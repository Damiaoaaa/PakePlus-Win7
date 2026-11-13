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

try {
  const saved = JSON.parse(Store.local.getItem("kiosk-link") || "null");
  if (saved && saved.host) hostEl.value = saved.host;
  if (saved && saved.port) portEl.value = saved.port;
} catch (error) { /* ignore */ }

const words = {
  checking: "正在检查更新",
  updating: "正在更新资料",
  ready: "更新完成，正在进入视频首页…",
  error: "资料暂时无法更新，将使用本地资料进入…"
};

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

function goStandby() {
  if (window.Nav && Nav.go) Nav.go("./standby/index.html");
  else location.assign(assetUrl("./standby/index.html"));
}

async function runUpdateThenGo() {
  showBoot(words.checking);
  let result = { phase: "error" };
  try {
    result = await Promise.race([
      Update.refresh((phase) => {
        bootText.textContent = words[phase] || "正在准备…";
      }),
      new Promise((resolve) => setTimeout(() => resolve({ phase: "error" }), 15000))
    ]);
  } catch (error) {
    result = { phase: "error" };
  }
  bootText.textContent = result && result.phase === "error" ? words.error : words.ready;
  await new Promise((resolve) => setTimeout(resolve, 350));
  goStandby();
}

hideBoot();

connectBtn.addEventListener("click", async () => {
  const host = hostEl.value.trim();
  const port = Number(portEl.value);
  if (!host || !port) {
    statusEl.textContent = "请填写首页显示的内网地址和端口";
    return;
  }
  if (host === "127.0.0.1" || host === "localhost") {
    statusEl.textContent = "请填写首页展示的内网 IP（如 192.168.x.x），不要填 127.0.0.1";
    return;
  }

  connectBtn.disabled = true;
  statusEl.textContent = "正在连接首页服务…";

  try {
    const bus = await ensureBus();
    await ensurePeer();
    await bus.clientConnect(host, port);
    statusEl.textContent = "连接成功，开始检查更新…";
    await runUpdateThenGo();
  } catch (error) {
    connectBtn.disabled = false;
    hideBoot();
    statusEl.textContent = "连接失败：" + (error && error.message ? error.message : "请检查地址、端口与 WiFi");
  }
});
