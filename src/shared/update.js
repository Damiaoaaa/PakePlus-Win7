(function () {
  const UPSTREAM = "https://heritage.spc.edu.hk/50_profession_JSON.php";
  const MEDIA_BASE = "https://heritage.spc.edu.hk/";
  const CACHE_KEY = "spc-alumni-cache";
  const STAMP_KEY = "spc-alumni-stamp";
  const SOURCE_KEY = "spc-alumni-source";
  const CHECKED_KEY = "spc-alumni-checked";

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

  function dataJsonUrl() {
    return siteRoot() + "data/alumni.json";
  }

  function localMediaUrl(rel) {
    const clean = String(rel || "").replace(/^\/+/, "");
    return siteRoot() + "data/media/" + clean;
  }

  function remoteMediaUrl(rel) {
    const clean = String(rel || "").replace(/^\/+/, "");
    // 线上资源在 /upload_files/...，不在 /data/media/upload_files/...
    return MEDIA_BASE + clean;
  }

  function keepRemoteAbsolute(value) {
    const text = String(value || "").trim();
    if (!/^https?:\/\//i.test(text)) return "";
    try {
      const url = new URL(text);
      if (/heritage\.spc\.edu\.hk$/i.test(url.hostname)) return url.href;
    } catch (error) { /* ignore */ }
    return "";
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
          const original = String(person[field] || "").trim();
          const rel = normalizeMediaPath(original);
          if (!rel) {
            person[field] = "";
            person[field + "_rel"] = "";
            person[field + "_remote"] = "";
            person[field + "_local"] = "";
            return;
          }
          const absoluteRemote = keepRemoteAbsolute(original) || remoteMediaUrl(rel);
          person[field + "_rel"] = rel;
          person[field + "_remote"] = absoluteRemote;
          person[field + "_local"] = localMediaUrl(rel);
          // Electron 自定义协议下本地文件常 404：远程优先，本地备用
          person[field] = useLocal ? person[field + "_local"] : absoluteRemote;
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

  function saveCache(payload, source) {
    try {
      Store.local.setItem(CACHE_KEY, JSON.stringify(payload));
      Store.local.setItem(STAMP_KEY, stampOf(payload));
      if (source) Store.local.setItem(SOURCE_KEY, source);
    } catch (error) { /* 缓存写失败时仍返回内存中的资料 */ }
  }

  function markChecked(stamp) {
    try {
      if (window.Store && Store.session) Store.session.setItem(CHECKED_KEY, stamp || "1");
    } catch (error) { /* ignore */ }
  }

  function alreadyChecked() {
    try {
      return !!(window.Store && Store.session && Store.session.getItem(CHECKED_KEY));
    } catch (error) {
      return false;
    }
  }

  async function fetchRemote() {
    const response = await fetchWithTimeout(UPSTREAM, 15000);
    if (!response.ok) throw new Error(String(response.status));
    return applyMedia(await response.json(), false);
  }

  function collectMediaUrls(payload) {
    const urls = [];
    const seen = Object.create(null);
    const data = payload && payload.data;
    if (!data) return urls;
    Object.keys(data).forEach((cat) => {
      (data[cat] || []).forEach((person) => {
        ["exhibition_thumbnail_remote", "exhibition_video_remote", "exhibition_thumbnail", "exhibition_video"].forEach((field) => {
          const url = String(person[field] || "").trim();
          if (!url || !/^https?:\/\//i.test(url) || seen[url]) return;
          seen[url] = true;
          urls.push(url);
        });
      });
    });
    return urls;
  }

  async function pullMediaLocal(payload, onPhase) {
    const urls = collectMediaUrls(payload);
    if (!urls.length) return;
    if (onPhase) onPhase("updating");
    const limit = 4;
    let index = 0;

    async function worker() {
      while (index < urls.length) {
        const url = urls[index++];
        try {
          await fetchWithTimeout(url, 20000);
        } catch (error) { /* 单文件失败不阻断整体更新 */ }
      }
    }

    const workers = [];
    for (let i = 0; i < Math.min(limit, urls.length); i += 1) workers.push(worker());
    await Promise.all(workers);
  }

  function adoptPayload(payload, source) {
    saveCache(payload, source);
    try {
      if (payload && hasPeople(payload)) {
        window.__ALUMNI_BUNDLE__ = JSON.parse(JSON.stringify(payload));
      }
    } catch (error) { /* ignore */ }
    markChecked(stampOf(payload));
  }

  async function refresh(onPhase) {
    const say = (phase) => { if (onPhase) onPhase(phase); };
    say("checking");

    let local = null;
    try { local = await loadBundled(); } catch (error) { local = null; }
    const cached = loadCached();

    let remote = null;
    let remoteError = null;
    try {
      remote = await fetchRemote();
    } catch (error) {
      remoteError = error;
      remote = null;
    }

    const oldStamp = Store.local.getItem(STAMP_KEY)
      || (cached ? stampOf(cached) : "")
      || (local ? stampOf(local) : "");

    if (remote && hasPeople(remote) && stampOf(remote) !== oldStamp) {
      say("updating");
      // 先落盘资料，再后台预热媒体，避免大文件下载卡住更新
      adoptPayload(remote, "remote");
      pullMediaLocal(remote, say).catch(function () { /* ignore */ });
      say("ready");
      return { phase: "ready", updated: true, payload: remote };
    }

    const payload = (cached && hasPeople(cached) && cached)
      || (local && hasPeople(local) && local)
      || remote;

    if (!hasPeople(payload)) {
      say("error");
      markChecked("error");
      return {
        phase: "error",
        updated: false,
        payload: { data: {} },
        error: remoteError && remoteError.message ? remoteError.message : "empty"
      };
    }

    const source = (cached && Store.local.getItem(SOURCE_KEY))
      || (remote && stampOf(remote) === stampOf(payload) ? "remote" : "local");
    adoptPayload(payload, source === "remote" ? "remote" : "local");
    say("ready");
    return { phase: "ready", updated: false, payload: payload };
  }

  function rehydrate(payload, preferRemote) {
    const copy = JSON.parse(JSON.stringify(payload || { data: {} }));
    const data = copy.data || {};
    Object.keys(data).forEach((cat) => {
      (data[cat] || []).forEach((person) => {
        ["exhibition_thumbnail", "exhibition_video"].forEach((field) => {
          const original = String(person[field] || "").trim();
          const rel = person[field + "_rel"] || normalizeMediaPath(original);
          if (!rel) {
            person[field] = "";
            person[field + "_rel"] = "";
            person[field + "_remote"] = "";
            person[field + "_local"] = "";
            return;
          }
          const absoluteRemote = keepRemoteAbsolute(person[field + "_remote"])
            || keepRemoteAbsolute(original)
            || remoteMediaUrl(rel);
          person[field + "_rel"] = rel;
          person[field + "_local"] = localMediaUrl(rel);
          person[field + "_remote"] = absoluteRemote;
          person[field] = preferRemote ? absoluteRemote : person[field + "_local"];
        });
      });
    });
    return copy;
  }

  async function current() {
    const preferRemote = Store.local.getItem(SOURCE_KEY) === "remote";
    const cached = loadCached();
    if (cached) return rehydrate(cached, preferRemote);

    const embedded = bundledPayload();
    if (embedded) {
      saveCache(embedded, "local");
      return embedded;
    }

    try {
      const bundled = await loadBundled();
      if (hasPeople(bundled)) {
        saveCache(bundled, "local");
        return bundled;
      }
    } catch (error) { /* 继续尝试线上 */ }

    try {
      const remote = await fetchRemote();
      if (!hasPeople(remote)) throw new Error("empty");
      adoptPayload(remote, "remote");
      pullMediaLocal(remote).catch(function () { /* ignore */ });
      return remote;
    } catch (error) {
      if (embedded) return embedded;
      throw error;
    }
  }

  window.Update = {
    refresh: refresh,
    current: current,
    alreadyChecked: alreadyChecked,
    markChecked: markChecked,
    dataJsonUrl: dataJsonUrl,
    localMediaUrl: localMediaUrl,
    remoteMediaUrl: remoteMediaUrl,
    siteRoot: siteRoot
  };
})();
