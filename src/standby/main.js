(function () {
  const video = document.getElementById("home-video");
  const fallback = document.getElementById("standby-fallback");

  function asset(rel) {
    if (window.Nav && Nav.resolve) return Nav.resolve(rel);
    try { return new URL(rel, location.href.replace(/\\/g, "/")).href; } catch (error) { return rel; }
  }

  function hideFallback() {
    if (fallback) fallback.hidden = true;
  }

  function showFallback(text) {
    if (!fallback) return;
    fallback.hidden = false;
    fallback.textContent = text || "待机画面暂时无法播放";
  }

  function candidateUrls() {
    const rels = [
      "../assets/standby.mp4",
      "./../assets/standby.mp4",
      "../../assets/standby.mp4",
      "assets/standby.mp4"
    ];
    const urls = [];
    rels.forEach((rel) => {
      const url = asset(rel);
      if (urls.indexOf(url) < 0) urls.push(url);
    });
    return urls;
  }

  function tryPlay() {
    if (!video) return Promise.resolve();
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    return video.play().then(hideFallback);
  }

  function loadVideo(urls, index) {
    const i = index || 0;
    if (!video) return;
    if (i >= urls.length) {
      showFallback("找不到待机视频，请检查 assets/standby.mp4");
      return;
    }
    const url = urls[i];
    const onError = () => {
      video.removeEventListener("error", onError);
      loadVideo(urls, i + 1);
    };
    const onReady = () => {
      video.removeEventListener("error", onError);
      tryPlay().catch(() => {
        showFallback("点击屏幕开始播放");
        const once = () => {
          document.removeEventListener("pointerdown", once, true);
          tryPlay().catch(() => showFallback("待机视频无法自动播放"));
        };
        document.addEventListener("pointerdown", once, true);
      });
    };
    video.addEventListener("error", onError);
    video.addEventListener("loadeddata", onReady, { once: true });
    video.src = url;
    video.load();
  }

  function playLoop() {
    hideFallback();
    loadVideo(candidateUrls(), 0);
  }

  playLoop();

  function goList(command) {
    const target = "../" + command.lang + "-list/index.html?cat=" + encodeURIComponent(command.cat);
    if (window.Nav && Nav.go) Nav.go(target);
    else location.assign(asset(target));
  }

  if (window.Sync && typeof Sync.watch === "function") {
    Sync.watch((command) => {
      if (window.Store) Store.session.setItem("cmd", command.seq);
      if (command.type === "home") {
        playLoop();
        return;
      }
      if (command.type === "list") goList(command);
    });
  } else {
    showFallback("同步模块未加载，无法接收控制端指令");
  }
})();
