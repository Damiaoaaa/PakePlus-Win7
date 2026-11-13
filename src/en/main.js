const CATS = [
  { key: "learnedmen", label: "Learned Men", y: 22.65, h: 11.98 },
  { key: "teachers", label: "Teachers", y: 34.57, h: 10.78 },
  { key: "artists", label: "Artists", y: 46.48, h: 10.73 },
  { key: "craftspeople", label: "Craftpeople", y: 57.17, h: 10.78 },
  { key: "merchants", label: "Merchants", y: 69.09, h: 10.78 }
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
hits.append(hit("HOME", 3.7, 1.4, 10.4, 3.1, () => send("home")));
hits.append(hit("中文", 83.7, 1.6, 5.6, 3.1, () => {
  send("lang zh");
  location.href = "../zh/";
}));
CATS.forEach((cat) => {
  hits.append(hit(cat.label, 10.8, cat.y, 79.17, cat.h, () => send("list en " + cat.key)));
});

document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("keydown", (event) => {
  if (event.key === "f" || event.key === "F") {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  }
});

loadScript("../shared/peerjs.min.js")
  .then(() => Bus.ensureHost())
  .catch(() => {});
