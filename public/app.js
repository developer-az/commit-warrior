(() => {
  const form = document.getElementById("lookup-form");
  const usernameInput = document.getElementById("username");
  const statusLine = document.getElementById("status-line");
  const generateBtn = document.getElementById("generate-btn");
  const generator = document.getElementById("generator");
  const embed = document.getElementById("embed");
  const themeSelect = document.getElementById("theme");
  const showIcons = document.getElementById("show-icons");
  const hideRank = document.getElementById("hide-rank");
  const compactLangs = document.getElementById("compact-langs");
  const copyBtn = document.getElementById("copy-btn");

  let currentUser = "";

  function originBase() {
    return window.location.origin;
  }

  function qs(params) {
    return new URLSearchParams(params).toString();
  }

  function statsUrl(username) {
    const params = {
      username,
      theme: themeSelect.value,
      show_icons: String(showIcons.checked),
    };
    if (hideRank.checked) params.hide_rank = "true";
    return `${originBase()}/api/stats?${qs(params)}`;
  }

  function langsUrl(username) {
    return `${originBase()}/api/top-langs?${qs({
      username,
      theme: themeSelect.value,
      layout: compactLangs.checked ? "compact" : "normal",
    })}`;
  }

  function streakUrl(username) {
    return `${originBase()}/api/streak?${qs({
      username,
      theme: themeSelect.value,
    })}`;
  }

  function graphUrl(username) {
    return `${originBase()}/api/graph?${qs({
      username,
      theme: themeSelect.value,
    })}`;
  }

  function formatNum(value) {
    return new Intl.NumberFormat("en-US").format(Number(value) || 0);
  }

  function formatWhen(iso) {
    if (!iso) return "";
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(iso));
    } catch {
      return "";
    }
  }

  function formatDay(iso) {
    if (!iso) return "";
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(new Date(`${iso}T00:00:00Z`));
    } catch {
      return iso;
    }
  }

  function friendlyError(message) {
    const msg = String(message || "");
    if (/not found/i.test(msg)) return "No GitHub user with that name.";
    if (/invalid github username/i.test(msg)) {
      return "Usernames are letters, numbers, and hyphens.";
    }
    if (/401|bad credentials/i.test(msg)) {
      return "GitHub login on the server failed. Try again shortly.";
    }
    if (/403|rate limit/i.test(msg)) {
      return "GitHub rate limit hit. Wait a minute.";
    }
    return msg || "Could not load this profile.";
  }

  function setStatus(message, type = "") {
    statusLine.textContent = message;
    statusLine.className = `hero-hint${type ? ` ${type}` : ""}`;
  }

  function renderRecent(stats) {
    const recent = stats.recent || {};
    const chip = document.getElementById("status-chip");
    chip.textContent = recent.headline || "No calendar";
    chip.className = `status-chip ${recent.status || "idle"}`;

    const served = document.getElementById("served-at");
    const when = formatWhen(stats.servedAt || recent.generatedAt);
    served.dateTime = stats.servedAt || recent.generatedAt || "";
    served.textContent = when ? when : "";
    document.getElementById("live-label").textContent = stats.cached
      ? "Cached"
      : "Live";

    const todayValue = recent.todayPublished ? formatNum(recent.todayCount) : "n/a";
    const changeValue = recent.todayPublished
      ? `${Number(recent.delta) > 0 ? "+" : ""}${formatNum(recent.delta)}`
      : "n/a";

    const cards = [
      {
        label: "Today",
        value: todayValue,
        note: formatDay(recent.today),
      },
      {
        label: "Yesterday",
        value: formatNum(recent.yesterdayCount),
        note: formatDay(recent.yesterday),
      },
      {
        label: "Change",
        value: changeValue,
        note: recent.todayPublished ? "vs yesterday" : "today pending",
        tone:
          recent.todayPublished && Number(recent.delta) > 0
            ? "up"
            : recent.todayPublished && Number(recent.delta) < 0
              ? "down"
              : "",
      },
      {
        label: "Last 7 days",
        value: formatNum(recent.last7Count),
        note: `${formatNum(recent.last7ActiveDays)} active`,
      },
    ];

    document.getElementById("delta-board").innerHTML = cards
      .map(
        (c) => `<div class="stat">
          <span class="label">${c.label}</span>
          <strong class="${c.tone || ""}">${c.value}</strong>
          <span class="note">${c.note || ""}</span>
        </div>`
      )
      .join("");

    renderSparkline(recent.last14 || []);
  }

  function renderSparkline(days) {
    const host = document.getElementById("sparkline");
    if (!days.length) {
      host.innerHTML = "";
      return;
    }
    const w = 720;
    const h = 48;
    const max = Math.max(1, ...days.map((d) => Number(d.count) || 0));
    const gap = 5;
    const barW = (w - gap * (days.length - 1)) / days.length;
    const bars = days
      .map((d, i) => {
        const count = Number(d.count) || 0;
        const bh = Math.max(count ? 5 : 2, (count / max) * (h - 6));
        const x = i * (barW + gap);
        const y = h - bh;
        const fill = count ? "#d4b483" : "#2a3340";
        return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="1.5" fill="${fill}"><title>${d.date}: ${count}</title></rect>`;
      })
      .join("");
    host.innerHTML = `<svg class="sparkline" viewBox="0 0 ${w} ${h}" role="img" aria-label="Last 14 days">${bars}</svg>`;
  }

  function renderHighlights(stats) {
    const host = document.getElementById("highlights");
    const items = stats.highlights || [];
    host.innerHTML = items
      .map(
        (item) => `<div class="stat">
          <span class="label">${item.label}</span>
          <strong>${item.value}</strong>
        </div>`
      )
      .join("");
  }

  function renderMetrics(stats) {
    const catalog = [
      ["Commits", stats.totalCommits],
      ["Pull requests", stats.totalPRs],
      ["PRs merged", stats.mergedPRs],
      ["Issues closed", stats.closedIssues],
      ["Reviews", stats.totalReviews],
      ["Repos contributed to", stats.contributedTo],
      ["Stars", stats.totalStars],
      ["This year", stats.yearContributions],
    ];
    document.getElementById("metrics").innerHTML = catalog
      .map(
        ([label, value]) => `<div class="stat">
          <span class="label">${label}</span>
          <strong>${formatNum(value)}</strong>
        </div>`
      )
      .join("");
  }

  function updatePreview(username) {
    const bust = Date.now();
    document.getElementById("stats-card").src = `${statsUrl(username)}&_=${bust}`;
    document.getElementById("langs-card").src = `${langsUrl(username)}&_=${bust}`;
    document.getElementById("streak-card").src = `${streakUrl(username)}&_=${bust}`;
    document.getElementById("graph-card").src = `${graphUrl(username)}&_=${bust}`;
    document.getElementById("markdown-output").textContent = `[![${username}'s GitHub stats](${statsUrl(username)})](https://github.com/${username})
![Top Languages](${langsUrl(username)})
![GitHub Streak](${streakUrl(username)})
![Contribution Graph](${graphUrl(username)})`;
  }

  async function loadUser(username) {
    const clean = username.trim().replace(/^@/, "");
    if (!clean) return;

    generateBtn.disabled = true;
    const btnLabel = generateBtn.querySelector("span");
    if (btnLabel) btnLabel.textContent = "Loading…";
    setStatus("Looking up GitHub…", "");

    try {
      const res = await fetch(`/api/json?username=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      currentUser = data.login;
      document.getElementById("avatar").src = data.avatarUrl || "";
      document.getElementById("avatar").alt = `${data.login} avatar`;
      document.getElementById("profile-name").textContent =
        data.name || data.login;
      const link = document.getElementById("profile-link");
      link.href = data.url || `https://github.com/${data.login}`;
      link.textContent = `@${data.login}`;
      document.getElementById("rank-pill").textContent = data.rank?.level
        ? data.rank.level
        : "";

      renderRecent(data);
      renderHighlights(data);
      renderMetrics(data);
      updatePreview(data.login);

      generator.hidden = false;
      embed.hidden = false;
      generator.scrollIntoView({ behavior: "smooth", block: "start" });
      setStatus(`Loaded @${data.login}.`, "ok");

      const url = new URL(window.location.href);
      url.searchParams.set("username", data.login);
      history.replaceState(null, "", url);
    } catch (err) {
      setStatus(friendlyError(err.message), "error");
      generator.hidden = true;
      embed.hidden = true;
    } finally {
      generateBtn.disabled = false;
      if (btnLabel) btnLabel.textContent = "Look up";
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    loadUser(usernameInput.value);
  });

  [themeSelect, showIcons, hideRank, compactLangs].forEach((el) => {
    el.addEventListener("change", () => {
      if (currentUser) updatePreview(currentUser);
    });
  });

  function flashCopied() {
    copyBtn.textContent = "Copied";
    copyBtn.classList.add("copied");
    setTimeout(() => {
      copyBtn.textContent = "Copy";
      copyBtn.classList.remove("copied");
    }, 1600);
  }

  copyBtn.addEventListener("click", async () => {
    const code = document.getElementById("markdown-output");
    const text = code.textContent;
    try {
      await navigator.clipboard.writeText(text);
      flashCopied();
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      try {
        document.execCommand("copy");
        flashCopied();
      } catch {
        copyBtn.textContent = "Select text";
      }
    }
  });

  const params = new URLSearchParams(window.location.search);
  const preset = params.get("username");
  if (preset) {
    usernameInput.value = preset;
    loadUser(preset);
  }
})();
