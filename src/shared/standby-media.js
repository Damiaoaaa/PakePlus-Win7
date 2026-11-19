(function () {
  var FILE_NAME = "standby.mp4";
  var ensured = null;

  function unique(list) {
    var out = [];
    (list || []).forEach(function (item) {
      if (!item) return;
      if (out.indexOf(item) < 0) out.push(item);
    });
    return out;
  }

  function asset(rel) {
    if (window.Nav && Nav.resolve) return Nav.resolve(rel);
    try { return new URL(rel, location.href.replace(/\\/g, "/")).href; } catch (error) { return rel; }
  }

  function siteRoot() {
    if (window.Update && typeof Update.siteRoot === "function") {
      try { return Update.siteRoot(); } catch (error) { /* fall through */ }
    }
    var href = String(location.href || "").split("#")[0].split("?")[0].replace(/\\/g, "/");
    href = href.replace(/\/(kiosk|standby|en-list|zh-list|en-detail|zh-detail)\/[^/]*$/i, "/");
    href = href.replace(/\/[^/]*\.html?$/i, "/");
    if (!/[\\/]$/.test(href)) href += "/";
    return href;
  }

  function webCandidates() {
    var root = siteRoot();
    return [
      root + "data/" + FILE_NAME,
      asset("../data/" + FILE_NAME),
      asset("../../data/" + FILE_NAME),
      asset("./../data/" + FILE_NAME),
      asset("../assets/" + FILE_NAME),
      asset("./../assets/" + FILE_NAME),
      asset("../../assets/" + FILE_NAME),
      asset("assets/" + FILE_NAME)
    ];
  }

  function hasTauriInvoke() {
    return !!(window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === "function");
  }

  function convertFileSrc(absPath) {
    if (!absPath) return "";
    try {
      if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.convertFileSrc === "function") {
        return window.__TAURI__.core.convertFileSrc(absPath);
      }
    } catch (error) { /* ignore */ }
    var normalized = String(absPath).replace(/\\/g, "/");
    if (/^[A-Za-z]:\//.test(normalized)) return "file:///" + normalized;
    if (normalized.charAt(0) === "/") return "file://" + normalized;
    return "file:///" + normalized;
  }

  async function runCommand(command) {
    return window.__TAURI__.core.invoke("run_command", { command: command });
  }

  async function resolveAppRoot() {
    try {
      var pathApi = window.__TAURI__ && window.__TAURI__.path;
      if (pathApi) {
        if (typeof pathApi.resourceDir === "function") {
          var resource = await pathApi.resourceDir();
          if (typeof pathApi.join === "function") {
            // resources 的上一级通常是安装根目录
            return await pathApi.join(resource, "..");
          }
        }
        if (typeof pathApi.appLocalDataDir === "function") {
          return await pathApi.appLocalDataDir();
        }
      }
    } catch (error) { /* ignore */ }

    try {
      var cwd = String(await runCommand("cd") || "").trim();
      if (cwd) return cwd.split(/\r?\n/).pop().trim();
    } catch (error) { /* ignore */ }
    return "";
  }

  async function ensureDataVideo() {
    if (!hasTauriInvoke()) return "";

    var root = await resolveAppRoot();
    if (!root) return "";

    // PowerShell：根目录没有 data 就创建，没有 standby.mp4 就从内置 assets 复制
    var ps = [
      "$ErrorActionPreference = 'SilentlyContinue'",
      "$root = @'",
      root,
      "'@.Trim()",
      "$data = Join-Path $root 'data'",
      "$dest = Join-Path $data 'standby.mp4'",
      "if (-not (Test-Path -LiteralPath $data)) { New-Item -ItemType Directory -Path $data -Force | Out-Null }",
      "if (-not (Test-Path -LiteralPath $dest)) {",
      "  $candidates = @(",
      "    (Join-Path $root 'config\\www\\assets\\standby.mp4'),",
      "    (Join-Path $root 'www\\assets\\standby.mp4'),",
      "    (Join-Path $root 'assets\\standby.mp4'),",
      "    (Join-Path $root 'resources\\assets\\standby.mp4'),",
      "    (Join-Path $root 'resources\\www\\assets\\standby.mp4')",
      "  )",
      "  foreach ($src in $candidates) {",
      "    if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination $dest -Force; break }",
      "  }",
      "}",
      "if (Test-Path -LiteralPath $dest) { Write-Output $dest }"
    ].join("\n");

    var command = "powershell -NoProfile -ExecutionPolicy Bypass -Command " + JSON.stringify(ps);
    try {
      var out = String(await runCommand(command) || "").trim();
      var line = out.split(/\r?\n/).filter(Boolean).pop() || "";
      return line;
    } catch (error) {
      console.warn("standby-media ensure failed", error);
      return "";
    }
  }

  async function resolveUrls() {
    if (!ensured) {
      ensured = ensureDataVideo().catch(function () { return ""; });
    }
    var abs = "";
    try { abs = await ensured; } catch (error) { abs = ""; }

    var list = [];
    if (abs) list.push(convertFileSrc(abs));
    list = list.concat(webCandidates());
    return unique(list);
  }

  window.StandbyMedia = {
    fileName: FILE_NAME,
    resolveUrls: resolveUrls,
    ensure: function () { return resolveUrls(); }
  };
})();
