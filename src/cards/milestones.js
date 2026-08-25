/**
 * Credential strip for README embeds — factual thresholds, not trophies.
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
  const items = (stats.milestones || []).slice(0, 6);
  const width = 495;
  const height = items.length ? 56 + Math.ceil(items.length / 2) * 28 : 100;

  if (!items.length) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="100" viewBox="0 0 ${width} 100" role="img">
  <title>${name} — thresholds</title>
  <rect x="0.5" y="0.5" width="${width - 1}" height="99" rx="6"
    fill="${theme.bg}" stroke="${hideBorder ? "none" : theme.border}"/>
  <text x="24" y="34" fill="${theme.title}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="15" font-weight="600">Public activity thresholds</text>
  <text x="24" y="62" fill="${theme.muted}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="12">No qualifying thresholds for this profile yet.</text>
</svg>`;
  }

  let body = "";
  items.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 24 + col * 230;
    const y = 52 + row * 28;
    body += `<text x="${x}" y="${y}" fill="${theme.text}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="12" font-weight="500">${escapeXml(item.label)}</text>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${name} activity thresholds">
  <title>${name} — activity thresholds</title>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="6"
    fill="${theme.bg}" stroke="${hideBorder ? "none" : theme.border}"/>
  <text x="24" y="30" fill="${theme.title}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="15" font-weight="600">Activity thresholds</text>
  ${body}
</svg>`;
}

module.exports = { renderMilestonesCard };
