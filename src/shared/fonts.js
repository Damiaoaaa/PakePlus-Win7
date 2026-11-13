(function () {
  const script = document.currentScript;
  const base = script && script.src
    ? new URL("../assets/fonts/", script.src).href
    : new URL("assets/fonts/", location.href).href;

  function face(family, weight, file) {
    return (
      "@font-face{font-family:'" + family + "';font-style:normal;font-weight:" + weight +
      ";font-display:swap;src:url('" + base + file + "') format('truetype');}"
    );
  }

  const css = [
    face("Poppins", 400, "poppins-400.ttf"),
    face("Poppins", 500, "poppins-500.ttf"),
    face("Poppins", 600, "poppins-600.ttf"),
    face("Poppins", 700, "poppins-700.ttf"),
    face("Poppins", 800, "poppins-800.ttf"),
    face("Source Han Serif TC", 400, "source-han-serif-tc-500.ttf"),
    face("Source Han Serif TC", 500, "source-han-serif-tc-500.ttf"),
    face("Source Han Serif TC", 600, "source-han-serif-tc-700.ttf"),
    face("Source Han Serif TC", 700, "source-han-serif-tc-700.ttf"),
    face("Source Han Serif TC", 800, "source-han-serif-tc-700.ttf"),
    "button,input,textarea,select{font-family:inherit;}"
  ].join("");

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();
