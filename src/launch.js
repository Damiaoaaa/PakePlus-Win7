const ipEl = document.getElementById("ip");
const hintEl = document.getElementById("ip-hint");
const portEl = document.getElementById("tcp-port");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("start");
const refreshBtn = document.getElementById("refresh-ip");

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

const FIXED_HOST = (window.Bus && Bus.FIXED_HOST) || "10.124.19.128";
const PORT_MIN = (window.Bus && Bus.PORT_MIN) || 9100;
const PORT_MAX = (window.Bus && Bus.PORT_MAX) || 9199;
const DEFAULT_PORT = PORT_MIN;

let activePort = Number(Store.local.getItem("kiosk-home-port")) || DEFAULT_PORT;
if (activePort < PORT_MIN || activePort > PORT_MAX) activePort = DEFAULT_PORT;
portEl.textContent = String(activePort);

let started = false;
let waiting = false;
let peerReady = false;
let starting = false;

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
  return String(ipEl.value || "").trim() || FIXED_HOST;
}

function setActivePort(nextPort) {
  activePort = Number(nextPort) || DEFAULT_PORT;
  if (activePort < PORT_MIN || activePort > PORT_MAX) activePort = DEFAULT_PORT;
  portEl.textContent = String(activePort);
  try {
    Store.local.setItem("kiosk-home-port", String(activePort));
  } catch (error) { /* ignore */ }
}

function rememberIp(ip) {
  const value = isLanIp(ip) ? ip : FIXED_HOST;
  displayHint(value);
  try {
    Store.local.setItem("kiosk-home-ip", value);
    Store.local.setItem("kiosk-home-port", String(activePort));
  } catch (error) { /* ignore */ }
}

function displayHint(ip) {
  const value = ip || FIXED_HOST;
  hintEl.textContent = "固定内网 " + value + "，端口范围 " + PORT_MIN + "-" + PORT_MAX + "（当前 " + activePort + "）";
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="' + src + '"]')) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("脚本加载失败: " + src));
    document.head.appendChild(el);
  });
}

async function ensurePeer() {
  if (peerReady || typeof Peer !== "undefined") {
    peerReady = true;
    return;
  }
  await loadScript("shared/peerjs.min.js");
  peerReady = true;
}

function enterOps() {
  statusEl.textContent = "已连接内容屏，正在进入操作页…";
  Bus.keepHubAlive();
  Nav.go("./ops/index.html");
}

async function startService() {
  if (starting || started) return;
  starting = true;
  startBtn.disabled = true;
  if (refreshBtn) refreshBtn.disabled = true;
  statusEl.textContent = "正在启动固定内网服务…";

  try {
    await ensurePeer();
    const connectIp = FIXED_HOST;
    ipEl.value = connectIp;
    rememberIp(connectIp);

    const usedPort = await Bus.hostStart(connectIp, PORT_MIN, (msg) => {
      statusEl.textContent = msg;
      const match = /改用\s+(\d+)/.exec(msg || "");
      if (match) setActivePort(match[1]);
    });
    setActivePort(usedPort || Bus.getPort() || activePort);
    started = true;
    waiting = true;
    startBtn.textContent = "服务运行中";
    if (refreshBtn) refreshBtn.disabled = false;
    displayHint(connectIp);
    statusEl.textContent = "服务已启动。固定地址 " + connectIp + " / " + activePort + "，等待内容屏自动连接…";

    Bus.waitPaired(() => {
      if (!waiting) return;
      waiting = false;
      enterOps();
    });
  } catch (error) {
    started = false;
    startBtn.disabled = false;
    if (refreshBtn) refreshBtn.disabled = false;
    startBtn.textContent = "重新启动服务";
    statusEl.textContent = "启动失败：" + (error && error.message ? error.message : "未知错误");
  } finally {
    starting = false;
  }
}

ipEl.value = FIXED_HOST;
rememberIp(FIXED_HOST);
displayHint(FIXED_HOST);

ipEl.addEventListener("input", () => {
  const ip = currentIp();
  if (isLanIp(ip)) {
    rememberIp(ip);
    if (started) {
      statusEl.textContent = "本机服务已启动。内容屏请连 " + ip + " / " + activePort;
    }
  }
});

if (refreshBtn) {
  refreshBtn.addEventListener("click", () => {
    ipEl.value = FIXED_HOST;
    rememberIp(FIXED_HOST);
    displayHint(FIXED_HOST);
    statusEl.textContent = "已恢复固定地址 " + FIXED_HOST;
  });
}

startBtn.addEventListener("click", () => {
  started = false;
  startService();
});

// 打开系统后自动启动服务并等待连接
startService();
