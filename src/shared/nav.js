(function () {
  function normalizeHref(href) {
    let text = String(href || "").replace(/\\/g, "/");
    // PakePlus Electron: pakeplus://appC:/Users/... -> pakeplus://app/C:/Users/...
    text = text.replace(/^(pakeplus:\/\/app)([A-Za-z]):\//i, "$1/$2:/");
    return text;
  }

  function normalizeBase(href) {
    let base = normalizeHref(href);
    base = base.split("#")[0].split("?")[0];
    if (/\.html?$/i.test(base)) base = base.replace(/[^/]+$/, "");
    if (!/[\\/]$/.test(base)) base += "/";
    return base;
  }

  function resolve(rel) {
    const raw = String(rel || "").replace(/\\/g, "/");
    const queryIndex = raw.indexOf("?");
    const pathPart = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
    const query = queryIndex >= 0 ? raw.slice(queryIndex) : "";
    const target = pathPart.replace(/^\.\//, "");
    const base = normalizeBase(location.href);
    try {
      return new URL(target, base).href + query;
    } catch (error) {
      // manual ../ resolution
      const stack = base.replace(/\/+$/, "").split("/");
      String(target).split("/").forEach((part) => {
        if (!part || part === ".") return;
        if (part === "..") {
          if (stack.length > 3) stack.pop();
          return;
        }
        stack.push(part);
      });
      return stack.join("/") + query;
    }
  }

  function go(rel) {
    if (window.Bus && typeof Bus.keepAlive === "function") {
      try { Bus.keepAlive(); } catch (error) { /* ignore */ }
    }
    const url = resolve(rel);
    console.log("Nav.go", rel, "->", url);
    location.assign(url);
  }

  window.Nav = { resolve: resolve, go: go };
})();
