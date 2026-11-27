(() => {
  const form = document.getElementById("widget-form");
  const input = document.getElementById("widget-user");
  const statusLine = document.getElementById("widget-status");

  const params = new URLSearchParams(window.location.search);
  let username = (
    params.get("username") ||
    (() => {
      try {
        return localStorage.getItem("cw:username") || "";
      } catch {
        return "";
      }
    })()
  ).trim();

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(Number(value) || 0);
  }

  function setStatus(message, isError = false) {
    statusLine.textContent = message;
    statusLine.className = `status${isError ? " error" : ""}`;
  }

  async function refresh() {
    const clean = username.trim().replace(/^@/, "");
    if (!clean) {
      setStatus("Enter a GitHub username.");
      return;
    }
    setStatus("Refreshing…");
    try {
      const data = await window.__CW_BRIDGE__.getJson(clean);
      const rank = data.rank || {};
      const streak = data.streak || {};
      const recent = data.recent || {};

      document.getElementById("widget-level").textContent = rank.level || "—";
      document.getElementById("widget-score").textContent =
        rank.score != null ? `${rank.score} / 100` : "— / 100";
      document.getElementById("widget-streak").textContent =
        `${formatNumber(streak.currentStreak)}d`;
      document.getElementById("widget-today").textContent = formatNumber(
        recent.todayCount
      );
      document.getElementById("widget-commits").textContent = formatNumber(
        data.totalCommits
      );

      username = data.login;
      input.value = data.login;
      try {
        localStorage.setItem("cw:username", data.login);
      } catch {
        /* ignore */
      }
      setStatus(
        `Updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · @${data.login}`
      );
    } catch (err) {
      setStatus(err.message || "Could not load profile.", true);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    username = input.value;
    refresh();
  });

  document.getElementById("close-widget").addEventListener("click", () => {
    window.__CW_BRIDGE__.closeWidget().catch(() => {});
  });

  if (username) {
    input.value = username;
    refresh();
  }
  setInterval(refresh, 60 * 1000);
})();
