const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { calculateRank } = require("../src/rank");

describe("calculateRank", () => {
  it("gives low ranks to empty profiles", () => {
    const rank = calculateRank({
      commits: 0,
      prs: 0,
      issues: 0,
      reviews: 0,
      stars: 0,
      followers: 0,
    });
    assert.equal(rank.level, "C");
    assert.ok(rank.percentile >= 87.5);
  });

  it("gives high ranks to strong profiles", () => {
    const rank = calculateRank({
      commits: 5000,
      prs: 800,
      issues: 400,
      reviews: 200,
      stars: 10000,
      followers: 5000,
    });
    assert.ok(["S", "A+", "A"].includes(rank.level));
    assert.ok(rank.score > 50);
  });

  it("derives the level from the visible score", () => {
    const rank = calculateRank({
      commits: 1100,
      prs: 148,
      issues: 51,
      reviews: 36,
      stars: 32,
      followers: 10,
    });
    const bands = [
      ["S", 90], ["A+", 85], ["A", 80], ["A-", 75],
      ["B+", 70], ["B", 65], ["B-", 60], ["C+", 50], ["C", 0],
    ];
    const expected = bands.find(([, min]) => rank.score >= min)[0];
    assert.equal(rank.level, expected);
    assert.ok(rank.score >= 0 && rank.score <= 100);
  });
});
