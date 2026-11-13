(function () {
  const memory = { local: Object.create(null), session: Object.create(null) };

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
      },
      removeItem: function (key) {
        delete bag[key];
        try { if (backend) backend.removeItem(key); } catch (error) { /* ignore */ }
      }
    };
  }

  window.Store = {
    local: make("local"),
    session: make("session")
  };
})();
