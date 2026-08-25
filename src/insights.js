/**
 * Today vs yesterday activity, aggregates for charts, and compact highlights.
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

function weekdayIndex(iso) {
  // UTC Sunday = 0 … Saturday = 6 (GitHub calendar convention)
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

function mondayOfWeek(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function monthKey(iso) {
  return iso.slice(0, 7);
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
 * Chart-ready aggregates derived from the contribution calendar.
 * @param {Array<{ date: string, count?: number, level?: number }>} days
 * @param {Date} [now]
 */
function buildVisualizations(days, now = new Date()) {
  const today = utcToday(now);
  const sorted = [...(days || [])]
    .filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const byDate = new Map(sorted.map((d) => [d.date, d]));

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  let activeDays = 0;
  let totalCount = 0;
  let peakDay = null;

  for (const day of sorted) {
    const count = dayCount(day);
    totalCount += count;
    weekdayCounts[weekdayIndex(day.date)] += count;
    if (count > 0) {
      activeDays += 1;
      if (!peakDay || count > peakDay.count) {
        peakDay = { date: day.date, count };
      }
    }
  }

  const weekdays = weekdayLabels.map((label, i) => ({
    label,
    count: weekdayCounts[i],
  }));

  const weeks = [];
  for (let i = 11; i >= 0; i -= 1) {
    const end = addUtcDays(today, -i * 7);
    const start = addUtcDays(end, -6);
    let count = 0;
    for (let d = 0; d < 7; d += 1) {
      count += dayCount(byDate.get(addUtcDays(start, d)));
    }
    weeks.push({
      start,
      end,
      label: start.slice(5),
      count,
    });
  }

  const months = [];
  const monthCursor = new Date(`${today}T12:00:00Z`);
  monthCursor.setUTCDate(1);
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(monthCursor);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = d.toISOString().slice(0, 7);
    let count = 0;
    for (const day of sorted) {
      if (monthKey(day.date) === key) count += dayCount(day);
    }
    months.push({
      key,
      label: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      count,
    });
  }

  // Weekly series for the activity SVG (last ~52 weeks, Monday-aligned)
  const activity = [];
  const oldest = addUtcDays(today, -364);
  let cursor = mondayOfWeek(oldest);
  while (cursor <= today) {
    let count = 0;
    for (let d = 0; d < 7; d += 1) {
      const date = addUtcDays(cursor, d);
      if (date > today) break;
      count += dayCount(byDate.get(date));
    }
    activity.push({ start: cursor, count });
    cursor = addUtcDays(cursor, 7);
  }

  const spanned = sorted.length || 1;
  const consistency = {
    activeDays,
    daysTracked: spanned,
    activePct: Math.round((activeDays / spanned) * 100),
    total: totalCount,
    avgPerActiveDay: activeDays
      ? Math.round((totalCount / activeDays) * 10) / 10
      : 0,
    peakDay,
    busiestWeekday: weekdays.reduce(
      (best, cur) => (cur.count > (best?.count || -1) ? cur : best),
      null
    ),
  };

  return { weekdays, weeks, months, activity, consistency };
}

/**
 * PR / issue funnel for the website (and optional future cards).
 */
function buildFunnel(stats) {
  const opened = n(stats.totalPRs);
  const merged = n(stats.mergedPRs);
  const closed = n(stats.closedPRs);
  const issuesOpened = n(stats.totalIssues);
  const issuesClosed = n(stats.closedIssues);
  return {
    prs: {
      opened,
      merged,
      closed,
      mergeRate: pct(merged, opened),
      open: Math.max(0, opened - merged - closed),
    },
    issues: {
      opened: issuesOpened,
      closed: issuesClosed,
      closeRate: pct(issuesClosed, issuesOpened),
    },
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
  const consistency = stats.viz?.consistency;
  if (consistency?.activePct) {
    items.push({
      label: "Active days",
      value: `${consistency.activePct}%`,
    });
  }
  if (consistency?.busiestWeekday?.count) {
    items.push({
      label: "Busiest day",
      value: consistency.busiestWeekday.label,
    });
  }
  return items;
}

/**
 * Lightweight trophy-style milestones for README flair.
 */
function buildMilestones(stats) {
  const checks = [
    { id: "commits-100", label: "100 Commits", ok: n(stats.totalCommits) >= 100 },
    { id: "commits-1k", label: "1K Commits", ok: n(stats.totalCommits) >= 1000 },
    { id: "prs-50", label: "50 PRs", ok: n(stats.totalPRs) >= 50 },
    { id: "merged-25", label: "25 Merged", ok: n(stats.mergedPRs) >= 25 },
    { id: "reviews-25", label: "25 Reviews", ok: n(stats.totalReviews) >= 25 },
    { id: "stars-50", label: "50 Stars", ok: n(stats.totalStars) >= 50 },
    {
      id: "streak-7",
      label: "7-Day Streak",
      ok: n(stats.streak?.longestStreak) >= 7,
    },
    {
      id: "streak-30",
      label: "30-Day Streak",
      ok: n(stats.streak?.longestStreak) >= 30,
    },
    {
      id: "multi-lang",
      label: "Polyglot",
      ok: (stats.topLanguages || []).length >= 3,
    },
    {
      id: "contrib-10",
      label: "10 Repos",
      ok: n(stats.contributedTo) >= 10,
    },
  ];
  return checks.filter((c) => c.ok);
}

module.exports = {
  buildRecentActivity,
  buildVisualizations,
  buildFunnel,
  buildHighlights,
  buildMilestones,
  formatCount,
  dayCount,
};
