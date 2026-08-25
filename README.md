# Commit Warrior

**Engineering activity profiles** from public GitHub data — delivery, collaboration, cadence, and stack. The website is built for review (hiring, open-source triage); README SVG embeds are optional.

## Two ways to use it

### 1. Activity profile (website)

Run the app, enter a public GitHub username, and read a structured summary: signal pillars, recent cadence, work patterns, and grouped career totals.

```bash
npm install
cp .env.example .env   # optional: add GITHUB_TOKEN for full stats
npm start
# → http://localhost:3000
```

Signals include merge rate, review volume, calendar consistency, and primary languages. Data comes from GitHub’s public API and contribution calendar (cached ~30 minutes).

### 2. README embeds (optional)

SVG endpoints for profile READMEs. Defaults on the site favor the **Professional** theme and hide rank badges.

```md
[![GitHub stats](https://YOUR_HOST/api/stats?username=YOUR_USERNAME&theme=professional&hide_rank=true)](https://github.com/YOUR_USERNAME)
![Top Languages](https://YOUR_HOST/api/top-langs?username=YOUR_USERNAME&theme=professional&layout=compact)
![Activity Graph](https://YOUR_HOST/api/activity?username=YOUR_USERNAME&theme=professional)
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
| Activity graph | Weekly contribution trend (smooth area chart) for the last year |
| Milestones | Threshold badges (commits, PRs, streaks, polyglot, …) |

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/stats?username=` | Stats SVG card |
| `GET /api/top-langs?username=` | Top languages SVG card |
| `GET /api/streak?username=` | Total / current / longest streak SVG |
| `GET /api/graph?username=` | Contribution heatmap SVG |
| `GET /api/activity?username=` | Weekly activity trend SVG |
| `GET /api/milestones?username=` | Milestone badge strip SVG |
| `GET /api/json?username=` | JSON used by the website (includes viz aggregates) |
| `GET /api/health` | Health + whether a token is configured |

### Query options

**Stats** (`/api/stats`)

- `username` (required)
- `theme` — `professional` · `default` · `dark` · `light` · `tokyonight` · `radical` · `transparent`
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

**Streak / graph / activity / milestones** (`/api/streak`, `/api/graph`, `/api/activity`, `/api/milestones`)

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
