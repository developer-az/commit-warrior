/**
 * Fetch professional GitHub engineering stats for a username.
 * Uses GraphQL when a token is available; falls back to REST for public data.
 */

const GITHUB_API = "https://api.github.com";
const GITHUB_GRAPHQL = "https://api.github.com/graphql";

const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getToken() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
}

function authHeaders() {
  const token = getToken();
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "CommitWarrior-Stats/2.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function ghFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
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
  const data = await ghFetch(GITHUB_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (data.errors?.length) {
    const msg = data.errors.map((e) => e.message).join("; ");
    const err = new Error(msg);
    err.status = msg.toLowerCase().includes("could not resolve") ? 404 : 400;
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
        repositoriesContributedTo(
          first: 1
          contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]
        ) { totalCount }
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

  let totalCommits = 0;
  let totalReviews = 0;
  for (const year of years) {
    const block = user[`y${year}`];
    if (!block) continue;
    totalCommits +=
      (block.totalCommitContributions || 0) +
      (block.restrictedContributionsCount || 0);
    totalReviews += block.totalPullRequestReviewContributions || 0;
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
    contributedTo: user.repositoriesContributedTo.totalCount,
    followers: user.followers.totalCount,
    publicRepos: user.repositories.totalCount,
    topLanguages,
    source: "graphql",
  };
}

async function searchCount(query) {
  const data = await ghFetch(
    `${GITHUB_API}/search/issues?q=${encodeURIComponent(query)}&per_page=1`
  );
  return data.total_count || 0;
}

async function fetchStatsREST(username) {
  const user = await ghFetch(`${GITHUB_API}/users/${username}`);
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

  const [totalPRs, mergedPRs, closedIssues, openIssues] = await Promise.all([
    searchCount(`author:${username} type:pr`),
    searchCount(`author:${username} type:pr is:merged`),
    searchCount(`author:${username} type:issue is:closed`),
    searchCount(`author:${username} type:issue is:open`),
  ]);

  // REST cannot get lifetime commits without many calls; approximate via events
  let totalCommits = 0;
  try {
    const events = await ghFetch(
      `${GITHUB_API}/users/${username}/events/public?per_page=100`
    );
    for (const event of events) {
      if (event.type === "PushEvent" && event.payload?.commits) {
        totalCommits += event.payload.commits.length;
      }
    }
  } catch {
    /* ignore */
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
    totalReviews: 0,
    contributedTo: 0,
    followers: user.followers || 0,
    publicRepos: user.public_repos || owned.length,
    topLanguages,
    source: "rest",
    partial: true,
    note: "Set GITHUB_TOKEN for full commit history, reviews, and contributed-to counts.",
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
      // Fall back to REST if GraphQL fails (rate limit, scope, etc.)
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

  cacheSet(`stats:${login.toLowerCase()}`, stats);
  return stats;
}

function clearCache() {
  cache.clear();
}

module.exports = { fetchUserStats, clearCache, getToken };
