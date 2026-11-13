const lang = "en";
const cat = new URLSearchParams(location.search).get("cat") || "";

function onCommand(command) {
  Store.session.setItem("cmd", command.seq);
  if (command.type === "home") {
    Nav.go("../standby/index.html");
    return;
  }
  if (command.type === "lang") {
    if (command.lang === lang) return;
    Nav.go("../" + command.lang + "-list/index.html?cat=" + encodeURIComponent(cat));
    return;
  }
  if (command.lang === lang && command.cat === cat) return;
  Nav.go("../" + command.lang + "-list/index.html?cat=" + encodeURIComponent(command.cat));
}

function render() {
  const app = document.getElementById("app");
  const meta = Alumni.CATS.find((item) => item.key === cat);
  app.replaceChildren();
  if (!meta) {
    app.append(Object.assign(document.createElement("p"), { className: "status", textContent: Alumni.COPY[lang].empty }));
    return;
  }
  const scroller = document.createElement("div");
  scroller.className = "scroller";
  scroller.append(Alumni.heading(meta, lang));
  const intro = document.createElement("div");
  intro.className = "intro";
  Alumni.intro(cat, lang).forEach((text) => {
    intro.append(Object.assign(document.createElement("p"), { textContent: text }));
  });
  scroller.append(intro);
  const problem = Alumni.problem(lang);
  if (problem) {
    scroller.append(Object.assign(document.createElement("p"), { className: "status", textContent: problem }));
  } else {
    const rows = Alumni.people(cat, lang);
    if (!rows.length) {
      scroller.append(Object.assign(document.createElement("p"), { className: "status", textContent: Alumni.COPY[lang].empty }));
    }
    rows.forEach((person) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "card";
      const text = document.createElement("div");
      Alumni.fillIdentity(text, person, lang);
      card.append(Alumni.photoOf(person), text);
      card.addEventListener("click", () => {
        Nav.go("../" + lang + "-detail/index.html?cat=" + encodeURIComponent(cat) + "&id=" + encodeURIComponent(person.id));
      });
      scroller.append(card);
    });
    scroller.append(Object.assign(document.createElement("div"), { className: "end-space" }));
  }
  const back = Alumni.pill(Alumni.COPY[lang].back, "back", () => {
    Nav.go("../standby/index.html");
  });
  app.append(scroller, Alumni.mountRail(scroller), back);
  document.title = meta.en;
}

Alumni.load().then(render);
Sync.watch(onCommand);
