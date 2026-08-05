# Commit Warrior

Dynamically generated **GitHub README stats** — commits, pull requests, merged PRs, closed issues, code reviews, stars, and top languages. Use it as a website or embed SVG cards in any profile README.

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
```

Replace `YOUR_HOST` with your deployment URL (or `http://localhost:3000` while testing).

## What the stats include

| Metric | Meaning |
| --- | --- |
| Total Stars | Stars across owned (non-fork) repositories |
| Total Commits | Contribution commits across all years (GraphQL + token) |
| Total PRs | Pull requests authored |
| PRs Merged | Pull requests merged |
| Total Issues / Issues Closed | Issues authored / closed |
| Code Reviews | Pull request review contributions |
| Contributed to | Repositories you contributed to |
| Top Languages | Language mix across owned repos |
| Rank | Weighted score (S → C) from the metrics above |

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/stats?username=` | Stats SVG card |
| `GET /api/top-langs?username=` | Top languages SVG card |
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

## GitHub token (recommended)

Without a token the server uses the public REST API (works for demos; commit totals and reviews are limited).

Set `GITHUB_TOKEN` in `.env` (classic PAT with public repo access, or fine-grained read on public data) to enable GraphQL and full multi-year commit / review history.

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
