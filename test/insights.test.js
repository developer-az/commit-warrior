const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseContributionsHtml, parseTooltipCount } = require("../src/streak");
const {
  buildRecentActivity,
  buildHighlights,
  buildVisualizations,
  buildFunnel,
  buildMilestones,
} = require("../src/insights");

describe("parseTooltipCount", () => {
  it("reads exact and zero contribution tooltips", () => {
    assert.equal(parseTooltipCount("12 contributions on January 11th."), 12);
    assert.equal(parseTooltipCount("1 contribution on August 13th."), 1);
    assert.equal(parseTooltipCount("No contributions on August 14th."), 0);
  });
});

describe("parseContributionsHtml tooltips", () => {
  it("uses tooltip counts when cell ids match", () => {
    const html = `
      <h2>9 contributions in the last year</h2>
      <td data-date="2026-08-13" id="contribution-day-component-0-1" data-level="2" class="ContributionCalendar-day"></td>
      <tool-tip for="contribution-day-component-0-1">7 contributions on August 13th.</tool-tip>
      <td data-date="2026-08-14" id="contribution-day-component-0-2" data-level="0" class="ContributionCalendar-day"></td>
      <tool-tip for="contribution-day-component-0-2">No contributions on August 14th.</tool-tip>
    `;
    const parsed = parseContributionsHtml(html);
    assert.equal(parsed.days[0].count, 7);
    assert.equal(parsed.days[1].count, 0);
    assert.equal(parsed.total, 9);
  });
});

describe("buildRecentActivity", () => {
  it("compares today to yesterday", () => {
    const days = [
      { date: "2026-08-12", count: 1, level: 1 },
      { date: "2026-08-13", count: 4, level: 2 },
      { date: "2026-08-14", count: 6, level: 3 },
    ];
    const recent = buildRecentActivity(days, new Date("2026-08-14T18:00:00Z"));
    assert.equal(recent.today, "2026-08-14");
    assert.equal(recent.yesterdayCount, 4);
    assert.equal(recent.todayCount, 6);
    assert.equal(recent.delta, 2);
    assert.equal(recent.status, "active");
    assert.equal(recent.headline, "Active today");
    assert.equal(recent.last14.length, 14);
  });

  it("marks watch when yesterday was active and today is empty", () => {
    const days = [
      { date: "2026-08-13", count: 3, level: 2 },
      { date: "2026-08-14", count: 0, level: 0 },
    ];
    const recent = buildRecentActivity(days, new Date("2026-08-14T12:00:00Z"));
    assert.equal(recent.status, "watch");
    assert.equal(recent.headline, "Active yesterday");
    assert.equal(recent.todayCount, 0);
  });
});

describe("buildHighlights", () => {
  it("returns compact facts without filler", () => {
    const items = buildHighlights({
      mergedPRs: 8,
      totalPRs: 10,
      totalReviews: 4,
      topLanguages: [{ name: "Go", percent: 70 }],
      streak: { currentStreak: 3 },
    });
    assert.deepEqual(
      items.map((i) => i.label),
      ["PRs merged", "Reviews", "Top language", "Current streak"]
    );
    assert.equal(items[0].value, "80%");
    assert.equal(items[2].value, "Go");
  });

  it("omits empty highlights", () => {
    const items = buildHighlights({
      mergedPRs: 0,
      totalPRs: 0,
      totalReviews: 0,
      topLanguages: [],
      streak: { currentStreak: 0 },
    });
    assert.equal(items.length, 0);
  });
});

describe("buildVisualizations", () => {
  it("aggregates weekday, weekly, monthly, and activity series", () => {
    const days = [];
    for (let i = 0; i < 60; i += 1) {
      const d = new Date(Date.UTC(2026, 6, 16));
      d.setUTCDate(d.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      days.push({ date: iso, count: i % 5 === 0 ? 4 : 1, level: 1 });
    }
    const viz = buildVisualizations(days, new Date("2026-08-14T12:00:00Z"));
    assert.equal(viz.weekdays.length, 7);
    assert.equal(viz.weeks.length, 12);
    assert.equal(viz.months.length, 6);
    assert.ok(viz.activity.length > 40);
    assert.ok(viz.consistency.activeDays > 0);
    assert.ok(viz.consistency.busiestWeekday);
  });
});

describe("buildFunnel", () => {
  it("computes PR merge rate", () => {
    const funnel = buildFunnel({
      totalPRs: 10,
      mergedPRs: 7,
      closedPRs: 2,
      totalIssues: 5,
      closedIssues: 4,
    });
    assert.equal(funnel.prs.mergeRate, 70);
    assert.equal(funnel.issues.closeRate, 80);
    assert.equal(funnel.prs.open, 1);
  });
});

describe("buildMilestones", () => {
  it("unlocks thresholds that are met", () => {
    const items = buildMilestones({
      totalCommits: 1200,
      totalPRs: 60,
      mergedPRs: 30,
      totalReviews: 0,
      totalStars: 10,
      contributedTo: 12,
      topLanguages: [{ name: "Go" }, { name: "TS" }, { name: "Rust" }],
      streak: { longestStreak: 14 },
    });
    const labels = items.map((i) => i.label);
    assert.ok(labels.includes("1K Commits"));
    assert.ok(labels.includes("50 PRs"));
    assert.ok(labels.includes("7-Day Streak"));
    assert.ok(labels.includes("Polyglot"));
    assert.ok(!labels.includes("50 Stars"));
  });
});
