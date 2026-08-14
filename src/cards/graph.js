/**
 * GitHub-style contribution heatmap SVG for README embeds.
 */

const { THEMES } = require("./stats");

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LEVEL_COLORS = {
  default: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  dark: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  light: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
  tokyonight: ["#1a1b27", "#283655", "#3d59a1", "#7aa2f7", "#bb9af7"],
  radical: ["#141321", "#4a1942", "#9b1d6a", "#fe428e", "#f8d847"],
  professional: ["#1e2633", "#3d4a3a", "#6b8f71", "#c4a574", "#e8d5a3"],
};

function weekday(iso) {
  return new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 Sun
}

/**
 * @param {object} stats
 * @param {object} options
 */
function renderGraphCard(stats, options = {}) {
  const theme = THEMES[options.theme] || THEMES.default;
  const hideBorder =
    options.hide_border === true || options.hide_border === "true";
  const palette = LEVEL_COLORS[options.theme] || LEVEL_COLORS.default;
  const days = [...(stats.calendar || [])].sort((a, b) =>
    a.date < b.date ? -1 : 1
  );
  const name = escapeXml(stats.name || stats.login || "GitHub");
  const total = stats.yearContributions ?? 0;

  if (!days.length) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="495" height="140" viewBox="0 0 495 140" role="img">
  <title>${name}'s Contribution Graph</title>
  <rect x="0.5" y="0.5" width="494" height="139" rx="8" fill="${theme.bg}" stroke="${hideBorder ? "none" : theme.border}"/>
  <text x="24" y="40" fill="${theme.title}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="16" font-weight="600">${name}'s Contributions</text>
  <text x="24" y="78" fill="${theme.muted}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="13">Contribution calendar is unavailable for this profile right now.</text>
</svg>`;
  }

  const cell = 11;
  const gap = 3;
  const left = 36;
  const top = 52;
  const weeks = 53;
  const width = left + weeks * (cell + gap) + 16;
  const height = top + 7 * (cell + gap) + 28;

  // Bucket days into week columns (Sun-start, like GitHub)
  const columns = [];
  let col = [];
  for (const day of days) {
    const wd = weekday(day.date);
    if (wd === 0 && col.length) {
      columns.push(col);
      col = [];
    }
    col.push(day);
  }
  if (col.length) columns.push(col);
  const shown = columns.slice(-weeks);

  let cells = "";
  shown.forEach((week, wi) => {
    week.forEach((day) => {
      const row = weekday(day.date);
      const level = Math.max(0, Math.min(4, Number(day.level) || 0));
      const x = left + wi * (cell + gap);
      const y = top + row * (cell + gap);
      cells += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${palette[level]}">
        <title>${escapeXml(day.date)}: ${day.count ?? level} contributions</title>
      </rect>`;
    });
  });

  const labels = ["Sun", "", "Tue", "", "Thu", "", "Sat"]
    .map((lab, i) =>
      lab
        ? `<text x="8" y="${top + i * (cell + gap) + 9}" class="dow" fill="${theme.muted}">${lab}</text>`
        : ""
    )
    .join("");

  const legend = [0, 1, 2, 3, 4]
    .map((lvl, i) => {
      const x = width - 16 - (5 - i) * (cell + 3);
      return `<rect x="${x}" y="${height - 20}" width="${cell}" height="${cell}" rx="2" fill="${palette[lvl]}"/>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${name}'s contribution graph">
  <title>${name}'s Contribution Graph</title>
  <style>
    .title { font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif; }
    .meta { font: 400 12px 'Segoe UI', Ubuntu, Sans-Serif; }
    .dow { font: 400 9px 'Segoe UI', Ubuntu, Sans-Serif; }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8"
    fill="${theme.bg}" stroke="${hideBorder ? "none" : theme.border}"/>
  <text x="16" y="28" class="title" fill="${theme.title}">${name}'s Contributions</text>
  <text x="${width - 16}" y="28" text-anchor="end" class="meta" fill="${theme.muted}">${total} in the last year</text>
  ${labels}
  ${cells}
  <text x="${width - 16 - 5 * (cell + 3) - 28}" y="${height - 11}" class="dow" fill="${theme.muted}">Less</text>
  ${legend}
  <text x="${width - 12}" y="${height - 11}" text-anchor="end" class="dow" fill="${theme.muted}">More</text>
</svg>`;
}

module.exports = { renderGraphCard };
