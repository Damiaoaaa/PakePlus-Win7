window.addEventListener("DOMContentLoaded",()=>{const t=document.createElement("script");t.src="https://www.googletagmanager.com/gtag/js?id=G-W5GKHM0893",t.async=!0,document.head.appendChild(t);const n=document.createElement("script");n.textContent="window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-W5GKHM0893');",document.body.appendChild(n)});document.addEventListener('contextmenu',function(e){const target=e.target;const isInput=target.tagName==='INPUT'||target.tagName==='TEXTAREA';const isContentEditable=target.isContentEditable;if(!isInput&&!isContentEditable){e.preventDefault()}});/* 供 PakePlus「脚本文件」注入：启动即无边框全屏铺满 1080×1920 */
(function () {
  var W = 1080;
  var H = 1920;

  function size() {
    var s = window.screen || {};
    return {
      w: Math.round(s.width || s.availWidth || W),
      h: Math.round(s.height || s.availHeight || H)
    };
  }

  function fit() {
    var dim = size();
    try {
      if (window.moveTo) window.moveTo(0, 0);
      if (window.resizeTo) window.resizeTo(dim.w, dim.h);
    } catch (e) {}

    try {
      var api = window.__TAURI__ && window.__TAURI__.window;
      var win = api && (api.getCurrentWindow ? api.getCurrentWindow() : (api.getCurrent ? api.getCurrent() : api.appWindow));
      var dpi = window.__TAURI__ && window.__TAURI__.dpi;
      if (!win) return;
      if (win.setDecorations) win.setDecorations(false);
      if (win.setFullscreen) win.setFullscreen(true);
      if (win.maximize) win.maximize();
      if (win.setAlwaysOnTop) win.setAlwaysOnTop(true);
      if (win.setSize && dpi) {
        if (dpi.LogicalSize) win.setSize(new dpi.LogicalSize(dim.w, dim.h));
        if (dpi.PhysicalSize) win.setSize(new dpi.PhysicalSize(dim.w, dim.h));
      }
      if (win.setPosition && dpi) {
        if (dpi.LogicalPosition) win.setPosition(new dpi.LogicalPosition(0, 0));
        if (dpi.PhysicalPosition) win.setPosition(new dpi.PhysicalPosition(0, 0));
      }
    } catch (e) {}

    try {
      var el = document.documentElement;
      var req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req && !document.fullscreenElement) Promise.resolve(req.call(el)).catch(function () {});
    } catch (e) {}
  }

  fit();
  setTimeout(fit, 100);
  setTimeout(fit, 500);
  setTimeout(fit, 1500);
  document.addEventListener("pointerdown", fit, true);
})();
