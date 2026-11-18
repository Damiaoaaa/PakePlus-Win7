(function () {
  var DESIGN_W = 1080;
  var DESIGN_H = 1920;

  function isFull() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function screenSize() {
    var s = window.screen || {};
    var w = s.width || s.availWidth || DESIGN_W;
    var h = s.height || s.availHeight || DESIGN_H;
    return { w: Math.round(w), h: Math.round(h) };
  }

  function fillPageChrome() {
    var html = document.documentElement;
    var body = document.body;
    html.style.cssText += ";margin:0;padding:0;width:100%;height:100%;overflow:hidden;";
    if (body) {
      body.style.margin = "0";
      body.style.width = "100%";
      body.style.height = "100%";
      body.style.minHeight = "100%";
      body.style.overflow = "hidden";
    }
  }

  function layoutBoard() {
    fillPageChrome();
    var board = document.querySelector(".board");
    var stage = document.querySelector(".stage");
    if (stage) {
      stage.style.position = "fixed";
      stage.style.inset = "0";
      stage.style.width = "100%";
      stage.style.height = "100%";
      stage.style.margin = "0";
      stage.style.padding = "0";
    }
    if (board) {
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
    }
    var vw = document.documentElement.clientWidth || window.innerWidth || DESIGN_W;
    var vh = document.documentElement.clientHeight || window.innerHeight || DESIGN_H;
    document.documentElement.style.setProperty("--board-w", vw + "px");
    document.documentElement.style.setProperty("--board-h", vh + "px");
  }

  function requestDomFullscreen() {
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!req) return Promise.resolve(false);
    try {
      return Promise.resolve(req.call(el)).then(function () { return true; }).catch(function () { return false; });
    } catch (error) {
      return Promise.resolve(false);
    }
  }

  function callMaybePromise(value) {
    return Promise.resolve(value).catch(function () { return null; });
  }

  function getTauriWindow() {
    try {
      var api = window.__TAURI__ && window.__TAURI__.window;
      if (!api) return null;
      if (typeof api.getCurrentWindow === "function") return api.getCurrentWindow();
      if (typeof api.getCurrent === "function") return api.getCurrent();
      if (api.appWindow) return api.appWindow;
    } catch (error) { /* ignore */ }
    return null;
  }

  function fitWindowToScreen() {
    var size = screenSize();

    try {
      if (typeof window.moveTo === "function") window.moveTo(0, 0);
      if (typeof window.resizeTo === "function") window.resizeTo(size.w, size.h);
    } catch (error) { /* ignore */ }

    var win = getTauriWindow();
    if (!win) return Promise.resolve(false);

    var dpi = window.__TAURI__ && window.__TAURI__.dpi;
    var tasks = [];

    try {
      if (typeof win.setDecorations === "function") tasks.push(callMaybePromise(win.setDecorations(false)));
      if (typeof win.setShadow === "function") tasks.push(callMaybePromise(win.setShadow(false)));
      if (typeof win.setAlwaysOnTop === "function") tasks.push(callMaybePromise(win.setAlwaysOnTop(true)));
      if (typeof win.setFullscreen === "function") tasks.push(callMaybePromise(win.setFullscreen(true)));
      if (typeof win.maximize === "function") tasks.push(callMaybePromise(win.maximize()));

      if (typeof win.setSize === "function" && dpi) {
        if (dpi.LogicalSize) {
          tasks.push(callMaybePromise(win.setSize(new dpi.LogicalSize(size.w, size.h))));
        }
        if (dpi.PhysicalSize) {
          tasks.push(callMaybePromise(win.setSize(new dpi.PhysicalSize(size.w, size.h))));
        }
      }
      if (typeof win.setPosition === "function" && dpi) {
        if (dpi.LogicalPosition) {
          tasks.push(callMaybePromise(win.setPosition(new dpi.LogicalPosition(0, 0))));
        }
        if (dpi.PhysicalPosition) {
          tasks.push(callMaybePromise(win.setPosition(new dpi.PhysicalPosition(0, 0))));
        }
      }
    } catch (error) { /* ignore */ }

    return Promise.all(tasks).then(function () { return true; }).catch(function () { return false; });
  }

  function windowLooksShort() {
    var size = screenSize();
    var ow = window.outerWidth || window.innerWidth || 0;
    var oh = window.outerHeight || window.innerHeight || 0;
    return ow + 2 < size.w || oh + 2 < size.h;
  }

  function enter() {
    return fitWindowToScreen().then(function () {
      layoutBoard();
      return requestDomFullscreen();
    }).then(function (ok) {
      layoutBoard();
      if (windowLooksShort()) {
        return fitWindowToScreen().then(function () {
          layoutBoard();
          return ok;
        });
      }
      return ok;
    });
  }

  function armGestureRetry() {
    function onGesture() {
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
    setTimeout(enter, 200);
    setTimeout(enter, 800);
    setTimeout(enter, 2000);
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (!windowLooksShort() || tries > 12) {
        clearInterval(timer);
        return;
      }
      enter();
    }, 500);
    armGestureRetry();
    bindToggleKey();
    window.addEventListener("resize", function () {
      layoutBoard();
      if (windowLooksShort()) enter();
    });
    window.addEventListener("orientationchange", function () {
      setTimeout(enter, 100);
    });
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
