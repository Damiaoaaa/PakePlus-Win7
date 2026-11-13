(function () {
  const style = document.createElement("style");
  style.textContent = [
    "#boot {",
    "  position: fixed; inset: 0; z-index: 40;",
    "  display: grid; place-items: center;",
    "  background: rgba(4, 16, 36, 0.78);",
    "}",
    ".boot-box { display: grid; justify-items: center; gap: 18px; }",
    ".boot-spin {",
    "  width: 72px; height: 72px; border-radius: 50%;",
    "  border: 5px solid rgba(208, 182, 131, 0.28);",
    "  border-top-color: #e4cca1;",
    "  animation: boot-turn 0.75s linear infinite;",
    "}",
    "@keyframes boot-turn { to { transform: rotate(360deg); } }",
    "#boot p {",
    "  margin: 0; color: #f4efe4;",
    "  font-family: 'Poppins', 'Source Han Serif TC', serif;",
    "  font-size: 20px; letter-spacing: 0.14em;",
    "}"
  ].join("\n");
  document.head.append(style);

  const ready = Promise.resolve({ phase: "ready", updated: false });

  window.Boot = {
    whenReady: function () { return ready; }
  };
})();
