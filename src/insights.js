/**
 * Activity signals, chart aggregates, and factual highlights.
 * Focused on delivery, collaboration, consistency, and stack — not vanity badges.
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

function computeTrend(weeks) {
  if (!weeks || weeks.length < 8) {
    return { direction: "stable", label: "Insufficient history", deltaPct: null };
  }
  const recent = weeks.slice(-4).reduce((s, w) => s + n(w.count), 0);
  const prior = weeks.slice(-8, -4).reduce((s, w) => s + n(w.count), 0);
  if (prior === 0 && recent === 0) {
    return { direction: "idle", label: "No recent activity", deltaPct: 0 };
  }
  if (prior === 0) {
    return { direction: "up", label: "Activity resumed", deltaPct: 100 };
  }
  const deltaPct = Math.round(((recent - prior) / prior) * 100);
  if (deltaPct > 12) {
    return { direction: "up", label: "Picking up", deltaPct };
  }
  if (deltaPct < -12) {
    return { direction: "down", label: "Slowing down", deltaPct };
  }
  return { direction: "stable", label: "Steady output", deltaPct };
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
  let headline = "No activity today";
  if (todayCount > 0) {
    status = "active";
    headline = "Contributions today";
  } else if (yesterdayCount > 0) {
    status = "watch";
    headline = "Contributions yesterday";
  } else if (!todayPublished && lastCalendarDate && lastCalendarDate < today) {
    status = "stale";
    headline = "Calendar pending";
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
    lastCalendarDate,
    last7Count,
    last7ActiveDays,
    last14,
    status,
    headline,
  };
}

/**
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
    weeks.push({ start, end, label: start.slice(5), count });
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
  const trend = computeTrend(weeks);
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
    trend,
  };

  return { weekdays, weeks, months, activity, consistency };
}

function buildFunnel(stats) {
  const opened = n(stats.totalPRs);
  const merged = n(stats.mergedPRs);
  const closed = n(stats.closedPRs);
  return {
    prs: {
      opened,
      merged,
      closed,
      mergeRate: pct(merged, opened),
      open: Math.max(0, opened - merged - closed),
    },
    issues: {
      opened: n(stats.totalIssues),
      closed: n(stats.closedIssues),
      closeRate: pct(stats.closedIssues, stats.totalIssues),
    },
  };
}

/**
 * Recruiter-oriented signal pillars derived from public GitHub data.
 */
function buildSignals(stats) {
  const viz = stats.viz || {};
  const funnel = stats.funnel || buildFunnel(stats);
  const consistency = viz.consistency || {};
  const trend = consistency.trend || computeTrend(viz.weeks);
  const mergeRate = funnel.prs.mergeRate;
  const reviews = n(stats.totalReviews);
  const contributed = n(stats.contributedTo);
  const langs = stats.topLanguages || [];

  const pillars = [];

  if (mergeRate != null || n(stats.mergedPRs)) {
    pillars.push({
      id: "delivery",
      title: "Delivery",
      metric:
        mergeRate != null ? `${mergeRate}% merged` : formatCount(stats.mergedPRs),
      detail:
        mergeRate != null
          ? `${formatCount(stats.mergedPRs)} of ${formatCount(stats.totalPRs)} PRs landed`
          : `${formatCount(stats.mergedPRs)} merged pull requests`,
    });
  }

  if (reviews || contributed) {
    pillars.push({
      id: "collaboration",
      title: "Collaboration",
      metric: reviews ? formatCount(reviews) : formatCount(contributed),
      detail: reviews
        ? `${formatCount(reviews)} code reviews · ${formatCount(contributed)} external repos`
        : `Contributions across ${formatCount(contributed)} repositories`,
    });
  }

  if (consistency.activePct != null) {
    pillars.push({
      id: "consistency",
      title: "Consistency",
      metric: `${consistency.activePct}% active`,
      detail: `${trend.label} · ${formatCount(consistency.activeDays)} days with output in the last year`,
    });
  }

  if (langs.length) {
    const names = langs
      .slice(0, 3)
      .map((l) => l.name)
      .join(", ");
    pillars.push({
      id: "stack",
      title: "Primary stack",
      metric: langs[0].name,
      detail:
        langs.length > 1
          ? `${names} · ${langs.length} languages in owned repos`
          : "Dominant language in owned repositories",
    });
  }

  return {
    pillars,
    trend,
    summary: pillars.map((p) => p.metric).join(" · "),
  };
}

/** @deprecated use buildSignals — kept for tests */
function buildHighlights(stats) {
  return (buildSignals(stats).pillars || []).map((p) => ({
    label: p.title,
    value: p.metric,
  }));
}

/** Legacy README badge API — not surfaced on the professional profile view */
function buildMilestones(stats) {
  const checks = [
    { id: "commits-1k", label: "1K commits", ok: n(stats.totalCommits) >= 1000 },
    { id: "merged-25", label: "25 merged PRs", ok: n(stats.mergedPRs) >= 25 },
    { id: "reviews-25", label: "25 reviews", ok: n(stats.totalReviews) >= 25 },
    {
      id: "contrib-10",
      label: "10 repo contributions",
      ok: n(stats.contributedTo) >= 10,
    },
  ];
  return checks.filter((c) => c.ok);
}

module.exports = {
  buildRecentActivity,
  buildVisualizations,
  buildFunnel,
  buildSignals,
  buildHighlights,
  buildMilestones,
  computeTrend,
  formatCount,
  dayCount,
};
