(function () {
  function normalizeBase(href) {
    let base = String(href || "").replace(/\\/g, "/");
    // PakePlus Electron 常见坏地址：pakeplus://appC:/Users/...
    base = base.replace(/^(pakeplus:\/\/app)([A-Za-z]):\//i, "$1/$2:/");
    base = base.split("#")[0].split("?")[0];
    if (/\.html?$/i.test(base)) base = base.replace(/[^/]+$/, "");
    if (!/[\\/]$/.test(base)) base += "/";
    return base;
  }

  function resolve(rel) {
    const target = String(rel || "").replace(/\\/g, "/").replace(/^\.\//, "");
    const base = normalizeBase(location.href);
    try {
      return new URL(target, base).href;
    } catch (error) {
      return base + target.replace(/^\//, "");
    }
  }

  function go(rel) {
    location.assign(resolve(rel));
  }

  window.Nav = { resolve: resolve, go: go };
})();
