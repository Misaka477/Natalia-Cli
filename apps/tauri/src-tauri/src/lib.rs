use futures_util::StreamExt;
use serde_json::Value;
use tauri::{Emitter, Manager};

#[derive(Clone)]
struct AppState {
    runtime_url: String,
    token: Option<String>,
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

    let (mut socket, _) = tokio_tungstenite::connect_async(&url)
        .await
        .map_err(|error| format!("terminal WebSocket connect failed: {error}"))?;

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
        .manage(AppState { runtime_url: runtime_url.clone(), token })
        .invoke_handler(tauri::generate_handler![runtime_call, terminal_output_subscribe])
        .setup(move |app| {
            let handle = app.handle().clone();
            let state = app.state::<AppState>();
            let url = state.runtime_url.clone();
            let token = state.token.clone();
            tauri::async_runtime::spawn(async move {
                stream_runtime_events(handle, url, token).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Natalia Desktop");
}
