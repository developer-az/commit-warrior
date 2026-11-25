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
  let gradientSeq = 0;
  let publicBase = window.location.origin;

  const C = {
    blue: "#58a6ff",
    green: "#3fb950",
    amber: "#d29922",
    violet: "#a371f7",
    cyan: "#39c5cf",
  };

  function originBase() {
    return publicBase;
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

  function nextGradient(prefix) {
    gradientSeq += 1;
    return `${prefix}-${gradientSeq}`;
  }

  function weeksLayout(days, weeks = 26) {
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const end = new Date(today);
    end.setUTCDate(end.getUTCDate() + (6 - today.getUTCDay()));
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (weeks * 7 - 1));

    const byDate = new Map();
    for (const day of days || []) {
      if (day && day.date) byDate.set(day.date, day);
    }

    const cells = [];
    const marks = [];
    let lastMonth = -1;

    for (let w = 0; w < weeks; w += 1) {
      const weekStart = new Date(start);
      weekStart.setUTCDate(weekStart.getUTCDate() + w * 7);

      const month = weekStart.getUTCMonth();
      if (month !== lastMonth) {
        lastMonth = month;
        marks.push({
          column: w + 1,
          label: weekStart.toLocaleString("en-US", {
            month: "short",
            timeZone: "UTC",
          }),
        });
      }

      for (let d = 0; d < 7; d += 1) {
        const date = new Date(weekStart);
        date.setUTCDate(date.getUTCDate() + d);
        const iso = date.toISOString().slice(0, 10);
        const entry = byDate.get(iso);
        const count = entry ? Number(entry.count) || 0 : 0;
        let level =
          entry && Number.isFinite(Number(entry.level))
            ? Math.min(4, Math.max(0, Number(entry.level)))
            : 0;
        if (!level && count > 0) {
          level = count > 9 ? 4 : count > 5 ? 3 : count > 1 ? 2 : 1;
        }
        cells.push({ date: iso, count, level });
      }
    }

    const months = marks
      .filter(
        (mark, i) =>
          !(i === 0 && marks[1] && marks[1].column - mark.column < 4)
      )
      .filter(
        (mark, i, list) => i === 0 || mark.column - list[i - 1].column >= 4
      );

    return { cells, months };
  }

  let snakeTimer = null;

  function stopSnake() {
    if (snakeTimer) {
      clearInterval(snakeTimer);
      snakeTimer = null;
    }
    const grid = document.getElementById("contrib-grid");
    if (!grid) return;
    grid.querySelectorAll(".snake-head, .snake-body").forEach((cell) => {
      cell.classList.remove("snake-head", "snake-body");
    });
  }

  function startSnake() {
    stopSnake();
    const grid = document.getElementById("contrib-grid");
    if (!grid) return;

    const cells = [...grid.querySelectorAll("i")];
    if (!cells.length) return;

    const columns = 26;
    const rows = 7;
    const path = [];
    for (let c = 0; c < columns; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        path.push(c * rows + (c % 2 === 0 ? r : rows - 1 - r));
      }
    }

    const bodyLength = 6;
    const paint = (step) => {
      cells.forEach((cell) => cell.classList.remove("snake-head", "snake-body"));
      for (let i = 0; i < bodyLength; i += 1) {
        const index = path[(step - i + path.length) % path.length];
        cells[index].classList.add(i === 0 ? "snake-head" : "snake-body");
      }
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paint(52);
      return;
    }

    let step = 0;
    paint(step);
    snakeTimer = setInterval(() => {
      step = (step + 1) % path.length;
      paint(step);
    }, 85);
  }

  function renderContributionGrid(days, meta, real) {
    const grid = document.getElementById("contrib-grid");
    const monthsHost = document.getElementById("contrib-months");
    if (!grid || !monthsHost) return;

    const { cells, months } = weeksLayout(days);
    const total = cells.reduce((sum, cell) => sum + cell.count, 0);

    grid.innerHTML = cells
      .map(
        (cell) =>
          `<i class="l${cell.level}" title="${escapeHtml(
            formatDay(cell.date)
          )}: ${cell.count} contribution${cell.count === 1 ? "" : "s"}"></i>`
      )
      .join("");
    monthsHost.innerHTML = months
      .map(
        (month) =>
          `<span style="grid-column:${month.column} / span 3">${month.label}</span>`
      )
      .join("");

    const metaEl = document.getElementById("contrib-meta");
    if (metaEl) {
      metaEl.textContent = real
        ? `${meta} · ${formatNum(total)} contributions`
        : meta;
    }

    if (real) {
      stopSnake();
    } else {
      startSnake();
    }
  }

  function renderContributionPreview() {
    renderContributionGrid([], "No profile loaded", false);
  }

  const ICONS = {
    shield:
      '<path d="M12 3 19 6v5.2c0 4.4-2.9 7.5-7 9.3-4.1-1.8-7-4.9-7-9.3V6l7-3Z"/><path d="m9 12 2 2 4-4"/>',
    commit:
      '<circle cx="12" cy="12" r="3.5"/><path d="M3 12h5.5M15.5 12H21"/>',
    calendar:
      '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    flame:
      '<path d="M12 3c3 3.4 5.5 5.7 5.5 9a5.5 5.5 0 0 1-11 0c0-1.6.6-2.9 1.8-4.2.3 1.3 1 2 2 2.4C10.6 8 11 5.4 12 3Z"/>',
    star:
      '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/>',
    review:
      '<path d="M4 5h16v11H9l-5 4V5Z"/><path d="m9 10 2 2 4-4"/>',
  };

  function icon(name) {
    return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  }

  function renderProfileMeta(stats) {
    const parts = [];
    if (stats.partial) {
      parts.push("Public REST data");
    } else if (stats.fallbackReason) {
      parts.push("Partial GraphQL · REST fallback");
    } else {
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

  function renderRank(stats) {
    const badge = document.getElementById("rank-badge");
    const rank = stats.rank || {};
    if (!rank.level) {
      badge.hidden = true;
      return;
    }
    badge.hidden = false;
    document.getElementById("rank-letter").textContent = rank.level;
    const score = rank.score != null ? `${rank.score}/100` : "weighted score";
    badge.title = `Rank ${rank.level} · ${score}`;
  }

  function renderKpis(stats) {
    const host = document.getElementById("kpi-grid");
    const rank = stats.rank || {};
    const streak = stats.streak || {};
    const vitals = [
      {
        label: "Rank",
        icon: "shield",
        value: rank.level || "—",
        sub: rank.score != null ? `${rank.score} / 100` : "rank score",
        accent: "#a371f7",
      },
      {
        label: "All-time commits",
        icon: "commit",
        value: formatNum(stats.totalCommits),
        sub:
          stats.commitsSource === "graphql"
            ? "GraphQL contribution history"
            : "public search index",
        accent: "#58a6ff",
      },
      {
        label: "This year",
        icon: "calendar",
        value: formatNum(stats.yearContributions),
        sub: stats.calendarSource
          ? `calendar · ${stats.calendarSource}`
          : "contribution calendar",
        accent: "#3fb950",
      },
      {
        label: "Current streak",
        icon: "flame",
        value: `${formatNum(streak.currentStreak)}d`,
        sub: `longest ${formatNum(streak.longestStreak)}d`,
        accent: "#d29922",
      },
      {
        label: "Stars owned",
        icon: "star",
        value: formatNum(stats.totalStars),
        sub: `${formatNum(stats.publicRepos)} public repos`,
        accent: "#db61a2",
      },
      {
        label: "Code reviews",
        icon: "review",
        value: formatNum(stats.totalReviews),
        sub: `${formatNum(stats.contributedTo)} external repos`,
        accent: "#39c5cf",
      },
    ];

    host.innerHTML = vitals
      .map(
        (k) => `<article class="kpi" style="--accent:${k.accent}">
          <span class="kpi-label">${icon(k.icon)}${escapeHtml(k.label)}</span>
          <strong class="kpi-value">${escapeHtml(k.value)}</strong>
          <span class="kpi-sub">${escapeHtml(k.sub)}</span>
        </article>`
      )
      .join("");
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
        (p, i) => `<article class="signal-card" style="--d:${i * 70}ms">
          <span class="signal-title">${escapeHtml(p.title)}</span>
          <strong>${escapeHtml(p.metric)}</strong>
          <span class="signal-detail">${escapeHtml(p.detail)}</span>
        </article>`
      )
      .join("");
  }


  function smoothPath(points) {
    if (!points.length) return "";
    if (points.length === 1) return `M${points[0].x},${points[0].y}`;
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  }

  function areaChart({ series, width = 720, height = 110, aria = "Trend" }) {
    const rows = (series || []).map((d) => ({
      label: d.label ?? d.key ?? "",
      count: Number(d.count) || 0,
    }));
    if (!rows.length) {
      return '<p class="viz-empty">No data</p>';
    }
    const pad = { l: 8, r: 8, t: 14, b: 24 };
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;
    const max = Math.max(1, ...rows.map((d) => d.count));
    const stepX = rows.length > 1 ? innerW / (rows.length - 1) : 0;
    const points = rows.map((d, i) => ({
      x: pad.l + i * stepX,
      y: pad.t + innerH - (d.count / max) * innerH,
      d,
    }));
    const id = nextGradient("area");
    const line = smoothPath(points);
    const baseY = height - pad.b;

    const grid = [0.25, 0.5, 0.75]
      .map((f) => `<line class="grid-line" x1="0" x2="${width}" y1="${(pad.t + innerH * f).toFixed(1)}" y2="${(pad.t + innerH * f).toFixed(1)}" />`)
      .join("");

    const dots = points
      .map((p) => {
        const active = p.d.count > 0;
        return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${active ? 2.4 : 1.6}" fill="${active ? C.green : "#484f58"}"><title>${escapeHtml(p.d.label)}: ${p.d.count}</title></circle>`;
      })
      .join("");

    const labelIdx = [0, Math.floor(rows.length / 2), rows.length - 1];
    const labels = labelIdx
      .map((i) => {
        const p = points[i];
        const anchor = i === 0 ? "start" : i === rows.length - 1 ? "end" : "middle";
        return `<text class="axis-label" x="${p.x.toFixed(1)}" y="${height - 6}" text-anchor="${anchor}">${escapeHtml(String(p.d.label).slice(0, 10))}</text>`;
      })
      .join("");

    return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(aria)}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${C.green}" stop-opacity="0.38" />
          <stop offset="55%" stop-color="${C.blue}" stop-opacity="0.12" />
          <stop offset="100%" stop-color="${C.blue}" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="${id}-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${C.green}" />
          <stop offset="100%" stop-color="${C.blue}" />
        </linearGradient>
      </defs>
      ${grid}
      <path d="${line} L${points[points.length - 1].x.toFixed(1)},${baseY} L${points[0].x.toFixed(1)},${baseY} Z" fill="url(#${id})" />
      <path class="area-line" d="${line}" fill="none" stroke="url(#${id}-line)" stroke-width="2" stroke-linecap="round" />
      ${dots}
      ${labels}
    </svg>`;
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
    const series = days.map((d) => ({
      label: formatDay(d.date),
      count: Number(d.count) || 0,
    }));
    host.innerHTML = areaChart({
      series,
      width: 720,
      height: 100,
      aria: "Contributions over the last 14 days",
    });
  }


  function renderLangDonut(langs) {
    const host = document.getElementById("lang-stack");
    const list = (langs || []).slice(0, 5);
    if (!list.length) {
      host.innerHTML = `<p class="viz-empty">No public language breakdown</p>`;
      return;
    }
    const total = list.reduce((sum, l) => sum + Number(l.percent || 0), 0) || 1;
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    const segments = list
      .map((lang) => {
        const share = (Number(lang.percent || 0) / total) * circumference;
        const seg = `<circle class="seg" cx="64" cy="64" r="${radius}" stroke="${escapeHtml(
          lang.color || C.violet
        )}" stroke-width="12" stroke-dasharray="${share.toFixed(2)} ${
          circumference - share
        }" stroke-dashoffset="${(-offset).toFixed(2)}"><title>${escapeHtml(
          lang.name
        )}: ${lang.percent}%</title></circle>`;
        offset += share;
        return seg;
      })
      .join("");

    host.innerHTML = `<div class="lang-panel">
      <svg class="lang-donut" viewBox="0 0 128 128" role="img" aria-label="Language mix">
        <circle class="track" cx="64" cy="64" r="${radius}" stroke-width="12" />
        ${segments}
        <text x="64" y="63">${Math.round(Number(list[0].percent) || 0)}%</text>
        <text class="donut-sub" x="64" y="76">${escapeHtml(
          String(list[0].name).slice(0, 12)
        )}</text>
      </svg>
      <div class="lang-legend">
        ${list
          .map(
            (lang) => `<div class="lang-row">
              <span class="lang-dot" style="--dot:${escapeHtml(lang.color || C.violet)}"></span>
              <span class="lang-name">${escapeHtml(lang.name)}</span>
              <em>${lang.percent}%</em>
            </div>`
          )
          .join("")}
      </div>
    </div>`;
  }

  function renderWeekdayChart(weekdays) {
    const host = document.getElementById("weekday-chart");
    const rows = weekdays || [];
    if (!rows.length) {
      host.innerHTML = `<p class="viz-empty">No calendar data</p>`;
      return;
    }
    const width = 320;
    const height = 150;
    const pad = { l: 6, r: 6, t: 10, b: 24 };
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;
    const values = rows.map((d) => Number(d.count) || 0);
    const max = Math.max(1, ...values);
    const total = values.reduce((s, v) => s + v, 0);
    const avg = total / (values.length || 1);
    const gap = 8;
    const barW = (innerW - gap * (rows.length - 1)) / rows.length;
    const baseY = height - pad.b;
    const avgY = pad.t + innerH - (avg / max) * innerH;
    const id = nextGradient("weekday");

    const bars = rows
      .map((d, i) => {
        const count = Number(d.count) || 0;
        const bh = count ? Math.max(4, (count / max) * innerH) : 2;
        const x = pad.l + i * (barW + gap);
        const y = baseY - bh;
        const hot = count === max && count > 0;
        return `<rect class="bar" style="--d:${i * 55}ms" x="${x.toFixed(
          1
        )}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(
          1
        )}" rx="4" fill="url(#${hot ? `${id}-hot` : id})"><title>${escapeHtml(
          d.label
        )}: ${count}</title></rect>
        <text class="axis-label" x="${(x + barW / 2).toFixed(
          1
        )}" y="${height - 8}" text-anchor="middle">${escapeHtml(
          String(d.label).slice(0, 1)
        )}</text>`;
      })
      .join("");

    host.innerHTML = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Contributions by weekday">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${C.blue}" />
          <stop offset="100%" stop-color="${C.blue}" stop-opacity="0.16" />
        </linearGradient>
        <linearGradient id="${id}-hot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${C.green}" />
          <stop offset="100%" stop-color="${C.green}" stop-opacity="0.2" />
        </linearGradient>
      </defs>
      <line class="grid-line" x1="${pad.l}" x2="${width - pad.r}" y1="${avgY.toFixed(
        1
      )}" y2="${avgY.toFixed(1)}" />
      <text class="axis-label" x="${width - pad.r}" y="${(avgY - 5).toFixed(
        1
      )}" text-anchor="end">avg ${Math.round(avg)}</text>
      ${bars}
    </svg>`;
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
      { label: "Opened", value: opened, color: C.blue },
      { label: "Merged", value: Number(prs.merged) || 0, color: C.green },
      { label: "Closed", value: Number(prs.closed) || 0, color: C.amber },
    ];
    const max = Math.max(...rows.map((r) => r.value), 1);
    const html = rows
      .map((r, i) => {
        const width = Math.round((r.value / max) * 100);
        return `<div class="funnel-row">
          <span>${r.label}</span>
          <div class="funnel-track"><span style="width:${width}%;background:linear-gradient(90deg,${r.color},${r.color}99);animation-delay:${i * 90}ms"></span></div>
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

  function renderGauge(consistency) {
    const host = document.getElementById("consistency-gauge");
    const value = Number(consistency?.activePct);
    if (!Number.isFinite(value)) {
      host.innerHTML = `<p class="viz-empty">No calendar data</p>`;
      return;
    }
    const pctValue = Math.max(0, Math.min(100, value));
    const radius = 46;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pctValue / 100) * circumference;
    const days = formatNum(consistency.activeDays);
    const tracked = formatNum(consistency.daysTracked);

    host.innerHTML = `<div class="gauge">
      <svg viewBox="0 0 120 120" role="img" aria-label="${pctValue}% active days">
        <circle class="gauge-track" cx="60" cy="60" r="${radius}" stroke-width="9" />
        <circle class="gauge-value" cx="60" cy="60" r="${radius}" stroke-width="9"
          style="--len:${circumference.toFixed(1)};stroke-dasharray:${circumference.toFixed(
            1
          )};stroke-dashoffset:${offset.toFixed(1)}" />
        <text class="gauge-pct" x="60" y="62">${pctValue}%</text>
        <text class="gauge-cap" x="60" y="76">active days</text>
      </svg>
      <p class="gauge-note">${days} of ${tracked} days · ${
        consistency.avgPerActiveDay || 0
      } per active day</p>
    </div>`;
  }


  function renderMonthly(months) {
    const host = document.getElementById("monthly-chart");
    const rows = (months || []).filter(Boolean);
    if (!rows.length) {
      host.innerHTML = `<p class="viz-empty">No data</p>`;
      return;
    }
    const width = 720;
    const height = 140;
    const pad = { l: 8, r: 8, t: 26, b: 30 };
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;
    const values = rows.map((d) => Number(d.count) || 0);
    const max = Math.max(1, ...values);
    const gap = 16;
    const barW = (innerW - gap * (rows.length - 1)) / rows.length;
    const baseY = height - pad.b;
    const id = nextGradient("month");

    const bars = rows
      .map((d, i) => {
        const count = Number(d.count) || 0;
        const bh = count ? Math.max(4, (count / max) * innerH) : 2;
        const x = pad.l + i * (barW + gap);
        const y = baseY - bh;
        return `<rect class="bar" style="--d:${i * 70}ms" x="${x.toFixed(
          1
        )}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(
          1
        )}" rx="5" fill="url(#${id})"><title>${escapeHtml(
          d.label || d.key
        )}: ${count}</title></rect>
        <text class="axis-label" x="${(x + barW / 2).toFixed(
          1
        )}" y="${(y - 7).toFixed(1)}" text-anchor="middle">${formatNum(
          count
        )}</text>
        <text class="axis-label" x="${(x + barW / 2).toFixed(
          1
        )}" y="${height - 10}" text-anchor="middle">${escapeHtml(
          String(d.label || d.key || "").slice(0, 3)
        )}</text>`;
      })
      .join("");

    host.innerHTML = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly contributions">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${C.green}" />
          <stop offset="100%" stop-color="${C.blue}" stop-opacity="0.28" />
        </linearGradient>
      </defs>
      ${bars}
    </svg>`;
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
      parts.push(`${consistency.avgPerActiveDay} per active day`);
    }
    if (consistency.busiestWeekday?.label) {
      parts.push(`peaks on ${consistency.busiestWeekday.label}`);
    }
    if (trend?.label) {
      parts.push(trend.label);
    }
    note.textContent = parts.join(" · ");

    renderLangDonut(stats.topLanguages);
    renderWeekdayChart(viz.weekdays);
    renderFunnel(stats.funnel);
    renderGauge(consistency);
    document.getElementById("weekly-chart").innerHTML = areaChart({
      series: viz.weeks,
      width: 720,
      height: 130,
      aria: "Weekly contributions over the last 12 weeks",
    });
    renderMonthly(viz.months);
  }

  function renderLedger(stats) {
    const funnel = stats.funnel || {};
    const streak = stats.streak || {};
    const consistency = stats.viz?.consistency || {};
    const peak = consistency.peakDay;
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
          [
            "Issue close rate",
            funnel.issues?.closeRate != null
              ? `${funnel.issues.closeRate}%`
              : null,
          ],
        ],
      },
      {
        title: "Reach",
        rows: [
          ["Contributions this year", stats.yearContributions],
          ["Repository stars", stats.totalStars],
          ["Followers", stats.followers],
          ["Public repositories", stats.publicRepos],
        ],
      },
      {
        title: "Rhythm",
        rows: [
          ["Current streak", `${formatNum(streak.currentStreak)} days`],
          ["Longest streak", `${formatNum(streak.longestStreak)} days`],
          [
            "Peak day",
            peak ? `${formatDay(peak.date)} · ${formatNum(peak.count)}` : null,
          ],
          ["Busiest weekday", consistency.busiestWeekday?.label || null],
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


  async function updatePreview(username) {
    const bust = Date.now();
    const urls = {
      stats: statsUrl(username),
      langs: langsUrl(username),
      streak: streakUrl(username),
      graph: graphUrl(username),
      activity: activityUrl(username),
    };
    const options = {
      ...themeParams(),
      show_icons: String(showIcons.checked),
      layout: compactLangs.checked ? "compact" : "normal",
    };
    if (hideRank.checked) options.hide_rank = "true";
    const kinds = {
      stats: "stats",
      langs: "langs",
      streak: "streak",
      graph: "graph",
      activity: "activity",
    };

    await Promise.all(
      Object.entries(urls).map(async ([key, url]) => {
        const img = document.getElementById(`${key}-card`);
        if (!img) return;
        try {
          const dataUrl = await window.__CW_BRIDGE__.cardSrc(
            kinds[key],
            username,
            options
          );
          img.src = dataUrl || `${url}&_=${bust}`;
        } catch {
          img.src = `${url}&_=${bust}`;
        }
      })
    );

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

  async function loadUser(username, { scroll = true } = {}) {
    const clean = username.trim().replace(/^@/, "");
    if (!clean) return;

    generateBtn.disabled = true;
    const btnLabel = generateBtn.querySelector("span");
    if (btnLabel) btnLabel.textContent = "Loading…";
    setStatus("Fetching public GitHub data…", "");

    try {
      const data = await window.__CW_BRIDGE__.getJson(clean);

      currentUser = data.login;
      const avatar = document.getElementById("avatar");
      avatar.src = data.avatarUrl || "";
      avatar.alt = `${data.login} avatar`;
      document.getElementById("profile-name").textContent =
        data.name || data.login;
      const link = document.getElementById("profile-link");
      link.href = data.url || `https://github.com/${data.login}`;
      link.textContent = `@${data.login}`;

      renderProfileMeta(data);
      renderRank(data);
      renderKpis(data);
      renderSignals(data);
      renderRecent(data);
      renderVisualizations(data);
      renderLedger(data);
      renderContributionGrid(data.calendar || [], `@${data.login}`, true);
      updatePreview(data.login);

      generator.hidden = false;
      embed.hidden = false;
      if (scroll) {
        generator.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setStatus(`Profile loaded for @${data.login}.`, "ok");

      const url = new URL(window.location.href);
      url.searchParams.set("username", data.login);
      history.replaceState(null, "", url);
    } catch (err) {
      setStatus(friendlyError(err.message), "error");
      generator.hidden = true;
      embed.hidden = true;
      renderContributionGrid([], "No profile loaded", false);
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

  function dismissPreloader() {
    const preloader = document.getElementById("preloader");
    if (!preloader) return;

    const cleanup = () => {
      if (preloader.parentNode) preloader.remove();
      document.documentElement.classList.remove("is-loading");
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cleanup();
      return;
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      preloader.removeEventListener("transitionend", onEnd);
      cleanup();
    };
    const onEnd = (event) => {
      if (event.target !== preloader || event.propertyName !== "transform") {
        return;
      }
      finish();
    };
    preloader.addEventListener("transitionend", onEnd);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => preloader.classList.add("is-done"));
    });
    setTimeout(finish, 1400);
  }

  function revealPage() {
    if (!document.getElementById("preloader")) return;

    // Reveal once the DOM is parsed and fonts have settled. Do NOT wait on
    // window.load: it blocks on every <img>, including the cache-busted SVG
    // cards, which makes a cold visit look broken until the data arrives.
    // Fonts already use display=swap, so a short cap is enough.
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    const cap = new Promise((resolve) => setTimeout(resolve, 700));

    Promise.race([fontsReady, cap])
      .catch(() => {})
      .then(dismissPreloader);
  }

  renderContributionPreview();

  window.__CW_BRIDGE__.publicBase()
    .then((base) => {
      publicBase = base;
      if (currentUser) updatePreview(currentUser);
    })
    .catch(() => {});

  const params = new URLSearchParams(window.location.search);
  const preset = params.get("username");
  if (preset) {
    usernameInput.value = preset;
    loadUser(preset, { scroll: false });
  }

  revealPage();
})();

