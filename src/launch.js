const hostEl = document.getElementById("host");
const portEl = document.getElementById("port");
const statusEl = document.getElementById("status");
const connectBtn = document.getElementById("connect");
const boot = document.getElementById("boot");
const bootText = document.getElementById("boot-text");

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

try {
  const saved = JSON.parse(Store.local.getItem("kiosk-link") || "null");
  hostEl.value = (saved && saved.host) || FIXED_HOST;
  portEl.value = (saved && saved.port) || PORT_MIN;
} catch (error) {
  hostEl.value = FIXED_HOST;
  portEl.value = PORT_MIN;
}

if (!hostEl.value.trim()) hostEl.value = FIXED_HOST;
if (!portEl.value) portEl.value = PORT_MIN;

const words = {
  checking: "正在检查更新",
  updating: "正在更新资料",
  ready: "更新完成，正在进入视频首页…",
  error: "资料暂时无法更新，将使用本地资料进入…"
};

let connecting = false;

function showBoot(text) {
  boot.hidden = false;
  boot.classList.add("show");
  bootText.textContent = text || words.checking;
}

function hideBoot() {
  boot.classList.remove("show");
  boot.hidden = true;
}

function assetUrl(rel) {
  if (window.Nav && Nav.resolve) return Nav.resolve(rel);
  try { return new URL(rel, location.href.replace(/\\/g, "/")).href; } catch (error) { return rel; }
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
  if (!window.Bus) throw new Error("通讯模块 Bus 未加载");
  return window.Bus;
}

async function ensurePeer() {
  if (typeof Peer !== "undefined") return;
  await loadScript("./shared/peerjs.min.js");
}

function goKiosk() {
  if (window.Bus && typeof Bus.keepAlive === "function") {
    try { Bus.keepAlive(); } catch (error) { /* ignore */ }
  }
  if (window.Nav && Nav.go) Nav.go("./kiosk/index.html");
  else location.assign(assetUrl("./kiosk/index.html"));
}

async function runUpdateThenGo() {
  showBoot(words.checking);
  let result = { phase: "error" };
  try {
    result = await Promise.race([
      Update.refresh((phase) => {
        bootText.textContent = words[phase] || "正在准备…";
      }),
      new Promise((resolve) => setTimeout(() => resolve({ phase: "error" }), 20000))
    ]);
  } catch (error) {
    result = { phase: "error" };
  }
  if (window.Update && typeof Update.markChecked === "function") {
    try { Update.markChecked((result && result.payload && (result.payload.last_update_at + "|" + result.payload.total_records)) || "1"); } catch (error) { /* ignore */ }
  }
  bootText.textContent = result && result.phase === "error" ? words.error : words.ready;
  await new Promise((resolve) => setTimeout(resolve, 350));
  goKiosk();
}

async function connectNow(auto) {
  if (connecting) return;
  connecting = true;

  const host = (hostEl.value.trim() || FIXED_HOST);
  const preferred = Number(portEl.value) || PORT_MIN;
  hostEl.value = host;
  portEl.value = preferred;

  connectBtn.disabled = true;
  statusEl.textContent = auto
    ? ("正在自动连接 " + host + "（端口 " + PORT_MIN + "-" + PORT_MAX + "）…")
    : "正在连接首页服务…";

  try {
    const bus = await ensureBus();
    await ensurePeer();
    const usedPort = typeof bus.clientConnectRange === "function"
      ? await bus.clientConnectRange(host, PORT_MIN, PORT_MAX, (msg) => {
          statusEl.textContent = msg;
        })
      : (await bus.clientConnect(host, preferred), preferred);
    portEl.value = usedPort;
    statusEl.textContent = "连接成功（" + host + ":" + usedPort + "），开始检查更新…";
    await runUpdateThenGo();
  } catch (error) {
    connectBtn.disabled = false;
    hideBoot();
    statusEl.textContent = "连接失败：" + (error && error.message ? error.message : "请确认首页服务已启动");
    if (auto) {
      // 首页可能稍晚启动，稍后自动重试
      setTimeout(() => {
        connecting = false;
        connectNow(true);
      }, 2500);
      return;
    }
  } finally {
    connecting = false;
  }
}

hideBoot();

connectBtn.addEventListener("click", () => {
  connectNow(false);
});

// 打开系统后自动连接固定内网
connectNow(true);
