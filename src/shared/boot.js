(function () {
  const words = {
    checking: "正在检查更新",
    updating: "正在更新资料",
    ready: "更新完成",
    error: "资料暂时无法更新，将使用本地资料"
  };

  const style = document.createElement("style");
  style.textContent = [
    "#boot {",
    "  position: fixed; inset: 0; z-index: 40;",
    "  display: grid; place-items: center;",
    "  background: rgba(4, 16, 36, 0.78);",
    "}",
    "#boot[hidden] { display: none !important; }",
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

  let overlay = null;
  let textEl = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.getElementById("boot");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "boot";
      overlay.innerHTML = '<div class="boot-box"><div class="boot-spin"></div><p></p></div>';
      document.documentElement.appendChild(overlay);
    }
    textEl = overlay.querySelector("p") || overlay;
    return overlay;
  }

  function show(phase) {
    const box = ensureOverlay();
    box.hidden = false;
    box.setAttribute("aria-hidden", "false");
    if (textEl) textEl.textContent = words[phase] || words.checking;
  }

  function hide() {
    if (!overlay) return;
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
  }

  const ready = (async function run() {
    if (!window.Update || typeof Update.refresh !== "function") {
      return { phase: "ready", updated: false };
    }
    if (typeof Update.alreadyChecked === "function" && Update.alreadyChecked()) {
      return { phase: "ready", updated: false };
    }

    show("checking");
    let result = { phase: "error", updated: false };
    try {
      result = await Promise.race([
        Update.refresh(function (phase) { show(phase); }),
        new Promise(function (resolve) {
          setTimeout(function () { resolve({ phase: "error", updated: false }); }, 20000);
        })
      ]);
    } catch (error) {
      result = { phase: "error", updated: false };
    }

    show(result && result.phase === "error" ? "error" : "ready");
    await new Promise(function (resolve) { setTimeout(resolve, 280); });
    hide();
    return result || { phase: "ready", updated: false };
  })();

  window.Boot = {
    whenReady: function () { return ready; }
  };
})();
