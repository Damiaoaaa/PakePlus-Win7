const CATS = [
  // 热区按 zh/20.png 实测对齐（此前整体下偏一格，点士会落到工）
  { key: "learnedmen", label: "士", y: 19.0, h: 10.8 },
  { key: "teachers", label: "師", y: 30.72, h: 10.78 },
  { key: "artists", label: "藝", y: 42.63, h: 10.5 },
  { key: "craftspeople", label: "工", y: 53.4, h: 10.78 },
  { key: "merchants", label: "商", y: 65.24, h: 10.78 }
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof Peer !== "undefined") {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("PeerJS load failed"));
    document.head.appendChild(el);
  });
}

function send(body) {
  Bus.publish(body).catch(() => {});
}

function hit(label, x, y, w, h, onClick) {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", label);
  el.style.left = x + "%";
  el.style.top = y + "%";
  el.style.width = w + "%";
  el.style.height = h + "%";
  el.addEventListener("click", onClick);
  return el;
}

const hits = document.getElementById("hits");
hits.append(hit("主頁", 3.7, 1.4, 10.4, 3.1, () => send("home")));
hits.append(hit("English", 90.6, 1.6, 5.5, 3.1, () => {
  send("lang en");
  Nav.go("../en/index.html");
}));
CATS.forEach((cat) => {
  hits.append(hit(cat.label, 10.86, cat.y, 79.14, cat.h, () => send("list zh " + cat.key)));
});

document.addEventListener("contextmenu", (event) => event.preventDefault());
if (window.Fullscreen && typeof Fullscreen.enter === "function") {
  Fullscreen.enter();
}

loadScript("../shared/peerjs.min.js")
  .then(() => Bus.ensureHost())
  .catch(() => {});
