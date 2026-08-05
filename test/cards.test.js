const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { renderStatsCard } = require("../src/cards/stats");
const { renderLanguagesCard } = require("../src/cards/languages");

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
});
