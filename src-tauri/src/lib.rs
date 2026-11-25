mod cache;
mod cards;
mod commands;
mod github;
mod signals;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::api_json,
            commands::api_svg,
            commands::public_base_url,
            commands::open_external,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Commit Warrior");
}
