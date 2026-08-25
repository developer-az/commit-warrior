/**
 * Activity graph SVG — weekly contribution trend for README embeds.
 * Similar idea to popular "activity graph" README widgets.
 */

const { THEMES } = require("./stats");

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNumber(n) {
  return new Intl.NumberFormat("en-US").format(Number(n) || 0);
}

/**
 * Catmull-Rom → cubic bezier path through points.
 */
function smoothPath(points) {
  if (!points.length) return "";
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * @param {object} stats
 * @param {object} options
 */
function renderActivityCard(stats, options = {}) {
  const theme = THEMES[options.theme] || THEMES.professional || THEMES.default;
  const hideBorder =
    options.hide_border === true || options.hide_border === "true";
  const name = escapeXml(stats.name || stats.login || "GitHub");
  const series = stats.viz?.activity || [];
  const width = 840;
  const height = 280;
  const padL = 48;
  const padR = 28;
  const padT = 56;
  const padB = 42;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  if (!series.length) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="140" viewBox="0 0 ${width} 140" role="img">
  <title>${name}'s Activity</title>
  <rect x="0.5" y="0.5" width="${width - 1}" height="139" rx="8"
    fill="${theme.bg}" stroke="${hideBorder ? "none" : theme.border}"/>
  <text x="28" y="40" fill="${theme.title}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="16" font-weight="600">${name}'s Activity</text>
  <text x="28" y="80" fill="${theme.muted}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="13">Contribution activity is unavailable for this profile right now.</text>
</svg>`;
  }

  const max = Math.max(1, ...series.map((p) => Number(p.count) || 0));
  const points = series.map((p, i) => {
    const x =
      padL +
      (series.length === 1 ? chartW / 2 : (i / (series.length - 1)) * chartW);
    const y = padT + chartH - ((Number(p.count) || 0) / max) * chartH;
    return { x, y, count: Number(p.count) || 0, start: p.start };
  });

  const line = smoothPath(points);
  const area = `${line} L ${points[points.length - 1].x} ${padT + chartH} L ${points[0].x} ${padT + chartH} Z`;

  // Grid lines + y labels
  let grid = "";
  for (let i = 0; i <= 3; i += 1) {
    const y = padT + (chartH * i) / 3;
    const val = Math.round(max * (1 - i / 3));
    grid += `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="${theme.border}" stroke-opacity="0.55"/>`;
    grid += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" class="axis" fill="${theme.muted}">${val}</text>`;
  }

  // X labels: first, mid, last week starts
  const labelIdx = [
    0,
    Math.floor((series.length - 1) / 2),
    series.length - 1,
  ].filter((v, i, a) => a.indexOf(v) === i);
  let xLabels = "";
  for (const i of labelIdx) {
    const p = points[i];
    const label = series[i].start?.slice(0, 7) || "";
    xLabels += `<text x="${p.x}" y="${height - 16}" text-anchor="middle" class="axis" fill="${theme.muted}">${escapeXml(label)}</text>`;
  }

  const total = series.reduce((s, p) => s + (Number(p.count) || 0), 0);
  const peak = Math.max(...series.map((p) => Number(p.count) || 0));
  const consistency = stats.viz?.consistency?.activePct;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${name}'s contribution activity">
  <title>${name}'s GitHub Activity</title>
  <defs>
    <linearGradient id="cw-activity-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${theme.ring}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${theme.ring}" stop-opacity="0.02"/>
    </linearGradient>
  </defs>
  <style>
    .title { font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif; }
    .meta { font: 500 12px 'Segoe UI', Ubuntu, Sans-Serif; }
    .axis { font: 400 11px 'Segoe UI', Ubuntu, Sans-Serif; }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8"
    fill="${theme.bg}" stroke="${hideBorder ? "none" : theme.border}"/>
  <text x="28" y="28" class="title" fill="${theme.title}">${name}'s Activity</text>
  <text x="${width - 28}" y="28" text-anchor="end" class="meta" fill="${theme.muted}">${formatNumber(total)} contribs · peak ${formatNumber(peak)}/wk${consistency != null ? ` · ${consistency}% active days` : ""}</text>
  ${grid}
  <path d="${area}" fill="url(#cw-activity-fill)"/>
  <path d="${line}" fill="none" stroke="${theme.ring}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  ${xLabels}
</svg>`;
}

module.exports = { renderActivityCard, smoothPath };
