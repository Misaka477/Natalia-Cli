use mux::pane::PaneId;
use serde::{Deserialize, Serialize};
use std::env;
use std::io::{BufRead, BufReader, Write};
use std::time::Duration;

#[cfg(unix)]
use std::os::unix::net::UnixStream;

const VERSION: u8 = 2;
const TIMEOUT: Duration = Duration::from_millis(250);

#[derive(Serialize)]
struct Claim<'a> {
    version: u8,
    #[serde(rename = "type")]
    kind_type: &'static str,
    nonce: String,
    token: &'a str,
    #[serde(rename = "terminalID")]
    terminal_id: &'a str,
    #[serde(rename = "paneID")]
    pane_id: PaneId,
    kind: &'a str,
    #[serde(rename = "byteLength")]
    byte_length: usize,
}

#[derive(Deserialize)]
struct Decision {
    version: u8,
    #[serde(rename = "type")]
    decision_type: String,
    nonce: String,
    permit: bool,
}

/// This is immediately before the existing pane write. Input bytes stay in
/// WezTerm and reach the PTY through the unmodified upstream write path.
#[cfg(unix)]
pub fn claim_before_pane_write(pane_id: PaneId, kind: &'static str, byte_length: usize) -> bool {
    let endpoint = match env::var("NATALIA_NATIVE_INPUT_ENDPOINT") {
        Ok(value) => value,
        Err(_) => return true,
    };
    let token = match env::var("NATALIA_NATIVE_INPUT_TOKEN") {
        Ok(value) => value,
        Err(_) => return deny("NATALIA_NATIVE_INPUT_TOKEN is missing"),
    };
    let terminal_id = match env::var("NATALIA_TERMINAL_ID") {
        Ok(value) => value,
        Err(_) => return deny("NATALIA_TERMINAL_ID is missing"),
    };
    let nonce = format!("{:016x}{:016x}", fastrand::u64(..), fastrand::u64(..));
    let claim = Claim {
        version: VERSION,
        kind_type: "claim",
        nonce: nonce.clone(),
        token: &token,
        terminal_id: &terminal_id,
        pane_id,
        kind,
        byte_length: byte_length.max(1),
    };
    let frame = match serde_json::to_string(&claim) {
        Ok(frame) => format!("{frame}\n"),
        Err(error) => return deny(&format!("claim encoding failed: {error:#}")),
    };
    let mut stream = match UnixStream::connect(endpoint) {
        Ok(stream) => stream,
        Err(error) => return deny(&format!("broker connect failed: {error:#}")),
    };
    if stream.set_read_timeout(Some(TIMEOUT)).is_err()
        || stream.set_write_timeout(Some(TIMEOUT)).is_err()
        || stream.write_all(frame.as_bytes()).is_err()
    {
        return deny("broker exchange failed");
    }
    let mut response = String::new();
    if BufReader::new(stream).read_line(&mut response).is_err() {
        return deny("broker did not reply");
    }
    match serde_json::from_str::<Decision>(&response) {
        Ok(decision)
            if decision.version == VERSION
                && decision.decision_type == "decision"
                && decision.nonce == nonce
                && decision.permit => true,
        Ok(_) => deny("broker denied input"),
        Err(error) => deny(&format!("broker reply invalid: {error:#}")),
    }
}

#[cfg(not(unix))]
pub fn claim_before_pane_write(_: PaneId, _: &'static str, _: usize) -> bool {
    true
}

fn deny(reason: &str) -> bool {
    log::warn!("NATALIA native input denied: {reason}");
    false
}
