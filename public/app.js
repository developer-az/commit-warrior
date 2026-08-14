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
    if (!iso) return "just now";
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function formatDay(iso) {
    if (!iso) return "—";
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
    if (/not found/i.test(msg)) {
      return "No GitHub user by that name. Check the spelling — usernames use letters, numbers, and hyphens.";
    }
    if (/invalid github username/i.test(msg)) {
      return "That doesn’t look like a GitHub username. Use letters, numbers, and hyphens only.";
    }
    if (/401|bad credentials/i.test(msg)) {
      return "GitHub rejected a server credential. Public lookups should still work — try again in a moment.";
    }
    if (/403|rate limit/i.test(msg)) {
      return "GitHub is rate-limiting lookups right now. Wait a minute and try again.";
    }
    return msg || "Could not load this profile.";
  }

  function setStatus(message, type = "") {
    statusLine.textContent = message;
    statusLine.className = `hero-hint${type ? ` ${type}` : ""}`;
  }

  function deltaHint(delta, todayPublished) {
    if (!todayPublished) return { text: "Today not published yet", cls: "" };
    if (delta === 0) return { text: "Same as yesterday", cls: "" };
    if (delta > 0) return { text: `+${formatNum(delta)} vs yesterday`, cls: "up" };
    return { text: `${formatNum(delta)} vs yesterday`, cls: "down" };
  }

  function renderRecent(stats) {
    const recent = stats.recent || {};
    const chip = document.getElementById("status-chip");
    chip.textContent = recent.headline || "Status unavailable";
    chip.className = `status-chip ${recent.status || "idle"}`;

    document.getElementById("recent-detail").textContent =
      recent.detail ||
      "Contribution calendar did not load; career totals below are still from GitHub.";

    const served = document.getElementById("served-at");
    served.dateTime = stats.servedAt || recent.generatedAt || "";
    served.textContent = `Served ${formatWhen(stats.servedAt || recent.generatedAt)}`;
    document.getElementById("live-label").textContent = stats.cached
      ? "Live (cached GitHub data)"
      : "Live";

    const todayLabel = recent.todayPublished
      ? formatNum(recent.todayCount)
      : "—";
    const yHint = recent.yesterdayPublished
      ? `${formatDay(recent.yesterday)}`
      : "Not on calendar yet";
    const change = deltaHint(Number(recent.delta) || 0, recent.todayPublished);

    const cards = [
      {
        kicker: "Today",
        value: todayLabel,
        hint: recent.todayPublished
          ? formatDay(recent.today)
          : "GitHub has not closed this day",
      },
      {
        kicker: "Yesterday",
        value: formatNum(recent.yesterdayCount),
        hint: yHint,
      },
      {
        kicker: "Change",
        value: recent.todayPublished
          ? `${Number(recent.delta) > 0 ? "+" : ""}${formatNum(recent.delta)}`
          : "—",
        hint: change.text,
        hintClass: change.cls,
      },
      {
        kicker: "Last 7 days",
        value: formatNum(recent.last7Count),
        hint: `${formatNum(recent.last7ActiveDays)} active day${
          Number(recent.last7ActiveDays) === 1 ? "" : "s"
        }`,
      },
    ];

    document.getElementById("delta-board").innerHTML = cards
      .map(
        (c) => `<article class="delta-card">
          <span class="kicker">${c.kicker}</span>
          <strong>${c.value}</strong>
          <span class="hint ${c.hintClass || ""}">${c.hint}</span>
        </article>`
      )
      .join("");

    renderSparkline(recent.last14 || []);
  }

  function renderSparkline(days) {
    const host = document.getElementById("sparkline");
    if (!days.length) {
      host.innerHTML = `<p class="hint">No last-14-day calendar points yet.</p>`;
      return;
    }
    const w = 640;
    const h = 56;
    const max = Math.max(1, ...days.map((d) => Number(d.count) || 0));
    const gap = 4;
    const barW = (w - gap * (days.length - 1)) / days.length;
    const bars = days
      .map((d, i) => {
        const count = Number(d.count) || 0;
        const bh = Math.max(count ? 4 : 2, (count / max) * (h - 8));
        const x = i * (barW + gap);
        const y = h - bh;
        const fill = count ? "#d4b483" : "#2a3340";
        const title = `${d.date}: ${count} contribution${count === 1 ? "" : "s"}`;
        return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="1.5" fill="${fill}"><title>${title}</title></rect>`;
      })
      .join("");
    host.innerHTML = `<svg class="sparkline" viewBox="0 0 ${w} ${h}" role="img" aria-label="Last 14 days of contributions">${bars}</svg>`;
  }

  function renderInsights(stats) {
    const items = stats.insights || [];
    document.getElementById("insights").innerHTML = items
      .map(
        (item) => `<article class="insight">
          <span class="kicker">${item.kicker || "Note"}</span>
          <h3>${item.title || "—"}</h3>
          <p>${item.body || "No additional context for this signal."}</p>
        </article>`
      )
      .join("");
  }

  function renderMetrics(stats) {
    const catalog = [
      ["Commits", stats.totalCommits, "All-time public commits attributed to this username."],
      ["Pull requests", stats.totalPRs, "PRs they opened — proposing a change."],
      ["PRs merged", stats.mergedPRs, "PRs that actually landed. The shipping number."],
      ["Issues closed", stats.closedIssues, "Issues they opened that are now closed."],
      ["Code reviews", stats.totalReviews, "Pull requests they reviewed."],
      ["Repos contributed to", stats.contributedTo, "Public repos they don’t own, with commits, issues, PRs, or comments."],
      ["Stars earned", stats.totalStars, "Stars on owned, non-fork repositories."],
      ["Year contributions", stats.yearContributions, "GitHub calendar total for the last 12 months."],
    ];
    document.getElementById("metrics").innerHTML = catalog
      .map(
        ([label, value, hint]) => `<div class="metric">
          <strong>${formatNum(value)}</strong>
          <span class="label">${label}</span>
          <span class="hint">${hint}</span>
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
    document.getElementById("stats-url").textContent = statsUrl(username);
    document.getElementById("langs-url").textContent = langsUrl(username);
    document.getElementById("streak-url").textContent = streakUrl(username);
    document.getElementById("graph-url").textContent = graphUrl(username);

    const md = `[![${username}'s GitHub stats](${statsUrl(username)})](https://github.com/${username})
![Top Languages](${langsUrl(username)})
![GitHub Streak](${streakUrl(username)})
![Contribution Graph](${graphUrl(username)})`;
    document.getElementById("markdown-output").textContent = md;
  }

  async function loadUser(username) {
    const clean = username.trim().replace(/^@/, "");
    if (!clean) return;

    generateBtn.disabled = true;
    const btnLabel = generateBtn.querySelector("span");
    if (btnLabel) btnLabel.textContent = "Loading…";
    setStatus("Fetching live GitHub activity…", "");

    try {
      const res = await fetch(`/api/json?username=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      currentUser = data.login;
      document.getElementById("avatar").src = data.avatarUrl || "";
      document.getElementById("avatar").alt = `${data.login} avatar`;
      document.getElementById("profile-name").textContent =
        data.name || data.login || "Unknown profile";
      const link = document.getElementById("profile-link");
      link.href = data.url || `https://github.com/${data.login}`;
      link.textContent = `@${data.login}`;
      document.getElementById("rank-pill").textContent = `Grade ${
        data.rank?.level || "—"
      }`;
      document.getElementById("rank-note").textContent =
        data.insights?.find((i) => i.kicker === "Public rank")?.body ||
        "Public rank is a weighted reading of commits, PRs, issues, reviews, stars, and followers.";
      document.getElementById("brief").textContent =
        data.brief || "Public GitHub totals loaded for this username.";

      renderRecent(data);
      renderInsights(data);
      renderMetrics(data);
      updatePreview(data.login);

      generator.hidden = false;
      embed.hidden = false;
      generator.scrollIntoView({ behavior: "smooth", block: "start" });

      setStatus(
        `Loaded @${data.login}. Today vs yesterday is from GitHub’s contribution calendar; career totals are all-time.`,
        "ok"
      );

      const url = new URL(window.location.href);
      url.searchParams.set("username", data.login);
      history.replaceState(null, "", url);
    } catch (err) {
      setStatus(friendlyError(err.message), "error");
      generator.hidden = true;
      embed.hidden = true;
    } finally {
      generateBtn.disabled = false;
      if (btnLabel) btnLabel.textContent = "Review this profile";
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
        copyBtn.textContent = "Select & copy";
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
