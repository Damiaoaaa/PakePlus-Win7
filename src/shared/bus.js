(function () {
  let role = "";
  let peer = null;
  let conn = null;
  let hostIp = "";
  let port = 9100;
  let paired = false;
  let started = false;
  let closed = false;
  let suppressReconnect = 0;
  let seq = Number(sessionStorage.getItem("spc-cmd-seq") || "0") || 0;
  let onCommand = null;
  let pairWaiters = [];

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
      if (!closed && !suppressReconnect && role === "client") {
        setTimeout(() => {
          if (!closed) ensureClient().catch(() => {});
        }, 800);
      }
    });
    connection.on("error", () => {});
  }

  function destroyPeer() {
    suppressReconnect += 1;
    const oldConn = conn;
    const oldPeer = peer;
    conn = null;
    peer = null;
    paired = false;
    try { if (oldConn) oldConn.close(); } catch (error) { /* ignore */ }
    try { if (oldPeer) oldPeer.destroy(); } catch (error) { /* ignore */ }
    setTimeout(() => {
      suppressReconnect = Math.max(0, suppressReconnect - 1);
    }, 1200);
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
        const timer = setTimeout(resolve, 1500);
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
      pc.close();
    } catch (error) { /* ignore */ }
    return ips;
  }

  async function runCmd(command) {
    if (!(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke)) {
      return "";
    }
    return Promise.race([
      window.__TAURI__.core.invoke("run_command", { command: command }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000))
    ]);
  }

  async function ipsFromSystem() {
    const ips = [];
    const commands = [
      "ipconfig",
      "(Get-NetIPAddress -AddressFamily IPv4).IPAddress",
      "cmd /c ipconfig"
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
    try {
      (await ipsFromSystem()).forEach((ip) => pushIp(merged, ip));
    } catch (error) { /* ignore */ }
    if (!merged.filter(isLanIp).length) {
      try {
        (await ipsFromRtc()).forEach((ip) => pushIp(merged, ip));
      } catch (error) { /* ignore */ }
    }
    const lanOnly = merged.filter(isLanIp);
    return lanOnly.length ? lanOnly : merged;
  }

  function primaryIp(ips) {
    const list = (ips || []).filter(isLanIp);
    if (!list.length) return "";
    return list.find((ip) => ip.startsWith("192.168.")) || list.find((ip) => ip.startsWith("10.")) || list[0];
  }

  async function hostStart(ip, nextPort) {
    if (typeof Peer === "undefined") throw new Error("PeerJS 未加载");
    destroyPeer();
    role = "host";
    hostIp = String(ip || "").trim();
    port = Number(nextPort) || 9100;
    started = true;
    localStorage.setItem("kiosk-home-ip", hostIp);
    localStorage.setItem("kiosk-home-port", String(port));
    peer = new Peer(peerId(hostIp, port), {
      debug: 0,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun.cloudflare.com:3478" }
        ]
      }
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("首页信令超时，请检查网络")), 20000);
      peer.on("open", () => {
        clearTimeout(timer);
        resolve();
      });
      peer.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    peer.on("connection", (connection) => {
      wireConn(connection);
    });
  }

  async function ensureHost() {
    const ip = localStorage.getItem("kiosk-home-ip");
    const nextPort = Number(localStorage.getItem("kiosk-home-port")) || 9100;
    if (!ip) throw new Error("首页尚未启动");
    if (peer && !peer.destroyed && role === "host") return;
    await hostStart(ip, nextPort);
  }

  async function clientConnect(ip, nextPort) {
    if (typeof Peer === "undefined") throw new Error("PeerJS 未加载");
    destroyPeer();
    role = "client";
    hostIp = String(ip || "").trim();
    port = Number(nextPort) || 9100;
    localStorage.setItem("kiosk-link", JSON.stringify({ host: hostIp, port: port }));
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
    const saved = JSON.parse(localStorage.getItem("kiosk-link") || "null");
    if (!saved || !saved.host || closed) return;
    if (conn && conn.open) return;
    let lastError = null;
    for (let attempt = 0; attempt < 12 && !closed; attempt += 1) {
      try {
        await clientConnect(saved.host, saved.port);
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }
    if (lastError) throw lastError;
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
    sessionStorage.setItem("spc-cmd-seq", String(seq));
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
    return { started: started || !!localStorage.getItem("kiosk-home-ip"), paired: paired };
  }

  function disconnect() {
    closed = true;
    destroyPeer();
  }

  window.addEventListener("pagehide", disconnect);
  window.addEventListener("beforeunload", disconnect);
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
    getPort: function () { return port; },
    getHostIp: function () { return hostIp; }
  };
})();
