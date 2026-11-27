/**
 * Rank model inspired by github-readme-stats / Japanese academic grading.
 * Weighted percentile across commits, PRs, issues, reviews, stars, followers.
 */

function exponentialCdf(x, lambda) {
  return 1 - Math.exp(-x / lambda);
}

function logNormalCdf(x, mean, sd) {
  if (x <= 0) return 0;
  const logX = Math.log(x);
  // Abramowitz & Stegun approximation of the normal CDF
  const z = (logX - mean) / sd;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return p;
}

/**
 * @param {{ commits: number, prs: number, issues: number, reviews: number, stars: number, followers: number }} stats
 * @returns {{ level: string, percentile: number, score: number }}
 */
function calculateRank(stats) {
  const COMMITS_MEDIAN = 250;
  const PRS_MEDIAN = 50;
  const ISSUES_MEDIAN = 25;
  const REVIEWS_MEDIAN = 2;
  const STARS_MEDIAN = 50;
  const FOLLOWERS_MEDIAN = 10;

  const COMMITS_WEIGHT = 1;
  const PRS_WEIGHT = 1.5;
  const ISSUES_WEIGHT = 1;
  const REVIEWS_WEIGHT = 0.5;
  const STARS_WEIGHT = 2;
  const FOLLOWERS_WEIGHT = 0.5;
  const TOTAL_WEIGHT =
    COMMITS_WEIGHT +
    PRS_WEIGHT +
    ISSUES_WEIGHT +
    REVIEWS_WEIGHT +
    STARS_WEIGHT +
    FOLLOWERS_WEIGHT;

  const threshold = (median, offset) => median * offset;
  const commits = exponentialCdf(
    stats.commits,
    threshold(COMMITS_MEDIAN, 1)
  );
  const prs = exponentialCdf(stats.prs, threshold(PRS_MEDIAN, 1));
  const issues = exponentialCdf(stats.issues, threshold(ISSUES_MEDIAN, 1));
  const reviews = exponentialCdf(
    stats.reviews,
    threshold(REVIEWS_MEDIAN, 1)
  );
  const stars = logNormalCdf(stats.stars, Math.log(STARS_MEDIAN), 1.2);
  const followers = logNormalCdf(
    stats.followers,
    Math.log(FOLLOWERS_MEDIAN),
    1.2
  );

  const rank =
    1 -
    (COMMITS_WEIGHT * commits +
      PRS_WEIGHT * prs +
      ISSUES_WEIGHT * issues +
      REVIEWS_WEIGHT * reviews +
      STARS_WEIGHT * stars +
      FOLLOWERS_WEIGHT * followers) /
      TOTAL_WEIGHT;

  const percentile = rank * 100;
  const score = Math.round((100 - percentile) * 100) / 100;

  // Grade from the score the user sees, not from the internal percentile.
  // Previously the bands were defined on percentile (lower = better), which
  // made "A-" show up next to a 72/100 score.
  const LEVELS = [
    { level: "S", min: 90 },
    { level: "A+", min: 85 },
    { level: "A", min: 80 },
    { level: "A-", min: 75 },
    { level: "B+", min: 70 },
    { level: "B", min: 65 },
    { level: "B-", min: 60 },
    { level: "C+", min: 50 },
    { level: "C", min: 0 },
  ];

  const level = LEVELS.find((l) => score >= l.min)?.level ?? "C";

  return {
    level,
    percentile: Math.round(percentile * 100) / 100,
    score,
  };
}

module.exports = { calculateRank };
