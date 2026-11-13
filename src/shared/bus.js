(function () {
  if (!window.Store) {
    const mem = { local: Object.create(null), session: Object.create(null) };
    function make(kind) {
      return {
        getItem: function (key) { return Object.prototype.hasOwnProperty.call(mem[kind], key) ? mem[kind][key] : null; },
        setItem: function (key, value) { mem[kind][key] = String(value); },
        removeItem: function (key) { delete mem[kind][key]; }
      };
    }
    window.Store = { local: make("local"), session: make("session") };
  }
  let role = "";
  let peer = null;
  let conn = null;
  let hostIp = "";
  let port = 9100;
  let paired = false;
  let started = false;
  let closed = false;
  let seq = Number(Store.session.getItem("spc-cmd-seq") || "0") || 0;
  let onCommand = null;
  let pairWaiters = [];
  let peerReady = false;

  function peerId(_ip, nextPort) {
    // 本机启动；对方按页面展示的内网 IP + 端口连接。房间号只按端口区分。
    return "spckiosk" + String(nextPort || 9100);
  }

  function notifyPaired() {
    paired = true;
    pairWaiters.splice(0).forEach((fn) => {
      try { fn(); } catch (error) { /* ignore */ }
    });
  }

  function wireConn(connection) {
    conn = connection;
    connection.on("open", () => {
      notifyPaired();
      if (role === "client") {
        connection.send({ type: "pair", at: Date.now() });
      }
    });
    connection.on("data", (data) => {
      if (!data || typeof data !== "object") return;
      if (data.type === "pair") notifyPaired();
      if (data.type === "cmd" && onCommand) onCommand(data);
    });
    connection.on("close", () => {
      paired = false;
      if (conn === connection) conn = null;
      if (!closed && role === "client") {
        setTimeout(() => {
          if (!closed) clientConnect(hostIp, port).catch(() => {});
        }, 800);
      }
    });
    connection.on("error", () => {});
  }

  function destroyPeer() {
    const oldConn = conn;
    const oldPeer = peer;
    conn = null;
    peer = null;
    paired = false;
    try { if (oldConn) oldConn.close(); } catch (error) { /* ignore */ }
    try { if (oldPeer) oldPeer.destroy(); } catch (error) { /* ignore */ }
  }

  function keepHubAlive() {
    try { Store.session.setItem("spc-nav-keep-hub", "1"); } catch (error) { /* ignore */ }
  }

  function consumeKeepHub() {
    try {
      const keep = Store.session.getItem("spc-nav-keep-hub") === "1";
      Store.session.removeItem("spc-nav-keep-hub");
      return keep;
    } catch (error) {
      return false;
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (typeof Peer !== "undefined") {
        resolve();
        return;
      }
      const el = document.createElement("script");
      el.src = src;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error("PeerJS 加载失败"));
      document.head.appendChild(el);
    });
  }

  async function ensurePeerJs() {
    if (peerReady || typeof Peer !== "undefined") {
      peerReady = true;
      return;
    }
    const nested = /\/(en|zh|ops)(\/|$)/.test(location.pathname);
    await loadScript(nested ? "../shared/peerjs.min.js" : "shared/peerjs.min.js");
    peerReady = true;
  }

  function waitOpen(nextPeer, ms) {
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error("连接超时"));
      }, ms);
      nextPeer.on("open", () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      });
      nextPeer.on("error", (error) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  function isLanIp(ip) {
    const text = String(ip || "");
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(text)) return false;
    if (text.startsWith("127.") || text.startsWith("0.") || text.startsWith("169.254.")) return false;
    const parts = text.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    return false;
  }

  function pushIp(list, ip) {
    const text = String(ip || "").trim();
    if (!text || list.indexOf(text) >= 0) return;
    if (isLanIp(text) || (!text.startsWith("127.") && /^\d{1,3}(?:\.\d{1,3}){3}$/.test(text) && !text.startsWith("169.254."))) {
      list.push(text);
    }
  }

  async function ipsFromRtc() {
    const ips = [];
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun.cloudflare.com:3478" }
        ]
      });
      pc.createDataChannel("spc");
      await pc.setLocalDescription(await pc.createOffer());
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 900);
        pc.onicecandidate = (event) => {
          if (!event.candidate) {
            clearTimeout(timer);
            resolve();
            return;
          }
          if (event.candidate.address) pushIp(ips, event.candidate.address);
          const match = /([0-9]{1,3}(?:\.[0-9]{1,3}){3})/.exec(event.candidate.candidate || "");
          if (match) pushIp(ips, match[1]);
        };
      });
      try { pc.close(); } catch (error) { /* ignore */ }
    } catch (error) { /* ignore */ }
    return ips;
  }

  async function runCmd(command) {
    if (!(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke)) {
      return "";
    }
    return Promise.race([
      window.__TAURI__.core.invoke("run_command", { command: command }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 1800))
    ]);
  }

  async function ipsFromSystem() {
    const ips = [];
    const commands = [
      "ipconfig",
      "(Get-NetIPAddress -AddressFamily IPv4).IPAddress"
    ];
    for (let i = 0; i < commands.length; i += 1) {
      try {
        const output = await runCmd(commands[i]);
        String(output || "").replace(/\r/g, "\n").split("\n").forEach((line) => {
          const match = /([0-9]{1,3}(?:\.[0-9]{1,3}){3})/.exec(line);
          if (match) pushIp(ips, match[1]);
        });
        if (ips.filter(isLanIp).length) break;
      } catch (error) { /* try next */ }
    }
    return ips;
  }

  async function getLocalIps() {
    const merged = [];
    const collect = Promise.allSettled([
      ipsFromSystem(),
      ipsFromRtc()
    ]).then((results) => {
      results.forEach((result) => {
        if (result.status !== "fulfilled") return;
        (result.value || []).forEach((ip) => pushIp(merged, ip));
      });
      return merged;
    });
    await Promise.race([
      collect,
      new Promise((resolve) => setTimeout(resolve, 2200))
    ]);
    const lanOnly = merged.filter(isLanIp);
    return lanOnly.length ? lanOnly : merged.slice();
  }

  function primaryIp(ips) {
    const list = (ips || []).filter(isLanIp);
    if (!list.length) return "";
    return list.find((ip) => ip.startsWith("192.168.")) || list.find((ip) => ip.startsWith("10.")) || list[0];
  }

  function isIdTaken(error) {
    const text = String((error && (error.message || error.type)) || error || "").toLowerCase();
    return text.indexOf("taken") >= 0 || text.indexOf("unavailable-id") >= 0;
  }

  async function tryHostPeer(id) {
    destroyPeer();
    peer = new Peer(id, {
      debug: 0,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun.cloudflare.com:3478" }
        ]
      }
    });
    peer.on("connection", (connection) => wireConn(connection));
    peer.on("disconnected", () => {
      if (closed || !peer || peer.destroyed) return;
      try { peer.reconnect(); } catch (error) { /* ignore */ }
    });
    await waitOpen(peer, 6000);
  }

  async function hostStart(ip, nextPort, onProgress) {
    const progress = typeof onProgress === "function" ? onProgress : function () {};
    closed = false;
    role = "host";
    hostIp = String(ip || "127.0.0.1").trim();
    const startPort = Number(nextPort) || 9100;
    const maxPort = Math.min(startPort + 30, 65535);
    started = true;
    Store.local.setItem("kiosk-home-ip", hostIp);
    await ensurePeerJs();
    if (typeof Peer === "undefined") throw new Error("PeerJS 未加载");

    if (peer && !peer.destroyed && peer.open && role === "host" && peer.id === peerId(hostIp, port)) {
      return port;
    }

    destroyPeer();
    let lastError = null;

    for (let candidate = startPort; candidate <= maxPort && !closed; candidate += 1) {
      port = candidate;
      Store.local.setItem("kiosk-home-port", String(port));
      const id = peerId(hostIp, port);
      if (candidate === startPort) progress("正在启动服务…");
      else progress("端口 " + (candidate - 1) + " 占用，自动改用 " + candidate + "…");

      for (let attempt = 0; attempt < 2 && !closed; attempt += 1) {
        try {
          await tryHostPeer(id);
          return port;
        } catch (error) {
          lastError = error;
          destroyPeer();
          if (isIdTaken(error)) break;
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 350));
          }
        }
      }
    }

    if (isIdTaken(lastError)) {
      throw new Error("附近端口均被占用，请关闭其他首页窗口后再试");
    }
    const msg = lastError && lastError.message ? lastError.message : "首页服务启动失败";
    throw new Error(msg);
  }

  async function ensureHost() {
    const ip = Store.local.getItem("kiosk-home-ip") || hostIp || "127.0.0.1";
    const nextPort = Number(Store.local.getItem("kiosk-home-port")) || port || 9100;
    if (peer && !peer.destroyed && peer.open && role === "host") return;
    await hostStart(ip, nextPort);
  }

  async function clientConnect(ip, nextPort) {
    if (typeof Peer === "undefined") throw new Error("PeerJS 未加载");
    destroyPeer();
    role = "client";
    hostIp = String(ip || "").trim();
    port = Number(nextPort) || 9100;
    Store.local.setItem("kiosk-link", JSON.stringify({ host: hostIp, port: port }));
    peer = new Peer({
      debug: 0,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun.cloudflare.com:3478" }
        ]
      }
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("内容屏信令超时，请检查网络")), 20000);
      peer.on("open", () => {
        clearTimeout(timer);
        resolve();
      });
      peer.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    const connection = peer.connect(peerId(hostIp, port), { reliable: true });
    wireConn(connection);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("无法连接首页，请确认两台电脑在同一 WiFi，且首页已启动")), 25000);
      connection.on("open", () => {
        clearTimeout(timer);
        resolve();
      });
      connection.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    notifyPaired();
  }

  async function ensureClient() {
    const saved = JSON.parse(Store.local.getItem("kiosk-link") || "null");
    if (!saved || !saved.host) return;
    if (conn && conn.open) return;
    await clientConnect(saved.host, saved.port);
  }

  async function publish(command) {
    if (role === "host") await ensureHost();
    if (!conn || !conn.open) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("内容屏未连接")), 10000);
        waitPaired(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    if (!conn || !conn.open) throw new Error("内容屏未连接");
    seq += 1;
    Store.session.setItem("spc-cmd-seq", String(seq));
    const packet = { type: "cmd", seq: seq, command: String(command || ""), at: Date.now() };
    conn.send(packet);
    return packet;
  }

  function watch(apply) {
    onCommand = function (packet) {
      apply(packet);
    };
  }

  function waitPaired(fn) {
    if (paired) fn();
    else pairWaiters.push(fn);
  }

  function pairStatus() {
    return { started: started || !!Store.local.getItem("kiosk-home-ip"), paired: paired };
  }

  function disconnect() {
    closed = true;
    destroyPeer();
    started = false;
  }

  function onPageExit() {
    if (consumeKeepHub()) return;
    disconnect();
  }

  window.addEventListener("pagehide", onPageExit);
  window.addEventListener("beforeunload", onPageExit);
  try {
    if (window.__TAURI__ && window.__TAURI__.window && window.__TAURI__.window.getCurrentWindow) {
      window.__TAURI__.window.getCurrentWindow().onCloseRequested(() => {
        disconnect();
      });
    }
  } catch (error) { /* ignore */ }

  window.Bus = {
    getLocalIps: getLocalIps,
    primaryIp: primaryIp,
    hostStart: hostStart,
    ensureHost: ensureHost,
    clientConnect: clientConnect,
    ensureClient: ensureClient,
    publish: publish,
    watch: watch,
    waitPaired: waitPaired,
    pairStatus: pairStatus,
    keepHubAlive: keepHubAlive,
    disconnect: disconnect,
    getPort: function () { return port; },
    getHostIp: function () { return hostIp; }
  };
})();
