/**
 * One-click helper for the Natalia Browser Bridge extension.
 *
 * - Ensures the local bridge server is running.
 * - Detects a Chromium browser (Chrome / Edge / Brave / Opera / Vivaldi / Arc).
 * - If the browser is not running, launches it with --load-extension.
 * - If the browser is already running, opens the extensions page and prints
 *   the folder to load.
 */
import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;
const EXT_DIR = join(ROOT, "src/extension/chromium");
const BRIDGE_URL = process.env.NATALIA_BROWSER_BRIDGE_URL || "http://127.0.0.1:18765";

function isUp(url: string) {
  try {
    execSync(`curl -s --max-time 1 ${url}/healthz`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function startBridgeServer() {
  console.log("[natalia-browser-bridge] starting bridge server...");
  const child = spawn("bun", [join(ROOT, "src/server.ts")], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  for (let i = 0; i < 20; i += 1) {
    if (isUp(BRIDGE_URL)) return;
    sleep(300);
  }
}

function sleep(ms: number) {
  const now = Date.now();
  while (Date.now() - now < ms) {
    // busy wait acceptable for this helper
  }
}

function browserCandidates(): string[] {
  const candidates: string[] = [];
  if (process.platform === "win32") {
    const roots = [process.env.LOCALAPPDATA, process.env.ProgramFiles, process.env.ProgramW6432].filter(Boolean) as string[];
    for (const root of roots) {
      for (const rel of [
        "Google/Chrome/Application/chrome.exe",
        "Chromium/Application/chrome.exe",
        "Microsoft/Edge/Application/msedge.exe",
        "BraveSoftware/Brave-Browser/Application/brave.exe",
        "Vivaldi/Application/vivaldi.exe",
      ]) candidates.push(join(root, rel));
    }
  } else if (process.platform === "darwin") {
    for (const rel of [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi",
    ]) candidates.push(rel);
  } else {
    for (const name of [
      "google-chrome",
      "google-chrome-stable",
      "chromium",
      "chromium-browser",
      "microsoft-edge",
      "microsoft-edge-stable",
      "brave-browser",
      "opera",
      "vivaldi",
    ]) {
      try {
        const path = execSync(`command -v ${name}`, { stdio: "pipe" }).toString().trim();
        if (path) candidates.push(path);
      } catch {}
    }
  }
  return candidates;
}

function findBrowser(): string | undefined {
  for (const candidate of browserCandidates()) if (existsSync(candidate)) return candidate;
  return undefined;
}

function isBrowserRunning() {
  try {
    const out = process.platform === "darwin"
      ? "pgrep -x 'Google Chrome|Microsoft Edge|Brave Browser|Vivaldi' || true"
      : process.platform === "win32"
        ? "tasklist | findstr /I \"chrome.exe msedge.exe brave.exe vivaldi.exe\""
        : "pgrep -f 'google-chrome|chromium|microsoft-edge|brave-browser|opera|vivaldi' || true";
    execSync(out, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("[natalia-browser-bridge] install helper");
  if (!isUp(BRIDGE_URL)) startBridgeServer();
  else console.log(`[natalia-browser-bridge] bridge already running at ${BRIDGE_URL}`);

  const browser = findBrowser();
  if (!browser) {
    console.error("No supported Chromium browser found. Please install Chrome, Edge, Brave, Opera, Vivaldi or Arc.");
    process.exit(1);
  }

  console.log(`[natalia-browser-bridge] browser: ${browser}`);
  console.log(`[natalia-browser-bridge] extension dir: ${EXT_DIR}`);

  if (!isBrowserRunning()) {
    console.log("[natalia-browser-bridge] launching browser with --load-extension...");
    const child = spawn(browser, [`--load-extension=${EXT_DIR}`, "about:blank"], {
      stdio: "ignore",
      detached: true,
    });
    child.unref();
    console.log("Done. The extension should auto-connect.");
  } else {
    console.log("[natalia-browser-bridge] browser is already running.");
    console.log("Open the extensions page and load the folder manually:");
    console.log("  chrome://extensions  (or edge://extensions)");
    console.log(`  then load unpacked folder: ${EXT_DIR}`);
    if (process.platform === "linux") {
      try {
        spawn("xdg-open", ["chrome://extensions"], { stdio: "ignore", detached: true }).unref();
      } catch {}
    }
  }
}

await main();
