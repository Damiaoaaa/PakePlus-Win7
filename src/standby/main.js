(function () {
  const video = document.getElementById("home-video");

  async function playLoop() {
    if (!video) return;
    video.muted = true;
    video.loop = true;
    try {
      await video.play();
    } catch (error) {
      /* 自动播放被拦截时，等一下再试 */
      setTimeout(() => {
        video.play().catch(() => {});
      }, 400);
    }
  }

  if (window.Boot) {
    Boot.whenReady().then(playLoop);
  } else {
    playLoop();
  }

  Sync.watch((command) => {
    sessionStorage.setItem("cmd", command.seq);
    if (command.type === "home") {
      playLoop();
      return;
    }
    if (command.type === "list") {
      location.href = "../" + command.lang + "-list/?cat=" + encodeURIComponent(command.cat);
    }
  });
})();
