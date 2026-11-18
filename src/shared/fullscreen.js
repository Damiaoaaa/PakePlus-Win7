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
    // 用完整屏幕，不用 avail*（avail 会去掉任务栏，底部留空）
    var w = s.width || s.availWidth || DESIGN_W;
    var h = s.height || s.availHeight || DESIGN_H;
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
          if (typeof win.setDecorations === "function") win.setDecorations(false);
          if (typeof win.setSize === "function" && window.__TAURI__.dpi && window.__TAURI__.dpi.PhysicalSize) {
            var size = screenSize();
            win.setSize(new window.__TAURI__.dpi.PhysicalSize(size.w, size.h));
          }
          if (typeof win.setPosition === "function" && window.__TAURI__.dpi && window.__TAURI__.dpi.PhysicalPosition) {
            win.setPosition(new window.__TAURI__.dpi.PhysicalPosition(0, 0));
          }
        }
      }
    } catch (error) { /* ignore */ }
  }

  function layoutBoard() {
    var board = document.querySelector(".board");
    if (!board) return;
    // 直接铺满可视区域，取消之前等比留边写法
    board.style.position = "absolute";
    board.style.left = "0";
    board.style.top = "0";
    board.style.right = "0";
    board.style.bottom = "0";
    board.style.width = "100%";
    board.style.height = "100%";
    board.style.maxWidth = "none";
    board.style.maxHeight = "none";
    board.style.margin = "0";
    board.style.transform = "none";

    var vw = document.documentElement.clientWidth || window.innerWidth || DESIGN_W;
    var vh = document.documentElement.clientHeight || window.innerHeight || DESIGN_H;
    document.documentElement.style.setProperty("--board-w", vw + "px");
    document.documentElement.style.setProperty("--board-h", vh + "px");
    document.documentElement.style.setProperty("--board-scale", "1");
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
      if (!isFull()) enter();
      else layoutBoard();
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
    window.addEventListener("resize", function () {
      fitWindowToScreen();
      layoutBoard();
    });
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
