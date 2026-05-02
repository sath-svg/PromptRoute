mod router;

use router::{RouteDecision, Router};
use std::sync::Arc;
use parking_lot::RwLock;
use tauri::Manager;

struct AppState {
    router: Arc<RwLock<Router>>,
}

#[tauri::command]
fn router_version(state: tauri::State<AppState>) -> String {
    state.router.read().version_string()
}

#[tauri::command]
fn route_prompt(state: tauri::State<AppState>, prompt: String) -> RouteDecision {
    state.router.read().route(&prompt)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let resource_dir = app.path().resource_dir()?;
            let bundled = resource_dir.join("resources/models/router.pk1");
            let app_data = app
                .path()
                .app_data_dir()?
                .join("models")
                .join("router.pk1");

            let router = Router::load(&bundled, &app_data)
                .unwrap_or_else(|e| {
                    eprintln!("router load failed: {e}; using fallback");
                    Router::fallback()
                });

            app.manage(AppState {
                router: Arc::new(RwLock::new(router)),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![router_version, route_prompt])
        .run(tauri::generate_context!())
        .expect("tauri run");
}
