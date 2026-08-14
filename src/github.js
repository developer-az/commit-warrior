/**
 * Fetch professional GitHub engineering stats for a username.
 * Uses GraphQL when a token is available; falls back to REST for public data.
 */

const GITHUB_API = "https://api.github.com";
const GITHUB_GRAPHQL = "https://api.github.com/graphql";

const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** When a configured token returns 401, stop attaching it and use public REST. */
let tokenRevoked = false;

function getToken() {
  if (tokenRevoked) return "";
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
}

function revokeToken(reason) {
  if (tokenRevoked) return;
  if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
    tokenRevoked = true;
    console.warn(
      `[commit-warrior] GitHub token rejected (${reason}). Falling back to public REST.`
    );
  }
}

function authHeaders({ allowAuth = true } = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "CommitWarrior-Stats/2.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = allowAuth ? getToken() : "";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function ghFetch(url, options = {}) {
  const attempt = async (allowAuth) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...authHeaders({ allowAuth }),
        ...(options.headers || {}),
      },
    });
    return res;
  };

  let res = await attempt(true);
  // Bad/expired token must not brick public REST lookups
  if (res.status === 401 && getToken()) {
    revokeToken("401 from GitHub API");
    res = await attempt(false);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(
      `GitHub API ${res.status}: ${body.slice(0, 200) || res.statusText}`
    );
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function graphql(query, variables = {}) {
  const token = getToken();
  if (!token) {
    const err = new Error("GITHUB_TOKEN required for GraphQL stats");
    err.status = 401;
    throw err;
  }
  let data;
  try {
    data = await ghFetch(GITHUB_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    if (err.status === 401) revokeToken(err.message);
    throw err;
  }
  if (data.errors?.length) {
    const msg = data.errors.map((e) => e.message).join("; ");
    const err = new Error(msg);
    const lower = msg.toLowerCase();
    err.status =
      lower.includes("could not resolve") || lower.includes("not found")
        ? 404
        : 400;
    throw err;
  }
  return data.data;
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

/**
 * Count commits from public PushEvents.
 * Prefer distinct_size/size — modern public event payloads often omit `commits`.
 * @param {Array<{ type?: string, payload?: object }>} events
 */
function countCommitsFromPushEvents(events) {
  let total = 0;
  for (const event of events || []) {
    if (event?.type !== "PushEvent") continue;
    const payload = event.payload || {};
    if (typeof payload.distinct_size === "number") {
      total += payload.distinct_size;
    } else if (typeof payload.size === "number") {
      total += payload.size;
    } else if (Array.isArray(payload.commits)) {
      total += payload.commits.length;
    }
  }
  return total;
}

/**
 * Build a commit-search query. Window is always author-date based when bounded.
 * Unbounded = all indexed public commits attributed to the user (typically default branches).
 * @param {string} username
 * @param {{ since?: string, until?: string }} [range] YYYY-MM-DD
 */
function buildCommitSearchQuery(username, range = {}) {
  let q = `author:${username}`;
  const { since, until } = range;
  if (since || until) {
    q += ` author-date:${since || "*"}..${until || "*"}`;
  }
  return q;
}

async function searchCommitCount(username, range) {
  const q = buildCommitSearchQuery(username, range);
  const data = await ghFetch(
    `${GITHUB_API}/search/commits?q=${encodeURIComponent(q)}&per_page=1`
  );
  return data.total_count || 0;
}

async function fetchCalendarGraphQL(username) {
  const data = await graphql(
    `query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }`,
    { login: username }
  );
  const user = data.user;
  if (!user) {
    const err = new Error(`User "${username}" not found`);
    err.status = 404;
    throw err;
  }
  const { calendarFromGraphQL, computeStreaks } = require("./streak");
  const parsed = calendarFromGraphQL(user.contributionsCollection);
  return {
    ...parsed,
    streak: computeStreaks(parsed.days),
    source: "graphql",
  };
}

async function fetchCalendarHTML(username) {
  const res = await fetch(
    `https://github.com/users/${encodeURIComponent(username)}/contributions`,
    {
      headers: {
        Accept: "text/html",
        "User-Agent": "CommitWarrior-Stats/2.0",
      },
    }
  );
  if (res.status === 404) {
    const err = new Error(`User "${username}" not found`);
    err.status = 404;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`GitHub contributions page ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const html = await res.text();
  const { parseContributionsHtml, computeStreaks } = require("./streak");
  const parsed = parseContributionsHtml(html);
  if (!parsed.days.length) {
    throw new Error("Could not parse contribution calendar");
  }
  const streak = computeStreaks(parsed.days);
  // Prefer GitHub's yearly heading over estimated cell counts
  streak.total = parsed.total;
  return {
    days: parsed.days,
    total: parsed.total,
    streak,
    source: "html",
  };
}

async function fetchContributionCalendar(username) {
  const key = `cal:${username.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  let cal;
  if (getToken()) {
    try {
      cal = await fetchCalendarGraphQL(username);
    } catch (err) {
      if (err.status === 404) throw err;
      cal = await fetchCalendarHTML(username);
    }
  } else {
    cal = await fetchCalendarHTML(username);
  }
  cacheSet(key, cal);
  return cal;
}

async function fetchYears(login) {
  const data = await graphql(
    `query($login: String!) {
      user(login: $login) {
        contributionsCollection { contributionYears }
      }
    }`,
    { login }
  );
  return data.user?.contributionsCollection?.contributionYears || [];
}

async function fetchStatsGraphQL(username) {
  const years = await fetchYears(username);
  const yearFragments = years
    .map(
      (year) => `
      y${year}: contributionsCollection(from: "${year}-01-01T00:00:00Z", to: "${year}-12-31T23:59:59Z") {
        totalCommitContributions
        restrictedContributionsCount
        totalPullRequestReviewContributions
      }`
    )
    .join("\n");

  const data = await graphql(
    `query($login: String!) {
      user(login: $login) {
        name
        login
        avatarUrl
        url
        followers { totalCount }
        pullRequests { totalCount }
        mergedPullRequests: pullRequests(states: MERGED) { totalCount }
        closedPullRequests: pullRequests(states: CLOSED) { totalCount }
        openIssues: issues(states: OPEN) { totalCount }
        closedIssues: issues(states: CLOSED) { totalCount }
        repositories(
          first: 100
          ownerAffiliations: OWNER
          orderBy: { field: STARGAZERS, direction: DESC }
          isFork: false
        ) {
          totalCount
          nodes {
            name
            stargazerCount
            primaryLanguage { name color }
            languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
              edges { size node { name color } }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
        ${yearFragments}
      }
    }`,
    { login: username }
  );

  const user = data.user;
  if (!user) {
    const err = new Error(`User "${username}" not found`);
    err.status = 404;
    throw err;
  }

  // All-time window: sum each contribution year. Use commit contributions only —
  // restrictedContributionsCount mixes private activity types and is not commit-pure.
  let totalCommits = 0;
  let graphqlReviews = 0;
  for (const year of years) {
    const block = user[`y${year}`];
    if (!block) continue;
    totalCommits += block.totalCommitContributions || 0;
    graphqlReviews += block.totalPullRequestReviewContributions || 0;
  }

  // Prefer search for all-time reviews + contributed-to (GraphQL contrib list is "recent" only).
  let totalReviews = graphqlReviews;
  let contributedTo = 0;
  let reviewsSource = "graphql-contributions";
  let contribSource = "unavailable";
  try {
    const collab = await fetchCollaborationStats(username);
    totalReviews = collab.totalReviews;
    contributedTo = collab.contributedTo;
    reviewsSource = collab.reviewsSource;
    contribSource = collab.contribSource;
  } catch {
    totalReviews = graphqlReviews;
    reviewsSource = "graphql-contributions";
  }

  let totalStars = 0;
  const langBytes = {};
  for (const repo of user.repositories.nodes || []) {
    totalStars += repo.stargazerCount || 0;
    for (const edge of repo.languages?.edges || []) {
      const name = edge.node.name;
      langBytes[name] = langBytes[name] || { name, color: edge.node.color, bytes: 0 };
      langBytes[name].bytes += edge.size;
    }
  }

  // Paginate remaining owned repos for stars/languages if needed (cap pages)
  let cursor = user.repositories.pageInfo?.endCursor;
  let hasNext = user.repositories.pageInfo?.hasNextPage;
  let pages = 0;
  while (hasNext && pages < 5) {
    const page = await graphql(
      `query($login: String!, $cursor: String!) {
        user(login: $login) {
          repositories(
            first: 100
            after: $cursor
            ownerAffiliations: OWNER
            orderBy: { field: STARGAZERS, direction: DESC }
            isFork: false
          ) {
            nodes {
              stargazerCount
              languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
                edges { size node { name color } }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }`,
      { login: username, cursor }
    );
    const repos = page.user.repositories;
    for (const repo of repos.nodes || []) {
      totalStars += repo.stargazerCount || 0;
      for (const edge of repo.languages?.edges || []) {
        const name = edge.node.name;
        langBytes[name] = langBytes[name] || {
          name,
          color: edge.node.color,
          bytes: 0,
        };
        langBytes[name].bytes += edge.size;
      }
    }
    hasNext = repos.pageInfo.hasNextPage;
    cursor = repos.pageInfo.endCursor;
    pages += 1;
  }

  const languages = Object.values(langBytes)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10);

  const totalLangBytes = languages.reduce((s, l) => s + l.bytes, 0) || 1;
  const topLanguages = languages.map((l) => ({
    name: l.name,
    color: l.color || "#8b949e",
    bytes: l.bytes,
    percent: Math.round((l.bytes / totalLangBytes) * 1000) / 10,
  }));

  return {
    name: user.name || user.login,
    login: user.login,
    avatarUrl: user.avatarUrl,
    url: user.url,
    totalStars,
    totalCommits,
    totalPRs: user.pullRequests.totalCount,
    mergedPRs: user.mergedPullRequests.totalCount,
    closedPRs: user.closedPullRequests.totalCount,
    openIssues: user.openIssues.totalCount,
    closedIssues: user.closedIssues.totalCount,
    totalIssues: user.openIssues.totalCount + user.closedIssues.totalCount,
    totalReviews,
    contributedTo,
    followers: user.followers.totalCount,
    publicRepos: user.repositories.totalCount,
    topLanguages,
    commitsWindow: "all-time",
    commitsSource: "graphql-contributions",
    reviewsSource,
    contribSource,
    source: "graphql",
  };
}

async function searchCount(query) {
  const data = await ghFetch(
    `${GITHUB_API}/search/issues?q=${encodeURIComponent(query)}&per_page=1`
  );
  return data.total_count || 0;
}

/** owner/repo from issue/PR search item.repository_url */
function repoFullNameFromIssue(item) {
  const m = String(item?.repository_url || "").match(
    /\/repos\/([^/]+\/[^/]+)$/
  );
  return m ? m[1] : "";
}

async function searchIssueRepoNames(query, { maxPages = 2 } = {}) {
  const repos = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const data = await ghFetch(
      `${GITHUB_API}/search/issues?q=${encodeURIComponent(query)}&per_page=100&page=${page}`
    );
    const items = data.items || [];
    for (const item of items) {
      const name = repoFullNameFromIssue(item);
      if (name) repos.add(name);
    }
    if (items.length < 100) break;
  }
  return repos;
}

async function searchCommitRepoNames(query, { maxPages = 2 } = {}) {
  const repos = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const data = await ghFetch(
      `${GITHUB_API}/search/commits?q=${encodeURIComponent(query)}&per_page=100&page=${page}`
    );
    const items = data.items || [];
    for (const item of items) {
      const name = item.repository?.full_name;
      if (name) repos.add(name);
    }
    if (items.length < 100) break;
  }
  return repos;
}

/**
 * All-time collaboration metrics via search (works with or without a token).
 * Reviews = PRs where the user left a review (includes reviews on own repos).
 * Contributed to = distinct repos the user does not own with public commits,
 * authored issues/PRs, or comments.
 */
async function fetchCollaborationStats(username) {
  const [
    totalReviews,
    prRepos,
    issueRepos,
    commentRepos,
    commitRepos,
  ] = await Promise.all([
    searchCount(`type:pr reviewed-by:${username}`),
    searchIssueRepoNames(`author:${username} type:pr -user:${username}`),
    searchIssueRepoNames(`author:${username} type:issue -user:${username}`),
    searchIssueRepoNames(`commenter:${username} -user:${username}`),
    searchCommitRepoNames(`author:${username} -user:${username}`),
  ]);

  const repos = new Set([
    ...prRepos,
    ...issueRepos,
    ...commentRepos,
    ...commitRepos,
  ]);

  return {
    totalReviews,
    contributedTo: repos.size,
    reviewsSource: "search",
    contribSource: "search",
  };
}

async function fetchStatsREST(username) {
  let user;
  try {
    user = await ghFetch(`${GITHUB_API}/users/${username}`);
  } catch (err) {
    if (err.status === 404) {
      const notFound = new Error(`User "${username}" not found`);
      notFound.status = 404;
      throw notFound;
    }
    throw err;
  }
  if (!user?.login) {
    const err = new Error(`User "${username}" not found`);
    err.status = 404;
    throw err;
  }

  const repos = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await ghFetch(
      `${GITHUB_API}/users/${username}/repos?per_page=100&page=${page}&type=owner&sort=updated`
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    repos.push(...batch);
    if (batch.length < 100) break;
  }

  const owned = repos.filter((r) => !r.fork);
  let totalStars = 0;
  const langCount = {};
  for (const repo of owned) {
    totalStars += repo.stargazers_count || 0;
    if (repo.language) {
      langCount[repo.language] = (langCount[repo.language] || 0) + 1;
    }
  }

  const totalLang = Object.values(langCount).reduce((a, b) => a + b, 0) || 1;
  const COLORS = {
    JavaScript: "#f1e05a",
    TypeScript: "#3178c6",
    Python: "#3572A5",
    Go: "#00ADD8",
    Rust: "#dea584",
    Java: "#b07219",
    "C++": "#f34b7d",
    C: "#555555",
    Ruby: "#701516",
    PHP: "#4F5D95",
    Swift: "#F05138",
    Kotlin: "#A97BFF",
    Shell: "#89e051",
    HTML: "#e34c26",
    CSS: "#563d7c",
  };

  const topLanguages = Object.entries(langCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({
      name,
      color: COLORS[name] || "#8b949e",
      bytes: count,
      percent: Math.round((count / totalLang) * 1000) / 10,
    }));

  const [
    totalPRs,
    mergedPRs,
    closedIssues,
    openIssues,
    collab,
  ] = await Promise.all([
    searchCount(`author:${username} type:pr`),
    searchCount(`author:${username} type:pr is:merged`),
    searchCount(`author:${username} type:issue is:closed`),
    searchCount(`author:${username} type:issue is:open`),
    fetchCollaborationStats(username).catch(() => ({
      totalReviews: 0,
      contributedTo: 0,
      reviewsSource: "unavailable",
      contribSource: "unavailable",
    })),
  ]);

  // Commits: search API is all-time (indexed public commits). Public PushEvent
  // payloads often omit commits/size now, so events are a last-resort fallback only.
  let totalCommits = 0;
  let commitsSource = "unavailable";
  try {
    totalCommits = await searchCommitCount(username);
    commitsSource = "search";
  } catch {
    try {
      const events = await ghFetch(
        `${GITHUB_API}/users/${username}/events/public?per_page=100`
      );
      totalCommits = countCommitsFromPushEvents(events);
      commitsSource = "events-recent";
    } catch {
      /* leave zero */
    }
  }

  return {
    name: user.name || user.login,
    login: user.login,
    avatarUrl: user.avatar_url,
    url: user.html_url,
    totalStars,
    totalCommits,
    totalPRs,
    mergedPRs,
    closedPRs: Math.max(0, totalPRs - mergedPRs),
    openIssues,
    closedIssues,
    totalIssues: openIssues + closedIssues,
    totalReviews: collab.totalReviews,
    contributedTo: collab.contributedTo,
    followers: user.followers || 0,
    publicRepos: user.public_repos || owned.length,
    topLanguages,
    commitsWindow: "all-time",
    commitsSource,
    reviewsSource: collab.reviewsSource,
    contribSource: collab.contribSource,
    source: "rest",
    partial: true,
    note:
      "Public REST stats: commits/reviews/contributed-to use GitHub search (all-time, public/indexed). Set GITHUB_TOKEN for GraphQL contribution commits and higher rate limits.",
  };
}

/**
 * @param {string} username
 * @returns {Promise<object>}
 */
async function fetchUserStats(username) {
  const login = String(username || "")
    .trim()
    .replace(/^@/, "");
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(login)) {
    const err = new Error("Invalid GitHub username");
    err.status = 400;
    throw err;
  }

  const cached = cacheGet(`stats:${login.toLowerCase()}`);
  if (cached) return { ...cached, cached: true };

  let stats;
  if (getToken()) {
    try {
      stats = await fetchStatsGraphQL(login);
    } catch (err) {
      if (err.status === 404) throw err;
      // Fall back to REST if GraphQL fails (bad token, rate limit, scope, etc.)
      stats = await fetchStatsREST(login);
      stats.fallbackReason = err.message;
    }
  } else {
    stats = await fetchStatsREST(login);
  }

  const { calculateRank } = require("./rank");
  stats.rank = calculateRank({
    commits: stats.totalCommits,
    prs: stats.totalPRs,
    issues: stats.totalIssues,
    reviews: stats.totalReviews,
    stars: stats.totalStars,
    followers: stats.followers,
  });

  try {
    const calendar = await fetchContributionCalendar(login);
    stats.calendar = calendar.days;
    stats.yearContributions = calendar.total;
    stats.streak = calendar.streak;
    stats.calendarSource = calendar.source;
  } catch (err) {
    stats.calendar = [];
    stats.yearContributions = 0;
    stats.streak = {
      total: 0,
      currentStreak: 0,
      longestStreak: 0,
    };
    stats.calendarError = err.message;
  }

  cacheSet(`stats:${login.toLowerCase()}`, stats);
  return stats;
}

function clearCache() {
  cache.clear();
}

function isTokenActive() {
  return Boolean(getToken());
}

module.exports = {
  fetchUserStats,
  fetchContributionCalendar,
  clearCache,
  getToken,
  isTokenActive,
  // Test helpers
  countCommitsFromPushEvents,
  buildCommitSearchQuery,
  repoFullNameFromIssue,
};
