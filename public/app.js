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
  const cardPicks = document.getElementById("card-picks");

  let currentUser = "";

  const ACCENT = "#6b9bd1";
  const BAR = "#252f3d";
  const INK = "#e6e9ef";
  const MUTED = "#6b7585";
  const POSITIVE = "#5a9a7a";
  const WATCH = "#b8945a";

  function originBase() {
    return window.location.origin;
  }

  function qs(params) {
    return new URLSearchParams(params).toString();
  }

  function themeParams() {
    return { theme: themeSelect.value };
  }

  function statsUrl(username) {
    const params = {
      username,
      ...themeParams(),
      show_icons: String(showIcons.checked),
    };
    if (hideRank.checked) params.hide_rank = "true";
    return `${originBase()}/api/stats?${qs(params)}`;
  }

  function langsUrl(username) {
    return `${originBase()}/api/top-langs?${qs({
      username,
      ...themeParams(),
      layout: compactLangs.checked ? "compact" : "normal",
    })}`;
  }

  function streakUrl(username) {
    return `${originBase()}/api/streak?${qs({ username, ...themeParams() })}`;
  }

  function graphUrl(username) {
    return `${originBase()}/api/graph?${qs({ username, ...themeParams() })}`;
  }

  function activityUrl(username) {
    return `${originBase()}/api/activity?${qs({ username, ...themeParams() })}`;
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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  function selectedCards() {
    return [...cardPicks.querySelectorAll("input[data-card]")]
      .filter((el) => el.checked)
      .map((el) => el.dataset.card);
  }

  function renderProfileMeta(stats) {
    const parts = [];
    if (stats.partial) {
      parts.push("Public REST data");
    } else if (stats.fallbackReason) {
      parts.push("Partial GraphQL · REST fallback");
    } else if (!stats.partial) {
      parts.push("Full GitHub data");
    }
    if (stats.calendarSource) {
      parts.push(`Calendar via ${stats.calendarSource}`);
    }
    if (stats.signals?.trend?.label) {
      parts.push(stats.signals.trend.label);
    }
    document.getElementById("profile-meta").textContent = parts.join(" · ");
  }

  function renderSignals(stats) {
    const host = document.getElementById("signals");
    const pillars = stats.signals?.pillars || [];
    if (!pillars.length) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = pillars
      .map(
        (p) => `<article class="signal-card">
          <span class="signal-title">${escapeHtml(p.title)}</span>
          <strong>${escapeHtml(p.metric)}</strong>
          <span class="signal-detail">${escapeHtml(p.detail)}</span>
        </article>`
      )
      .join("");
  }

  function renderRecent(stats) {
    const recent = stats.recent || {};
    const chip = document.getElementById("status-chip");
    chip.textContent = recent.headline || "No calendar";
    chip.className = `status-chip ${recent.status || "idle"}`;

    const served = document.getElementById("served-at");
    const when = formatWhen(stats.servedAt || recent.generatedAt);
    served.dateTime = stats.servedAt || recent.generatedAt || "";
    served.textContent = when ? `· ${when}` : "";
    document.getElementById("live-label").textContent = stats.cached
      ? "Cached"
      : "Live";

    const todayValue = recent.todayPublished ? formatNum(recent.todayCount) : "—";
    const changeValue = recent.todayPublished
      ? `${Number(recent.delta) > 0 ? "+" : ""}${formatNum(recent.delta)}`
      : "—";

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
        label: "Day change",
        value: changeValue,
        note: recent.todayPublished ? "vs yesterday" : "today not published",
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
        note: `${formatNum(recent.last7ActiveDays)} active days`,
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
    const h = 44;
    const max = Math.max(1, ...days.map((d) => Number(d.count) || 0));
    const gap = 4;
    const barW = (w - gap * (days.length - 1)) / days.length;
    const bars = days
      .map((d, i) => {
        const count = Number(d.count) || 0;
        const bh = Math.max(count ? 4 : 2, (count / max) * (h - 4));
        const x = i * (barW + gap);
        const y = h - bh;
        const fill = count ? ACCENT : BAR;
        return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" fill="${fill}"><title>${d.date}: ${count}</title></rect>`;
      })
      .join("");
    host.innerHTML = `<svg class="sparkline" viewBox="0 0 ${w} ${h}" role="img" aria-label="Last 14 days">${bars}</svg>`;
  }

  function renderLangStack(langs) {
    const host = document.getElementById("lang-stack");
    const list = (langs || []).slice(0, 5);
    if (!list.length) {
      host.innerHTML = `<p class="viz-empty">No public language breakdown</p>`;
      return;
    }
    host.innerHTML = `<div class="lang-bars">${list
      .map(
        (lang) => `<div class="lang-row">
          <span>${escapeHtml(lang.name)}</span>
          <div class="lang-track"><i style="width:${lang.percent}%;background:${lang.color || ACCENT}"></i></div>
          <em>${lang.percent}%</em>
        </div>`
      )
      .join("")}</div>`;
  }

  function renderWeekdayChart(weekdays) {
    const host = document.getElementById("weekday-chart");
    const rows = weekdays || [];
    if (!rows.length) {
      host.innerHTML = `<p class="viz-empty">No calendar data</p>`;
      return;
    }
    const max = Math.max(1, ...rows.map((d) => Number(d.count) || 0));
    const w = 280;
    const h = 130;
    const gap = 6;
    const barW = (w - gap * (rows.length - 1)) / rows.length;
    const bars = rows
      .map((d, i) => {
        const count = Number(d.count) || 0;
        const bh = Math.max(count ? 4 : 2, (count / max) * 80);
        const x = i * (barW + gap);
        const y = 92 - bh;
        return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" fill="${count ? ACCENT : BAR}"><title>${d.label}: ${count}</title></rect>
          <text x="${x + barW / 2}" y="110" text-anchor="middle" fill="${MUTED}" font-size="9" font-family="IBM Plex Sans, sans-serif">${d.label.slice(0, 1)}</text>`;
      })
      .join("");
    host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Contributions by weekday">${bars}</svg>`;
  }

  function renderFunnel(funnel) {
    const host = document.getElementById("funnel-chart");
    const prs = funnel?.prs || {};
    const opened = Number(prs.opened) || 0;
    if (!opened) {
      host.innerHTML = `<p class="viz-empty">No authored pull requests</p>`;
      return;
    }
    const rows = [
      { label: "Opened", value: opened, color: MUTED },
      { label: "Merged", value: Number(prs.merged) || 0, color: POSITIVE },
      { label: "Closed", value: Number(prs.closed) || 0, color: WATCH },
    ];
    const max = Math.max(...rows.map((r) => r.value), 1);
    const html = rows
      .map((r) => {
        const width = Math.round((r.value / max) * 100);
        return `<div class="funnel-row">
          <span>${r.label}</span>
          <div class="funnel-track"><span style="width:${width}%;background:${r.color}"></span></div>
          <strong>${formatNum(r.value)}</strong>
        </div>`;
      })
      .join("");
    const rate =
      prs.mergeRate != null
        ? `<p class="funnel-rate">${prs.mergeRate}% of opened PRs merged</p>`
        : "";
    host.innerHTML = `${html}${rate}`;
  }

  function renderBarSeries(hostId, series, aria) {
    const host = document.getElementById(hostId);
    const rows = series || [];
    if (!rows.length) {
      host.innerHTML = `<p class="viz-empty">No data</p>`;
      return;
    }
    const max = Math.max(1, ...rows.map((d) => Number(d.count) || 0));
    const w = 640;
    const h = 110;
    const gap = 5;
    const barW = (w - gap * (rows.length - 1)) / rows.length;
    const bars = rows
      .map((d, i) => {
        const count = Number(d.count) || 0;
        const bh = Math.max(count ? 3 : 2, (count / max) * 72);
        const x = i * (barW + gap);
        const y = 78 - bh;
        const label = d.label || d.key || "";
        return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" fill="${count ? ACCENT : BAR}"><title>${label}: ${count}</title></rect>
          <text x="${x + barW / 2}" y="96" text-anchor="middle" fill="${MUTED}" font-size="8" font-family="IBM Plex Sans, sans-serif">${escapeHtml(String(label).slice(-5))}</text>`;
      })
      .join("");
    host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" class="chart wide" role="img" aria-label="${aria}">${bars}</svg>`;
  }

  function renderVisualizations(stats) {
    const viz = stats.viz || {};
    const consistency = viz.consistency || {};
    const note = document.getElementById("consistency-note");
    const trend = consistency.trend || stats.signals?.trend;
    const parts = [];
    if (consistency.activePct != null) {
      parts.push(`${consistency.activePct}% of tracked days had output`);
    }
    if (consistency.avgPerActiveDay) {
      parts.push(`${consistency.avgPerActiveDay} avg per active day`);
    }
    if (trend?.label) {
      parts.push(trend.label);
    }
    note.textContent = parts.join(" · ");

    renderLangStack(stats.topLanguages);
    renderWeekdayChart(viz.weekdays);
    renderFunnel(stats.funnel);
    renderBarSeries("weekly-chart", viz.weeks, "Last 12 weeks");
    renderBarSeries("monthly-chart", viz.months, "Monthly contributions");
  }

  function renderLedger(stats) {
    const funnel = stats.funnel || {};
    const groups = [
      {
        title: "Shipping",
        rows: [
          ["Commits (all-time)", stats.totalCommits],
          ["Pull requests", stats.totalPRs],
          ["Merged", stats.mergedPRs],
          ["Issues closed", stats.closedIssues],
        ],
      },
      {
        title: "Collaboration",
        rows: [
          ["Code reviews", stats.totalReviews],
          ["External repos", stats.contributedTo],
          [
            "Merge rate",
            funnel.prs?.mergeRate != null ? `${funnel.prs.mergeRate}%` : null,
          ],
        ],
      },
      {
        title: "Reach",
        rows: [
          ["Contributions this year", stats.yearContributions],
          ["Repository stars", stats.totalStars],
          ["Followers", stats.followers],
        ],
      },
    ];

    document.getElementById("ledger").innerHTML = groups
      .map(
        (g) => `<div class="ledger-group">
          <h3>${g.title}</h3>
          ${g.rows
            .filter(([, v]) => v != null && v !== "")
            .map(
              ([label, value]) => `<div class="ledger-row">
                <span>${label}</span>
                <strong>${typeof value === "number" ? formatNum(value) : escapeHtml(String(value))}</strong>
              </div>`
            )
            .join("")}
        </div>`
      )
      .join("");
  }

  function updatePreview(username) {
    const bust = Date.now();
    const urls = {
      stats: statsUrl(username),
      langs: langsUrl(username),
      streak: streakUrl(username),
      graph: graphUrl(username),
      activity: activityUrl(username),
    };

    document.getElementById("stats-card").src = `${urls.stats}&_=${bust}`;
    document.getElementById("langs-card").src = `${urls.langs}&_=${bust}`;
    document.getElementById("streak-card").src = `${urls.streak}&_=${bust}`;
    document.getElementById("graph-card").src = `${urls.graph}&_=${bust}`;
    document.getElementById("activity-card").src = `${urls.activity}&_=${bust}`;

    const selected = new Set(selectedCards());
    document.querySelectorAll("[data-preview]").forEach((el) => {
      el.hidden = !selected.has(el.dataset.preview);
    });

    const lines = [];
    if (selected.has("stats")) {
      lines.push(
        `[![${username}'s GitHub stats](${urls.stats})](https://github.com/${username})`
      );
    }
    if (selected.has("langs")) lines.push(`![Top Languages](${urls.langs})`);
    if (selected.has("activity")) {
      lines.push(`![Activity Graph](${urls.activity})`);
    }
    if (selected.has("graph")) {
      lines.push(`![Contribution Graph](${urls.graph})`);
    }
    if (selected.has("streak")) {
      lines.push(`![GitHub Streak](${urls.streak})`);
    }
    document.getElementById("markdown-output").textContent = lines.join("\n");
  }

  async function loadUser(username) {
    const clean = username.trim().replace(/^@/, "");
    if (!clean) return;

    generateBtn.disabled = true;
    const btnLabel = generateBtn.querySelector("span");
    if (btnLabel) btnLabel.textContent = "Loading…";
    setStatus("Fetching public GitHub data…", "");

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

      renderProfileMeta(data);
      renderSignals(data);
      renderRecent(data);
      renderVisualizations(data);
      renderLedger(data);
      updatePreview(data.login);

      generator.hidden = false;
      embed.hidden = false;
      generator.scrollIntoView({ behavior: "smooth", block: "start" });
      setStatus(`Profile loaded for @${data.login}.`, "ok");

      const url = new URL(window.location.href);
      url.searchParams.set("username", data.login);
      history.replaceState(null, "", url);
    } catch (err) {
      setStatus(friendlyError(err.message), "error");
      generator.hidden = true;
      embed.hidden = true;
    } finally {
      generateBtn.disabled = false;
      if (btnLabel) btnLabel.textContent = "Load profile";
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

  cardPicks.addEventListener("change", () => {
    if (currentUser) updatePreview(currentUser);
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
