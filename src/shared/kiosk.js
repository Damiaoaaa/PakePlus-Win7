document.addEventListener("contextmenu", (event) => event.preventDefault());
if (window.Fullscreen && typeof Fullscreen.enter === "function") {
  Fullscreen.enter();
}
