(function () {
  var DESIGN_W = 1080;
  var DESIGN_H = 1920;

  function isFull() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function requestDomFullscreen() {
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!req) return Promise.resolve(false);
    try {
      var result = req.call(el);
      return Promise.resolve(result).then(function () { return true; }).catch(function () { return false; });
    } catch (error) {
      return Promise.resolve(false);
    }
  }

  function screenSize() {
    var s = window.screen || {};
    var w = Math.max(s.width || 0, s.availWidth || 0, DESIGN_W);
    var h = Math.max(s.height || 0, s.availHeight || 0, DESIGN_H);
    // 竖屏展板优先落到设计分辨率
    if (h >= w && Math.abs(w / h - DESIGN_W / DESIGN_H) < 0.08) {
      return { w: DESIGN_W, h: DESIGN_H };
    }
    return { w: w, h: h };
  }

  function fitWindowToScreen() {
    try {
      var size = screenSize();
      if (typeof window.moveTo === "function") window.moveTo(0, 0);
      if (typeof window.resizeTo === "function") window.resizeTo(size.w, size.h);
    } catch (error) { /* ignore */ }

    try {
      var tw = window.__TAURI__ && window.__TAURI__.window;
      if (tw && typeof tw.getCurrentWindow === "function") {
        var win = tw.getCurrentWindow();
        if (win) {
          if (typeof win.setFullscreen === "function") win.setFullscreen(true);
          if (typeof win.maximize === "function") win.maximize();
        }
      }
    } catch (error) { /* ignore */ }
  }

  function layoutBoard() {
    var board = document.querySelector(".board");
    if (!board) return;
    var vw = document.documentElement.clientWidth || window.innerWidth || DESIGN_W;
    var vh = document.documentElement.clientHeight || window.innerHeight || DESIGN_H;
    var scale = Math.min(vw / DESIGN_W, vh / DESIGN_H);
    var w = Math.round(DESIGN_W * scale);
    var h = Math.round(DESIGN_H * scale);
    board.style.width = w + "px";
    board.style.height = h + "px";
    document.documentElement.style.setProperty("--board-w", w + "px");
    document.documentElement.style.setProperty("--board-h", h + "px");
    document.documentElement.style.setProperty("--board-scale", String(scale));
  }

  function enter() {
    fitWindowToScreen();
    layoutBoard();
    return requestDomFullscreen().then(function (ok) {
      layoutBoard();
      return ok;
    });
  }

  function armGestureRetry() {
    function onGesture() {
      if (isFull()) {
        layoutBoard();
        return;
      }
      enter();
    }
    document.addEventListener("pointerdown", onGesture, { capture: true, passive: true });
    document.addEventListener("keydown", onGesture, { capture: true });
  }

  function bindToggleKey() {
    document.addEventListener("keydown", function (event) {
      if (event.key !== "f" && event.key !== "F") return;
      if (isFull()) {
        var exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
      } else {
        enter();
      }
    });
  }

  function boot() {
    layoutBoard();
    enter();
    setTimeout(enter, 300);
    setTimeout(enter, 1200);
    armGestureRetry();
    bindToggleKey();
    window.addEventListener("resize", layoutBoard);
    window.addEventListener("orientationchange", function () {
      setTimeout(enter, 100);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", layoutBoard);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.Fullscreen = {
    enter: enter,
    isFull: isFull,
    layout: layoutBoard,
    design: { width: DESIGN_W, height: DESIGN_H }
  };
})();
