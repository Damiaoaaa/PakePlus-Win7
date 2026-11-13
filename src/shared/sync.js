(function () {
  const CATS = ["learnedmen", "teachers", "artists", "craftspeople", "merchants"];

  function parse(command) {
    const parts = String(command || "").trim().split(/\s+/);
    if (parts.length === 3 && parts[0] === "list" && (parts[1] === "en" || parts[1] === "zh") && CATS.indexOf(parts[2]) >= 0) {
      return { type: "list", lang: parts[1], cat: parts[2] };
    }
    if (parts.length === 2 && parts[0] === "lang" && (parts[1] === "en" || parts[1] === "zh")) {
      return { type: "lang", lang: parts[1] };
    }
    if (parts.length === 1 && parts[0] === "home") {
      return { type: "home" };
    }
    return null;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (typeof Peer !== "undefined") {
        resolve();
        return;
      }
      const el = document.createElement("script");
      el.src = src;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error("PeerJS load failed"));
      document.head.appendChild(el);
    });
  }

  function watch(apply) {
    Bus.watch((packet) => {
      const command = parse(packet.command);
      if (!command) return;
      command.seq = String(packet.seq);
      apply(command);
    });
    loadScript("../shared/peerjs.min.js")
      .then(() => Bus.ensureClient())
      .catch(() => {});
  }

  window.Sync = { watch: watch };
})();
