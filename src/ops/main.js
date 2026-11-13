const EN = {
  lang: "en",
  svg: "../en/17.svg",
  homeLabel: "HOME",
  switchLabel: "中文",
  switchX: 83.7,
  switchW: 5.6,
  homeX: 3.7,
  homeW: 10.4,
  homeY: 1.4,
  homeH: 3.1,
  cats: [
    { key: "learnedmen", label: "Learned Men", y: 22.65, h: 11.98 },
    { key: "teachers", label: "Teachers", y: 34.57, h: 10.78 },
    { key: "artists", label: "Artists", y: 46.48, h: 10.73 },
    { key: "craftspeople", label: "Craftpeople", y: 57.17, h: 10.78 },
    { key: "merchants", label: "Merchants", y: 69.09, h: 10.78 }
  ],
  catX: 10.8,
  catW: 79.17
};

const ZH = {
  lang: "zh",
  svg: "../zh/20.svg",
  homeLabel: "主頁",
  switchLabel: "English",
  switchX: 90.6,
  switchW: 5.5,
  homeX: 3.7,
  homeW: 10.4,
  homeY: 1.4,
  homeH: 3.1,
  cats: [
    { key: "learnedmen", label: "士", y: 22.65, h: 11.98 },
    { key: "teachers", label: "師", y: 34.57, h: 10.78 },
    { key: "artists", label: "藝", y: 46.48, h: 10.73 },
    { key: "craftspeople", label: "工", y: 57.17, h: 10.78 },
    { key: "merchants", label: "商", y: 69.09, h: 10.78 }
  ],
  catX: 10.8,
  catW: 79.17
};

const img = document.getElementById("home");
const hits = document.getElementById("hits");
let current = Store.session.getItem("spc-ops-lang") === "zh" ? ZH : EN;

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
  img.src = current.svg;
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
document.addEventListener("keydown", (event) => {
  if (event.key === "f" || event.key === "F") {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  }
});

render();
Bus.ensureHost().catch(() => {});
