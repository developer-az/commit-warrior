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
});
