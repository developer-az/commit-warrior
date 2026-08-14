# Commit Warrior - GitHub Copilot Instructions

Commit Warrior is a **Node/Express web app** that generates GitHub README stats. Users enter a username on the site to preview cards, or embed SVG URLs in a profile README (same pattern as anuraghazra/github-readme-stats).

**Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Bootstrap and Dependencies
- Install dependencies: `npm install` — takes ~5–15 seconds. NEVER CANCEL.
- Single runtime dependency: `express`
- Node **18+** required (`fetch`, `node:test`)

### Run / Test
- Start server: `npm start` → `http://localhost:3000` (default `PORT=3000`)
- Dev watch: `npm run dev`
- Tests: `npm test` (node:test) — rank + SVG card unit tests
- Health: `GET /api/health`

### Optional GitHub token
- Copy `.env.example` → `.env` and set `GITHUB_TOKEN` for GraphQL (full multi-year commits, reviews, contributed-to).
- Without a token, `/api/json` and SVG routes fall back to public REST. Commits use all-time `/search/commits?q=author:USER`. Reviews use `reviewed-by:USER`. Contributed-to counts distinct non-owned repos from public search (PRs/issues/comments/commits).
- Token must stay server-side only — never expose it to `public/`.

## Project Structure

### Core files
- `server.js` — Express app: static site + `/api/stats`, `/api/top-langs`, `/api/json`
- `src/github.js` — GraphQL/REST stats fetcher + in-memory cache (~30 min)
- `src/rank.js` — S–C rank from weighted percentiles
- `src/cards/stats.js` — Stats SVG renderer
- `src/cards/languages.js` — Top-languages SVG renderer
- `src/cards/streak.js` — Streak SVG renderer
- `src/cards/graph.js` — Contribution heatmap SVG renderer
- `src/streak.js` — Calendar parse + streak math
- `public/` — Website (username form, live preview, markdown copy)
- `test/` — Unit tests

### Removed (legacy Electron)
- This project is **no longer** an Electron tray app. Do not reintroduce `electron`, `main.js` BrowserWindow, or `electron-store` unless explicitly requested.

## API contract (README embeds)

```
GET /api/stats?username=USER&theme=default&show_icons=true
GET /api/top-langs?username=USER&layout=compact&theme=default
GET /api/streak?username=USER&theme=default
GET /api/graph?username=USER&theme=default
GET /api/json?username=USER
```

SVG responses use `Content-Type: image/svg+xml` and `Cache-Control: public, max-age=1800`.

## Validation

1. `npm install` then `npm test`
2. `npm start` and open `/` — enter a public username (e.g. `octocat`)
3. Confirm live metrics + SVG previews load
4. Confirm markdown block copies and image URLs return SVG (`curl -sI /api/stats?username=octocat`)
5. With `GITHUB_TOKEN`, confirm `source: "graphql"` in `/api/json` and non-zero commit totals for active users

## Design notes for the website
- Brand-first hero (“Commit Warrior”), Syne + IBM Plex Mono, verdant accent on deep green-black — not purple/cream/newspaper defaults
- First viewport: brand, one headline, one lede, username CTA — no stat dumps in the hero
- Cards appear only after lookup (preview of README embeds)
