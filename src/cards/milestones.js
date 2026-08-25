/**
 * Compact milestone / trophy strip for README embeds.
 */

const { THEMES } = require("./stats");

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {object} stats
 * @param {object} options
 */
function renderMilestonesCard(stats, options = {}) {
  const theme = THEMES[options.theme] || THEMES.professional || THEMES.default;
  const hideBorder =
    options.hide_border === true || options.hide_border === "true";
  const name = escapeXml(stats.name || stats.login || "GitHub");
  const items = (stats.milestones || []).slice(0, 8);
  const width = 495;
  const cols = Math.min(4, Math.max(items.length, 1));
  const rows = Math.max(1, Math.ceil(items.length / cols));
  const height = items.length ? 58 + rows * 52 : 110;

  if (!items.length) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="110" viewBox="0 0 ${width} 110" role="img">
  <title>${name}'s Milestones</title>
  <rect x="0.5" y="0.5" width="${width - 1}" height="109" rx="8"
    fill="${theme.bg}" stroke="${hideBorder ? "none" : theme.border}"/>
  <text x="24" y="36" fill="${theme.title}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="16" font-weight="600">${name}'s Milestones</text>
  <text x="24" y="70" fill="${theme.muted}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="13">Keep shipping — milestones unlock as you go.</text>
</svg>`;
  }

  const cellW = (width - 32) / cols;
  let body = "";
  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 16 + col * cellW;
    const y = 48 + row * 52;
    body += `
      <rect x="${x}" y="${y}" width="${cellW - 10}" height="40" rx="6"
        fill="${theme.border}" fill-opacity="0.35" stroke="${theme.ring}" stroke-opacity="0.55"/>
      <text x="${x + (cellW - 10) / 2}" y="${y + 24}" text-anchor="middle" class="item" fill="${theme.text}">${escapeXml(item.label)}</text>
    `;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${name}'s milestones">
  <title>${name}'s GitHub Milestones</title>
  <style>
    .title { font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif; }
    .item { font: 600 12px 'Segoe UI', Ubuntu, Sans-Serif; }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8"
    fill="${theme.bg}" stroke="${hideBorder ? "none" : theme.border}"/>
  <text x="24" y="30" class="title" fill="${theme.title}">${name}'s Milestones</text>
  ${body}
</svg>`;
}

module.exports = { renderMilestonesCard };
