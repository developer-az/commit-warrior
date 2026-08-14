/**
 * Live "since yesterday" status and employer-facing copy.
 * Never returns blanks — missing data is explicit ("Not published yet", 0, —).
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

const RANK_COPY = {
  S: "Exceptional public footprint — among the strongest profiles on this scale.",
  "A+": "Very strong public engineering record versus a typical GitHub profile.",
  A: "Solid, hire-ready public record of shipping and collaboration.",
  "A-": "Above-average public activity with clear shipping evidence.",
  "B+": "Healthy public presence; enough signal to discuss in an interview.",
  B: "Moderate public activity — useful context, not the whole story.",
  "B-": "Some public work; private or newer accounts often look like this.",
  "C+": "Early or mostly-private public footprint.",
  C: "Limited public GitHub history so far.",
};

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
  let headline = "No public contributions in the last day";
  let detail =
    "No public GitHub activity yesterday or today. Career totals below are still current.";

  if (todayCount > 0) {
    status = "active";
    headline = "Active today";
    const vs =
      delta === 0
        ? "Matching yesterday’s volume."
        : delta > 0
          ? `${formatCount(delta)} more than yesterday.`
          : `${formatCount(Math.abs(delta))} fewer than yesterday.`;
    detail = `${formatCount(todayCount)} public contribution${
      todayCount === 1 ? "" : "s"
    } so far today. ${vs}`;
  } else if (yesterdayCount > 0) {
    status = "watch";
    headline = "Yesterday was active — today is still open";
    detail = `${formatCount(yesterdayCount)} contribution${
      yesterdayCount === 1 ? "" : "s"
    } yesterday. Nothing published for today yet; a contribution today keeps the streak.`;
  } else if (!todayPublished && lastCalendarDate && lastCalendarDate < today) {
    status = "stale";
    headline = "Calendar catching up";
    detail = `GitHub’s public calendar currently ends on ${lastCalendarDate}. Totals still come from live GitHub APIs.`;
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
    detail,
  };
}

function buildBrief(stats) {
  const name = stats.name || stats.login || "This engineer";
  const commits = n(stats.totalCommits);
  const merged = n(stats.mergedPRs);
  const reviews = n(stats.totalReviews);
  const year = n(stats.yearContributions);
  const lang = stats.topLanguages?.[0]?.name;
  const mergeRate = pct(stats.mergedPRs, stats.totalPRs);

  const bits = [];
  bits.push(
    `${name} has ${formatCount(commits)} public commit${commits === 1 ? "" : "s"} and ${formatCount(merged)} merged pull request${merged === 1 ? "" : "s"}`
  );
  if (mergeRate != null) {
    bits.push(`a ${mergeRate}% merge rate on authored PRs`);
  }
  if (reviews) {
    bits.push(`${formatCount(reviews)} code review${reviews === 1 ? "" : "s"}`);
  }
  if (year) {
    bits.push(`${formatCount(year)} contributions in the last year`);
  }
  let sentence = `${bits.join(", ")}.`;
  if (lang) {
    sentence += ` Primary public stack: ${lang}.`;
  }
  sentence +=
    " These are public GitHub signals — useful for hiring context, not a substitute for a conversation.";
  return sentence;
}

function buildInsights(stats) {
  const mergeRate = pct(stats.mergedPRs, stats.totalPRs);
  const closeRate = pct(stats.closedIssues, stats.totalIssues);
  const top = (stats.topLanguages || [])[0];
  const others = (stats.topLanguages || [])
    .slice(1, 3)
    .map((l) => l.name)
    .filter(Boolean);
  const rank = stats.rank?.level || "C";
  const recent = stats.recent;

  return [
    {
      kicker: "Follow-through",
      title:
        mergeRate == null
          ? "No public pull requests yet"
          : `${mergeRate}% of authored PRs merged`,
      body:
        mergeRate == null
          ? "GitHub has not indexed public pull requests for this account."
          : `${formatCount(stats.mergedPRs)} of ${formatCount(stats.totalPRs)} landed. Employers read this as finishing work, not only opening it.`,
    },
    {
      kicker: "Collaboration",
      title: n(stats.totalReviews)
        ? `${formatCount(stats.totalReviews)} code reviews`
        : "Reviews not indexed",
      body: n(stats.totalReviews)
        ? "Reviews other people’s changes — the day-to-day of a teammate, not a solo commit log."
        : "Public review activity is limited or private. Authored PRs and issues still appear below.",
    },
    {
      kicker: "Issue hygiene",
      title:
        closeRate == null
          ? "No public issues yet"
          : `${closeRate}% of authored issues closed`,
      body:
        closeRate == null
          ? "No public issues are indexed for this username."
          : `${formatCount(stats.closedIssues)} closed of ${formatCount(stats.totalIssues)} authored. Shows whether they wrap up work they start.`,
    },
    {
      kicker: "Stack",
      title: top ? `${top.name} · ${top.percent}%` : "Languages not listed",
      body: top
        ? `Most-used language on owned public repos${
            others.length ? `, then ${others.join(" and ")}` : ""
          }.`
        : "No primary language on public owned repositories.",
    },
    {
      kicker: "Cadence",
      title: recent
        ? `${n(recent.last7ActiveDays)} active day${
            n(recent.last7ActiveDays) === 1 ? "" : "s"
          } in the last 7`
        : "Cadence unavailable",
      body: recent
        ? `${formatCount(recent.last7Count)} public contribution${
            n(recent.last7Count) === 1 ? "" : "s"
          } this week. Consistency matters more than a single spike.`
        : "The contribution calendar could not be loaded; career totals still apply.",
    },
    {
      kicker: "Public rank",
      title: `Grade ${rank}`,
      body: RANK_COPY[rank] || RANK_COPY.C,
    },
  ];
}

function buildMetricCatalog(stats) {
  return [
    {
      label: "Commits",
      value: n(stats.totalCommits),
      hint: "All-time public commits attributed to this username.",
    },
    {
      label: "Pull requests",
      value: n(stats.totalPRs),
      hint: "PRs they opened — proposing a change.",
    },
    {
      label: "PRs merged",
      value: n(stats.mergedPRs),
      hint: "PRs that actually landed. The shipping number.",
    },
    {
      label: "Issues closed",
      value: n(stats.closedIssues),
      hint: "Issues they opened that are now closed.",
    },
    {
      label: "Code reviews",
      value: n(stats.totalReviews),
      hint: "Pull requests they reviewed, including on their own repos.",
    },
    {
      label: "Repos contributed to",
      value: n(stats.contributedTo),
      hint: "Distinct public repos they don’t own with commits, issues, PRs, or comments.",
    },
    {
      label: "Stars earned",
      value: n(stats.totalStars),
      hint: "Stars on owned, non-fork repositories.",
    },
    {
      label: "Year contributions",
      value: n(stats.yearContributions),
      hint: "GitHub contribution calendar total for the last 12 months.",
    },
  ];
}

module.exports = {
  buildRecentActivity,
  buildBrief,
  buildInsights,
  buildMetricCatalog,
  formatCount,
  dayCount,
};
