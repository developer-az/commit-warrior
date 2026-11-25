//! SVG card renderers — Rust port of src/cards/*.js.

use chrono::{Datelike, NaiveDate};
use serde_json::Value;

#[derive(Clone, Copy)]
struct Theme {
    title: &'static str,
    text: &'static str,
    icon: &'static str,
    bg: &'static str,
    border: &'static str,
    ring: &'static str,
    muted: &'static str,
}

const DEFAULT: Theme = Theme {
    title: "#2ea043",
    text: "#e6edf3",
    icon: "#3fb950",
    bg: "#0d1117",
    border: "#30363d",
    ring: "#238636",
    muted: "#8b949e",
};
const DARK: Theme = Theme {
    title: "#58a6ff",
    text: "#e6edf3",
    icon: "#58a6ff",
    bg: "#0d1117",
    border: "#30363d",
    ring: "#1f6feb",
    muted: "#8b949e",
};
const RADICAL: Theme = Theme {
    title: "#fe428e",
    text: "#a9fef7",
    icon: "#f8d847",
    bg: "#141321",
    border: "#fe428e55",
    ring: "#fe428e",
    muted: "#a9fef799",
};
const TOKYO: Theme = Theme {
    title: "#70a5fd",
    text: "#38bdae",
    icon: "#bf91f3",
    bg: "#1a1b27",
    border: "#70a5fd44",
    ring: "#bf91f3",
    muted: "#38bdae99",
};
const TRANSPARENT: Theme = Theme {
    title: "#2ea043",
    text: "#e6edf3",
    icon: "#3fb950",
    bg: "#00000000",
    border: "#00000000",
    ring: "#238636",
    muted: "#8b949e",
};
const PROFESSIONAL: Theme = Theme {
    title: "#8eb4e3",
    text: "#e6e9ef",
    icon: "#6b9bd1",
    bg: "#121820",
    border: "#252f3d",
    ring: "#6b9bd1",
    muted: "#8a939f",
};
const LIGHT: Theme = Theme {
    title: "#0969da",
    text: "#1f2328",
    icon: "#1a7f37",
    bg: "#ffffff",
    border: "#d0d7de",
    ring: "#1a7f37",
    muted: "#656d76",
};

fn theme(options: &Value) -> Theme {
    match str_opt(options, "theme") {
        "default" => DEFAULT,
        "dark" => DARK,
        "radical" => RADICAL,
        "tokyonight" => TOKYO,
        "transparent" => TRANSPARENT,
        "professional" => PROFESSIONAL,
        "light" => LIGHT,
        _ => DEFAULT,
    }
}

fn fallback_theme(options: &Value) -> Theme {
    if options.get("theme").is_some() {
        theme(options)
    } else {
        PROFESSIONAL
    }
}

fn str_opt<'a>(options: &'a Value, key: &str) -> &'a str {
    options.get(key).and_then(Value::as_str).unwrap_or("")
}

fn bool_opt(options: &Value, key: &str) -> bool {
    match options.get(key) {
        Some(Value::Bool(b)) => *b,
        Some(Value::String(s)) => s == "true",
        _ => false,
    }
}

fn escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn s_of(value: Option<&Value>) -> String {
    value
        .map(|v| match v {
            Value::String(s) => s.clone(),
            Value::Number(n) => n.to_string(),
            _ => String::new(),
        })
        .unwrap_or_default()
}

fn n_of(value: Option<&Value>) -> f64 {
    match value {
        Some(Value::Number(n)) => n.as_f64().unwrap_or(0.0),
        Some(Value::String(s)) => s.parse::<f64>().unwrap_or(0.0),
        _ => 0.0,
    }
}

fn u_of(value: Option<&Value>) -> u64 {
    n_of(value).max(0.0) as u64
}

fn count_separated(value: u64) -> String {
    let digits = value.to_string();
    let mut out = String::new();
    for (i, ch) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(ch);
    }
    out
}

fn compact_number(value: f64) -> String {
    if value >= 1_000_000.0 {
        format!("{:.1}M", value / 1_000_000.0)
    } else if value >= 10_000.0 {
        format!("{:.1}k", value / 1_000.0)
    } else if value >= 1_000.0 {
        format!("{:.1}k", value / 1_000.0)
    } else {
        (value as u64).to_string()
    }
}

const ICON_STAR: &str = "<path fill=\"currentColor\" d=\"M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z\"/>";
const ICON_COMMITS: &str = "<path fill=\"currentColor\" d=\"M1.643 3.143 .75.75V0h.5v.75l.9 2.393A5.002 5.002 0 0 1 10.5 6.5a5 5 0 0 1-9.5 2.143A.75.75 0 0 1 2 8.5a3.5 3.5 0 1 0 5.5-2.857A.75.75 0 0 1 8 5.25 5.002 5.002 0 0 1 1.643 3.143Z\"/><path fill=\"currentColor\" d=\"M7.5 1.75a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-.75v8.5a.75.75 0 0 1-1.5 0V2.5h-.75a.75.75 0 0 1-.75-.75Z\"/>";
const ICON_PRS: &str = "<path fill=\"currentColor\" d=\"M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z\"/>";
const ICON_ISSUES: &str = "<path fill=\"currentColor\" d=\"M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm9-3a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.92 6.085a.75.75 0 0 1 .904.37l.001.002.002.004.007.016.026.058c.02.044.049.105.084.183a4.46 4.46 0 0 0 .268.538c.202.356.47.762.756 1.07.285.307.557.508.704.586A.75.75 0 0 1 9 9.25v.753a.75.75 0 0 1-1.5 0V9.15a3.66 3.66 0 0 1-.45-.372 5.08 5.08 0 0 1-.677-.95 5.3 5.3 0 0 1-.318-.652l-.025-.056-.008-.017-.002-.004v-.002A.75.75 0 0 1 6.92 6.085Z\"/>";
const ICON_MERGED: &str = "<path fill=\"currentColor\" d=\"M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.75 5.75 0 0 1 4 3.75v-.955a2.25 2.25 0 1 1 1.5 0V5.154ZM4.25 13a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-9.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5.078 15.25a.75.75 0 0 1 .75-.75h5.844a.75.75 0 0 1 0 1.5H5.828a.75.75 0 0 1-.75-.75Z\"/>";
const ICON_REVIEWS: &str = "<path fill=\"currentColor\" d=\"M1.679 7.932c.172-.174.4-.338.68-.486.55-.288 1.305-.493 2.141-.493s1.59.205 2.141.493c.28.148.508.312.68.487.163.166.276.338.276.568 0 .23-.113.402-.276.568-.172.174-.4.338-.68.486-.55.288-1.305.493-2.141.493s-1.59-.205-2.141-.493a2.8 2.8 0 0 1-.68-.487C1.516 8.902 1.4 8.73 1.4 8.5c0-.23.116-.402.279-.568ZM8 9.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z\"/><path fill=\"currentColor\" d=\"M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z\"/>";
const ICON_CONTRIBS: &str = "<path fill=\"currentColor\" d=\"M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1V1.5h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z\"/>";
const ICON_FOLLOWERS: &str = "<path fill=\"currentColor\" d=\"M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4.001 4.001 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z\"/>";

fn stat_icon(name: &str, color: &str, x: f64, y: f64) -> String {
    let path = match name {
        "commits" => ICON_COMMITS,
        "prs" => ICON_PRS,
        "issues" | "issues_closed" => ICON_ISSUES,
        "merged" => ICON_MERGED,
        "reviews" => ICON_REVIEWS,
        "contribs" => ICON_CONTRIBS,
        "followers" => ICON_FOLLOWERS,
        _ => ICON_STAR,
    };
    format!(
        "<g transform=\"translate({},{})\" style=\"color:{}\">\n    <svg width=\"16\" height=\"16\" viewBox=\"0 0 16 16\">{}</svg>\n  </g>",
        x, y, color, path
    )
}

pub fn render_stats(stats: &Value, options: &Value) -> String {
    let t = theme(options);
    let show_icons = match options.get("show_icons") {
        Some(Value::Bool(b)) => *b,
        Some(Value::String(s)) => s != "false",
        _ => true,
    };
    let hide_rank = bool_opt(options, "hide_rank");
    let hide_border = bool_opt(options, "hide_border");

    let hide: Vec<&str> = str_opt(options, "hide")
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .collect();
    let show: Vec<&str> = str_opt(options, "show")
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .collect();
    let defaults = [
        "stars", "commits", "prs", "prs_merged", "issues", "issues_closed",
        "reviews", "contribs",
    ];

    let rows: Vec<(&str, &str, f64, &str)> = vec![
        ("stars", "Total Stars Earned", n_of(stats.get("totalStars")), "star"),
        ("commits", "Total Commits", n_of(stats.get("totalCommits")), "commits"),
        ("prs", "Total PRs", n_of(stats.get("totalPRs")), "prs"),
        ("prs_merged", "PRs Merged", n_of(stats.get("mergedPRs")), "merged"),
        ("issues", "Total Issues", n_of(stats.get("totalIssues")), "issues"),
        ("issues_closed", "Issues Closed", n_of(stats.get("closedIssues")), "issues"),
        ("reviews", "Code Reviews", n_of(stats.get("totalReviews")), "reviews"),
        ("contribs", "Contributed to", n_of(stats.get("contributedTo")), "contribs"),
        ("followers", "Followers", n_of(stats.get("followers")), "followers"),
    ];
    let visible: Vec<_> = rows
        .into_iter()
        .filter(|(key, _, _, _)| !hide.contains(key))
        .filter(|(key, _, _, _)| defaults.contains(key) || show.contains(key))
        .collect();

    let line_height = 25.0;
    let padding_top = 50.0;
    let height = padding_top + visible.len() as f64 * line_height + 20.0;
    let width = if hide_rank { 380.0 } else { 460.0 };
    let name = s_of(stats.get("name"));
    let title = format!("{}'s GitHub Stats", escape(&name));

    let rank = stats.get("rank");
    let level = rank
        .and_then(|r| r.get("level"))
        .and_then(Value::as_str)
        .unwrap_or("C");
    let score: f64 = rank
        .and_then(|r| r.get("score"))
        .map(|v| n_of(Some(v)))
        .unwrap_or(0.0)
        .clamp(0.0, 100.0);
    let circumference = 2.0 * std::f64::consts::PI * 40.0;
    let dash = score / 100.0 * circumference;

    let mut body = String::new();
    for (i, (_, label, value, icon_name)) in visible.iter().enumerate() {
        let y = padding_top + i as f64 * line_height;
        let label_x = if show_icons { 45 } else { 25 };
        if show_icons {
            body.push_str(&stat_icon(icon_name, t.icon, 25.0, y - 12.0));
        }
        body.push_str(&format!(
            "\n      <text x=\"{}\" y=\"{}\" class=\"stat\" fill=\"{}\">{}:</text>\n      <text x=\"{}\" y=\"{}\" class=\"stat bold\" fill=\"{}\" text-anchor=\"end\">{}</text>\n    ",
            label_x,
            y,
            t.text,
            escape(label),
            if hide_rank { 340 } else { 300 },
            y,
            t.text,
            compact_number(*value)
        ));
    }

    let rank_svg = if hide_rank {
        String::new()
    } else {
        format!(
            "\n    <g transform=\"translate({}, {})\">\n      <circle cx=\"0\" cy=\"0\" r=\"40\" fill=\"none\" stroke=\"{}\" stroke-width=\"6\"/>\n      <circle cx=\"0\" cy=\"0\" r=\"40\" fill=\"none\" stroke=\"{}\" stroke-width=\"6\"\n        stroke-dasharray=\"{} {}\"\n        stroke-linecap=\"round\" transform=\"rotate(-90)\"\n        style=\"animation: rank 1s ease-out forwards\"/>\n      <text x=\"0\" y=\"6\" text-anchor=\"middle\" class=\"rank\" fill=\"{}\">{}</text>\n      <text x=\"0\" y=\"58\" text-anchor=\"middle\" class=\"rank-label\" fill=\"{}\">Rank</text>\n    </g>",
            width - 90.0,
            height / 2.0,
            t.border,
            t.ring,
            dash,
            circumference,
            t.title,
            escape(level),
            t.muted
        )
    };

    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{}\" height=\"{}\" viewBox=\"0 0 {} {}\" role=\"img\" aria-label=\"{}\">\n  <title>{}</title>\n  <style>\n    .title {{ font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif; }}\n    .stat {{ font: 400 14px 'Segoe UI', Ubuntu, Sans-Serif; }}\n    .stat.bold {{ font-weight: 700; }}\n    .rank {{ font: 800 24px 'Segoe UI', Ubuntu, Sans-Serif; }}\n    .rank-label {{ font: 600 12px 'Segoe UI', Ubuntu, Sans-Serif; }}\n    @keyframes rank {{ from {{ stroke-dasharray: 0 {}; }} }}\n  </style>\n  <rect x=\"0.5\" y=\"0.5\" width=\"{}\" height=\"{}\" rx=\"8\"\n    fill=\"{}\" stroke=\"{}\"/>\n  <text x=\"25\" y=\"32\" class=\"title\" fill=\"{}\">{}</text>\n  {}\n  {}\n</svg>",
        width,
        height,
        width,
        height,
        title,
        title,
        circumference,
        width - 1.0,
        height - 1.0,
        t.bg,
        if hide_border { "none" } else { t.border },
        t.title,
        title,
        body,
        rank_svg
    )
}

pub fn render_languages(stats: &Value, options: &Value) -> String {
    let t = theme(options);
    let hide_border = bool_opt(options, "hide_border");
    let layout = str_opt(options, "layout");
    let all = stats
        .get("topLanguages")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let requested = str_opt(options, "langs_count").parse::<usize>().unwrap_or(6);
    let count = requested.min(all.len());
    let langs = &all[..count];
    let title = "Most Used Languages";
    let width = 300.0;

    if langs.is_empty() {
        return format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"300\" height=\"120\" viewBox=\"0 0 300 120\" role=\"img\">\n  <title>{}</title>\n  <style>\n    .title {{ font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif; }}\n    .msg {{ font: 400 13px 'Segoe UI', Ubuntu, Sans-Serif; }}\n  </style>\n  <rect x=\"0.5\" y=\"0.5\" width=\"299\" height=\"119\" rx=\"8\" fill=\"{}\" stroke=\"{}\"/>\n  <text x=\"25\" y=\"32\" class=\"title\" fill=\"{}\">{}</text>\n  <text x=\"25\" y=\"70\" class=\"msg\" fill=\"{}\">No public language data for this profile.</text>\n</svg>",
            title,
            t.bg,
            if hide_border { "none" } else { t.border },
            t.title,
            title,
            t.muted
        );
    }

    if layout == "compact" {
        let height: usize = 90 + ((langs.len() + 1) / 2) * 22;
        let bar_width = width - 50.0;
        let mut progress = String::new();
        let mut x = 0.0;
        for lang in langs {
            let percent = n_of(lang.get("percent"));
            let w = percent / 100.0 * bar_width;
            progress.push_str(&format!(
                "<rect x=\"{}\" y=\"50\" width=\"{}\" height=\"8\" fill=\"{}\"/>",
                25.0 + x,
                w.max(0.0),
                s_of(lang.get("color"))
            ));
            x += w;
        }
        let mut labels = String::new();
        for (i, lang) in langs.iter().enumerate() {
            let col = (i % 2) as f64;
            let row = (i / 2) as f64;
            let lx = 25.0 + col * 140.0;
            let ly = 80.0 + row * 22.0;
            labels.push_str(&format!(
                "\n        <circle cx=\"{}\" cy=\"{}\" r=\"4\" fill=\"{}\"/>\n        <text x=\"{}\" y=\"{}\" class=\"lang\" fill=\"{}\">{} {}%</text>\n      ",
                lx,
                ly - 4.0,
                s_of(lang.get("color")),
                lx + 12.0,
                ly,
                t.text,
                escape(&s_of(lang.get("name"))),
                s_of(lang.get("percent"))
            ));
        }
        return format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{}\" height=\"{}\" viewBox=\"0 0 {} {}\" role=\"img\">\n  <title>{}</title>\n  <style>\n    .title {{ font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif; }}\n    .lang {{ font: 400 12px 'Segoe UI', Ubuntu, Sans-Serif; }}\n  </style>\n  <rect x=\"0.5\" y=\"0.5\" width=\"{}\" height=\"{}\" rx=\"8\" fill=\"{}\" stroke=\"{}\"/>\n  <text x=\"25\" y=\"32\" class=\"title\" fill=\"{}\">{}</text>\n  <rect x=\"25\" y=\"50\" width=\"{}\" height=\"8\" rx=\"4\" fill=\"{}\"/>\n  {}\n  {}\n</svg>",
            width,
            height,
            width,
            height,
            title,
            width - 1.0,
            height as f64 - 1.0,
            t.bg,
            if hide_border { "none" } else { t.border },
            t.title,
            title,
            bar_width,
            t.border,
            progress,
            labels
        );
    }

    let line_height = 40.0;
    let height = 55.0 + langs.len() as f64 * line_height + 10.0;
    let mut body = String::new();
    for (i, lang) in langs.iter().enumerate() {
        let y = 55.0 + i as f64 * line_height;
        let percent = n_of(lang.get("percent"));
        let bar_w = (width - 50.0) * percent / 100.0;
        body.push_str(&format!(
            "\n      <text x=\"25\" y=\"{}\" class=\"lang\" fill=\"{}\">{}</text>\n      <text x=\"{}\" y=\"{}\" class=\"lang\" fill=\"{}\" text-anchor=\"end\">{}%</text>\n      <rect x=\"25\" y=\"{}\" width=\"{}\" height=\"8\" rx=\"4\" fill=\"{}\"/>\n      <rect x=\"25\" y=\"{}\" width=\"{}\" height=\"8\" rx=\"4\" fill=\"{}\">\n        <animate attributeName=\"width\" from=\"0\" to=\"{}\" dur=\"0.8s\" fill=\"freeze\"/>\n      </rect>\n    ",
            y,
            t.text,
            escape(&s_of(lang.get("name"))),
            width - 25.0,
            y,
            t.muted,
            s_of(lang.get("percent")),
            y + 8.0,
            width - 50.0,
            t.border,
            y + 8.0,
            bar_w.max(0.0),
            s_of(lang.get("color")),
            bar_w.max(0.0)
        ));
    }
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{}\" height=\"{}\" viewBox=\"0 0 {} {}\" role=\"img\">\n  <title>{}</title>\n  <style>\n    .title {{ font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif; }}\n    .lang {{ font: 400 13px 'Segoe UI', Ubuntu, Sans-Serif; }}\n  </style>\n  <rect x=\"0.5\" y=\"0.5\" width=\"{}\" height=\"{}\" rx=\"8\" fill=\"{}\" stroke=\"{}\"/>\n  <text x=\"25\" y=\"32\" class=\"title\" fill=\"{}\">{}</text>\n  {}\n</svg>",
        width,
        height,
        width,
        height,
        title,
        width - 1.0,
        height - 1.0,
        t.bg,
        if hide_border { "none" } else { t.border },
        t.title,
        title,
        body
    )
}

fn format_range(start: Option<&Value>, end: Option<&Value>) -> String {
    let (start, end) = match (start.and_then(Value::as_str), end.and_then(Value::as_str)) {
        (Some(s), Some(e)) if !s.is_empty() && !e.is_empty() => (s, e),
        _ => return "—".to_string(),
    };
    const MONTHS: [&str; 12] = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    let fmt = |iso: &str| -> String {
        let parts: Vec<&str> = iso.split('-').collect();
        if parts.len() != 3 {
            return iso.to_string();
        }
        let month = parts[1].parse::<usize>().unwrap_or(1).saturating_sub(1);
        format!(
            "{} {}, {}",
            MONTHS.get(month).copied().unwrap_or("Jan"),
            parts[2].parse::<u64>().unwrap_or(0),
            parts[0]
        )
    };
    if start == end {
        fmt(start)
    } else {
        format!("{} – {}", fmt(start), fmt(end))
    }
}

pub fn render_streak(stats: &Value, options: &Value) -> String {
    let t = theme(options);
    let hide_border = bool_opt(options, "hide_border");
    let streak = stats.get("streak");
    let total = stats
        .get("yearContributions")
        .or_else(|| streak.and_then(|s| s.get("total")))
        .map(|v| u_of(Some(v)))
        .unwrap_or(0);
    let name = escape(
        &stats
            .get("name")
            .or_else(|| stats.get("login"))
            .and_then(Value::as_str)
            .unwrap_or("GitHub"),
    );
    let width = 495.0;
    let height = 195.0;
    let current = streak
        .and_then(|s| s.get("currentStreak"))
        .map(|v| u_of(Some(v)))
        .unwrap_or(0);
    let longest = streak
        .and_then(|s| s.get("longestStreak"))
        .map(|v| u_of(Some(v)))
        .unwrap_or(0);

    let cols: Vec<(String, String, String, &str, bool)> = vec![
        (
            "Total Contributions".to_string(),
            count_separated(total),
            "Last 12 months".to_string(),
            t.muted,
            false,
        ),
        (
            "Current Streak".to_string(),
            current.to_string(),
            format_range(
                streak.and_then(|s| s.get("currentStart")),
                streak.and_then(|s| s.get("currentEnd")),
            ),
            t.title,
            true,
        ),
        (
            "Longest Streak".to_string(),
            longest.to_string(),
            format_range(
                streak.and_then(|s| s.get("longestStart")),
                streak.and_then(|s| s.get("longestEnd")),
            ),
            t.icon,
            false,
        ),
    ];

    let col_w = width / 3.0;
    let mut body = String::new();
    for (i, (label, value, sub, accent, ring)) in cols.iter().enumerate() {
        let cx = col_w * i as f64 + col_w / 2.0;
        if *ring {
            body.push_str(&format!(
                "\n        <circle cx=\"{}\" cy=\"88\" r=\"38\" fill=\"none\" stroke=\"{}\" stroke-width=\"4\"/>\n        <circle cx=\"{}\" cy=\"88\" r=\"38\" fill=\"none\" stroke=\"{}\" stroke-width=\"4\"\n          stroke-dasharray=\"180 239\" stroke-linecap=\"round\" transform=\"rotate(-90 {} 88)\"/>\n      ",
                cx, t.border, cx, t.ring, cx
            ));
        }
        body.push_str(&format!(
            "\n      <text x=\"{}\" y=\"{}\" text-anchor=\"middle\" class=\"label\" fill=\"{}\">{}</text>\n      <text x=\"{}\" y=\"{}\" text-anchor=\"middle\" class=\"value\" fill=\"{}\">{}</text>\n      <text x=\"{}\" y=\"{}\" text-anchor=\"middle\" class=\"sub\" fill=\"{}\">{}</text>\n    ",
            cx,
            if *ring { 42 } else { 58 },
            accent,
            escape(label),
            cx,
            if *ring { 96 } else { 100 },
            t.text,
            escape(value),
            cx,
            if *ring { 168 } else { 128 },
            t.muted,
            escape(sub)
        ));
        if i < 2 {
            body.push_str(&format!(
                "<line x1=\"{}\" y1=\"40\" x2=\"{}\" y2=\"{}\" stroke=\"{}\"/>",
                col_w * (i + 1) as f64,
                col_w * (i + 1) as f64,
                height - 24.0,
                t.border
            ));
        }
    }

    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{}\" height=\"{}\" viewBox=\"0 0 {} {}\" role=\"img\" aria-label=\"{}'s contribution streak\">\n  <title>{}'s GitHub Streak</title>\n  <style>\n    .title {{ font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif; }}\n    .label {{ font: 600 12px 'Segoe UI', Ubuntu, Sans-Serif; }}\n    .value {{ font: 800 28px 'Segoe UI', Ubuntu, Sans-Serif; }}\n    .sub {{ font: 400 11px 'Segoe UI', Ubuntu, Sans-Serif; }}\n  </style>\n  <rect x=\"0.5\" y=\"0.5\" width=\"{}\" height=\"{}\" rx=\"8\" fill=\"{}\" stroke=\"{}\"/>\n  <text x=\"24\" y=\"28\" class=\"title\" fill=\"{}\">{}'s Streak</text>\n  {}\n</svg>",
        width,
        height,
        width,
        height,
        name,
        name,
        width - 1.0,
        height - 1.0,
        t.bg,
        if hide_border { "none" } else { t.border },
        t.title,
        name,
        body
    )
}

fn weekday_of(iso: &str) -> u32 {
    NaiveDate::parse_from_str(iso, "%Y-%m-%d")
        .map(|d| d.weekday().num_days_from_sunday())
        .unwrap_or(0)
}

fn level_colors(options: &Value) -> [&'static str; 5] {
    match str_opt(options, "theme") {
        "light" => ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
        "tokyonight" => ["#1a1b27", "#283655", "#3d59a1", "#7aa2f7", "#bb9af7"],
        "radical" => ["#141321", "#4a1942", "#9b1d6a", "#fe428e", "#f8d847"],
        "professional" => ["#1e2633", "#3d4a3a", "#6b8f71", "#c4a574", "#e8d5a3"],
        _ => ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
    }
}

pub fn render_graph(stats: &Value, options: &Value) -> String {
    let t = theme(options);
    let hide_border = bool_opt(options, "hide_border");
    let palette = level_colors(options);
    let name = escape(
        &stats
            .get("name")
            .or_else(|| stats.get("login"))
            .and_then(Value::as_str)
            .unwrap_or("GitHub"),
    );
    let mut days = stats
        .get("calendar")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    days.sort_by(|a, b| {
        s_of(a.get("date")).cmp(&s_of(b.get("date")))
    });
    let total = u_of(stats.get("yearContributions"));

    if days.is_empty() {
        return format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"495\" height=\"140\" viewBox=\"0 0 495 140\" role=\"img\">\n  <title>{}'s Contribution Graph</title>\n  <rect x=\"0.5\" y=\"0.5\" width=\"494\" height=\"139\" rx=\"8\" fill=\"{}\" stroke=\"{}\"/>\n  <text x=\"24\" y=\"40\" fill=\"{}\" font-family=\"Segoe UI, Ubuntu, sans-serif\" font-size=\"16\" font-weight=\"600\">{}'s Contributions</text>\n  <text x=\"24\" y=\"78\" fill=\"{}\" font-family=\"Segoe UI, Ubuntu, sans-serif\" font-size=\"13\">Contribution calendar is unavailable for this profile right now.</text>\n</svg>",
            name,
            t.bg,
            if hide_border { "none" } else { t.border },
            t.title,
            name,
            t.muted
        );
    }

    let cell = 11.0;
    let gap = 3.0;
    let left = 36.0;
    let top = 52.0;
    let weeks = 53usize;
    let width = left + weeks as f64 * (cell + gap) + 16.0;
    let height = top + 7.0 * (cell + gap) + 28.0;

    let mut columns: Vec<Vec<&Value>> = Vec::new();
    let mut col: Vec<&Value> = Vec::new();
    for day in &days {
        let wd = weekday_of(&s_of(day.get("date")));
        if wd == 0 && !col.is_empty() {
            columns.push(std::mem::take(&mut col));
        }
        col.push(day);
    }
    if !col.is_empty() {
        columns.push(col);
    }
    let start = columns.len().saturating_sub(weeks);
    let shown = &columns[start..];

    let mut cells = String::new();
    for (wi, week) in shown.iter().enumerate() {
        for day in week {
            let date = s_of(day.get("date"));
            let row = weekday_of(&date);
            let level = u_of(day.get("level")).clamp(0, 4) as usize;
            let x = left + wi as f64 * (cell + gap);
            let y = top + row as f64 * (cell + gap);
            let count = day
                .get("count")
                .map(|v| s_of(Some(v)))
                .unwrap_or_else(|| level.to_string());
            cells.push_str(&format!(
                "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" rx=\"2\" fill=\"{}\">\n        <title>{}: {} contributions</title>\n      </rect>",
                x, y, cell, cell, palette[level], escape(&date), count
            ));
        }
    }

    let labels: String = ["Sun", "", "Tue", "", "Thu", "", "Sat"]
        .iter()
        .enumerate()
        .filter_map(|(i, lab)| {
            if lab.is_empty() {
                None
            } else {
                Some(format!(
                    "<text x=\"8\" y=\"{}\" class=\"dow\" fill=\"{}\">{}</text>",
                    top + i as f64 * (cell + gap) + 9.0,
                    t.muted,
                    lab
                ))
            }
        })
        .collect();

    let legend: String = (0..5)
        .map(|i| {
            let x = width - 16.0 - (5 - i) as f64 * (cell + 3.0);
            format!(
                "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" rx=\"2\" fill=\"{}\"/>",
                x,
                height - 20.0,
                cell,
                cell,
                palette[i]
            )
        })
        .collect();

    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{}\" height=\"{}\" viewBox=\"0 0 {} {}\" role=\"img\" aria-label=\"{}'s contribution graph\">\n  <title>{}'s Contribution Graph</title>\n  <style>\n    .title {{ font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif; }}\n    .meta {{ font: 400 12px 'Segoe UI', Ubuntu, Sans-Serif; }}\n    .dow {{ font: 400 9px 'Segoe UI', Ubuntu, Sans-Serif; }}\n  </style>\n  <rect x=\"0.5\" y=\"0.5\" width=\"{}\" height=\"{}\" rx=\"8\" fill=\"{}\" stroke=\"{}\"/>\n  <text x=\"16\" y=\"28\" class=\"title\" fill=\"{}\">{}'s Contributions</text>\n  <text x=\"{}\" y=\"28\" text-anchor=\"end\" class=\"meta\" fill=\"{}\">{} in the last year</text>\n  {}\n  {}\n  <text x=\"{}\" y=\"{}\" class=\"dow\" fill=\"{}\">Less</text>\n  {}\n  <text x=\"{}\" y=\"{}\" text-anchor=\"end\" class=\"dow\" fill=\"{}\">More</text>\n</svg>",
        width,
        height,
        width,
        height,
        name,
        name,
        width - 1.0,
        height - 1.0,
        t.bg,
        if hide_border { "none" } else { t.border },
        t.title,
        name,
        width - 16.0,
        t.muted,
        total,
        labels,
        cells,
        width - 16.0 - 5.0 * (cell + 3.0) - 28.0,
        height - 11.0,
        t.muted,
        legend,
        width - 12.0,
        height - 11.0,
        t.muted
    )
}

#[derive(Clone, Copy)]
struct Point {
    x: f64,
    y: f64,
}

fn smooth_path(points: &[Point]) -> String {
    if points.is_empty() {
        return String::new();
    }
    if points.len() == 1 {
        return format!("M {} {}", points[0].x, points[0].y);
    }
    let mut d = format!("M {} {}", points[0].x, points[0].y);
    for i in 0..points.len() - 1 {
        let p0 = points.get(i.wrapping_sub(1)).unwrap_or(&points[i]);
        let p1 = &points[i];
        let p2 = &points[i + 1];
        let p3 = points.get(i + 2).unwrap_or(p2);
        let cp1x = p1.x + (p2.x - p0.x) / 6.0;
        let cp1y = p1.y + (p2.y - p0.y) / 6.0;
        let cp2x = p2.x - (p3.x - p1.x) / 6.0;
        let cp2y = p2.y - (p3.y - p1.y) / 6.0;
        d.push_str(&format!(
            " C {} {}, {} {}, {} {}",
            cp1x, cp1y, cp2x, cp2y, p2.x, p2.y
        ));
    }
    d
}

pub fn render_activity(stats: &Value, options: &Value) -> String {
    let t = fallback_theme(options);
    let hide_border = bool_opt(options, "hide_border");
    let name = escape(
        &stats
            .get("name")
            .or_else(|| stats.get("login"))
            .and_then(Value::as_str)
            .unwrap_or("GitHub"),
    );
    let series = stats
        .get("viz")
        .and_then(|v| v.get("activity"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let width = 840.0;
    let height = 280.0;
    let pad_l = 48.0;
    let pad_r = 28.0;
    let pad_t = 56.0;
    let pad_b = 42.0;
    let chart_w = width - pad_l - pad_r;
    let chart_h = height - pad_t - pad_b;

    if series.is_empty() {
        return format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{}\" height=\"140\" viewBox=\"0 0 {} 140\" role=\"img\">\n  <title>{}'s Activity</title>\n  <rect x=\"0.5\" y=\"0.5\" width=\"{}\" height=\"139\" rx=\"8\" fill=\"{}\" stroke=\"{}\"/>\n  <text x=\"28\" y=\"40\" fill=\"{}\" font-family=\"Segoe UI, Ubuntu, sans-serif\" font-size=\"16\" font-weight=\"600\">{}'s Activity</text>\n  <text x=\"28\" y=\"80\" fill=\"{}\" font-family=\"Segoe UI, Ubuntu, sans-serif\" font-size=\"13\">Contribution activity is unavailable for this profile right now.</text>\n</svg>",
            width,
            width,
            name,
            width - 1.0,
            t.bg,
            if hide_border { "none" } else { t.border },
            t.title,
            name,
            t.muted
        );
    }

    let max = series.iter().map(|p| u_of(p.get("count"))).max().unwrap_or(0).max(1) as f64;
    let points: Vec<Point> = series
        .iter()
        .enumerate()
        .map(|(i, p)| {
            let x = pad_l
                + if series.len() == 1 {
                    chart_w / 2.0
                } else {
                    i as f64 / (series.len() - 1) as f64 * chart_w
                };
            let y = pad_t + chart_h - (n_of(p.get("count")) / max) * chart_h;
            Point { x, y }
        })
        .collect();
    let line = smooth_path(&points);
    let area = format!(
        "{} L {} {} L {} {} Z",
        line,
        points.last().map(|p| p.x).unwrap_or(0.0),
        pad_t + chart_h,
        points.first().map(|p| p.x).unwrap_or(0.0),
        pad_t + chart_h
    );

    let mut grid = String::new();
    for i in 0..=3 {
        let y = pad_t + chart_h * i as f64 / 3.0;
        let val = (max * (1.0 - i as f64 / 3.0)).round() as u64;
        grid.push_str(&format!(
            "<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" stroke=\"{}\" stroke-opacity=\"0.55\"/>",
            pad_l, y, width - pad_r, y, t.border
        ));
        grid.push_str(&format!(
            "<text x=\"{}\" y=\"{}\" text-anchor=\"end\" class=\"axis\" fill=\"{}\">{}</text>",
            pad_l - 8.0,
            y + 4.0,
            t.muted,
            val
        ));
    }

    let len = series.len();
    let mut indices = vec![0, (len - 1) / 2, len - 1];
    indices.dedup();
    let mut x_labels = String::new();
    for i in indices {
        if let Some(p) = points.get(i) {
            let label = series[i]
                .get("start")
                .map(|v| s_of(Some(v)))
                .unwrap_or_default();
            let label = label.chars().take(7).collect::<String>();
            x_labels.push_str(&format!(
                "<text x=\"{}\" y=\"{}\" text-anchor=\"middle\" class=\"axis\" fill=\"{}\">{}</text>",
                p.x,
                height - 16.0,
                t.muted,
                escape(&label)
            ));
        }
    }

    let total: u64 = series.iter().map(|p| u_of(p.get("count"))).sum();
    let peak = series.iter().map(|p| u_of(p.get("count"))).max().unwrap_or(0);
    let consistency = stats
        .get("viz")
        .and_then(|v| v.get("consistency"))
        .and_then(|c| c.get("activePct"))
        .map(|v| format!(" · {}% active days", s_of(Some(v))))
        .unwrap_or_default();

    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{}\" height=\"{}\" viewBox=\"0 0 {} {}\" role=\"img\" aria-label=\"{}'s contribution activity\">\n  <title>{}'s GitHub Activity</title>\n  <defs>\n    <linearGradient id=\"cw-activity-fill\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">\n      <stop offset=\"0%\" stop-color=\"{}\" stop-opacity=\"0.35\"/>\n      <stop offset=\"100%\" stop-color=\"{}\" stop-opacity=\"0.02\"/>\n    </linearGradient>\n  </defs>\n  <style>\n    .title {{ font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif; }}\n    .meta {{ font: 500 12px 'Segoe UI', Ubuntu, Sans-Serif; }}\n    .axis {{ font: 400 11px 'Segoe UI', Ubuntu, Sans-Serif; }}\n  </style>\n  <rect x=\"0.5\" y=\"0.5\" width=\"{}\" height=\"{}\" rx=\"8\" fill=\"{}\" stroke=\"{}\"/>\n  <text x=\"28\" y=\"28\" class=\"title\" fill=\"{}\">{}'s Activity</text>\n  <text x=\"{}\" y=\"28\" text-anchor=\"end\" class=\"meta\" fill=\"{}\">{} contribs · peak {}/wk{}</text>\n  {}\n  <path d=\"{}\" fill=\"url(#cw-activity-fill)\"/>\n  <path d=\"{}\" fill=\"none\" stroke=\"{}\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n  {}\n</svg>",
        width,
        height,
        width,
        height,
        name,
        name,
        t.ring,
        t.ring,
        width - 1.0,
        height - 1.0,
        t.bg,
        if hide_border { "none" } else { t.border },
        t.title,
        name,
        width - 28.0,
        t.muted,
        count_separated(total),
        count_separated(peak),
        consistency,
        grid,
        area,
        line,
        t.ring,
        x_labels
    )
}

pub fn render_milestones(stats: &Value, options: &Value) -> String {
    let t = fallback_theme(options);
    let hide_border = bool_opt(options, "hide_border");
    let name = escape(
        &stats
            .get("name")
            .or_else(|| stats.get("login"))
            .and_then(Value::as_str)
            .unwrap_or("GitHub"),
    );
    let items = stats
        .get("milestones")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let items: Vec<Value> = items.into_iter().take(6).collect();
    let width = 495.0;
    let height = if items.is_empty() {
        100.0
    } else {
        56.0 + ((items.len() + 1) / 2) as f64 * 28.0
    };

    if items.is_empty() {
        return format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{}\" height=\"100\" viewBox=\"0 0 {} 100\" role=\"img\">\n  <title>{} — thresholds</title>\n  <rect x=\"0.5\" y=\"0.5\" width=\"{}\" height=\"99\" rx=\"6\" fill=\"{}\" stroke=\"{}\"/>\n  <text x=\"24\" y=\"34\" fill=\"{}\" font-family=\"Segoe UI, Ubuntu, sans-serif\" font-size=\"15\" font-weight=\"600\">Public activity thresholds</text>\n  <text x=\"24\" y=\"62\" fill=\"{}\" font-family=\"Segoe UI, Ubuntu, sans-serif\" font-size=\"12\">No qualifying thresholds for this profile yet.</text>\n</svg>",
            width,
            width,
            name,
            width - 1.0,
            t.bg,
            if hide_border { "none" } else { t.border },
            t.title,
            t.muted
        );
    }

    let mut body = String::new();
    for (i, item) in items.iter().enumerate() {
        let col = (i % 2) as f64;
        let row = (i / 2) as f64;
        let x = 24.0 + col * 230.0;
        let y = 52.0 + row * 28.0;
        body.push_str(&format!(
            "<text x=\"{}\" y=\"{}\" fill=\"{}\" font-family=\"Segoe UI, Ubuntu, sans-serif\" font-size=\"12\" font-weight=\"500\">{}</text>",
            x,
            y,
            t.text,
            escape(&s_of(item.get("label")))
        ));
    }

    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{}\" height=\"{}\" viewBox=\"0 0 {} {}\" role=\"img\" aria-label=\"{} activity thresholds\">\n  <title>{} — activity thresholds</title>\n  <rect x=\"0.5\" y=\"0.5\" width=\"{}\" height=\"{}\" rx=\"6\" fill=\"{}\" stroke=\"{}\"/>\n  <text x=\"24\" y=\"30\" fill=\"{}\" font-family=\"Segoe UI, Ubuntu, sans-serif\" font-size=\"15\" font-weight=\"600\">Activity thresholds</text>\n  {}\n</svg>",
        width,
        height,
        width,
        height,
        name,
        name,
        width - 1.0,
        height - 1.0,
        t.bg,
        if hide_border { "none" } else { t.border },
        t.title,
        body
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample_stats() -> Value {
        json!({
            "name": "Anthony",
            "login": "developer-az",
            "totalStars": 32,
            "totalCommits": 1100,
            "totalPRs": 148,
            "mergedPRs": 133,
            "totalIssues": 51,
            "closedIssues": 45,
            "totalReviews": 36,
            "contributedTo": 3,
            "rank": { "level": "A", "score": 80 },
            "topLanguages": [
                { "name": "Python", "color": "#3572A5", "percent": 62.2 },
                { "name": "TypeScript", "color": "#3178c6", "percent": 24.2 }
            ],
            "calendar": [
                { "date": "2026-01-05", "count": 3, "level": 2 }
            ],
            "yearContributions": 42,
            "streak": { "currentStreak": 4, "longestStreak": 9, "currentStart": "2026-01-02", "currentEnd": "2026-01-05" },
            "viz": { "activity": [{ "start": "2026-01-05", "count": 3 }] },
            "milestones": [{ "id": "commits-1k", "label": "1K commits" }]
        })
    }

    #[test]
    fn stats_card_renders_title_and_values() {
        let svg = render_stats(&sample_stats(), &json!({ "theme": "professional" }));
        assert!(svg.contains("Anthony&#39;s GitHub Stats") || svg.contains("Anthony's GitHub Stats"));
        assert!(svg.contains("1.1k"));
        assert!(svg.contains("Rank"));
        assert!(svg.contains("width=\"460\""));
    }

    #[test]
    fn stats_card_can_hide_rank() {
        let svg = render_stats(&sample_stats(), &json!({ "hide_rank": "true" }));
        assert!(svg.contains("width=\"380\""));
        assert!(!svg.contains(">Rank<"));
    }

    #[test]
    fn languages_card_compact_has_labels() {
        let svg = render_languages(&sample_stats(), &json!({ "layout": "compact" }));
        assert!(svg.contains("Python"));
        assert!(svg.contains("62.2%"));
    }

    #[test]
    fn graph_card_handles_missing_calendar() {
        let svg = render_graph(&json!({ "name": "Ada" }), &json!({}));
        assert!(svg.contains("unavailable"));
    }

    #[test]
    fn activity_card_renders_chart() {
        let svg = render_activity(&sample_stats(), &json!({}));
        assert!(svg.contains("Anthony&#39;s Activity") || svg.contains("Anthony's Activity"));
        assert!(svg.contains("<path"));
    }

    #[test]
    fn milestones_card_lists_earned_badges() {
        let svg = render_milestones(&sample_stats(), &json!({}));
        assert!(svg.contains("1K commits"));
    }
}
