import { spawn } from "node:child_process";
import { platform } from "node:os";

export function copyCommand(
  os: NodeJS.Platform,
  wayland: boolean,
  has: (name: string) => boolean,
) {
  if (os === "darwin" && has("pbcopy")) return ["pbcopy"];
  if (os === "linux" && wayland && has("wl-copy")) return ["wl-copy"];
  if (os === "linux" && has("xclip"))
    return ["xclip", "-selection", "clipboard"];
  if (os === "linux" && has("xsel")) return ["xsel", "--clipboard", "--input"];
  if (os === "win32" && has("powershell.exe"))
    return [
      "powershell.exe",
      "-NonInteractive",
      "-NoProfile",
      "-Command",
      "Set-Clipboard -Value ([Console]::In.ReadToEnd())",
    ];
}

export async function writeClipboard(text: string) {
  writeOsc52(text);
  const command = copyCommand(
    platform(),
    Boolean(process.env.WAYLAND_DISPLAY),
    (name) => Boolean(Bun.which(name)),
  );
  if (!command) return;
  await run(command[0]!, command.slice(1), text).catch(() => undefined);
}

export async function readClipboardText() {
  const command = readCommand(
    platform(),
    Boolean(process.env.WAYLAND_DISPLAY),
    (name) => Boolean(Bun.which(name)),
  );
  if (!command) return;
  return (
    await run(command[0]!, command.slice(1)).catch(() => undefined)
  )?.toString();
}

export function imageReadCommand(
  os: NodeJS.Platform,
  wayland: boolean,
  has: (name: string) => boolean,
): string[] | undefined {
  if (os === "linux" && wayland && has("wl-paste"))
    return ["wl-paste", "-t", "image/png"];
  if (os === "linux" && has("xclip"))
    return ["xclip", "-selection", "clipboard", "-t", "image/png", "-o"];
  if (os === "darwin" && has("osascript"))
    return ["osascript", "-e", "the clipboard as «class PNGf»"];
  if (os === "win32" && has("powershell.exe"))
    return [
      "powershell.exe",
      "-NoProfile",
      "-Command",
      "$i = Get-Clipboard -Format Image; if ($i) { $ms = New-Object IO.MemoryStream; $i.Save($ms, [Drawing.Imaging.ImageFormat]::Png); [Convert]::ToBase64String($ms.ToArray()) }",
    ];
}

/**
 * Reads an image from the system clipboard as raw PNG bytes, or `undefined`
 * when no tool is available or the clipboard holds no image. On macOS and
 * Windows the tools emit base64, which is decoded here so callers always get
 * bytes. The tool choice is injectable, exactly like `readCommand`, so tests
 * can pin the command per platform without spawning anything.
 */
export async function readClipboardImage(
  os: NodeJS.Platform = platform(),
  wayland: boolean = Boolean(process.env.WAYLAND_DISPLAY),
  has: (name: string) => boolean = (name) => Boolean(Bun.which(name)),
): Promise<Buffer | undefined> {
  const command = imageReadCommand(os, wayland, has);
  if (!command) return undefined;
  const output = await run(command[0]!, command.slice(1)).catch(
    () => undefined,
  );
  if (!output || output.length === 0) return undefined;
  if (os === "darwin" || os === "win32") {
    try {
      return Buffer.from(output.toString().trim(), "base64");
    } catch {
      return undefined;
    }
  }
  return output;
}

function readCommand(
  os: NodeJS.Platform,
  wayland: boolean,
  has: (name: string) => boolean,
) {
  if (os === "darwin" && has("pbpaste")) return ["pbpaste"];
  if (os === "linux" && wayland && has("wl-paste"))
    return ["wl-paste", "--no-newline"];
  if (os === "linux" && has("xclip"))
    return ["xclip", "-selection", "clipboard", "-o"];
  if (os === "linux" && has("xsel")) return ["xsel", "--clipboard", "--output"];
  if (os === "win32" && has("powershell.exe"))
    return ["powershell.exe", "-NoProfile", "-Command", "Get-Clipboard"];
}

function writeOsc52(text: string) {
  if (!process.stdout.isTTY) return;
  const sequence = `\u001b]52;c;${Buffer.from(text).toString("base64")}\u0007`;
  process.stdout.write(
    process.env.TMUX || process.env.STY
      ? `\u001bPtmux;\u001b${sequence}\u001b\\`
      : sequence,
  );
}

function run(command: string, args: string[], input?: string) {
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "ignore"],
    });
    const output: Buffer[] = [];
    child.on("error", reject);
    child.stdout?.on("data", (chunk: Buffer) => output.push(chunk));
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(output));
      else reject(new Error(`${command} exited with code ${code}`));
    });
    if (input !== undefined) child.stdin?.end(input);
  });
}
