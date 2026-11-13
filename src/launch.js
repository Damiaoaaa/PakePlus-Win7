const ipEl = document.getElementById("ip");
const hintEl = document.getElementById("ip-hint");
const portEl = document.getElementById("tcp-port");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("start");
const refreshBtn = document.getElementById("refresh-ip");

const DEFAULT_PORT = 9100;
let activePort = Number(localStorage.getItem("kiosk-home-port")) || DEFAULT_PORT;
portEl.textContent = String(activePort);

let started = false;
let waiting = false;
let peerReady = false;

function isLanIp(ip) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) return false;
  if (ip.startsWith("127.") || ip.startsWith("0.") || ip.startsWith("169.254.")) return false;
  const parts = ip.split(".").map(Number);
  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

function currentIp() {
  return String(ipEl.value || "").trim();
}

function setActivePort(nextPort) {
  activePort = Number(nextPort) || DEFAULT_PORT;
  portEl.textContent = String(activePort);
  try {
    localStorage.setItem("kiosk-home-port", String(activePort));
  } catch (error) { /* ignore */ }
}

function rememberIp(ip) {
  displayHint(ip);
  try {
    localStorage.setItem("kiosk-home-ip", ip);
    localStorage.setItem("kiosk-home-port", String(activePort));
  } catch (error) { /* ignore */ }
}

function displayHint(ip, others) {
  if (ip && isLanIp(ip)) {
    hintEl.textContent = others && others.length
      ? ("内容屏请填写：" + ip + " 。其他网卡：" + others.join(" / "))
      : ("内容屏请填写：" + ip + " 和端口 " + activePort);
  } else {
    hintEl.textContent = "请填写局域网 IP（如 192.168.1.10），不要填 127.0.0.1";
  }
}

function assetUrl(rel) {
  try { return new URL(rel, location.href).href; } catch (error) { return rel; }
}

function loadScript(src) {
  const href = assetUrl(src);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="' + src + '"], script[src="' + href + '"]');
    if (existing) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = href;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("脚本加载失败: " + src));
    document.head.appendChild(el);
  });
}

async function ensureBus() {
  if (window.Bus) return window.Bus;
  await loadScript("./shared/bus.js");
  if (!window.Bus) throw new Error("通讯模块 Bus 未加载，请重新打包并确认包含 shared/bus.js");
  return window.Bus;
}

async function ensurePeer() {
  if (peerReady || typeof Peer !== "undefined") {
    peerReady = true;
    return;
  }
  await loadScript("./shared/peerjs.min.js");
  peerReady = true;
}

async function detectIp() {
  hintEl.textContent = "正在识别内网地址…";
  refreshBtn.disabled = true;
  try {
    const bus = await ensureBus();
    const ips = await Promise.race([
      bus.getLocalIps(),
      new Promise((resolve) => setTimeout(() => resolve([]), 2500))
    ]);
    const primary = bus.primaryIp(ips);
    if (primary) {
      ipEl.value = primary;
      rememberIp(primary);
      displayHint(primary, ips.filter((ip) => ip !== primary));
      if (started) {
        statusEl.textContent = "本机服务已启动。请让内容屏填写 " + primary + " / " + activePort;
      }
      return primary;
    }
  } catch (error) {
    /* ignore */
  } finally {
    refreshBtn.disabled = false;
  }

  const saved = localStorage.getItem("kiosk-home-ip") || "";
  if (isLanIp(saved) && !currentIp()) {
    ipEl.value = saved;
    displayHint(saved);
    hintEl.textContent = "未能自动识别，已填入上次地址，请核对或手动修改";
    return saved;
  }

  if (!currentIp()) {
    ipEl.placeholder = "例如 192.168.1.10";
    hintEl.textContent = "未自动识别到。请手动输入本机无线网卡 IPv4（运行 ipconfig 可查看）";
  }
  return currentIp();
}

function enterOps() {
  statusEl.textContent = "已连接内容屏，正在进入操作页…";
  if (window.Bus && typeof window.Bus.keepHubAlive === "function") window.Bus.keepHubAlive();
  location.href = "./ops/";
}

ipEl.addEventListener("input", () => {
  const ip = currentIp();
  if (isLanIp(ip)) {
    rememberIp(ip);
    if (started) {
      statusEl.textContent = "本机服务已启动。请让内容屏填写 " + ip + " / " + activePort;
    }
  }
});

refreshBtn.addEventListener("click", () => {
  detectIp();
});

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  refreshBtn.disabled = true;
  statusEl.textContent = "正在本机启动服务…";
  try {
    const bus = await ensureBus();
    await ensurePeer();
    const savedIp = currentIp() || localStorage.getItem("kiosk-home-ip") || "";
    const connectIp = isLanIp(savedIp) ? savedIp : (savedIp || "127.0.0.1");
    const detectPromise = detectIp().catch(() => currentIp());
    const usedPort = await bus.hostStart(connectIp, DEFAULT_PORT, (msg) => {
      statusEl.textContent = msg;
      const match = /改用\s+(\d+)/.exec(msg || "");
      if (match) setActivePort(match[1]);
    });
    setActivePort(usedPort || bus.getPort() || activePort);
    started = true;
    waiting = true;
    startBtn.textContent = "服务运行中";
    refreshBtn.disabled = false;
    await Promise.race([
      detectPromise,
      new Promise((resolve) => setTimeout(resolve, 800))
    ]);
    const ip = currentIp();
    if (isLanIp(ip)) {
      statusEl.textContent = "本机服务已启动。请让内容屏填写 " + ip + " / " + activePort;
      displayHint(ip);
    } else {
      statusEl.textContent = "本机服务已启动（端口 " + activePort + "）。请在上方手动填写内网 IP，再让内容屏照填。";
      ipEl.focus();
    }
    bus.waitPaired(() => {
      if (!waiting) return;
      waiting = false;
      enterOps();
    });
  } catch (error) {
    startBtn.disabled = false;
    refreshBtn.disabled = false;
    startBtn.textContent = "一键启动服务";
    statusEl.textContent = "启动失败：" + (error && error.message ? error.message : "未知错误");
  }
});
