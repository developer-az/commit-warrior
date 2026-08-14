(() => {
  const form = document.getElementById("lookup-form");
  const usernameInput = document.getElementById("username");
  const statusLine = document.getElementById("status-line");
  const generateBtn = document.getElementById("generate-btn");
  const generator = document.getElementById("generator");
  const embed = document.getElementById("embed");
  const metrics = document.getElementById("metrics");
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
    const params = {
      username,
      theme: themeSelect.value,
      layout: compactLangs.checked ? "compact" : "normal",
    };
    return `${originBase()}/api/top-langs?${qs(params)}`;
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

  function formatNum(n) {
    return new Intl.NumberFormat().format(Number(n) || 0);
  }

  function setStatus(message, type = "") {
    statusLine.textContent = message;
    statusLine.className = `hero-hint${type ? ` ${type}` : ""}`;
  }

  function renderMetrics(stats) {
    const items = [
      ["Commits", stats.totalCommits],
      ["Pull Requests", stats.totalPRs],
      ["PRs Merged", stats.mergedPRs],
      ["Issues Closed", stats.closedIssues],
      ["Code Reviews", stats.totalReviews],
      ["Current Streak", stats.streak?.currentStreak],
      ["Year Contributions", stats.yearContributions],
      ["Stars", stats.totalStars],
    ];
    metrics.innerHTML = items
      .map(
        ([label, value]) =>
          `<div class="metric"><strong>${formatNum(value)}</strong><span>${label}</span></div>`
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
    setStatus("Fetching GitHub activity…", "");

    try {
      const res = await fetch(`/api/json?username=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      currentUser = data.login;
      document.getElementById("avatar").src = data.avatarUrl;
      document.getElementById("avatar").alt = `${data.login} avatar`;
      document.getElementById("profile-name").textContent = data.name || data.login;
      const link = document.getElementById("profile-link");
      link.href = data.url;
      link.textContent = `@${data.login}`;
      document.getElementById("rank-pill").textContent = `RANK ${data.rank?.level || "—"}`;

      renderMetrics(data);
      updatePreview(data.login);

      generator.hidden = false;
      embed.hidden = false;
      generator.scrollIntoView({ behavior: "smooth", block: "start" });

      const windowNote =
        data.commitsWindow === "all-time"
          ? " Commits, reviews, and contributed-to are all-time (not limited to this week/month)."
          : "";
      const note = data.partial
        ? ` Loaded public REST stats.${windowNote} Server GITHUB_TOKEN unlocks GraphQL contribution commits and higher rate limits.`
        : ` Full GraphQL stats loaded.${windowNote}`;
      setStatus(`Stats for @${data.login}.${note}`, "ok");

      const url = new URL(window.location.href);
      url.searchParams.set("username", data.login);
      history.replaceState(null, "", url);
    } catch (err) {
      setStatus(err.message || "Could not load stats", "error");
      generator.hidden = true;
      embed.hidden = true;
    } finally {
      generateBtn.disabled = false;
      const btnLabel = generateBtn.querySelector("span");
      if (btnLabel) btnLabel.textContent = "Show my stats";
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
      // Fallback when Clipboard API is blocked (some embeds / insecure contexts)
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
