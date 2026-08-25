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

  const ACCENT = "#d4b483";
  const MUTED_BAR = "#2a3340";
  const INK = "#f4f0e8";
  const MUTED = "#8b93a1";

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

  function milestonesUrl(username) {
    return `${originBase()}/api/milestones?${qs({ username, ...themeParams() })}`;
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

  function selectedCards() {
    return [...cardPicks.querySelectorAll("input[data-card]")]
      .filter((el) => el.checked)
      .map((el) => el.dataset.card);
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
        const fill = count ? ACCENT : MUTED_BAR;
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

  function renderLangDonut(langs) {
    const host = document.getElementById("lang-donut");
    const list = (langs || []).slice(0, 5);
    if (!list.length) {
      host.innerHTML = `<p class="viz-empty">No language data</p>`;
      return;
    }
    const size = 160;
    const cx = 80;
    const cy = 72;
    const r = 46;
    const stroke = 18;
    const circ = 2 * Math.PI * r;
    let offset = 0;
    const arcs = list
      .map((lang) => {
        const frac = Math.max(0, Number(lang.percent) || 0) / 100;
        const dash = frac * circ;
        const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${lang.color || ACCENT}" stroke-width="${stroke}" stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
        offset += dash;
        return el;
      })
      .join("");
    const legend = list
      .map(
        (lang) =>
          `<li><span class="swatch" style="background:${lang.color || ACCENT}"></span>${escapeHtml(lang.name)} <em>${lang.percent}%</em></li>`
      )
      .join("");
    host.innerHTML = `<div class="donut-wrap">
      <svg viewBox="0 0 ${size} ${size}" class="donut" role="img" aria-label="Language mix">${arcs}
        <circle cx="${cx}" cy="${cy}" r="${r - stroke / 2 - 4}" fill="#121821"/>
        <text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="${INK}" font-size="13" font-weight="600">${escapeHtml(list[0].name)}</text>
      </svg>
      <ul class="legend">${legend}</ul>
    </div>`;
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
    const h = 140;
    const gap = 8;
    const barW = (w - gap * (rows.length - 1)) / rows.length;
    const bars = rows
      .map((d, i) => {
        const count = Number(d.count) || 0;
        const bh = Math.max(count ? 6 : 2, (count / max) * 88);
        const x = i * (barW + gap);
        const y = 100 - bh;
        return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="2" fill="${count ? ACCENT : MUTED_BAR}"><title>${d.label}: ${count}</title></rect>
          <text x="${x + barW / 2}" y="118" text-anchor="middle" fill="${MUTED}" font-size="10">${d.label[0]}</text>`;
      })
      .join("");
    host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Contributions by weekday">${bars}</svg>`;
  }

  function renderFunnel(funnel) {
    const host = document.getElementById("funnel-chart");
    const prs = funnel?.prs || {};
    const opened = Number(prs.opened) || 0;
    if (!opened) {
      host.innerHTML = `<p class="viz-empty">No pull requests</p>`;
      return;
    }
    const rows = [
      { label: "Opened", value: opened, color: MUTED },
      { label: "Merged", value: Number(prs.merged) || 0, color: "#7dba9f" },
      { label: "Closed", value: Number(prs.closed) || 0, color: "#c76c76" },
    ];
    const max = Math.max(...rows.map((r) => r.value), 1);
    const html = rows
      .map((r) => {
        const pct = Math.round((r.value / max) * 100);
        return `<div class="funnel-row">
          <span>${r.label}</span>
          <div class="funnel-track"><span style="width:${pct}%;background:${r.color}"></span></div>
          <strong>${formatNum(r.value)}</strong>
        </div>`;
      })
      .join("");
    const rate =
      prs.mergeRate != null
        ? `<p class="funnel-rate">${prs.mergeRate}% merge rate</p>`
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
    const h = 120;
    const gap = 6;
    const barW = (w - gap * (rows.length - 1)) / rows.length;
    const bars = rows
      .map((d, i) => {
        const count = Number(d.count) || 0;
        const bh = Math.max(count ? 4 : 2, (count / max) * 78);
        const x = i * (barW + gap);
        const y = 86 - bh;
        const label = d.label || d.key || "";
        return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="2" fill="${count ? ACCENT : MUTED_BAR}"><title>${label}: ${count}</title></rect>
          <text x="${x + barW / 2}" y="106" text-anchor="middle" fill="${MUTED}" font-size="9">${escapeHtml(String(label).slice(-5))}</text>`;
      })
      .join("");
    host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" class="chart wide" role="img" aria-label="${aria}">${bars}</svg>`;
  }

  function renderMilestonesList(items) {
    const host = document.getElementById("milestones");
    const list = items || [];
    if (!list.length) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = list
      .map((m) => `<span class="milestone-chip">${escapeHtml(m.label)}</span>`)
      .join("");
  }

  function renderVisualizations(stats) {
    const viz = stats.viz || {};
    const consistency = viz.consistency || {};
    const note = document.getElementById("consistency-note");
    if (consistency.activePct != null) {
      note.textContent = `${consistency.activePct}% active days · avg ${consistency.avgPerActiveDay}/active day`;
    } else {
      note.textContent = "";
    }
    renderLangDonut(stats.topLanguages);
    renderWeekdayChart(viz.weekdays);
    renderFunnel(stats.funnel);
    renderBarSeries("weekly-chart", viz.weeks, "Last 12 weeks");
    renderBarSeries("monthly-chart", viz.months, "Monthly contributions");
    renderMilestonesList(stats.milestones);
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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function updatePreview(username) {
    const bust = Date.now();
    const urls = {
      stats: statsUrl(username),
      langs: langsUrl(username),
      streak: streakUrl(username),
      graph: graphUrl(username),
      activity: activityUrl(username),
      milestones: milestonesUrl(username),
    };

    document.getElementById("stats-card").src = `${urls.stats}&_=${bust}`;
    document.getElementById("langs-card").src = `${urls.langs}&_=${bust}`;
    document.getElementById("streak-card").src = `${urls.streak}&_=${bust}`;
    document.getElementById("graph-card").src = `${urls.graph}&_=${bust}`;
    document.getElementById("activity-card").src = `${urls.activity}&_=${bust}`;
    document.getElementById("milestones-card").src = `${urls.milestones}&_=${bust}`;

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
    if (selected.has("streak")) lines.push(`![GitHub Streak](${urls.streak})`);
    if (selected.has("milestones")) {
      lines.push(`![Milestones](${urls.milestones})`);
    }
    if (selected.has("graph")) lines.push(`![Contribution Graph](${urls.graph})`);
    if (selected.has("activity")) lines.push(`![Activity Graph](${urls.activity})`);
    document.getElementById("markdown-output").textContent = lines.join("\n");
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
      renderVisualizations(data);
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
