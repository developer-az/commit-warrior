# Community post drafts

These are drafts for you to review and post from your own accounts. I did not publish them.
Images use raw GitHub URLs, so they will resolve once these files are pushed to `main`.

Assets:
- Demo GIF: https://raw.githubusercontent.com/developer-az/commit-warrior/main/docs/demo.gif
- Dashboard: https://raw.githubusercontent.com/developer-az/commit-warrior/main/docs/demo-dashboard.png
- Widget: https://raw.githubusercontent.com/developer-az/commit-warrior/main/docs/demo-widget.png

Links:
- Live demo: https://commit-warrior.vercel.app/?username=developer-az
- Repo: https://github.com/developer-az/commit-warrior
- Windows installer: https://github.com/developer-az/commit-warrior/releases/latest

---

## Hacker News — Show HN

**Title:** Show HN: Commit Warrior – engineering activity profiles from public GitHub data

**Body:**

Hi HN,

I built Commit Warrior because GitHub's profile stats never showed the things I actually care about when reviewing an engineer: merge rate, review volume, consistency, and stack — not just star count.

It's a public GitHub username → dashboard with:

- all-time commits/PRs/issues/reviews from GitHub's public APIs
- a rank score with a visible, documented formula (no mystery badge)
- contribution heatmap, weekly rhythm, weekday patterns, merge funnel and language mix
- SVG cards you can embed in a profile README
- a Windows desktop app in Rust + Tauri with a tray icon and an always-on-top widget that refreshes every minute

Live demo: https://commit-warrior.vercel.app/?username=developer-az
Demo GIF: https://raw.githubusercontent.com/developer-az/commit-warrior/main/docs/demo.gif
Source: https://github.com/developer-az/commit-warrior

The website is Node/Express; the desktop app reuses the same frontend but calls a Rust backend over Tauri IPC. Everything uses public data, no account required.

I'd love feedback on the rank formula and what other signals would be useful in a review context. Thanks!

---

## Reddit — r/opensource (or r/github)

**Title:** I built an open-source GitHub activity dashboard with a Rust desktop widget — feedback welcome

**Body:**

Hey r/opensource — I've been working on Commit Warrior, a way to turn public GitHub activity into a review-ready profile instead of a vanity star count.

What it does:
- Dashboard with merge rate, review volume, streaks, consistency, language mix and a documented rank score
- SVG cards for profile READMEs
- Windows app in Rust + Tauri with a system tray and a floating widget showing rank, streak and today's activity

Live demo (no sign-up): https://commit-warrior.vercel.app/?username=developer-az
Demo: https://raw.githubusercontent.com/developer-az/commit-warrior/main/docs/demo.gif
Repo: https://github.com/developer-az/commit-warrior

It's MIT/ISC-licensed and self-hostable with `npm start`. If you try it, I'd love to know which metrics you actually look at when reviewing someone's GitHub — I may add more.

---

## dev.to

**Title:** Building a GitHub activity dashboard (and a Rust desktop widget) from public APIs

**Tags:** `github` `rust` `tauri` `opensource` `javascript`

**Outline / body starter:**

I wanted a GitHub profile view that showed delivery and collaboration signals, not just stars. So I built Commit Warrior: a Node/Express dashboard, embeddable SVG cards, and a Windows desktop app whose backend is a Rust port of the same stats logic.

The interesting parts:
1. GitHub's REST search endpoints give all-time commits, reviews and contributed-to repos without a token; GraphQL with a token adds full contribution years.
2. Contribution calendar HTML is parsed into exact daily counts via tooltips, then aggregated into streaks, weekday rhythm and trends.
3. The rank is simply `weighted / 6.5 × 100` with documented weights — stars carry 2×, PRs 1.5×, everything else 0.5–1×.
4. The desktop app shares the web frontend through a small bridge that swaps `fetch('/api/...')` for Tauri IPC commands.

Demo: https://commit-warrior.vercel.app/?username=developer-az
Repo: https://github.com/developer-az/commit-warrior

What would you include in an "engineering activity" profile?

---

## LinkedIn

**Body:**

I shipped a new open-source tool: Commit Warrior — a dashboard that turns public GitHub activity into review-ready signals like merge rate, code reviews, consistency and stack, plus embeddable README cards.

There's also a Windows desktop app I built with Rust and Tauri: a small always-on-top widget keeps your rank, streak and daily activity one click from the tray.

Live demo: https://commit-warrior.vercel.app/?username=developer-az
Source: https://github.com/developer-az/commit-warrior

I'm especially interested in feedback from engineers who review candidates or triage open-source contributors: which signals do you actually trust?
