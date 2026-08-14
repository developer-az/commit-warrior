/**
 * Render a top-languages SVG card for README embeds.
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
function renderLanguagesCard(stats, options = {}) {
  const theme = THEMES[options.theme] || THEMES.default;
  const layout = options.layout || "normal";
  const hideBorder =
    options.hide_border === true || options.hide_border === "true";
  const count = Math.min(
    Number(options.langs_count) || 6,
    stats.topLanguages?.length || 0
  );
  const langs = (stats.topLanguages || []).slice(0, count);
  const title = `Most Used Languages`;
  const width = 300;

  if (!langs.length) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="120" viewBox="0 0 ${width} 120" role="img">
  <title>${title}</title>
  <style>
    .title { font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif; }
    .msg { font: 400 13px 'Segoe UI', Ubuntu, Sans-Serif; }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="119" rx="8"
    fill="${theme.bg}" stroke="${hideBorder ? "none" : theme.border}"/>
  <text x="25" y="32" class="title" fill="${theme.title}">${title}</text>
  <text x="25" y="70" class="msg" fill="${theme.muted}">No public language data for this profile.</text>
</svg>`;
  }

  if (layout === "compact") {
    const height = 90 + Math.ceil(langs.length / 2) * 22;
    let progress = "";
    let x = 0;
    const barWidth = width - 50;
    for (const lang of langs) {
      const w = (lang.percent / 100) * barWidth;
      progress += `<rect x="${25 + x}" y="50" width="${Math.max(w, 0)}" height="8" fill="${lang.color}"/>`;
      x += w;
    }

    let labels = "";
    langs.forEach((lang, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const lx = 25 + col * 140;
      const ly = 80 + row * 22;
      labels += `
        <circle cx="${lx}" cy="${ly - 4}" r="4" fill="${lang.color}"/>
        <text x="${lx + 12}" y="${ly}" class="lang" fill="${theme.text}">${escapeXml(lang.name)} ${lang.percent}%</text>
      `;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <title>${title}</title>
  <style>
    .title { font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif; }
    .lang { font: 400 12px 'Segoe UI', Ubuntu, Sans-Serif; }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8"
    fill="${theme.bg}" stroke="${hideBorder ? "none" : theme.border}"/>
  <text x="25" y="32" class="title" fill="${theme.title}">${title}</text>
  <rect x="25" y="50" width="${barWidth}" height="8" rx="4" fill="${theme.border}"/>
  ${progress}
  ${labels}
</svg>`;
  }

  // Normal layout with progress bars
  const lineHeight = 40;
  const height = 55 + langs.length * lineHeight + 10;
  let body = "";
  langs.forEach((lang, i) => {
    const y = 55 + i * lineHeight;
    const barW = ((width - 50) * lang.percent) / 100;
    body += `
      <text x="25" y="${y}" class="lang" fill="${theme.text}">${escapeXml(lang.name)}</text>
      <text x="${width - 25}" y="${y}" class="lang" fill="${theme.muted}" text-anchor="end">${lang.percent}%</text>
      <rect x="25" y="${y + 8}" width="${width - 50}" height="8" rx="4" fill="${theme.border}"/>
      <rect x="25" y="${y + 8}" width="${Math.max(barW, 0)}" height="8" rx="4" fill="${lang.color}">
        <animate attributeName="width" from="0" to="${Math.max(barW, 0)}" dur="0.8s" fill="freeze"/>
      </rect>
    `;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <title>${title}</title>
  <style>
    .title { font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif; }
    .lang { font: 400 13px 'Segoe UI', Ubuntu, Sans-Serif; }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8"
    fill="${theme.bg}" stroke="${hideBorder ? "none" : theme.border}"/>
  <text x="25" y="32" class="title" fill="${theme.title}">${title}</text>
  ${body}
</svg>`;
}

module.exports = { renderLanguagesCard };
