const lang = "zh";
const params = new URLSearchParams(location.search);
const cat = params.get("cat") || "";
const id = params.get("id") || "";

function onCommand(command) {
  if (Store.session.getItem("cmd") === command.seq) return;
  Store.session.setItem("cmd", command.seq);
  if (command.type === "home") {
    location.href = "../standby/index.html";
    return;
  }
  if (command.type === "lang") {
    if (command.lang === lang) return;
    location.href = "../" + command.lang + "-detail/index.html?cat=" + encodeURIComponent(cat) + "&id=" + encodeURIComponent(id);
    return;
  }
  location.href = "../" + command.lang + "-list/index.html?cat=" + encodeURIComponent(command.cat);
}

function render() {
  const app = document.getElementById("app");
  const meta = Alumni.CATS.find((item) => item.key === cat);
  const rows = meta ? Alumni.people(cat, lang) : [];
  const index = rows.findIndex((person) => String(person.id) === String(id));
  const person = rows[index];
  app.replaceChildren();
  const prev = Alumni.arrow("prev", "上一位", () => {
    if (index > 0) location.href = "../zh-detail/index.html?cat=" + encodeURIComponent(cat) + "&id=" + encodeURIComponent(rows[index - 1].id);
  });
  const next = Alumni.arrow("next", "下一位", () => {
    if (index >= 0 && index < rows.length - 1) {
      location.href = "../zh-detail/index.html?cat=" + encodeURIComponent(cat) + "&id=" + encodeURIComponent(rows[index + 1].id);
    }
  });
  prev.disabled = index <= 0;
  next.disabled = index < 0 || index >= rows.length - 1;
  const wrap = document.createElement("div");
  wrap.className = "sheet-wrap";
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  if (!meta || !person) {
    sheet.append(Object.assign(document.createElement("p"), { className: "status", textContent: Alumni.COPY[lang].empty }));
    document.title = meta ? meta.zh : "详情";
  } else {
    const who = document.createElement("div");
    who.className = "who";
    const text = document.createElement("div");
    const name = Alumni.fillIdentity(text, person, lang);
    who.append(Alumni.photoOf(person, { preferVideo: true }), text);
    const bio = document.createElement("div");
    bio.className = "bio";
    Alumni.fillBio(bio, person.chi_desc);
    sheet.append(who, bio);
    document.title = name.textContent;
  }
  wrap.append(sheet, Alumni.mountRail(sheet));
  const back = Alumni.pill(Alumni.COPY[lang].back, "back", () => {
    location.href = "../zh-list/index.html?cat=" + encodeURIComponent(cat);
  });
  const toHome = Alumni.pill(Alumni.COPY[lang].home, "home", () => { location.href = "../standby/index.html"; });
  const title = meta ? Alumni.heading(meta, lang) : Object.assign(document.createElement("h1"), { className: "title" });
  app.append(prev, next, title, wrap, back, toHome);
}

Alumni.load().then(render);
Sync.watch(onCommand);
