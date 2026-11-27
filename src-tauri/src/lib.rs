mod cache;
mod cards;
mod commands;
mod github;
mod signals;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

/// Show the floating mini window, or hide it when already visible.
pub fn toggle_widget_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("widget") {
        if window.is_visible()? {
            window.hide()?;
        } else {
            window.show()?;
            window.set_focus()?;
        }
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::api_json,
            commands::api_svg,
            commands::public_base_url,
            commands::open_external,
            commands::toggle_widget,
            commands::close_widget,
        ])
        .setup(|app| {
            let widget_item =
                MenuItem::with_id(app, "toggle-widget", "Toggle widget", true, None::<&str>)?;
            let main_item = MenuItem::with_id(
                app,
                "show-main",
                "Show Commit Warrior",
                true,
                None::<&str>,
            )?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&widget_item, &main_item, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("cw-tray")
                .tooltip("Commit Warrior")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle-widget" => {
                        let _ = toggle_widget_window(app);
                    }
                    "show-main" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        let _ = toggle_widget_window(app);
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Commit Warrior");
}
