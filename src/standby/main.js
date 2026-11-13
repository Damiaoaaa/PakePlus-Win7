(function () {
  const video = document.getElementById("home-video");
  const fallback = document.getElementById("standby-fallback");

  function asset(rel) {
    if (window.Nav && Nav.resolve) return Nav.resolve(rel);
    try { return new URL(rel, location.href).href; } catch (error) { return rel; }
  }

  function showFallback(text) {
    if (!fallback) return;
    fallback.hidden = false;
    fallback.textContent = text || "待机画面暂时无法播放";
  }

  async function playLoop() {
    if (!video) return;
    if (!video.getAttribute("src")) {
      video.src = asset("../assets/standby.mp4");
    }
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    try {
      await video.play();
      if (fallback) fallback.hidden = true;
    } catch (error) {
      showFallback("点击屏幕开始播放待机视频");
      const once = () => {
        document.removeEventListener("pointerdown", once, true);
        video.play().then(() => {
          if (fallback) fallback.hidden = true;
        }).catch(() => showFallback("待机视频无法播放，请检查 assets/standby.mp4"));
      };
      document.addEventListener("pointerdown", once, true);
    }
  }

  video.addEventListener("error", () => {
    showFallback("找不到待机视频 assets/standby.mp4");
  });

  playLoop();

  if (window.Sync && typeof Sync.watch === "function") {
    Sync.watch((command) => {
      if (window.Store) Store.session.setItem("cmd", command.seq);
      if (command.type === "home") {
        playLoop();
        return;
      }
      if (command.type === "list") {
        Nav.go("../" + command.lang + "-list/index.html?cat=" + encodeURIComponent(command.cat));
      }
    });
  }
})();
