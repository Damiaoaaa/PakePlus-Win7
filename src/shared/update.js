(function () {
  const UPSTREAM = "https://heritage.spc.edu.hk/50_profession_JSON.php";
  const MEDIA_BASE = "https://heritage.spc.edu.hk/";
  const CACHE_KEY = "spc-alumni-cache";
  const STAMP_KEY = "spc-alumni-stamp";

  function fixProtocol(href) {
    return String(href || "")
      .replace(/\\/g, "/")
      .replace(/^(pakeplus:\/\/app)([A-Za-z]):\//i, "$1/$2:/");
  }

  function siteRoot() {
    let href = fixProtocol(location.href).split("#")[0].split("?")[0];
    href = href.replace(/\/(kiosk|standby|en-list|zh-list|en-detail|zh-detail)\/[^/]*$/i, "/");
    href = href.replace(/\/[^/]*\.html?$/i, "/");
    if (!/[\\/]$/.test(href)) href += "/";
    return href;
  }

  function rootUrl() {
    try { return new URL(siteRoot()); } catch (error) {
      if (window.Nav && Nav.resolve) {
        try { return new URL(Nav.resolve("../")); } catch (err) { /* fall through */ }
      }
      return new URL("./", fixProtocol(location.href));
    }
  }

  function dataJsonUrl() {
    return siteRoot() + "data/alumni.json";
  }

  function localMediaUrl(rel) {
    const clean = String(rel || "").replace(/^\/+/, "");
    return siteRoot() + "data/media/" + clean;
  }

  function remoteMediaUrl(rel) {
    const clean = String(rel || "").replace(/^\/+/, "");
    return MEDIA_BASE + "data/media/" + clean;
  }

  function bundledPayload() {
    if (window.__ALUMNI_BUNDLE__ && hasPeople(window.__ALUMNI_BUNDLE__)) {
      return applyMedia(window.__ALUMNI_BUNDLE__, true);
    }
    return null;
  }

  function normalizeMediaPath(value) {
    let text = String(value || "").trim();
    if (!text) return "";
    if (/^https?:\/\//i.test(text) || text.indexOf("blob:") === 0) {
      try { text = new URL(text, location.href).pathname || ""; } catch (error) { return ""; }
    }
    text = text.replace(/\\/g, "/");
    while (text.indexOf("//") >= 0) text = text.replace("//", "/");
    text = text.replace(/^\/+/, "");
    if (text.indexOf("data/media/") === 0) text = text.slice("data/media/".length);
    return text.replace(/^\/+/, "");
  }

  function applyMedia(payload, useLocal) {
    const copy = JSON.parse(JSON.stringify(payload || { data: {} }));
    const data = copy.data || {};
    Object.keys(data).forEach((cat) => {
      (data[cat] || []).forEach((person) => {
        ["exhibition_thumbnail", "exhibition_video"].forEach((field) => {
          const rel = normalizeMediaPath(person[field]);
          if (!rel) {
            person[field] = "";
            person[field + "_rel"] = "";
            return;
          }
          person[field + "_rel"] = rel;
          // Electron 自定义协议下本地文件常 404，优先可访问的线上图，本地作备用
          person[field] = useLocal ? localMediaUrl(rel) : remoteMediaUrl(rel);
          person[field + "_remote"] = remoteMediaUrl(rel);
          person[field + "_local"] = localMediaUrl(rel);
        });
      });
    });
    return copy;
  }

  function hasPeople(payload) {
    const data = payload && payload.data;
    if (!data || typeof data !== "object") return false;
    return Object.keys(data).some((key) => Array.isArray(data[key]) && data[key].length);
  }

  function stampOf(payload) {
    return String((payload && payload.last_update_at) || "") + "|" + String((payload && payload.total_records) || "");
  }

  async function fetchWithTimeout(url, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { cache: "no-store", signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadBundled() {
    const embedded = bundledPayload();
    if (embedded) return embedded;

    const urls = [dataJsonUrl()];
    if (window.Nav && Nav.resolve) {
      ["../data/alumni.json", "./../data/alumni.json", "data/alumni.json"].forEach((rel) => {
        const url = Nav.resolve(rel);
        if (urls.indexOf(url) < 0) urls.push(url);
      });
    }

    let lastError = null;
    for (let i = 0; i < urls.length; i += 1) {
      try {
        const response = await fetchWithTimeout(urls[i], 8000);
        if (!response.ok) throw new Error(String(response.status));
        return applyMedia(await response.json(), true);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("bundled missing");
  }

  function loadCached() {
    try {
      const raw = Store.local.getItem(CACHE_KEY);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      return hasPeople(payload) ? payload : null;
    } catch (error) {
      return null;
    }
  }

  function saveCache(payload) {
    try {
      Store.local.setItem(CACHE_KEY, JSON.stringify(payload));
      Store.local.setItem(STAMP_KEY, stampOf(payload));
    } catch (error) { /* 缓存写失败时仍返回内存中的资料 */ }
  }

  async function fetchRemote() {
    const response = await fetchWithTimeout(UPSTREAM, 10000);
    if (!response.ok) throw new Error(String(response.status));
    return applyMedia(await response.json(), false);
  }

  async function refresh(onPhase) {
    const say = (phase) => { if (onPhase) onPhase(phase); };
    say("checking");

    let local = null;
    try { local = await loadBundled(); } catch (error) { local = null; }

    let remote = null;
    try { remote = await fetchRemote(); } catch (error) { remote = null; }

    const oldStamp = Store.local.getItem(STAMP_KEY) || (local ? stampOf(local) : "");
    if (remote && hasPeople(remote) && stampOf(remote) !== oldStamp) {
      say("updating");
      saveCache(remote);
      say("ready");
      return { phase: "ready", updated: true, payload: remote };
    }

    const payload = (local && hasPeople(local) && local) || loadCached() || remote;
    if (!hasPeople(payload)) {
      say("error");
      return { phase: "error", updated: false, payload: { data: {} } };
    }
    saveCache(payload);
    say("ready");
    return { phase: "ready", updated: false, payload: payload };
  }

  function rehydrate(payload) {
    const copy = JSON.parse(JSON.stringify(payload || { data: {} }));
    const data = copy.data || {};
    Object.keys(data).forEach((cat) => {
      (data[cat] || []).forEach((person) => {
        ["exhibition_thumbnail", "exhibition_video"].forEach((field) => {
          const rel = person[field + "_rel"] || normalizeMediaPath(person[field]);
          if (!rel) {
            person[field] = "";
            person[field + "_rel"] = "";
            return;
          }
          person[field + "_rel"] = rel;
          person[field + "_local"] = localMediaUrl(rel);
          person[field + "_remote"] = remoteMediaUrl(rel);
          person[field] = person[field + "_local"];
        });
      });
    });
    return copy;
  }

  async function current() {
    const cached = loadCached();
    if (cached) return rehydrate(cached);

    const embedded = bundledPayload();
    if (embedded) {
      saveCache(embedded);
      return embedded;
    }

    try {
      const bundled = await loadBundled();
      if (hasPeople(bundled)) {
        saveCache(bundled);
        return bundled;
      }
    } catch (error) { /* 继续尝试线上 */ }

    try {
      const remote = await fetchRemote();
      if (!hasPeople(remote)) throw new Error("empty");
      saveCache(remote);
      return remote;
    } catch (error) {
      if (embedded) return embedded;
      throw error;
    }
  }

  window.Update = {
    refresh: refresh,
    current: current,
    dataJsonUrl: dataJsonUrl,
    localMediaUrl: localMediaUrl,
    remoteMediaUrl: remoteMediaUrl,
    siteRoot: siteRoot
  };
})();

