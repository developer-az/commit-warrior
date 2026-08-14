/**
 * Streak SVG card — total contributions, current streak, longest streak.
 */

const { THEMES } = require("./stats");

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatRange(start, end) {
  if (!start || !end) return "—";
  const fmt = (iso) => {
    const [y, m, d] = iso.split("-");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[Number(m) - 1]} ${Number(d)}, ${y}`;
  };
  if (start === end) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatNumber(n) {
  return new Intl.NumberFormat("en-US").format(Number(n) || 0);
}

/**
 * @param {object} stats
 * @param {object} options
 */
function renderStreakCard(stats, options = {}) {
  const theme = THEMES[options.theme] || THEMES.default;
  const hideBorder =
    options.hide_border === true || options.hide_border === "true";
  const streak = stats.streak || {};
  const total =
    stats.yearContributions ??
    streak.total ??
    0;
  const name = escapeXml(stats.name || stats.login || "GitHub");
  const width = 495;
  const height = 195;

  const cols = [
    {
      label: "Total Contributions",
      value: formatNumber(total),
      sub: "Last 12 months",
      accent: theme.muted,
    },
    {
      label: "Current Streak",
      value: String(streak.currentStreak || 0),
      sub: formatRange(streak.currentStart, streak.currentEnd),
      accent: theme.title,
      ring: true,
    },
    {
      label: "Longest Streak",
      value: String(streak.longestStreak || 0),
      sub: formatRange(streak.longestStart, streak.longestEnd),
      accent: theme.icon,
    },
  ];

  const colW = width / 3;
  let body = "";
  cols.forEach((col, i) => {
    const cx = colW * i + colW / 2;
    if (col.ring) {
      body += `
        <circle cx="${cx}" cy="88" r="38" fill="none" stroke="${theme.border}" stroke-width="4"/>
        <circle cx="${cx}" cy="88" r="38" fill="none" stroke="${theme.ring}" stroke-width="4"
          stroke-dasharray="180 239" stroke-linecap="round" transform="rotate(-90 ${cx} 88)"/>
      `;
    }
    body += `
      <text x="${cx}" y="${col.ring ? 42 : 58}" text-anchor="middle" class="label" fill="${col.accent}">${escapeXml(col.label)}</text>
      <text x="${cx}" y="${col.ring ? 96 : 100}" text-anchor="middle" class="value" fill="${theme.text}">${escapeXml(col.value)}</text>
      <text x="${cx}" y="${col.ring ? 168 : 128}" text-anchor="middle" class="sub" fill="${theme.muted}">${escapeXml(col.sub)}</text>
    `;
    if (i < 2) {
      body += `<line x1="${colW * (i + 1)}" y1="40" x2="${colW * (i + 1)}" y2="${height - 24}" stroke="${theme.border}"/>`;
    }
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${name}'s contribution streak">
  <title>${name}'s GitHub Streak</title>
  <style>
    .title { font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif; }
    .label { font: 600 12px 'Segoe UI', Ubuntu, Sans-Serif; }
    .value { font: 800 28px 'Segoe UI', Ubuntu, Sans-Serif; }
    .sub { font: 400 11px 'Segoe UI', Ubuntu, Sans-Serif; }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8"
    fill="${theme.bg}" stroke="${hideBorder ? "none" : theme.border}"/>
  <text x="24" y="28" class="title" fill="${theme.title}">${name}'s Streak</text>
  ${body}
</svg>`;
}

module.exports = { renderStreakCard };
