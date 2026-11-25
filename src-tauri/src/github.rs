//! GitHub REST client, contribution-calendar parsing and stats assembly.

use crate::{cache, signals};
use chrono::Utc;
use regex::Regex;
use reqwest::Client;
use serde::de::DeserializeOwned;
use serde_json::{json, Value};
use std::{
    collections::HashSet,
    sync::{
        atomic::{AtomicBool, Ordering},
        OnceLock,
    },
};

const API: &str = "https://api.github.com";
const COLORS: &[(&str, &str)] = &[
    ("JavaScript", "#f1e05a"),
    ("TypeScript", "#3178c6"),
    ("Python", "#3572A5"),
    ("Go", "#00ADD8"),
    ("Rust", "#dea584"),
    ("Java", "#b07219"),
    ("C++", "#f34b7d"),
    ("C", "#555555"),
    ("Ruby", "#701516"),
    ("PHP", "#4F5D95"),
    ("Swift", "#F05138"),
    ("Kotlin", "#A97BFF"),
    ("Shell", "#89e051"),
    ("HTML", "#e34c26"),
    ("CSS", "#563d7c"),
];

pub struct Github {
    client: Client,
    token: Option<String>,
    token_revoked: AtomicBool,
}

impl Github {
    pub fn new() -> Self {
        let token = std::env::var("GITHUB_TOKEN")
            .or_else(|_| std::env::var("GH_TOKEN"))
            .ok()
            .filter(|t| !t.trim().is_empty());
        Self {
            client: Client::builder()
                .user_agent("CommitWarrior-Desktop/2.0")
                .build()
                .unwrap_or_else(|_| Client::new()),
            token,
            token_revoked: AtomicBool::new(false),
        }
    }

    async fn request(&self, url: &str, allow_auth: bool) -> Result<reqwest::Response, String> {
        let mut req = self
            .client
            .get(url)
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "CommitWarrior-Desktop/2.0")
            .header("X-GitHub-Api-Version", "2022-11-28");
        if allow_auth && !self.token_revoked.load(Ordering::Relaxed) {
            if let Some(token) = &self.token {
                req = req.bearer_auth(token);
            }
        }
        req.send().await.map_err(|e| format!("GitHub request failed: {}", e))
    }

    async fn response_json<T: DeserializeOwned>(res: reqwest::Response) -> Result<T, String> {
        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            return Err(format!("GitHub API {}: {}", status.as_u16(), truncate(&body, 200)));
        }
        res.json::<T>()
            .await
            .map_err(|e| format!("Could not parse GitHub response: {}", e))
    }

    async fn get_json<T: DeserializeOwned>(&self, url: &str) -> Result<T, String> {
        let allow_auth = self.token.is_some() && !self.token_revoked.load(Ordering::Relaxed);
        let res = self.request(url, allow_auth).await?;
        if res.status().as_u16() == 401 && allow_auth {
            self.token_revoked.store(true, Ordering::Relaxed);
            let retry = self.request(url, false).await?;
            return Self::response_json(retry).await;
        }
        Self::response_json(res).await
    }

    async fn get_text(&self, url: &str) -> Result<String, String> {
        let res = self
            .client
            .get(url)
            .header("Accept", "text/html")
            .header("User-Agent", "CommitWarrior-Desktop/2.0")
            .send()
            .await
            .map_err(|e| format!("GitHub request failed: {}", e))?;
        if res.status().as_u16() == 404 {
            return Err("not found".to_string());
        }
        if !res.status().is_success() {
            return Err(format!("GitHub contributions page {}", res.status().as_u16()));
        }
        res.text().await.map_err(|e| e.to_string())
    }

    async fn fetch_user(&self, login: &str) -> Result<Value, String> {
        match self.get_json::<Value>(&format!("{}/users/{}", API, login)).await {
            Ok(user) => Ok(user),
            Err(err) if err.contains("404") => {
                Err(format!("User \"{}\" not found", login))
            }
            Err(err) => Err(err),
        }
    }

    async fn fetch_repos(&self, login: &str) -> Result<Vec<Value>, String> {
        let mut repos = Vec::new();
        for page in 1..=5 {
            let batch = self
                .get_json::<Vec<Value>>(&format!(
                    "{}/users/{}/repos?per_page=100&page={}&type=owner&sort=updated",
                    API, login, page
                ))
                .await?;
            let empty = batch.is_empty();
            repos.extend(batch);
            if empty || repos.len() % 100 != 0 {
                break;
            }
        }
        Ok(repos)
    }

    async fn search_count(&self, query: &str) -> Result<u64, String> {
        let url = format!(
            "{}/search/issues?q={}&per_page=1",
            API,
            urlencode(query)
        );
        let data = self.get_json::<Value>(&url).await?;
        Ok(data.get("total_count").and_then(Value::as_u64).unwrap_or(0))
    }

    async fn search_repo_names(&self, query: &str) -> Result<HashSet<String>, String> {
        let mut repos = HashSet::new();
        for page in 1..=2 {
            let data = self
                .get_json::<Value>(&format!(
                    "{}/search/issues?q={}&per_page=100&page={}",
                    API,
                    urlencode(query),
                    page
                ))
                .await?;
            let items = data.get("items").and_then(Value::as_array).cloned().unwrap_or_default();
            for item in &items {
                if let Some(Some(name)) = item
                    .get("repository_url")
                    .and_then(Value::as_str)
                    .map(|url| url.rsplit('/').next())
                {
                    repos.insert(name.to_string());
                }
            }
            if items.len() < 100 {
                break;
            }
        }
        Ok(repos)
    }

    async fn fetch_collaboration(&self, login: &str) -> (u64, u64, &'static str, &'static str) {
        let q_reviews = format!("type:pr reviewed-by:{}", login);
        let q_pr_repos = format!("author:{} type:pr -user:{}", login, login);
        let q_issue_repos = format!("author:{} type:issue -user:{}", login, login);
        let q_comment_repos = format!("commenter:{} -user:{}", login, login);
        let q_commit_repos = format!("author:{} -user:{}", login, login);
        let (reviews, pr_repos, issue_repos, comment_repos, commit_repos) = tokio::join!(
            self.search_count(&q_reviews),
            self.search_repo_names(&q_pr_repos),
            self.search_repo_names(&q_issue_repos),
            self.search_repo_names(&q_comment_repos),
            self.search_repo_names(&q_commit_repos),
        );
        let mut all = HashSet::new();
        for set in [pr_repos, issue_repos, comment_repos, commit_repos] {
            if let Ok(set) = set {
                all.extend(set);
            }
        }
        (
            reviews.unwrap_or(0),
            all.len() as u64,
            "search",
            "search",
        )
    }

    async fn fetch_commit_count(&self, login: &str) -> (u64, &'static str) {
        let url = format!(
            "{}/search/commits?q={}&per_page=1",
            API,
            urlencode(&format!("author:{}", login))
        );
        if let Ok(data) = self.get_json::<Value>(&url).await {
            return (
                data.get("total_count").and_then(Value::as_u64).unwrap_or(0),
                "search",
            );
        }
        // Last resort: recent public PushEvents (counts are often redacted).
        let events = self
            .get_json::<Vec<Value>>(&format!("{}/users/{}/events/public?per_page=100", API, login))
            .await
            .unwrap_or_default();
        let total = events
            .iter()
            .filter(|event| {
                event.get("type").and_then(Value::as_str) == Some("PushEvent")
            })
            .map(|event| {
                let payload = event.get("payload");
                payload
                    .and_then(|p| p.get("distinct_size"))
                    .and_then(Value::as_u64)
                    .or_else(|| payload.and_then(|p| p.get("size")).and_then(Value::as_u64))
                    .unwrap_or_else(|| {
                        payload
                            .and_then(|p| p.get("commits"))
                            .and_then(Value::as_array)
                            .map(|c| c.len() as u64)
                            .unwrap_or(0)
                    })
            })
            .sum();
        (total, "events-recent")
    }

    async fn fetch_calendar(&self, login: &str) -> Result<(Vec<Value>, u64), String> {
        let today = Utc::now().format("%Y-%m-%d").to_string();
        let html = self
            .get_text(&format!(
                "https://github.com/users/{}/contributions?to={}",
                login, today
            ))
            .await?;
        Ok(parse_contributions_html(&html))
    }

    async fn load_stats(&self, login: &str) -> Result<Value, String> {
        let user = self.fetch_user(login).await?;
        let repos = self.fetch_repos(login).await?;
        let owned: Vec<&Value> = repos.iter().filter(|r| {
            r.get("fork").and_then(Value::as_bool) != Some(true)
        }).collect();

        let total_stars: u64 = owned
            .iter()
            .map(|r| r.get("stargazers_count").and_then(Value::as_u64).unwrap_or(0))
            .sum();
        let mut lang_count: std::collections::HashMap<String, u64> =
            std::collections::HashMap::new();
        for repo in &owned {
            if let Some(lang) = repo.get("language").and_then(Value::as_str) {
                if !lang.is_empty() {
                    *lang_count.entry(lang.to_string()).or_default() += 1;
                }
            }
        }
        let total_lang: u64 = lang_count.values().sum::<u64>().max(1);
        let mut languages: Vec<(String, u64)> = lang_count.into_iter().collect();
        languages.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
        languages.truncate(8);
        let top_languages: Vec<Value> = languages
            .iter()
            .map(|(name, count)| {
                let color = COLORS
                    .iter()
                    .find(|(key, _)| *key == name.as_str())
                    .map(|(_, color)| *color)
                    .unwrap_or("#8b949e");
                json!({
                    "name": name,
                    "color": color,
                    "bytes": count,
                    "percent": ((*count as f64 / total_lang as f64) * 1000.0).round() / 10.0,
                })
            })
            .collect();

        let q_prs = format!("author:{} type:pr", login);
        let q_merged = format!("author:{} type:pr is:merged", login);
        let q_closed_issues = format!("author:{} type:issue is:closed", login);
        let q_open_issues = format!("author:{} type:issue is:open", login);
        let (total_prs, merged_prs, closed_issues, open_issues, collab, commits) = tokio::join!(
            self.search_count(&q_prs),
            self.search_count(&q_merged),
            self.search_count(&q_closed_issues),
            self.search_count(&q_open_issues),
            self.fetch_collaboration(login),
            self.fetch_commit_count(login),
        );

        let total_prs = total_prs.unwrap_or(0);
        let merged_prs = merged_prs.unwrap_or(0);
        let closed_issues = closed_issues.unwrap_or(0);
        let open_issues = open_issues.unwrap_or(0);
        let (reviews, contributed, reviews_source, contrib_source) = collab;
        let (total_commits, commits_source) = commits;

        let mut stats = json!({
            "name": user.get("name").and_then(Value::as_str).filter(|s| !s.is_empty())
                .unwrap_or_else(|| login).to_string(),
            "login": user.get("login").and_then(Value::as_str).unwrap_or(login).to_string(),
            "avatarUrl": user.get("avatar_url").and_then(Value::as_str).unwrap_or(""),
            "url": user.get("html_url").and_then(Value::as_str).unwrap_or(""),
            "totalStars": total_stars,
            "totalCommits": total_commits,
            "totalPRs": total_prs,
            "mergedPRs": merged_prs,
            "closedPRs": total_prs.saturating_sub(merged_prs),
            "openIssues": open_issues,
            "closedIssues": closed_issues,
            "totalIssues": open_issues + closed_issues,
            "totalReviews": reviews,
            "contributedTo": contributed,
            "followers": user.get("followers").and_then(Value::as_u64).unwrap_or(0),
            "publicRepos": user.get("public_repos").and_then(Value::as_u64).unwrap_or(owned.len() as u64),
            "topLanguages": top_languages,
            "commitsWindow": "all-time",
            "commitsSource": commits_source,
            "reviewsSource": reviews_source,
            "contribSource": contrib_source,
            "source": "rest",
            "partial": true,
            "note": "Public REST stats: commits/reviews/contributed-to use GitHub search (all-time, public/indexed).",
        });

        match self.fetch_calendar(login).await {
            Ok((days, total)) => {
                let streak = signals::compute_streaks(&days);
                stats["calendar"] = json!(days);
                stats["yearContributions"] = json!(total);
                stats["streak"] = streak;
                stats["calendarSource"] = json!("html");
            }
            Err(err) => {
                stats["calendar"] = json!([]);
                stats["yearContributions"] = json!(0);
                stats["streak"] = signals::compute_streaks(&[]);
                stats["calendarError"] = json!(err);
            }
        }

        stats["rank"] = signals::calculate_rank(&stats);
        let calendar: Vec<Value> = stats["calendar"].as_array().cloned().unwrap_or_default();
        let viz = signals::build_visualizations(&calendar);
        let funnel = signals::build_funnel(&stats);
        let recent = signals::build_recent(&calendar);
        let signal_payload = signals::build_signals(&stats, &viz, &funnel);
        stats["recent"] = recent;
        stats["viz"] = viz;
        stats["funnel"] = funnel;
        stats["signals"] = signal_payload.clone();
        stats["milestones"] = signals::build_milestones(&stats);
        stats["highlights"] = json!(signal_payload
            .get("pillars")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default()
            .iter()
            .map(|p| json!({
                "label": p.get("title").cloned().unwrap_or(Value::Null),
                "value": p.get("metric").cloned().unwrap_or(Value::Null),
            }))
            .collect::<Vec<_>>());

        Ok(stats)
    }
}

fn truncate(text: &str, max: usize) -> String {
    let clean: String = text.chars().take(max).collect();
    clean
}

fn urlencode(text: &str) -> String {
    let mut out = String::new();
    for byte in text.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{:02X}", byte)),
        }
    }
    out
}

fn re(pattern: &str) -> Regex {
    Regex::new(pattern).expect("valid static regex")
}

fn parse_tooltip(text: &str) -> Option<u64> {
    let stripped = re("<[^>]+>").replace_all(text, " ");
    let collapsed = re("\\s+").replace_all(&stripped, " ");
    let clean = collapsed.trim();
    if clean.to_lowercase().starts_with("no contributions") {
        return Some(0);
    }
    let caps = re("(?i)^([\\d,]+)\\s+contributions?").captures(clean)?;
    caps.get(1)?
        .as_str()
        .replace(',', "")
        .parse::<u64>()
        .ok()
}

fn unescape_entities(text: &str) -> String {
    text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

pub fn parse_contributions_html(html: &str) -> (Vec<Value>, u64) {
    let mut counts_by_id = std::collections::HashMap::new();
    let tip_re = re("(?is)<tool-tip\\b[^>]*\\bfor=\"([^\"]+)\"[^>]*>([\\s\\S]*?)<\\/tool-tip>");
    for caps in tip_re.captures_iter(html) {
        if let (Some(id), Some(body)) = (caps.get(1), caps.get(2)) {
            if let Some(count) = parse_tooltip(body.as_str()) {
                counts_by_id.insert(id.as_str().to_string(), count);
            }
        }
    }

    let cell_re = re("(?i)<td\\b([^>]*)>");
    let date_re = re("data-date=\"(\\d{4}-\\d{2}-\\d{2})\"");
    let level_re = re("data-level=\"(\\d)\"");
    let id_re = re("\\bid=\"([^\"]+)\"");
    let mut days = Vec::new();
    let mut seen = HashSet::new();

    for caps in cell_re.captures_iter(html) {
        let attrs = caps.get(1).map(|m| m.as_str()).unwrap_or("");
        let date = match date_re.captures(attrs).and_then(|c| c.get(1)) {
            Some(value) => value.as_str().to_string(),
            None => continue,
        };
        if !seen.insert(date.clone()) {
            continue;
        }
        let level = level_re
            .captures(attrs)
            .and_then(|c| c.get(1))
            .and_then(|m| m.as_str().parse::<u64>().ok())
            .unwrap_or(0);
        let tooltip_count = id_re
            .captures(attrs)
            .and_then(|c| c.get(1))
            .and_then(|m| counts_by_id.get(m.as_str()).copied());
        let count = tooltip_count.unwrap_or(if level > 0 { 1 } else { 0 });
        days.push(json!({ "date": date, "level": level, "count": count }));
    }
    days.sort_by(|a, b| {
        a.get("date")
            .and_then(Value::as_str)
            .unwrap_or("")
            .cmp(b.get("date").and_then(Value::as_str).unwrap_or(""))
    });

    let total = re("(?i)([\\d,]+)\\s+contributions?\\s+in the last year")
        .captures(html)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().replace(',', "").parse::<u64>().ok())
        .unwrap_or_else(|| {
            days.iter()
                .map(|d| d.get("count").and_then(Value::as_u64).unwrap_or(0))
                .sum()
        });

    let _ = unescape_entities(""); // keep helper available for future entities
    (days, total)
}

fn valid_login(login: &str) -> bool {
    if login.is_empty() || login.len() > 39 {
        return false;
    }
    let bytes = login.as_bytes();
    let alphanumeric = |b: u8| b.is_ascii_alphanumeric();
    if !alphanumeric(bytes[0]) || !alphanumeric(bytes[bytes.len() - 1]) {
        return false;
    }
    !login.contains("--") && bytes.iter().all(|b| b.is_ascii_alphanumeric() || *b == b'-')
}

static CLIENT: OnceLock<Github> = OnceLock::new();
fn client() -> &'static Github {
    CLIENT.get_or_init(Github::new)
}

fn with_flags(mut value: Value, cached: bool, stale: bool) -> Value {
    if let Value::Object(map) = &mut value {
        map.insert("cached".to_string(), json!(cached));
        map.insert("stale".to_string(), json!(stale));
    }
    value
}

pub async fn fetch_user_stats(username: &str) -> Result<Value, String> {
    let login = username.trim().trim_start_matches('@');
    if !valid_login(login) {
        return Err("Invalid GitHub username".to_string());
    }
    let key = format!("stats:{}", login.to_lowercase());

    if let Some(cached) = cache::get_fresh(&key) {
        return Ok(with_flags(cached, true, false));
    }
    if let Some(stale) = cache::get_stale(&key) {
        let refresh_login = login.to_string();
        let refresh_key = key.clone();
        tokio::spawn(async move {
            if let Ok(fresh) = client().load_stats(&refresh_login).await {
                cache::set(&refresh_key, fresh);
            }
        });
        return Ok(with_flags(stale, true, true));
    }

    let stats = client().load_stats(login).await?;
    cache::set(&key, stats.clone());
    Ok(stats)
}
