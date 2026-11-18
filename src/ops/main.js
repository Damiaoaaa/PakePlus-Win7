const EN = {
  lang: "en",
  svg: "../en/17.png",
  homeLabel: "HOME",
  switchLabel: "中文",
  switchX: 83.7,
  switchW: 5.6,
  homeX: 3.7,
  homeW: 10.4,
  homeY: 1.4,
  homeH: 3.1,
  cats: [
    { key: "learnedmen", label: "Learned Men", y: 21.14, h: 11.98 },
    { key: "teachers", label: "Teachers", y: 33.06, h: 10.76 },
    { key: "artists", label: "Artists", y: 44.97, h: 10.76 },
    { key: "craftspeople", label: "Craftpeople", y: 55.66, h: 10.75 },
    { key: "merchants", label: "Merchants", y: 67.58, h: 10.76 }
  ],
  catX: 10.86,
  catW: 79.14
};

const ZH = {
  lang: "zh",
  svg: "../zh/20.png",
  homeLabel: "主頁",
  switchLabel: "English",
  switchX: 90.6,
  switchW: 5.5,
  homeX: 3.7,
  homeW: 10.4,
  homeY: 1.4,
  homeH: 3.1,
  cats: [
    // 热区按 zh/20.png 实测对齐（此前整体下偏一格）
    { key: "learnedmen", label: "士", y: 19.0, h: 10.8 },
    { key: "teachers", label: "師", y: 30.72, h: 10.78 },
    { key: "artists", label: "藝", y: 42.63, h: 10.5 },
    { key: "craftspeople", label: "工", y: 53.4, h: 10.78 },
    { key: "merchants", label: "商", y: 65.24, h: 10.78 }
  ],
  catX: 10.86,
  catW: 79.14
};

const img = document.getElementById("home");
const hits = document.getElementById("hits");
let current = Store.session.getItem("spc-ops-lang") === "zh" ? ZH : EN;

function assetUrl(rel) {
  try { return new URL(rel, location.href).href; } catch (error) { return rel; }
}

function send(body) {
  return Bus.publish(body).catch(() => {});
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

function render() {
  img.src = assetUrl(current.svg);
  img.alt = current.lang === "zh" ? "中文首页" : "English home";
  document.documentElement.lang = current.lang === "zh" ? "zh-Hant" : "en";
  hits.replaceChildren();
  hits.append(hit(current.homeLabel, current.homeX, current.homeY, current.homeW, current.homeH, () => { send("home"); }));
  hits.append(hit(current.switchLabel, current.switchX, 1.6, current.switchW, 3.1, () => {
    const next = current.lang === "en" ? ZH : EN;
    current = next;
    Store.session.setItem("spc-ops-lang", next.lang);
    render();
    send("lang " + next.lang);
  }));
  current.cats.forEach((cat) => {
    hits.append(hit(cat.label, current.catX, cat.y, current.catW, cat.h, () => {
      send("list " + current.lang + " " + cat.key);
    }));
  });
}

document.addEventListener("contextmenu", (event) => event.preventDefault());
if (window.Fullscreen && typeof Fullscreen.enter === "function") {
  Fullscreen.enter();
}

img.onerror = function () {
  document.body.style.background = "#071633";
  console.error("ops svg failed", img.src);
};

render();
if (window.Bus && typeof Bus.ensureHost === "function") {
  Bus.ensureHost().catch((error) => console.error("ensureHost", error));
}
