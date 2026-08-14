/**
 * Contribution calendar parsing and streak math.
 * Days are UTC ISO dates (YYYY-MM-DD). A day counts toward a streak when count > 0
 * or, when only GitHub "level" is known, level > 0.
 */

function utcToday(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function addUtcDays(iso, delta) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function activityOf(day) {
  if (!day) return 0;
  if (typeof day.count === "number" && day.count > 0) return day.count;
  if (typeof day.level === "number" && day.level > 0) return day.level;
  return 0;
}

/**
 * @param {Array<{ date: string, count?: number, level?: number }>} days
 * @param {string} [today] YYYY-MM-DD
 */
function computeStreaks(days, today = utcToday()) {
  const sorted = [...(days || [])]
    .filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const byDate = new Map(sorted.map((d) => [d.date, d]));
  const totalFromCounts = sorted.reduce(
    (sum, d) => sum + (Number(d.count) || 0),
    0
  );

  let longest = 0;
  let longestStart = null;
  let longestEnd = null;
  let run = 0;
  let runStart = null;

  for (const day of sorted) {
    if (activityOf(day) > 0) {
      if (run === 0) runStart = day.date;
      run += 1;
      if (run > longest) {
        longest = run;
        longestStart = runStart;
        longestEnd = day.date;
      }
    } else {
      run = 0;
      runStart = null;
    }
  }

  // Current streak: still alive if you contributed today *or* yesterday
  // (today can still be in progress).
  let cursor = today;
  if (activityOf(byDate.get(cursor)) === 0) {
    cursor = addUtcDays(cursor, -1);
  }

  let current = 0;
  let currentEnd = activityOf(byDate.get(cursor)) > 0 ? cursor : null;
  let currentStart = null;
  while (activityOf(byDate.get(cursor)) > 0) {
    current += 1;
    currentStart = cursor;
    cursor = addUtcDays(cursor, -1);
  }

  return {
    total: totalFromCounts,
    currentStreak: current,
    currentStart,
    currentEnd,
    longestStreak: longest,
    longestStart,
    longestEnd,
  };
}

/**
 * Parse GitHub's public `/users/:user/contributions` HTML.
 * Cells expose data-date + data-level (0–4). Exact counts come from adjacent tooltips
 * when present; otherwise count is 0 or 1 from the level.
 */
function parseTooltipCount(text) {
  const clean = String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/^no contributions/i.test(clean)) return 0;
  const n = clean.match(/^([\d,]+)\s+contributions?/i);
  return n ? Number(n[1].replace(/,/g, "")) : null;
}

function parseContributionsHtml(html) {
  const days = [];
  const seen = new Set();
  const countsById = new Map();
  const tipRe = /<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([\s\S]*?)<\/tool-tip>/gi;
  let tip;
  while ((tip = tipRe.exec(html))) {
    const count = parseTooltipCount(tip[2]);
    if (count != null) countsById.set(tip[1], count);
  }

  const cellRe = /<td\b([^>]*)>/gi;
  let cell;
  while ((cell = cellRe.exec(html))) {
    const attrs = cell[1];
    const dateMatch = attrs.match(/data-date="(\d{4}-\d{2}-\d{2})"/);
    if (!dateMatch) continue;
    const date = dateMatch[1];
    if (seen.has(date)) continue;
    seen.add(date);
    const levelMatch = attrs.match(/data-level="(\d)"/);
    const idMatch = attrs.match(/\bid="([^"]+)"/);
    const level = levelMatch ? Number(levelMatch[1]) : 0;
    const fromTip = idMatch ? countsById.get(idMatch[1]) : undefined;
    const count = typeof fromTip === "number" ? fromTip : level > 0 ? 1 : 0;
    days.push({ date, level, count });
  }

  days.sort((a, b) => (a.date < b.date ? -1 : 1));

  const heading = html.match(
    /([\d,]+)\s+contributions?\s+in the last year/i
  );
  const headingTotal = heading
    ? Number(heading[1].replace(/,/g, ""))
    : days.reduce((s, d) => s + d.count, 0);

  return { days, total: headingTotal };
}

const LEVEL_FROM_GRAPHQL = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

function calendarFromGraphQL(collection) {
  const cal = collection?.contributionCalendar;
  const days = [];
  for (const week of cal?.weeks || []) {
    for (const day of week.contributionDays || []) {
      days.push({
        date: day.date,
        count: day.contributionCount || 0,
        level: LEVEL_FROM_GRAPHQL[day.contributionLevel] ?? (day.contributionCount ? 1 : 0),
      });
    }
  }
  return {
    days,
    total: cal?.totalContributions ?? days.reduce((s, d) => s + d.count, 0),
  };
}

module.exports = {
  utcToday,
  addUtcDays,
  computeStreaks,
  parseContributionsHtml,
  parseTooltipCount,
  calendarFromGraphQL,
};
