(function () {
  const standbyView = document.getElementById("standby-view");
  const app = document.getElementById("app");
  const video = document.getElementById("home-video");
  const fallback = document.getElementById("standby-fallback");

  let state = {
    view: "standby",
    lang: "zh",
    cat: "",
    id: ""
  };

  function asset(rel) {
    if (window.Nav && Nav.resolve) return Nav.resolve(rel);
    try { return new URL(rel, location.href.replace(/\\/g, "/")).href; } catch (error) { return rel; }
  }

  function setLangClass(lang) {
    app.classList.remove("lang-en", "lang-zh");
    app.classList.add(lang === "zh" ? "lang-zh" : "lang-en");
  }

  function showStandby() {
    state.view = "standby";
    standbyView.hidden = false;
    app.hidden = true;
    app.replaceChildren();
    playVideo();
  }

  function showApp(mode) {
    standbyView.hidden = true;
    app.hidden = false;
    app.classList.remove("view-list", "view-detail");
    app.classList.add(mode === "detail" ? "view-detail" : "view-list");
    if (video) {
      try { video.pause(); } catch (error) { /* ignore */ }
    }
  }

  function hideFallback() {
    if (fallback) fallback.hidden = true;
  }

  function showFallback(text) {
    if (!fallback) return;
    fallback.hidden = false;
    fallback.textContent = text || "待机画面暂时无法播放";
  }

  function playVideo() {
    if (!video) return;
    const urls = [
      asset("../assets/standby.mp4"),
      asset("./../assets/standby.mp4")
    ].filter(function (url, index, all) { return all.indexOf(url) === index; });

    let i = 0;
    function tryNext() {
      if (i >= urls.length) {
        showFallback("找不到待机视频 assets/standby.mp4");
        return;
      }
      const url = urls[i++];
      const onError = function () {
        video.removeEventListener("error", onError);
        tryNext();
      };
      video.addEventListener("error", onError);
      video.addEventListener("loadeddata", function () {
        video.removeEventListener("error", onError);
        video.muted = true;
        video.loop = true;
        video.play().then(hideFallback).catch(function () {
          showFallback("点击屏幕开始播放");
          const once = function () {
            document.removeEventListener("pointerdown", once, true);
            video.play().then(hideFallback).catch(function () {
              showFallback("待机视频无法播放");
            });
          };
          document.addEventListener("pointerdown", once, true);
        });
      }, { once: true });
      video.src = url;
      video.load();
    }
    hideFallback();
    tryNext();
  }

  function renderList() {
    const lang = state.lang;
    const cat = state.cat;
    const meta = Alumni.CATS.find(function (item) { return item.key === cat; });
    setLangClass(lang);
    showApp("list");
    app.replaceChildren();
    if (!meta) {
      app.append(Object.assign(document.createElement("p"), {
        className: "status",
        textContent: Alumni.COPY[lang].empty
      }));
      return;
    }

    const scroller = document.createElement("div");
    scroller.className = "scroller";
    scroller.append(Alumni.heading(meta, lang));
    const intro = document.createElement("div");
    intro.className = "intro";
    Alumni.intro(cat, lang).forEach(function (text) {
      intro.append(Object.assign(document.createElement("p"), { textContent: text }));
    });
    scroller.append(intro);

    const problem = Alumni.problem(lang);
    if (problem) {
      scroller.append(Object.assign(document.createElement("p"), { className: "status", textContent: problem }));
    } else {
      const rows = Alumni.people(cat, lang);
      if (!rows.length) {
        scroller.append(Object.assign(document.createElement("p"), {
          className: "status",
          textContent: Alumni.COPY[lang].empty
        }));
      }
      rows.forEach(function (person) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "card";
        const text = document.createElement("div");
        Alumni.fillIdentity(text, person, lang);
        card.append(Alumni.photoOf(person), text);
        card.addEventListener("click", function () {
          state.id = String(person.id);
          state.view = "detail";
          renderDetail();
        });
        scroller.append(card);
      });
      scroller.append(Object.assign(document.createElement("div"), { className: "end-space" }));
    }

    const back = Alumni.pill(Alumni.COPY[lang].back, "back", function () {
      showStandby();
    });
    app.append(scroller, Alumni.mountRail(scroller), back);
    document.title = lang === "zh" ? meta.zh : meta.en;
  }

  function renderDetail() {
    const lang = state.lang;
    const cat = state.cat;
    const id = state.id;
    const meta = Alumni.CATS.find(function (item) { return item.key === cat; });
    const rows = meta ? Alumni.people(cat, lang) : [];
    const index = rows.findIndex(function (person) { return String(person.id) === String(id); });
    const person = rows[index];
    setLangClass(lang);
    showApp("detail");
    app.replaceChildren();

    const prev = Alumni.arrow("prev", lang === "zh" ? "上一位" : "Previous", function () {
      if (index > 0) {
        state.id = String(rows[index - 1].id);
        renderDetail();
      }
    });
    const next = Alumni.arrow("next", lang === "zh" ? "下一位" : "Next", function () {
      if (index >= 0 && index < rows.length - 1) {
        state.id = String(rows[index + 1].id);
        renderDetail();
      }
    });
    prev.disabled = index <= 0;
    next.disabled = index < 0 || index >= rows.length - 1;

    const wrap = document.createElement("div");
    wrap.className = "sheet-wrap";
    const sheet = document.createElement("div");
    sheet.className = "sheet";
    if (!meta || !person) {
      sheet.append(Object.assign(document.createElement("p"), {
        className: "status",
        textContent: Alumni.COPY[lang].empty
      }));
      document.title = meta ? (lang === "zh" ? meta.zh : meta.en) : "详情";
    } else {
      const who = document.createElement("div");
      who.className = "who";
      const text = document.createElement("div");
      const name = Alumni.fillIdentity(text, person, lang);
      who.append(Alumni.photoOf(person, { preferVideo: true }), text);
      const bio = document.createElement("div");
      bio.className = "bio";
      Alumni.fillBio(bio, lang === "zh" ? person.chi_desc : person.eng_desc);
      sheet.append(who, bio);
      document.title = name.textContent;
    }
    wrap.append(sheet, Alumni.mountRail(sheet));

    const back = Alumni.pill(Alumni.COPY[lang].back, "back", function () {
      state.view = "list";
      renderList();
    });
    const toHome = Alumni.pill(Alumni.COPY[lang].home, "home", function () {
      showStandby();
    });
    const title = meta
      ? Alumni.heading(meta, lang)
      : Object.assign(document.createElement("h1"), { className: "title" });
    app.append(prev, next, title, wrap, back, toHome);
  }

  function openList(lang, cat) {
    state.lang = lang === "en" ? "en" : "zh";
    state.cat = cat || "";
    state.id = "";
    state.view = "list";
    Alumni.load().then(renderList);
  }

  function onCommand(command) {
    if (window.Store) Store.session.setItem("cmd", command.seq);
    if (command.type === "home") {
      showStandby();
      return;
    }
    if (command.type === "lang") {
      if (state.view === "standby") return;
      state.lang = command.lang === "en" ? "en" : "zh";
      if (state.view === "detail" && state.id) renderDetail();
      else if (state.cat) renderList();
      return;
    }
    if (command.type === "list") {
      openList(command.lang, command.cat);
    }
  }

  document.addEventListener("contextmenu", function (event) { event.preventDefault(); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "f" || event.key === "F") {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    }
  });

  // boot
  showStandby();
  Alumni.load().catch(function () {});
  if (window.Sync && typeof Sync.watch === "function") {
    Sync.watch(onCommand);
  } else {
    showFallback("同步模块未加载");
  }
})();
