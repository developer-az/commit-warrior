#!/usr/bin/env node
/**
 * Commit Warrior — GitHub README stats server
 * Serves the website + SVG/JSON APIs for embeddable profile stats.
 */

const fs = require("fs");
const path = require("path");
const express = require("express");

// Lightweight .env loader (no dependency)
try {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
} catch {
  /* ignore */
}

const { fetchUserStats, getToken, isTokenActive } = require("./src/github");
const { renderStatsCard } = require("./src/cards/stats");
const { renderLanguagesCard } = require("./src/cards/languages");
const { renderStreakCard } = require("./src/cards/streak");
const { renderGraphCard } = require("./src/cards/graph");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.use(express.json());

// Cache headers for README image embeds (GitHub CDN friendly)
function svgHeaders(res, seconds = 1800) {
  res.set({
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": `public, max-age=${seconds}`,
    "Access-Control-Allow-Origin": "*",
  });
}

function errorSvg(message, status = 400) {
  const text = String(message).slice(0, 120);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="120" viewBox="0 0 420 120">
  <rect width="420" height="120" rx="8" fill="#0d1117" stroke="#f85149"/>
  <text x="24" y="48" fill="#f85149" font-family="Segoe UI, Ubuntu, sans-serif" font-size="16" font-weight="600">Commit Warrior</text>
  <text x="24" y="76" fill="#e6edf3" font-family="Segoe UI, Ubuntu, sans-serif" font-size="13">${text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</text>
</svg>`;
}

async function handleStats(req, res) {
  const username = req.query.username;
  if (!username) {
    svgHeaders(res, 60);
    return res.status(400).send(errorSvg("Missing ?username= parameter"));
  }
  try {
    const stats = await fetchUserStats(username);
    svgHeaders(res);
    res.send(renderStatsCard(stats, req.query));
  } catch (err) {
    const status = err.status || 500;
    svgHeaders(res, 60);
    res.status(status).send(errorSvg(err.message || "Failed to load stats", status));
  }
}

async function handleLanguages(req, res) {
  const username = req.query.username;
  if (!username) {
    svgHeaders(res, 60);
    return res.status(400).send(errorSvg("Missing ?username= parameter"));
  }
  try {
    const stats = await fetchUserStats(username);
    svgHeaders(res);
    res.send(renderLanguagesCard(stats, req.query));
  } catch (err) {
    const status = err.status || 500;
    svgHeaders(res, 60);
    res.status(status).send(errorSvg(err.message || "Failed to load languages", status));
  }
}

async function handleStreak(req, res) {
  const username = req.query.username;
  if (!username) {
    svgHeaders(res, 60);
    return res.status(400).send(errorSvg("Missing ?username= parameter"));
  }
  try {
    const stats = await fetchUserStats(username);
    svgHeaders(res);
    res.send(renderStreakCard(stats, req.query));
  } catch (err) {
    const status = err.status || 500;
    svgHeaders(res, 60);
    res.status(status).send(errorSvg(err.message || "Failed to load streak", status));
  }
}

async function handleGraph(req, res) {
  const username = req.query.username;
  if (!username) {
    svgHeaders(res, 60);
    return res.status(400).send(errorSvg("Missing ?username= parameter"));
  }
  try {
    const stats = await fetchUserStats(username);
    svgHeaders(res);
    res.send(renderGraphCard(stats, req.query));
  } catch (err) {
    const status = err.status || 500;
    svgHeaders(res, 60);
    res.status(status).send(errorSvg(err.message || "Failed to load graph", status));
  }
}

// README embed endpoints (github-readme-stats compatible paths)
app.get("/api", handleStats);
app.get("/api/stats", handleStats);
app.get("/api/top-langs", handleLanguages);
app.get("/api/top-langs/", handleLanguages);
app.get("/api/streak", handleStreak);
app.get("/api/graph", handleGraph);

// JSON for the interactive website
app.get("/api/json", async (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ error: "Missing username" });
  }
  try {
    const stats = await fetchUserStats(username);
    res.set("Cache-Control", "public, max-age=600");
    res.json(stats);
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.message || "Failed to load stats",
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    tokenConfigured: Boolean(process.env.GITHUB_TOKEN || process.env.GH_TOKEN),
    tokenActive: isTokenActive(),
    version: require("./package.json").version,
  });
});

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Commit Warrior running at http://localhost:${PORT}`);
    console.log(
      getToken()
        ? "GitHub token detected — full GraphQL stats enabled."
        : "No GITHUB_TOKEN — public REST (all-time search for commits, reviews, contributed-to)."
    );
  });
}

module.exports = app;
