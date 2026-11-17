(function () {
  const memory = { local: Object.create(null), session: Object.create(null) };
  const NAME_KEY = "__spc_store_v1__";

  function readNameBag() {
    try {
      const raw = window.name || "";
      if (raw.indexOf(NAME_KEY) !== 0) return;
      const data = JSON.parse(raw.slice(NAME_KEY.length));
      if (!data || typeof data !== "object") return;
      Object.assign(memory.local, data.local || {});
      Object.assign(memory.session, data.session || {});
    } catch (error) { /* ignore */ }
  }

  function writeNameBag() {
    try {
      window.name = NAME_KEY + JSON.stringify({
        local: memory.local,
        session: memory.session
      });
    } catch (error) { /* ignore */ }
  }

  function probe(kind) {
    try {
      const backend = kind === "local" ? window.localStorage : window.sessionStorage;
      const key = "__spc_store_probe__";
      backend.setItem(key, "1");
      backend.removeItem(key);
      return backend;
    } catch (error) {
      return null;
    }
  }

  readNameBag();

  function make(kind) {
    const backend = probe(kind);
    const bag = memory[kind];
    return {
      getItem: function (key) {
        try {
          if (backend) {
            const value = backend.getItem(key);
            if (value !== null && value !== undefined) return value;
          }
        } catch (error) { /* fall through */ }
        return Object.prototype.hasOwnProperty.call(bag, key) ? bag[key] : null;
      },
      setItem: function (key, value) {
        const text = String(value);
        bag[key] = text;
        try { if (backend) backend.setItem(key, text); } catch (error) { /* memory only */ }
        writeNameBag();
      },
      removeItem: function (key) {
        delete bag[key];
        try { if (backend) backend.removeItem(key); } catch (error) { /* ignore */ }
        writeNameBag();
      }
    };
  }

  window.Store = {
    local: make("local"),
    session: make("session")
  };
})();
