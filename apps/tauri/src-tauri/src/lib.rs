use futures_util::StreamExt;
use serde_json::Value;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, WebviewBuilder, WebviewUrl};

#[derive(Clone, serde::Deserialize)]
struct BrowserRect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Clone)]
struct AppState {
    runtime_url: String,
    token: Option<String>,
    browser_url: Arc<Mutex<String>>,
}

/// Forward one JSON-RPC call to the local Natalia runtime.
///
/// The frontend sees this as Tauri IPC. The actual runtime is still the same
/// TypeScript/Bun runtime used by the web shell; this command proxies plain HTTP
/// RPC and lets the desktop screen replace Remote HTTP/SSE with local IPC.
#[tauri::command]
async fn runtime_call(
    state: tauri::State<'_, AppState>,
    method: String,
    params: Value,
) -> Result<Value, String> {
    eprintln!("[natalia-desktop] runtime_call method={method}");
    let base = state.runtime_url.trim_end_matches('/');
    let client = reqwest::Client::new();
    let request = client
        .post(format!("{base}/rpc"))
        .json(&serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        }));
    let request = if let Some(token) = &state.token {
        request.bearer_auth(token)
    } else {
        request
    };

    let response = request
        .send()
        .await
        .map_err(|error| format!("runtime RPC request failed: {error}"))?;
    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|error| format!("runtime RPC response was not JSON: {error}"))?;

    if !status.is_success() {
        let message = body
            .get("error")
            .and_then(|error| error.get("message"))
            .and_then(Value::as_str)
            .unwrap_or("runtime RPC returned an error status");
        return Err(message.to_string());
    }

    if let Some(error) = body.get("error") {
        let message = error
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("runtime RPC failed");
        return Err(message.to_string());
    }

    Ok(body.get("result").cloned().unwrap_or(Value::Null))
}

#[tauri::command]
async fn terminal_output_subscribe(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    session_id: String,
    terminal_id: String,
) -> Result<(), String> {
    let base = state.runtime_url.trim_end_matches('/');
    let ws_base = if base.starts_with("https://") {
        base.replacen("https://", "wss://", 1)
    } else if base.starts_with("http://") {
        base.replacen("http://", "ws://", 1)
    } else {
        format!("ws://{base}")
    };
    let mut url = format!("{ws_base}/terminal/{session_id}/{terminal_id}");
    if let Some(token) = &state.token {
        url.push_str(&format!("?token={token}"));
    }

    eprintln!("[natalia-desktop] terminal_output_subscribe connecting {url}");
    let (mut socket, _) = tokio_tungstenite::connect_async(&url)
        .await
        .map_err(|error| format!("terminal WebSocket connect failed: {error}"))?;
    eprintln!("[natalia-desktop] terminal_output_subscribe connected");

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        use tokio_tungstenite::tungstenite::Message;

        while let Some(message) = socket.next().await {
            let message = match message {
                Ok(message) => message,
                Err(error) => {
                    eprintln!("[natalia-desktop] terminal stream ended: {error}");
                    break;
                }
            };
            let text = match message {
                Message::Text(text) => text,
                Message::Binary(bytes) => String::from_utf8_lossy(&bytes).to_string(),
                _ => continue,
            };
            eprintln!("[natalia-desktop] terminal ws message bytes={}", text.len());
            if let Ok(value) = serde_json::from_str::<Value>(&text) {
                let _ = app.emit(
                    "natalia-terminal-output",
                    serde_json::json!({
                        "id": terminal_id,
                        "message": value,
                    }),
                );
            }
        }
    });

    Ok(())
}

fn current_browser_url(state: &AppState) -> String {
    state.browser_url.lock().unwrap().clone()
}

fn set_browser_url(state: &AppState, url: String) {
    *state.browser_url.lock().unwrap() = url;
}

fn get_browser_webview(app: &tauri::AppHandle) -> Option<tauri::Webview> {
    app.get_webview("browser-webview")
}

fn create_browser_webview(
    app: &tauri::AppHandle,
    url: String,
) -> Result<tauri::Webview, String> {
    let parsed = url
        .parse::<tauri::Url>()
        .map_err(|error| format!("invalid browser URL: {error}"))?;
    let window = app
        .get_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    eprintln!("[natalia-desktop] create embedded browser webview {url}");
    let builder = WebviewBuilder::new("browser-webview", WebviewUrl::External(parsed));
    window
        .add_child(
            builder,
            tauri::LogicalPosition::new(0.0, 0.0),
            tauri::LogicalSize::new(1.0, 1.0),
        )
        .map_err(|error| format!("failed to create browser webview: {error}"))
}

#[tauri::command]
fn browser_show(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    rect: BrowserRect,
) -> Result<(), String> {
    let url = current_browser_url(&state);
    let webview = match get_browser_webview(&app) {
        Some(webview) => webview,
        None => create_browser_webview(&app, url)?,
    };
    eprintln!(
        "[natalia-desktop] browser_show rect=({},{},{},{})",
        rect.x, rect.y, rect.width, rect.height
    );
    webview
        .set_position(tauri::LogicalPosition::new(rect.x, rect.y))
        .map_err(|error| format!("browser position failed: {error}"))?;
    webview
        .set_size(tauri::LogicalSize::new(rect.width, rect.height))
        .map_err(|error| format!("browser size failed: {error}"))?;
    webview
        .show()
        .map_err(|error| format!("browser show failed: {error}"))
}

#[tauri::command]
fn browser_move(
    app: tauri::AppHandle,
    rect: BrowserRect,
) -> Result<(), String> {
    let webview = get_browser_webview(&app)
        .ok_or_else(|| "browser webview is not open".to_string())?;
    eprintln!(
        "[natalia-desktop] browser_move rect=({},{},{},{})",
        rect.x, rect.y, rect.width, rect.height
    );
    webview
        .set_position(tauri::LogicalPosition::new(rect.x, rect.y))
        .map_err(|error| format!("browser position failed: {error}"))?;
    webview
        .set_size(tauri::LogicalSize::new(rect.width, rect.height))
        .map_err(|error| format!("browser size failed: {error}"))
}

#[tauri::command]
fn browser_hide(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(webview) = get_browser_webview(&app) {
        webview
            .hide()
            .map_err(|error| format!("browser hide failed: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
fn browser_navigate(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    url: String,
) -> Result<(), String> {
    set_browser_url(&state, url.clone());
    let parsed = url
        .parse::<tauri::Url>()
        .map_err(|error| format!("invalid browser URL: {error}"))?;
    if let Some(webview) = get_browser_webview(&app) {
        webview
            .navigate(parsed)
            .map_err(|error| format!("browser navigate failed: {error}"))
    } else {
        let _ = create_browser_webview(&app, url)?;
        Ok(())
    }
}

fn eval_browser_js(webview: &tauri::Webview, js: String) -> Result<String, String> {
    let (tx, rx) = std::sync::mpsc::channel::<String>();
    webview
        .eval_with_callback(js, move |result| {
            let _ = tx.send(result);
        })
        .map_err(|error| format!("browser eval failed: {error}"))?;
    rx.recv_timeout(std::time::Duration::from_secs(5))
        .map_err(|_| "browser eval timed out".to_string())
}

#[tauri::command]
fn browser_read_dom(app: tauri::AppHandle) -> Result<String, String> {
    let webview = get_browser_webview(&app)
        .ok_or_else(|| "browser webview is not open".to_string())?;
    eprintln!("[natalia-desktop] browser_read_dom");
    eval_browser_js(
        &webview,
        "JSON.stringify(document.documentElement.outerHTML)".to_string(),
    )
}

#[tauri::command]
fn browser_click(app: tauri::AppHandle, x: f64, y: f64) -> Result<String, String> {
    let webview = get_browser_webview(&app)
        .ok_or_else(|| "browser webview is not open".to_string())?;
    eprintln!("[natalia-desktop] browser_click ({x},{y})");
    let js = format!(
        "JSON.stringify((()=>{{const e=document.elementFromPoint({x},{y}); if(e){{e.click(); return 'ok';}} return 'no_element';}})())"
    );
    eval_browser_js(&webview, js)
}

#[tauri::command]
fn browser_input(app: tauri::AppHandle, text: String) -> Result<String, String> {
    let webview = get_browser_webview(&app)
        .ok_or_else(|| "browser webview is not open".to_string())?;
    eprintln!("[natalia-desktop] browser_input text_len={}", text.len());
    let payload = serde_json::to_string(&text).unwrap_or_else(|_| "\"\"".to_string());
    let js = format!(
        "JSON.stringify((()=>{{const el=document.activeElement; if(!el)return 'no_active'; if(el.value!==undefined)el.value={payload}; el.dispatchEvent(new Event('input',{{bubbles:true}})); return 'ok';}})())"
    );
    eval_browser_js(&webview, js)
}

#[tauri::command]
fn browser_screenshot(app: tauri::AppHandle) -> Result<String, String> {
    let _webview = get_browser_webview(&app)
        .ok_or_else(|| "browser webview is not open".to_string())?;
    // The remote WebView cannot be read back through the Tauri webview API
    // directly. This command is a placeholder for platform screenshot work.
    eprintln!("[natalia-desktop] browser_screenshot requested");
    Err("browser_screenshot is not implemented yet in the Tauri host".to_string())
}

fn handle_browser_bridge_route(
    app: &tauri::AppHandle,
    method: &str,
    path: &str,
    body: &str,
) -> Result<String, String> {
    let state = app.state::<AppState>();
    if method == "POST" && path == "/browser/navigate" {
        let value: Value = serde_json::from_str(body)
            .map_err(|error| format!("invalid navigate body: {error}"))?;
        let url = value
            .get("url")
            .and_then(Value::as_str)
            .ok_or_else(|| "navigate body must contain a string url".to_string())?;
        browser_navigate(app.clone(), state, url.to_string())?;
        return Ok(serde_json::json!({ "ok": true }).to_string());
    }
    if method == "POST" && path == "/browser/read" {
        let text = browser_read_dom(app.clone())?;
        return Ok(serde_json::json!({ "text": text }).to_string());
    }
    if method == "POST" && path == "/browser/click" {
        let value: Value = serde_json::from_str(body)
            .map_err(|error| format!("invalid click body: {error}"))?;
        let x = value
            .get("x")
            .and_then(Value::as_f64)
            .ok_or_else(|| "click body must contain numeric x".to_string())?;
        let y = value
            .get("y")
            .and_then(Value::as_f64)
            .ok_or_else(|| "click body must contain numeric y".to_string())?;
        let result = browser_click(app.clone(), x, y)?;
        return Ok(serde_json::json!({ "result": result }).to_string());
    }
    if method == "POST" && path == "/browser/input" {
        let value: Value = serde_json::from_str(body)
            .map_err(|error| format!("invalid input body: {error}"))?;
        let text = value
            .get("text")
            .and_then(Value::as_str)
            .ok_or_else(|| "input body must contain string text".to_string())?;
        let result = browser_input(app.clone(), text.to_string())?;
        return Ok(serde_json::json!({ "result": result }).to_string());
    }
    Err(format!("unknown browser bridge route: {method} {path}"))
}

fn handle_browser_bridge_connection(mut stream: std::net::TcpStream, app: tauri::AppHandle) {
    let mut buffer = Vec::new();
    let mut chunk = [0u8; 4096];
    loop {
        let read = stream.read(&mut chunk).unwrap_or(0);
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..read]);
        if buffer.windows(4).any(|window| window == b"\r\n\r\n")
            || buffer.len() > 64 * 1024
        {
            break;
        }
    }

    let request = String::from_utf8_lossy(&buffer).to_string();
    let header_end = request.find("\r\n\r\n").unwrap_or(request.len());
    let head = &request[..header_end];
    let body = if header_end < request.len() {
        request[header_end + 4..].to_string()
    } else {
        String::new()
    };

    let mut lines = head.lines();
    let request_line = lines.next().unwrap_or("");
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("GET");
    let path = parts.next().unwrap_or("/");

    let (status, payload) = match handle_browser_bridge_route(&app, method, path, &body) {
        Ok(value) => ("200 OK", value),
        Err(error) => (
            "500 Internal Server Error",
            serde_json::json!({ "error": error }).to_string(),
        ),
    };

    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{payload}",
        payload.len()
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn start_browser_bridge(app: tauri::AppHandle) {
    let listener = match TcpListener::bind("127.0.0.1:8788") {
        Ok(listener) => listener,
        Err(error) => {
            eprintln!("[natalia-desktop] browser bridge bind failed: {error}");
            return;
        }
    };
    eprintln!("[natalia-desktop] browser bridge listening on http://127.0.0.1:8788");
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let app = app.clone();
                std::thread::spawn(move || {
                    handle_browser_bridge_connection(stream, app);
                });
            }
            Err(error) => eprintln!("[natalia-desktop] browser bridge accept error: {error}"),
        }
    }
}

/// Keep a long-lived /events SSE connection open and re-emit each runtime event
/// as a Tauri event so the desktop UI never needs to know about HTTP/SSE.
async fn stream_runtime_events(
    app: tauri::AppHandle,
    runtime_url: String,
    token: Option<String>,
) {
    let base = runtime_url.trim_end_matches('/');
    let client = reqwest::Client::new();
    let request = client.get(format!("{base}/events"));
    let request = if let Some(token) = token {
        request.bearer_auth(token)
    } else {
        request
    };

    let response = match request.send().await {
        Ok(response) => response,
        Err(error) => {
            eprintln!("[natalia-desktop] runtime event stream connect failed: {error}");
            return;
        }
    };

    if !response.status().is_success() {
        eprintln!(
            "[natalia-desktop] runtime event stream returned {}",
            response.status()
        );
        return;
    }

    eprintln!("[natalia-desktop] runtime event stream connected");
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut current: Option<String> = None;

    while let Some(chunk) = stream.next().await {
        let chunk = match chunk {
            Ok(chunk) => chunk,
            Err(error) => {
                eprintln!("[natalia-desktop] runtime event stream ended: {error}");
                break;
            }
        };
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim_end_matches('\r').to_string();
            buffer.drain(..=pos);
            if let Some(data) = line.strip_prefix("data: ") {
                current = Some(data.to_string());
            } else if line.is_empty() {
                if let Some(payload) = current.take() {
                    if let Ok(event) = serde_json::from_str::<Value>(&payload) {
                        let _ = app.emit("natalia-runtime-event", event);
                    }
                }
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let runtime_url = std::env::var("NATALIA_RUNTIME_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:8790".to_string());
    let token = std::env::var("NATALIA_TRANSPORT_TOKEN").ok();

    tauri::Builder::default()
        .manage(AppState {
            runtime_url: runtime_url.clone(),
            token,
            browser_url: Arc::new(Mutex::new("https://example.com".to_string())),
        })
        .invoke_handler(tauri::generate_handler![
            runtime_call,
            terminal_output_subscribe,
            browser_show,
            browser_move,
            browser_hide,
            browser_navigate,
            browser_read_dom,
            browser_click,
            browser_input,
            browser_screenshot
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            let state = app.state::<AppState>();
            let url = state.runtime_url.clone();
            let token = state.token.clone();
            tauri::async_runtime::spawn(async move {
                stream_runtime_events(handle, url, token).await;
            });
            let bridge_app = app.handle().clone();
            std::thread::spawn(move || start_browser_bridge(bridge_app));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Natalia Desktop");
}
