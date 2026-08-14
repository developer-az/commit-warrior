const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseContributionsHtml, parseTooltipCount } = require("../src/streak");
const {
  buildRecentActivity,
  buildBrief,
  buildInsights,
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
  it("compares today to yesterday and never leaves blanks", () => {
    const days = [
      { date: "2026-08-12", count: 1, level: 1 },
      { date: "2026-08-13", count: 4, level: 2 },
      { date: "2026-08-14", count: 6, level: 3 },
    ];
    const recent = buildRecentActivity(days, new Date("2026-08-14T18:00:00Z"));
    assert.equal(recent.today, "2026-08-14");
    assert.equal(recent.yesterday, "2026-08-13");
    assert.equal(recent.todayCount, 6);
    assert.equal(recent.yesterdayCount, 4);
    assert.equal(recent.delta, 2);
    assert.equal(recent.status, "active");
    assert.equal(recent.last14.length, 14);
    assert.ok(recent.headline);
    assert.ok(recent.detail);
  });

  it("marks watch when yesterday was active and today is empty", () => {
    const days = [
      { date: "2026-08-13", count: 3, level: 2 },
      { date: "2026-08-14", count: 0, level: 0 },
    ];
    const recent = buildRecentActivity(days, new Date("2026-08-14T12:00:00Z"));
    assert.equal(recent.status, "watch");
    assert.equal(recent.todayCount, 0);
    assert.equal(recent.yesterdayCount, 3);
  });
});

describe("employer copy", () => {
  it("builds a brief and insights without empty titles", () => {
    const stats = {
      name: "Ada",
      login: "ada",
      totalCommits: 100,
      totalPRs: 10,
      mergedPRs: 8,
      totalReviews: 4,
      closedIssues: 5,
      totalIssues: 6,
      yearContributions: 40,
      topLanguages: [{ name: "Go", percent: 70 }],
      rank: { level: "A" },
      recent: { last7ActiveDays: 3, last7Count: 9 },
    };
    const brief = buildBrief(stats);
    assert.match(brief, /Ada/);
    assert.match(brief, /80%/);
    const insights = buildInsights(stats);
    assert.equal(insights.length, 6);
    for (const item of insights) {
      assert.ok(item.title);
      assert.ok(item.body);
      assert.ok(item.kicker);
    }
  });
});
