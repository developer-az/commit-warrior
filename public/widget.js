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

  // The widget's own signature element: the same contribution calendar the
  // dashboard uses, compressed into a 26-week pulse strip.
  function renderPulse(days) {
    const host = document.getElementById("widget-pulse");
    const byDate = new Map();
    for (const day of days || []) {
      if (day && day.date) byDate.set(day.date, day);
    }

    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const end = new Date(today);
    end.setUTCDate(end.getUTCDate() + (6 - today.getUTCDay()));
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (26 * 7 - 1));

    const cells = [];
    for (let week = 0; week < 26; week += 1) {
      for (let day = 0; day < 7; day += 1) {
        const cursor = new Date(start);
        cursor.setUTCDate(cursor.getUTCDate() + week * 7 + day);
        const iso = cursor.toISOString().slice(0, 10);
        const entry = byDate.get(iso);
        const count = entry ? Number(entry.count) || 0 : 0;
        let level = entry ? Number(entry.level) || 0 : 0;
        if (!level && count > 0) level = count > 9 ? 4 : count > 5 ? 3 : count > 1 ? 2 : 1;
        cells.push(
          `<i class="l${Math.min(4, level)}" title="${iso}: ${count} contribution${count === 1 ? "" : "s"}"></i>`
        );
      }
    }
    host.innerHTML = cells.join("");
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
      const calendar = data.calendar || [];
      const total = calendar.reduce((sum, day) => sum + (Number(day.count) || 0), 0);

      document.getElementById("widget-level").textContent = rank.level || "—";
      document.getElementById("widget-score").textContent =
        rank.score != null ? rank.score.toFixed(2) : "—";
      document.getElementById("widget-streak").textContent =
        `${formatNumber(streak.currentStreak)}d`;
      document.getElementById("widget-today").textContent = formatNumber(
        recent.todayCount
      );
      document.getElementById("widget-commits").textContent = formatNumber(
        data.totalCommits
      );
      document.getElementById("widget-total").textContent =
        `${formatNumber(total)} contributions`;
      renderPulse(calendar);

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
