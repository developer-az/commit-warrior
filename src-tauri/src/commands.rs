use crate::{cards, github, toggle_widget_window};
use chrono::Utc;
use serde_json::{json, Value};
use tauri::Manager;

#[tauri::command]
pub async fn api_json(username: String) -> Result<Value, String> {
    let stats = github::fetch_user_stats(&username).await?;
    let has_calendar = stats
        .get("calendar")
        .and_then(Value::as_array)
        .map(|days| !days.is_empty())
        .unwrap_or(false);
    let mut result = stats;
    if let Value::Object(map) = &mut result {
        map.insert(
            "servedAt".to_string(),
            json!(Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()),
        );
        map.insert("hasCalendar".to_string(), json!(has_calendar));
    }
    Ok(result)
}

#[tauri::command]
pub async fn api_svg(
    kind: String,
    username: String,
    options: Option<Value>,
) -> Result<String, String> {
    let stats = github::fetch_user_stats(&username).await?;
    let options = options.unwrap_or_else(|| json!({}));
    let svg = match kind.as_str() {
        "stats" => cards::render_stats(&stats, &options),
        "langs" | "top-langs" => cards::render_languages(&stats, &options),
        "streak" => cards::render_streak(&stats, &options),
        "graph" => cards::render_graph(&stats, &options),
        "activity" => cards::render_activity(&stats, &options),
        "milestones" => cards::render_milestones(&stats, &options),
        other => return Err(format!("Unknown card type: {}", other)),
    };
    Ok(svg)
}

#[tauri::command]
pub fn public_base_url() -> String {
    std::env::var("PUBLIC_BASE_URL")
        .unwrap_or_else(|_| "https://commit-warrior.vercel.app".to_string())
}

#[tauri::command]
pub fn toggle_widget(app: tauri::AppHandle) -> Result<(), String> {
    toggle_widget_window(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn close_widget(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("widget") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("Only http(s) links are allowed".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
