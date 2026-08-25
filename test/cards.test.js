const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { renderStatsCard } = require("../src/cards/stats");
const { renderLanguagesCard } = require("../src/cards/languages");
const { renderActivityCard, smoothPath } = require("../src/cards/activity");
const { renderMilestonesCard } = require("../src/cards/milestones");

const sample = {
  name: "Ada",
  login: "ada",
  totalStars: 1200,
  totalCommits: 3400,
  totalPRs: 210,
  mergedPRs: 180,
  closedPRs: 20,
  totalIssues: 90,
  closedIssues: 70,
  openIssues: 20,
  totalReviews: 55,
  contributedTo: 40,
  followers: 300,
  rank: { level: "A+", score: 88 },
  topLanguages: [
    { name: "TypeScript", color: "#3178c6", percent: 42 },
    { name: "Python", color: "#3572A5", percent: 28 },
    { name: "Go", color: "#00ADD8", percent: 18 },
  ],
  milestones: [
    { id: "commits-1k", label: "1K Commits" },
    { id: "prs-50", label: "50 PRs" },
  ],
  viz: {
    activity: [
      { start: "2026-01-05", count: 2 },
      { start: "2026-01-12", count: 8 },
      { start: "2026-01-19", count: 5 },
      { start: "2026-01-26", count: 12 },
    ],
    consistency: { activePct: 42 },
  },
};

describe("SVG cards", () => {
  it("renders stats card with username title", () => {
    const svg = renderStatsCard(sample, { show_icons: true });
    assert.match(svg, /Ada's GitHub Stats/);
    assert.match(svg, /Total Commits/);
    assert.match(svg, /PRs Merged/);
    assert.match(svg, /A\+/);
    assert.match(svg, /<svg/);
  });

  it("hides rank when requested", () => {
    const svg = renderStatsCard(sample, { hide_rank: true });
    assert.doesNotMatch(svg, />Rank</);
  });

  it("renders compact languages card", () => {
    const svg = renderLanguagesCard(sample, { layout: "compact" });
    assert.match(svg, /Most Used Languages/);
    assert.match(svg, /TypeScript/);
  });

  it("renders activity graph card", () => {
    const svg = renderActivityCard(sample, { theme: "professional" });
    assert.match(svg, /Ada's Activity/);
    assert.match(svg, /cw-activity-fill/);
    assert.match(svg, /path/);
  });

  it("builds a smooth path through points", () => {
    const d = smoothPath([
      { x: 0, y: 10 },
      { x: 10, y: 20 },
      { x: 20, y: 5 },
    ]);
    assert.match(d, /^M /);
    assert.match(d, /C /);
  });

  it("renders milestones card", () => {
    const svg = renderMilestonesCard(sample, { theme: "professional" });
    assert.match(svg, /Ada's Milestones/);
    assert.match(svg, /1K Commits/);
    assert.match(svg, /50 PRs/);
  });
});
