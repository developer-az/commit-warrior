//! Port of the Node `rank.js`, `streak.js` and `insights.js` logic.

use chrono::{Datelike, Duration, NaiveDate, Utc};
use serde_json::{json, Value};
use std::collections::HashMap;

fn num(value: Option<&Value>) -> f64 {
    match value {
        Some(Value::Number(n)) => n.as_f64().unwrap_or(0.0),
        Some(Value::String(s)) => s.parse::<f64>().unwrap_or(0.0),
        _ => 0.0,
    }
}

fn u64_of(value: Option<&Value>) -> u64 {
    num(value).max(0.0) as u64
}

fn format_count(value: u64) -> String {
    let digits = value.to_string();
    let mut out = String::with_capacity(digits.len() + digits.len() / 3);
    for (i, ch) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(ch);
    }
    out
}

fn pct(part: f64, whole: f64) -> Option<u64> {
    if whole == 0.0 {
        None
    } else {
        Some(((part / whole) * 100.0).round() as u64)
    }
}

fn valid_date(value: &Value) -> Option<String> {
    let s = value.get("date")?.as_str()?;
    if s.len() == 10
        && s.as_bytes()[4] == b'-'
        && s.as_bytes()[7] == b'-'
        && NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok()
    {
        Some(s.to_string())
    } else {
        None
    }
}

fn today_iso() -> String {
    Utc::now().format("%Y-%m-%d").to_string()
}

fn add_days(iso: &str, delta: i64) -> String {
    match NaiveDate::parse_from_str(iso, "%Y-%m-%d") {
        Ok(date) => (date + Duration::days(delta)).format("%Y-%m-%d").to_string(),
        Err(_) => iso.to_string(),
    }
}

fn day_count(day: Option<&Value>) -> u64 {
    match day {
        Some(d) => {
            let count = num(d.get("count"));
            if count > 0.0 {
                count as u64
            } else if num(d.get("level")) > 0.0 {
                1
            } else {
                0
            }
        }
        None => 0,
    }
}

fn sorted_days(days: &[Value]) -> Vec<Value> {
    let mut list: Vec<Value> = days
        .iter()
        .filter(|d| valid_date(d).is_some())
        .cloned()
        .collect();
    list.sort_by(|a, b| {
        valid_date(a)
            .unwrap_or_default()
            .cmp(&valid_date(b).unwrap_or_default())
    });
    list
}

fn by_date(days: &[Value]) -> HashMap<String, Value> {
    days.iter()
        .filter_map(|d| valid_date(d).map(|date| (date, d.clone())))
        .collect()
}

pub fn compute_streaks(days: &[Value]) -> Value {
    let sorted = sorted_days(days);
    let lookup = by_date(&sorted);
    let total: u64 = sorted.iter().map(|d| u64_of(d.get("count"))).sum();

    let mut longest = 0u64;
    let mut longest_start: Option<String> = None;
    let mut longest_end: Option<String> = None;
    let mut run = 0u64;
    let mut run_start: Option<String> = None;

    for day in &sorted {
        let date = valid_date(day).unwrap_or_default();
        if day_count(Some(day)) > 0 {
            if run == 0 {
                run_start = Some(date.clone());
            }
            run += 1;
            if run > longest {
                longest = run;
                longest_start = run_start.clone();
                longest_end = Some(date.clone());
            }
        } else {
            run = 0;
            run_start = None;
        }
    }

    let mut cursor = today_iso();
    if day_count(lookup.get(&cursor)) == 0 {
        cursor = add_days(&cursor, -1);
    }
    let mut current = 0u64;
    let current_end = if day_count(lookup.get(&cursor)) > 0 {
        Some(cursor.clone())
    } else {
        None
    };
    let mut current_start: Option<String> = None;
    while day_count(lookup.get(&cursor)) > 0 {
        current += 1;
        current_start = Some(cursor.clone());
        cursor = add_days(&cursor, -1);
    }

    json!({
        "total": total,
        "currentStreak": current,
        "currentStart": current_start,
        "currentEnd": current_end,
        "longestStreak": longest,
        "longestStart": longest_start,
        "longestEnd": longest_end,
    })
}

pub fn compute_trend(weeks: &[Value]) -> Value {
    if weeks.len() < 8 {
        return json!({
            "direction": "stable",
            "label": "Insufficient history",
            "deltaPct": Value::Null,
        });
    }
    let sum = |slice: &[Value]| -> u64 {
        slice.iter().map(|w| u64_of(w.get("count"))).sum()
    };
    let recent = sum(&weeks[weeks.len() - 4..]);
    let prior = sum(&weeks[weeks.len() - 8..weeks.len() - 4]);
    if prior == 0 && recent == 0 {
        return json!({ "direction": "idle", "label": "No recent activity", "deltaPct": 0 });
    }
    if prior == 0 {
        return json!({ "direction": "up", "label": "Activity resumed", "deltaPct": 100 });
    }
    let delta = ((recent as f64 - prior as f64) / prior as f64 * 100.0).round() as i64;
    let (direction, label) = if delta > 12 {
        ("up", "Picking up")
    } else if delta < -12 {
        ("down", "Slowing down")
    } else {
        ("stable", "Steady output")
    };
    json!({ "direction": direction, "label": label, "deltaPct": delta })
}

pub fn build_recent(days: &[Value]) -> Value {
    let today = today_iso();
    let yesterday = add_days(&today, -1);
    let prior = add_days(&today, -2);
    let sorted = sorted_days(days);
    let lookup = by_date(&sorted);
    let last_calendar_date = sorted.last().and_then(|d| valid_date(d));

    let today_published = lookup.contains_key(&today);
    let today_count = day_count(lookup.get(&today));
    let yesterday_count = day_count(lookup.get(&yesterday));
    let prior_count = day_count(lookup.get(&prior));

    let last14: Vec<Value> = (0..14)
        .rev()
        .map(|i| {
            let date = add_days(&today, -i);
            json!({
                "date": date,
                "count": day_count(lookup.get(&date)),
                "published": lookup.contains_key(&date),
            })
        })
        .collect();

    let mut last7_count = 0u64;
    let mut last7_active = 0u64;
    for i in 0..7 {
        let count = day_count(lookup.get(&add_days(&today, -i)));
        last7_count += count;
        if count > 0 {
            last7_active += 1;
        }
    }

    let (status, headline) = if today_count > 0 {
        ("active", "Contributions today")
    } else if yesterday_count > 0 {
        ("watch", "Contributions yesterday")
    } else if !today_published
        && last_calendar_date.as_deref().unwrap_or("") < today.as_str()
    {
        ("stale", "Calendar pending")
    } else {
        ("idle", "No activity today")
    };

    json!({
        "generatedAt": Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string(),
        "today": today,
        "yesterday": yesterday,
        "prior": prior,
        "todayCount": today_count,
        "yesterdayCount": yesterday_count,
        "priorCount": prior_count,
        "delta": today_count as i64 - yesterday_count as i64,
        "todayPublished": today_published,
        "lastCalendarDate": last_calendar_date,
        "last7Count": last7_count,
        "last7ActiveDays": last7_active,
        "last14": last14,
        "status": status,
        "headline": headline,
    })
}

pub fn build_visualizations(days: &[Value]) -> Value {
    let sorted = sorted_days(days);
    let lookup = by_date(&sorted);
    let today = today_iso();

    let labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let mut weekday_counts = [0u64; 7];
    let mut active_days = 0u64;
    let mut total_count = 0u64;
    let mut peak_day: Option<Value> = None;

    for day in &sorted {
        let count = day_count(Some(day));
        total_count += count;
        if let Some(date) = valid_date(day) {
            if let Ok(parsed) = NaiveDate::parse_from_str(&date, "%Y-%m-%d") {
                weekday_counts[parsed.weekday().num_days_from_sunday() as usize] += count;
            }
        }
        if count > 0 {
            active_days += 1;
            let peak = u64_of(peak_day.as_ref().and_then(|p| p.get("count")));
            if count > peak {
                peak_day = Some(json!({ "date": valid_date(day), "count": count }));
            }
        }
    }

    let weekdays: Vec<Value> = labels
        .iter()
        .enumerate()
        .map(|(i, label)| json!({ "label": label, "count": weekday_counts[i] }))
        .collect();

    let weeks: Vec<Value> = (0..12)
        .rev()
        .map(|i| {
            let end = add_days(&today, -i * 7);
            let start = add_days(&end, -6);
            let count: u64 = (0..7)
                .map(|d| day_count(lookup.get(&add_days(&start, d))))
                .sum();
            json!({
                "start": start,
                "end": end,
                "label": start.get(5..).unwrap_or(""),
                "count": count,
            })
        })
        .collect();

    let months: Vec<Value> = (0..6)
        .rev()
        .map(|i| {
            let base = NaiveDate::parse_from_str(&today, "%Y-%m-%d")
                .unwrap_or_else(|_| Utc::now().date_naive())
                .with_day(1)
                .unwrap_or_else(|| Utc::now().date_naive());
            let month_index = base.year() * 12 + base.month0() as i32 - i;
            let year = month_index.div_euclid(12);
            let month = month_index.rem_euclid(12) as u32 + 1;
            let date = NaiveDate::from_ymd_opt(year, month, 1)
                .unwrap_or(base);
            let key = date.format("%Y-%m").to_string();
            let count: u64 = sorted
                .iter()
                .filter(|d| valid_date(d).map(|v| v.starts_with(&key)).unwrap_or(false))
                .map(|d| day_count(Some(d)))
                .sum();
            json!({
                "key": key,
                "label": date.format("%b").to_string(),
                "count": count,
            })
        })
        .collect();

    let oldest = add_days(&today, -364);
    let mut cursor = monday_of(&oldest);
    let mut activity = Vec::new();
    while cursor.as_str() <= today.as_str() {
        let count: u64 = (0..7)
            .map(|d| day_count(lookup.get(&add_days(&cursor, d))))
            .sum();
        activity.push(json!({ "start": cursor.clone(), "count": count }));
        cursor = add_days(&cursor, 7);
    }

    let spanned = sorted.len().max(1) as u64;
    let trend = compute_trend(&weeks);
    let busiest = weekdays
        .iter()
        .max_by_key(|w| u64_of(w.get("count")))
        .cloned();
    let consistency = json!({
        "activeDays": active_days,
        "daysTracked": spanned,
        "activePct": ((active_days as f64 / spanned as f64) * 100.0).round() as u64,
        "total": total_count,
        "avgPerActiveDay": if active_days > 0 {
            ((total_count as f64 / active_days as f64) * 10.0).round() / 10.0
        } else { 0.0 },
        "peakDay": peak_day,
        "busiestWeekday": busiest,
        "trend": trend,
    });

    json!({
        "weekdays": weekdays,
        "weeks": weeks,
        "months": months,
        "activity": activity,
        "consistency": consistency,
    })
}

fn monday_of(iso: &str) -> String {
    match NaiveDate::parse_from_str(iso, "%Y-%m-%d") {
        Ok(date) => {
            let weekday = date.weekday().num_days_from_sunday() as i64;
            let diff = if weekday == 0 { -6 } else { 1 - weekday };
            add_days(iso, diff)
        }
        Err(_) => iso.to_string(),
    }
}

pub fn build_funnel(stats: &Value) -> Value {
    let opened = u64_of(stats.get("totalPRs"));
    let merged = u64_of(stats.get("mergedPRs"));
    let closed = u64_of(stats.get("closedPRs"));
    let total_issues = u64_of(stats.get("totalIssues"));
    let closed_issues = u64_of(stats.get("closedIssues"));
    json!({
        "prs": {
            "opened": opened,
            "merged": merged,
            "closed": closed,
            "mergeRate": pct(merged as f64, opened as f64),
            "open": opened.saturating_sub(merged + closed),
        },
        "issues": {
            "opened": total_issues,
            "closed": closed_issues,
            "closeRate": pct(closed_issues as f64, total_issues as f64),
        },
    })
}

pub fn build_signals(stats: &Value, viz: &Value, funnel: &Value) -> Value {
    let trend = viz
        .get("consistency")
        .and_then(|c| c.get("trend"))
        .filter(|t| !t.is_null())
        .cloned()
        .unwrap_or_else(|| compute_trend(&[]));
    let consistency = viz.get("consistency");
    let active_pct = consistency.and_then(|c| c.get("activePct")).cloned();
    let active_days = u64_of(consistency.and_then(|c| c.get("activeDays")));
    let merge_rate = funnel
        .get("prs")
        .and_then(|p| p.get("mergeRate"))
        .and_then(|v| v.as_u64());
    let merged = u64_of(stats.get("mergedPRs"));
    let total_prs = u64_of(stats.get("totalPRs"));
    let reviews = u64_of(stats.get("totalReviews"));
    let contributed = u64_of(stats.get("contributedTo"));
    let langs = stats
        .get("topLanguages")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut pillars = Vec::new();
    if merge_rate.is_some() || merged > 0 {
        pillars.push(json!({
            "id": "delivery",
            "title": "Delivery",
            "metric": match merge_rate {
                Some(rate) => format!("{}% merged", rate),
                None => format_count(merged),
            },
            "detail": match merge_rate {
                Some(_) => format!(
                    "{} of {} PRs landed",
                    format_count(merged),
                    format_count(total_prs)
                ),
                None => format!("{} merged pull requests", format_count(merged)),
            },
        }));
    }
    if reviews > 0 || contributed > 0 {
        pillars.push(json!({
            "id": "collaboration",
            "title": "Collaboration",
            "metric": if reviews > 0 { format_count(reviews) } else { format_count(contributed) },
            "detail": if reviews > 0 {
                format!("{} code reviews · {} external repos", format_count(reviews), format_count(contributed))
            } else {
                format!("Contributions across {} repositories", format_count(contributed))
            },
        }));
    }
    if let Some(pct_value) = &active_pct {
        if !pct_value.is_null() {
            pillars.push(json!({
                "id": "consistency",
                "title": "Consistency",
                "metric": format!("{}% active", pct_value),
                "detail": format!(
                    "{} · {} days with output in the last year",
                    trend.get("label").and_then(|v| v.as_str()).unwrap_or("Steady output"),
                    format_count(active_days)
                ),
            }));
        }
    }
    if !langs.is_empty() {
        let names: Vec<String> = langs
            .iter()
            .take(3)
            .filter_map(|l| l.get("name").and_then(|n| n.as_str()).map(str::to_string))
            .collect();
        let primary = langs[0]
            .get("name")
            .and_then(|n| n.as_str())
            .unwrap_or("Unknown")
            .to_string();
        pillars.push(json!({
            "id": "stack",
            "title": "Primary stack",
            "metric": primary,
            "detail": if langs.len() > 1 {
                format!("{} · {} languages in owned repos", names.join(", "), langs.len())
            } else {
                "Dominant language in owned repositories".to_string()
            },
        }));
    }

    let summary = pillars
        .iter()
        .filter_map(|p| p.get("metric").and_then(|v| v.as_str()))
        .collect::<Vec<_>>()
        .join(" · ");

    json!({ "pillars": pillars, "trend": trend, "summary": summary })
}

pub fn build_milestones(stats: &Value) -> Value {
    let checks = [
        ("commits-1k", "1K commits", u64_of(stats.get("totalCommits")) >= 1000),
        ("merged-25", "25 merged PRs", u64_of(stats.get("mergedPRs")) >= 25),
        ("reviews-25", "25 reviews", u64_of(stats.get("totalReviews")) >= 25),
        ("contrib-10", "10 repo contributions", u64_of(stats.get("contributedTo")) >= 10),
    ];
    let list: Vec<Value> = checks
        .iter()
        .filter(|(_, _, ok)| *ok)
        .map(|(id, label, _)| json!({ "id": id, "label": label }))
        .collect();
    Value::Array(list)
}

fn exponential_cdf(x: f64, lambda: f64) -> f64 {
    1.0 - (-x / lambda).exp()
}

fn normal_cdf(z: f64) -> f64 {
    let t = 1.0 / (1.0 + 0.2316419 * z.abs());
    let d = 0.3989423 * (-z * z / 2.0).exp();
    let mut p = d
        * t
        * (0.3193815
            + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if z > 0.0 {
        p = 1.0 - p;
    }
    p
}

fn log_normal_cdf(x: f64, mean: f64, sd: f64) -> f64 {
    if x <= 0.0 {
        return 0.0;
    }
    normal_cdf((x.ln() - mean) / sd)
}

pub fn calculate_rank(stats: &Value) -> Value {
    let commits = exponential_cdf(num(stats.get("totalCommits")), 250.0);
    let prs = exponential_cdf(num(stats.get("totalPRs")), 50.0);
    let issues = exponential_cdf(num(stats.get("totalIssues")), 25.0);
    let reviews = exponential_cdf(num(stats.get("totalReviews")), 2.0);
    let stars = log_normal_cdf(num(stats.get("totalStars")), 50f64.ln(), 1.2);
    let followers = log_normal_cdf(num(stats.get("followers")), 10f64.ln(), 1.2);

    let weighted = commits + 1.5 * prs + issues + 0.5 * reviews + 2.0 * stars + 0.5 * followers;
    let percentile = (1.0 - weighted / 6.5) * 100.0;
    let levels = [
        ("S", 1.0),
        ("A+", 12.5),
        ("A", 25.0),
        ("A-", 37.5),
        ("B+", 50.0),
        ("B", 62.5),
        ("B-", 75.0),
        ("C+", 87.5),
        ("C", 100.0),
    ];
    let level = levels
        .iter()
        .find(|(_, threshold)| percentile <= *threshold)
        .map(|(level, _)| *level)
        .unwrap_or("C");

    json!({
        "level": level,
        "percentile": (percentile * 100.0).round() / 100.0,
        "score": ((100.0 - percentile) * 100.0).round() / 100.0,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn day(date: &str, count: u64) -> Value {
        json!({ "date": date, "count": count, "level": if count > 0 { 2 } else { 0 } })
    }

    #[test]
    fn streaks_count_runs_and_longest() {
        let days = vec![
            day("2026-01-01", 1),
            day("2026-01-02", 2),
            day("2026-01-03", 0),
            day("2026-01-04", 3),
            day("2026-01-05", 1),
            day("2026-01-06", 1),
        ];
        let streak = compute_streaks(&days);
        assert_eq!(streak["longestStreak"], 3);
        assert_eq!(streak["longestStart"], "2026-01-04");
        assert_eq!(streak["total"], 8);
    }

    #[test]
    fn funnel_computes_merge_rate() {
        let stats = json!({ "totalPRs": 10, "mergedPRs": 7, "closedPRs": 1,
                            "totalIssues": 8, "closedIssues": 4 });
        let funnel = build_funnel(&stats);
        assert_eq!(funnel["prs"]["mergeRate"], 70);
        assert_eq!(funnel["issues"]["closeRate"], 50);
    }

    #[test]
    fn rank_is_c_for_empty_profile() {
        let rank = calculate_rank(&json!({}));
        assert_eq!(rank["level"], "C");
        assert_eq!(rank["score"], 0.0);
    }

    #[test]
    fn recent_marks_active_today() {
        let today = today_iso();
        let recent = build_recent(&[day(&today, 3)]);
        assert_eq!(recent["status"], "active");
        assert_eq!(recent["todayCount"], 3);
        assert_eq!(recent["delta"], 3);
    }

    #[test]
    fn visualizations_build_all_series() {
        let viz = build_visualizations(&[day("2026-01-05", 2)]);
        assert_eq!(viz["weekdays"].as_array().unwrap().len(), 7);
        assert_eq!(viz["weeks"].as_array().unwrap().len(), 12);
        assert_eq!(viz["months"].as_array().unwrap().len(), 6);
    }
}
