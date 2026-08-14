/**
 * Render a GitHub-style README stats SVG card.
 */

const THEMES = {
  default: {
    title: "#2ea043",
    text: "#e6edf3",
    icon: "#3fb950",
    bg: "#0d1117",
    border: "#30363d",
    ring: "#238636",
    muted: "#8b949e",
  },
  dark: {
    title: "#58a6ff",
    text: "#e6edf3",
    icon: "#58a6ff",
    bg: "#0d1117",
    border: "#30363d",
    ring: "#1f6feb",
    muted: "#8b949e",
  },
  radical: {
    title: "#fe428e",
    text: "#a9fef7",
    icon: "#f8d847",
    bg: "#141321",
    border: "#fe428e55",
    ring: "#fe428e",
    muted: "#a9fef799",
  },
  tokyonight: {
    title: "#70a5fd",
    text: "#38bdae",
    icon: "#bf91f3",
    bg: "#1a1b27",
    border: "#70a5fd44",
    ring: "#bf91f3",
    muted: "#38bdae99",
  },
  transparent: {
    title: "#2ea043",
    text: "#e6edf3",
    icon: "#3fb950",
    bg: "#00000000",
    border: "#00000000",
    ring: "#238636",
    muted: "#8b949e",
  },
  professional: {
    title: "#d4b483",
    text: "#f3efe6",
    icon: "#c4a574",
    bg: "#161c25",
    border: "#2c3544",
    ring: "#d4b483",
    muted: "#9aa3b2",
  },
  light: {
    title: "#0969da",
    text: "#1f2328",
    icon: "#1a7f37",
    bg: "#ffffff",
    border: "#d0d7de",
    ring: "#1a7f37",
    muted: "#656d76",
  },
};

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNumber(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 10_000) return `${(num / 1_000).toFixed(1)}k`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
}

const ICONS = {
  star: `<path fill="currentColor" d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/>`,
  commits: `<path fill="currentColor" d="M1.643 3.143 .75.75V0h.5v.75l.9 2.393A5.002 5.002 0 0 1 10.5 6.5a5 5 0 0 1-9.5 2.143A.75.75 0 0 1 2 8.5a3.5 3.5 0 1 0 5.5-2.857A.75.75 0 0 1 8 5.25 5.002 5.002 0 0 1 1.643 3.143Z"/><path fill="currentColor" d="M7.5 1.75a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-.75v8.5a.75.75 0 0 1-1.5 0V2.5h-.75a.75.75 0 0 1-.75-.75Z"/>`,
  prs: `<path fill="currentColor" d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/>`,
  issues: `<path fill="currentColor" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm9-3a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.92 6.085a.75.75 0 0 1 .904.37l.001.002.002.004.007.016.026.058c.02.044.049.105.084.183a4.46 4.46 0 0 0 .268.538c.202.356.47.762.756 1.07.285.307.557.508.704.586A.75.75 0 0 1 9 9.25v.753a.75.75 0 0 1-1.5 0V9.15a3.66 3.66 0 0 1-.45-.372 5.08 5.08 0 0 1-.677-.95 5.3 5.3 0 0 1-.318-.652l-.025-.056-.008-.017-.002-.004v-.002A.75.75 0 0 1 6.92 6.085Z"/>`,
  merged: `<path fill="currentColor" d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.75 5.75 0 0 1 4 3.75v-.955a2.25 2.25 0 1 1 1.5 0V5.154ZM4.25 13a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-9.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5.078 15.25a.75.75 0 0 1 .75-.75h5.844a.75.75 0 0 1 0 1.5H5.828a.75.75 0 0 1-.75-.75Z"/>`,
  reviews: `<path fill="currentColor" d="M1.679 7.932c.172-.174.4-.338.68-.486.55-.288 1.305-.493 2.141-.493s1.59.205 2.141.493c.28.148.508.312.68.487.163.166.276.338.276.568 0 .23-.113.402-.276.568-.172.174-.4.338-.68.486-.55.288-1.305.493-2.141.493s-1.59-.205-2.141-.493a2.8 2.8 0 0 1-.68-.487C1.516 8.902 1.4 8.73 1.4 8.5c0-.23.116-.402.279-.568ZM8 9.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/><path fill="currentColor" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z"/>`,
  contribs: `<path fill="currentColor" d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1V1.5h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/>`,
  followers: `<path fill="currentColor" d="M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4.001 4.001 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z"/>`,
};

function iconSvg(name, color, x, y) {
  const path = ICONS[name] || ICONS.star;
  return `<g transform="translate(${x},${y})" style="color:${color}">
    <svg width="16" height="16" viewBox="0 0 16 16">${path}</svg>
  </g>`;
}

/**
 * @param {object} stats
 * @param {object} options
 */
function renderStatsCard(stats, options = {}) {
  const theme = THEMES[options.theme] || THEMES.default;
  const showIcons = options.show_icons !== false && options.show_icons !== "false";
  const hideRank = options.hide_rank === true || options.hide_rank === "true";
  const hideBorder =
    options.hide_border === true || options.hide_border === "true";

  const hide = new Set(
    String(options.hide || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  const rows = [
    { key: "stars", label: "Total Stars Earned", value: stats.totalStars, icon: "star" },
    { key: "commits", label: "Total Commits", value: stats.totalCommits, icon: "commits" },
    { key: "prs", label: "Total PRs", value: stats.totalPRs, icon: "prs" },
    { key: "prs_merged", label: "PRs Merged", value: stats.mergedPRs, icon: "merged" },
    { key: "issues", label: "Total Issues", value: stats.totalIssues, icon: "issues" },
    { key: "issues_closed", label: "Issues Closed", value: stats.closedIssues, icon: "issues" },
    { key: "reviews", label: "Code Reviews", value: stats.totalReviews, icon: "reviews" },
    { key: "contribs", label: "Contributed to", value: stats.contributedTo, icon: "contribs" },
    { key: "followers", label: "Followers", value: stats.followers, icon: "followers" },
  ].filter((r) => !hide.has(r.key));

  // Default visible set (compact professional card) unless custom hide used
  const defaultKeys = new Set([
    "stars",
    "commits",
    "prs",
    "prs_merged",
    "issues",
    "issues_closed",
    "reviews",
    "contribs",
  ]);
  const extra = new Set(
    String(options.show || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const visible = rows.filter(
    (r) => defaultKeys.has(r.key) || extra.has(r.key)
  );

  const lineHeight = 25;
  const paddingTop = 50;
  const height = paddingTop + visible.length * lineHeight + 20;
  const width = hideRank ? 380 : 460;
  const title = `${escapeXml(stats.name)}'s GitHub Stats`;

  const rank = stats.rank || { level: "C", score: 0 };
  const circumference = 2 * Math.PI * 40;
  const progress = Math.min(100, Math.max(0, rank.score));
  const dash = (progress / 100) * circumference;

  let body = "";
  visible.forEach((row, i) => {
    const y = paddingTop + i * lineHeight;
    const labelX = showIcons ? 45 : 25;
    body += `
      ${showIcons ? iconSvg(row.icon, theme.icon, 25, y - 12) : ""}
      <text x="${labelX}" y="${y}" class="stat" fill="${theme.text}">${escapeXml(row.label)}:</text>
      <text x="${hideRank ? 340 : 300}" y="${y}" class="stat bold" fill="${theme.text}" text-anchor="end">${formatNumber(row.value)}</text>
    `;
  });

  const rankSvg = hideRank
    ? ""
    : `
    <g transform="translate(${width - 90}, ${height / 2})">
      <circle cx="0" cy="0" r="40" fill="none" stroke="${theme.border}" stroke-width="6"/>
      <circle cx="0" cy="0" r="40" fill="none" stroke="${theme.ring}" stroke-width="6"
        stroke-dasharray="${dash} ${circumference}"
        stroke-linecap="round" transform="rotate(-90)"
        style="animation: rank 1s ease-out forwards"/>
      <text x="0" y="6" text-anchor="middle" class="rank" fill="${theme.title}">${escapeXml(rank.level)}</text>
      <text x="0" y="58" text-anchor="middle" class="rank-label" fill="${theme.muted}">Rank</text>
    </g>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">
  <title>${title}</title>
  <style>
    .title { font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif; }
    .stat { font: 400 14px 'Segoe UI', Ubuntu, Sans-Serif; }
    .stat.bold { font-weight: 700; }
    .rank { font: 800 24px 'Segoe UI', Ubuntu, Sans-Serif; }
    .rank-label { font: 600 12px 'Segoe UI', Ubuntu, Sans-Serif; }
    @keyframes rank { from { stroke-dasharray: 0 ${circumference}; } }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8"
    fill="${theme.bg}" stroke="${hideBorder ? "none" : theme.border}"/>
  <text x="25" y="32" class="title" fill="${theme.title}">${title}</text>
  ${body}
  ${rankSvg}
</svg>`;
}

module.exports = { renderStatsCard, THEMES };
