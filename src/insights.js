/**
 * Today vs yesterday activity, plus a few compact highlights.
 */

const { utcToday, addUtcDays } = require("./streak");

function n(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(n(value));
}

function dayCount(day) {
  if (!day) return 0;
  if (typeof day.count === "number" && Number.isFinite(day.count)) {
    return Math.max(0, day.count);
  }
  if (typeof day.level === "number" && day.level > 0) return 1;
  return 0;
}

function pct(part, whole) {
  if (!whole) return null;
  return Math.round((n(part) / n(whole)) * 100);
}

/**
 * @param {Array<{ date: string, count?: number, level?: number }>} days
 * @param {Date} [now]
 */
function buildRecentActivity(days, now = new Date()) {
  const today = utcToday(now);
  const yesterday = addUtcDays(today, -1);
  const prior = addUtcDays(today, -2);
  const sorted = [...(days || [])]
    .filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const byDate = new Map(sorted.map((d) => [d.date, d]));
  const lastCalendarDate = sorted.length ? sorted[sorted.length - 1].date : null;

  const todayPublished = byDate.has(today);
  const yesterdayPublished = byDate.has(yesterday);
  const todayCount = dayCount(byDate.get(today));
  const yesterdayCount = dayCount(byDate.get(yesterday));
  const priorCount = dayCount(byDate.get(prior));
  const delta = todayCount - yesterdayCount;

  const last14 = [];
  for (let i = 13; i >= 0; i -= 1) {
    const date = addUtcDays(today, -i);
    last14.push({
      date,
      count: dayCount(byDate.get(date)),
      published: byDate.has(date),
    });
  }

  let last7Count = 0;
  let last7ActiveDays = 0;
  for (let i = 0; i < 7; i += 1) {
    const count = dayCount(byDate.get(addUtcDays(today, -i)));
    last7Count += count;
    if (count > 0) last7ActiveDays += 1;
  }

  let status = "idle";
  let headline = "Quiet";
  if (todayCount > 0) {
    status = "active";
    headline = "Active today";
  } else if (yesterdayCount > 0) {
    status = "watch";
    headline = "Active yesterday";
  } else if (!todayPublished && lastCalendarDate && lastCalendarDate < today) {
    status = "stale";
    headline = "Calendar lag";
  }

  return {
    generatedAt: now.toISOString(),
    today,
    yesterday,
    prior,
    todayCount,
    yesterdayCount,
    priorCount,
    delta,
    todayPublished,
    yesterdayPublished,
    lastCalendarDate,
    last7Count,
    last7ActiveDays,
    last14,
    status,
    headline,
  };
}

/**
 * Short labeled facts only. Skip anything we cannot state cleanly.
 */
function buildHighlights(stats) {
  const items = [];
  const mergeRate = pct(stats.mergedPRs, stats.totalPRs);
  if (mergeRate != null) {
    items.push({
      label: "PRs merged",
      value: `${mergeRate}%`,
    });
  }
  if (n(stats.totalReviews)) {
    items.push({
      label: "Reviews",
      value: formatCount(stats.totalReviews),
    });
  }
  const top = stats.topLanguages?.[0];
  if (top?.name) {
    items.push({
      label: "Top language",
      value: top.name,
    });
  }
  const streak = n(stats.streak?.currentStreak);
  if (streak) {
    items.push({
      label: "Current streak",
      value: `${streak} day${streak === 1 ? "" : "s"}`,
    });
  }
  return items;
}

module.exports = {
  buildRecentActivity,
  buildHighlights,
  formatCount,
  dayCount,
};
