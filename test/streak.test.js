const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  computeStreaks,
  parseContributionsHtml,
  calendarFromGraphQL,
} = require("../src/streak");
const { renderStreakCard } = require("../src/cards/streak");
const { renderGraphCard } = require("../src/cards/graph");

describe("computeStreaks", () => {
  it("counts current and longest consecutive active days", () => {
    const days = [];
    // 10 inactive, then 5 active ending yesterday relative to 2026-08-14
    for (let i = 1; i <= 20; i++) {
      const d = String(i).padStart(2, "0");
      const date = `2026-07-${d}`;
      const active = i >= 10 && i <= 14;
      days.push({ date, count: active ? 2 : 0, level: active ? 2 : 0 });
    }
    // August 1–13 inactive, 14 active (today)
    for (let i = 1; i <= 14; i++) {
      const d = String(i).padStart(2, "0");
      days.push({
        date: `2026-08-${d}`,
        count: i === 14 ? 1 : 0,
        level: i === 14 ? 1 : 0,
      });
    }
    const s = computeStreaks(days, "2026-08-14");
    assert.equal(s.currentStreak, 1);
    assert.equal(s.currentStart, "2026-08-14");
    assert.equal(s.longestStreak, 5);
    assert.equal(s.longestStart, "2026-07-10");
    assert.equal(s.longestEnd, "2026-07-14");
  });

  it("keeps current streak alive if yesterday was active and today is empty", () => {
    const days = [
      { date: "2026-08-12", count: 1, level: 1 },
      { date: "2026-08-13", count: 3, level: 2 },
      { date: "2026-08-14", count: 0, level: 0 },
    ];
    const s = computeStreaks(days, "2026-08-14");
    assert.equal(s.currentStreak, 2);
    assert.equal(s.currentStart, "2026-08-12");
    assert.equal(s.currentEnd, "2026-08-13");
  });
});

describe("parseContributionsHtml", () => {
  it("reads data-date/level cells and yearly heading", () => {
    const html = `
      <h2>12 contributions in the last year</h2>
      <td data-date="2026-08-12" data-level="0" class="ContributionCalendar-day"></td>
      <td data-date="2026-08-13" data-level="3" class="ContributionCalendar-day"></td>
      <td data-level="1" data-date="2026-08-14" class="ContributionCalendar-day"></td>
    `;
    const parsed = parseContributionsHtml(html);
    assert.equal(parsed.total, 12);
    assert.equal(parsed.days.length, 3);
    assert.equal(parsed.days[1].level, 3);
    assert.equal(parsed.days[2].date, "2026-08-14");
  });
});

describe("calendarFromGraphQL", () => {
  it("flattens weeks into dated days", () => {
    const parsed = calendarFromGraphQL({
      contributionCalendar: {
        totalContributions: 9,
        weeks: [
          {
            contributionDays: [
              { date: "2026-08-13", contributionCount: 4, contributionLevel: "THIRD_QUARTILE" },
              { date: "2026-08-14", contributionCount: 0, contributionLevel: "NONE" },
            ],
          },
        ],
      },
    });
    assert.equal(parsed.total, 9);
    assert.equal(parsed.days[0].level, 3);
    assert.equal(parsed.days[1].count, 0);
  });
});

describe("streak + graph SVG", () => {
  const stats = {
    name: "Ada",
    login: "ada",
    yearContributions: 354,
    streak: {
      currentStreak: 12,
      currentStart: "2026-08-03",
      currentEnd: "2026-08-14",
      longestStreak: 40,
      longestStart: "2026-01-01",
      longestEnd: "2026-02-09",
    },
    calendar: [
      { date: "2026-08-09", count: 0, level: 0 },
      { date: "2026-08-10", count: 2, level: 2 },
      { date: "2026-08-11", count: 5, level: 4 },
    ],
  };

  it("renders streak totals", () => {
    const svg = renderStreakCard(stats);
    assert.match(svg, /Ada's Streak/);
    assert.match(svg, /Current Streak/);
    assert.match(svg, />12</);
    assert.match(svg, />40</);
  });

  it("renders heatmap cells", () => {
    const svg = renderGraphCard(stats);
    assert.match(svg, /Ada's Contributions/);
    assert.match(svg, /354 in the last year/);
    assert.match(svg, /<rect /);
  });
});
