mod auth;
mod router;

use auth::AuthSession;
use parking_lot::RwLock;
use router::{RouteDecision, Router};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

const DESKTOP_AUTH_URL: &str = "https://pmtpk.com/desktop-auth";
const DEEP_LINK_SCHEME: &str = "promptroute";

struct AppState {
    router: Arc<RwLock<Router>>,
}

#[derive(Default)]
struct AuthState {
    session: Mutex<Option<AuthSession>>,
}

#[tauri::command]
fn router_version(state: State<AppState>) -> String {
    state.router.read().version_string()
}

#[tauri::command]
fn route_prompt(state: State<AppState>, prompt: String) -> RouteDecision {
    state.router.read().route(&prompt)
}

#[tauri::command]
fn verify_auth_token(
    token: String,
    auth_state: State<'_, AuthState>,
) -> Result<AuthSession, String> {
    let claims = auth::verify_session_token(&token).map_err(|e| e.to_string())?;
    let session = AuthSession {
        user_id: claims.sub.clone(),
        email: claims.email.clone(),
        name: None,
        image_url: None,
        tier: "free".to_string(),
        session_token: token,
        expires_at: claims.exp,
    };

    let mut slot = auth_state
        .session
        .lock()
        .map_err(|_| "auth lock poisoned")?;
    *slot = Some(session.clone());
    Ok(session)
}

#[tauri::command]
fn get_auth_session(auth_state: State<'_, AuthState>) -> Result<Option<AuthSession>, String> {
    let slot = auth_state
        .session
        .lock()
        .map_err(|_| "auth lock poisoned")?;
    if let Some(s) = slot.as_ref() {
        let now = chrono::Utc::now().timestamp();
        if s.expires_at < now {
            return Ok(None);
        }
        return Ok(Some(s.clone()));
    }
    Ok(None)
}

#[tauri::command]
fn logout(auth_state: State<'_, AuthState>) -> Result<(), String> {
    let mut slot = auth_state
        .session
        .lock()
        .map_err(|_| "auth lock poisoned")?;
    *slot = None;
    Ok(())
}

#[tauri::command]
async fn open_auth_window(app_handle: AppHandle) -> Result<(), String> {
    use tauri_plugin_shell::ShellExt;
    let auth_url = format!("{}?source=desktop&app=promptroute", DESKTOP_AUTH_URL);
    app_handle
        .shell()
        .open(&auth_url, None)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .manage(AuthState::default())
        .setup(|app| {
            let resource_dir = app.path().resource_dir()?;
            let bundled = resource_dir.join("resources/models/router.pk1");
            let app_data = app
                .path()
                .app_data_dir()?
                .join("models")
                .join("router.pk1");

            let r = Router::load(&bundled, &app_data).unwrap_or_else(|e| {
                eprintln!("router load failed: {e}; using fallback");
                Router::fallback()
            });
            app.manage(AppState {
                router: Arc::new(RwLock::new(r)),
            });

            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        if url.scheme() == DEEP_LINK_SCHEME && url.host_str() == Some("auth") {
                            if let Some(query) = url.query() {
                                let auth_data = parse_auth_query(query);
                                let _ = handle.emit("auth-callback", auth_data);
                            }
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            router_version,
            route_prompt,
            verify_auth_token,
            get_auth_session,
            logout,
            open_auth_window,
        ])
        .run(tauri::generate_context!())
        .expect("tauri run");
}

fn parse_auth_query(query: &str) -> serde_json::Value {
    let decode = |v: &str| -> String {
        let with_spaces = v.replace('+', " ");
        urlencoding::decode(&with_spaces)
            .map(|s| s.into_owned())
            .unwrap_or(with_spaces)
    };

    let mut token: Option<String> = None;
    let mut name: Option<String> = None;
    let mut email: Option<String> = None;
    let mut image_url: Option<String> = None;
    let mut user_id: Option<String> = None;

    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            match k {
                "token" => token = Some(decode(v)),
                "name" => name = Some(decode(v)),
                "email" => email = Some(decode(v)),
                "image_url" => image_url = Some(decode(v)),
                "user_id" => user_id = Some(decode(v)),
                _ => {}
            }
        }
    }

    serde_json::json!({
        "token": token,
        "name": name,
        "email": email,
        "image_url": image_url,
        "user_id": user_id,
    })
}
