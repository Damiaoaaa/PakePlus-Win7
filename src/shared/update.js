(function () {
  const UPSTREAM = "https://heritage.spc.edu.hk/50_profession_JSON.php";
  const MEDIA_BASE = "https://heritage.spc.edu.hk/";
  const CACHE_KEY = "spc-alumni-cache";
  const STAMP_KEY = "spc-alumni-stamp";

  function rootUrl() {
    const script = document.querySelector("script[src*='update.js']") || document.querySelector("script[src*='alumni.js']");
    if (script && script.src) return new URL("../", script.src);
    return new URL("./", location.href);
  }

  function dataJsonUrl() {
    return new URL("data/alumni.json", rootUrl()).href;
  }

  function localMediaUrl(rel) {
    return new URL("data/media/" + rel, rootUrl()).href;
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
            return;
          }
          person[field] = useLocal ? localMediaUrl(rel) : (MEDIA_BASE + rel);
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
    const response = await fetchWithTimeout(dataJsonUrl(), 8000);
    if (!response.ok) throw new Error(String(response.status));
    return applyMedia(await response.json(), true);
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

  async function current() {
    const cached = loadCached();
    if (cached) return cached;
    try {
      const bundled = await loadBundled();
      if (hasPeople(bundled)) {
        saveCache(bundled);
        return bundled;
      }
    } catch (error) { /* 继续尝试线上 */ }
    const remote = await fetchRemote();
    if (!hasPeople(remote)) throw new Error("empty");
    saveCache(remote);
    return remote;
  }

  window.Update = { refresh: refresh, current: current, dataJsonUrl: dataJsonUrl };
})();
