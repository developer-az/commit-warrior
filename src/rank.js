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
  const LEVELS = [
    { level: "S", threshold: 1 },
    { level: "A+", threshold: 12.5 },
    { level: "A", threshold: 25 },
    { level: "A-", threshold: 37.5 },
    { level: "B+", threshold: 50 },
    { level: "B", threshold: 62.5 },
    { level: "B-", threshold: 75 },
    { level: "C+", threshold: 87.5 },
    { level: "C", threshold: 100 },
  ];

  const level =
    LEVELS.find((l) => percentile <= l.threshold)?.level ?? "C";

  return {
    level,
    percentile: Math.round(percentile * 100) / 100,
    score: Math.round((100 - percentile) * 100) / 100,
  };
}

module.exports = { calculateRank };
