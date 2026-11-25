/**
 * Commit Warrior API bridge.
 * Browser: plain fetch to the Node server.
 * Tauri desktop: Rust commands via IPC, returning the same JSON/SVG shapes.
 */
(() => {
  const INTERNALS = window.__TAURI_INTERNALS__;
  const GLOBAL = window.__TAURI__;
  const isTauri = Boolean(
    INTERNALS || (GLOBAL && (GLOBAL.core || GLOBAL.invoke))
  );

  function invoke(command, args = {}) {
    if (INTERNALS && typeof INTERNALS.invoke === "function") {
      return INTERNALS.invoke(command, args);
    }
    if (GLOBAL && GLOBAL.core && typeof GLOBAL.core.invoke === "function") {
      return GLOBAL.core.invoke(command, args);
    }
    if (GLOBAL && typeof GLOBAL.invoke === "function") {
      return GLOBAL.invoke(command, args);
    }
    return Promise.reject(new Error("Tauri IPC is unavailable"));
  }

  let basePromise = null;

  window.__CW_BRIDGE__ = {
    isTauri,

    async getJson(username) {
      if (!isTauri) {
        const res = await fetch(
          `/api/json?username=${encodeURIComponent(username)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Request failed");
        return data;
      }
      return invoke("api_json", { username });
    },

    async cardSrc(kind, username, options) {
      if (!isTauri) return null;
      const svg = await invoke("api_svg", { kind, username, options });
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    },

    publicBase() {
      if (!isTauri) return Promise.resolve(window.location.origin);
      if (!basePromise) {
        basePromise = invoke("public_base_url").catch(
          () => "https://commit-warrior.vercel.app"
        );
      }
      return basePromise;
    },

    openExternal(url) {
      if (!isTauri) {
        window.open(url, "_blank", "noopener");
        return Promise.resolve();
      }
      return invoke("open_external", { url });
    },
  };

  if (isTauri) {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link || link.target !== "_blank") return;
      const url = link.getAttribute("href");
      if (!url || !/^https?:\/\//.test(url)) return;
      event.preventDefault();
      window.__CW_BRIDGE__.openExternal(url).catch(() => {});
    });
  }
})();
