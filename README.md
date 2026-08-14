# Commit Warrior

Dynamically generated **GitHub README stats** — commits, pull requests, merged PRs, closed issues, code reviews, streaks, contribution graphs, stars, and top languages. Use it as a website or embed SVG cards in any profile README.

## Two ways to use it

### 1. Website

Run the app, open it in a browser, enter a GitHub username, preview the cards, and copy the markdown.

```bash
npm install
cp .env.example .env   # optional: add GITHUB_TOKEN for full stats
npm start
# → http://localhost:3000
```

Optional: open with a preset user — `http://localhost:3000?username=octocat`

### 2. README embeds (preview / markdown image)

Same idea as [github-readme-stats](https://github.com/anuraghazra/github-readme-stats): the API returns an SVG. GitHub’s README renderer requests that URL and shows a live card.

```md
[![GitHub stats](https://YOUR_HOST/api/stats?username=YOUR_USERNAME&show_icons=true)](https://github.com/YOUR_USERNAME)
![Top Languages](https://YOUR_HOST/api/top-langs?username=YOUR_USERNAME&layout=compact)
![GitHub Streak](https://YOUR_HOST/api/streak?username=YOUR_USERNAME)
![Contribution Graph](https://YOUR_HOST/api/graph?username=YOUR_USERNAME)
```

Replace `YOUR_HOST` with your deployment URL (or `http://localhost:3000` while testing).

## What the stats include

| Metric | Meaning |
| --- | --- |
| Total Stars | Stars across owned (non-fork) repositories |
| Total Commits | **All-time** (not week/month). With token: GraphQL contribution commits across every contribution year. Without token: GitHub commit search (`author:USER`) for indexed public commits |
| Total PRs | Pull requests authored |
| PRs Merged | Pull requests merged |
| Total Issues / Issues Closed | Issues authored / closed |
| Code Reviews | PRs you reviewed (`reviewed-by:USER`, all-time; includes reviews on your own repos) |
| Contributed to | Distinct repos you don’t own with public commits, authored issues/PRs, or comments |
| Top Languages | Language mix across owned repos |
| Rank | Weighted score (S → C) from the metrics above |
| Current / longest streak | Consecutive contribution days (commits, PRs, issues — GitHub’s calendar) |
| Contribution graph | Last-year heatmap, same shape as the profile calendar |

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/stats?username=` | Stats SVG card |
| `GET /api/top-langs?username=` | Top languages SVG card |
| `GET /api/streak?username=` | Total / current / longest streak SVG |
| `GET /api/graph?username=` | Contribution heatmap SVG |
| `GET /api/json?username=` | JSON used by the website |
| `GET /api/health` | Health + whether a token is configured |

### Query options

**Stats** (`/api/stats`)

- `username` (required)
- `theme` — `default` · `dark` · `light` · `tokyonight` · `radical` · `transparent`
- `show_icons` — `true` / `false`
- `hide_rank` — `true` / `false`
- `hide_border` — `true` / `false`
- `hide` — comma list: `stars,commits,prs,prs_merged,issues,issues_closed,reviews,contribs,followers`

**Languages** (`/api/top-langs`)

- `username` (required)
- `theme` — same themes
- `layout` — `normal` or `compact`
- `langs_count` — number of languages (default 6)
- `hide_border` — `true` / `false`

**Streak / graph** (`/api/streak`, `/api/graph`)

- `username` (required)
- `theme` — same themes
- `hide_border` — `true` / `false`

## GitHub token (recommended)

Without a token the server uses the public REST API. Commits, reviews, and contributed-to still use **all-time** GitHub search (public/indexed activity).

Set `GITHUB_TOKEN` in `.env` (classic PAT with public repo access, or fine-grained read on public data) for GraphQL contribution commits and higher rate limits.

```bash
GITHUB_TOKEN=ghp_...
PORT=3000
```

## Deploy

Any Node host works (`npm start`, port from `PORT`). Example with a process manager:

```bash
npm install --omit=dev
GITHUB_TOKEN=... PORT=3000 npm start
```

Point a reverse proxy at the port and use that public origin in your README image URLs.

## Development

```bash
npm install
npm start          # http://localhost:3000
npm test           # node:test unit tests
npm run dev        # restart on file changes (Node 18+)
```

## Privacy

- The website only needs a public GitHub username.
- Optional server `GITHUB_TOKEN` stays on the server and is never sent to the browser.
- Responses are cached in memory (~30 minutes) to respect GitHub rate limits.

## License

ISC — built by [Anthony Zhou](https://github.com/developer-az).
