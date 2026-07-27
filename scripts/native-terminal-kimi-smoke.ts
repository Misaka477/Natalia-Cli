import {
  createWezTermHost,
  NativeTerminalRegistry,
} from "../packages/native-terminal/src/index";

const command = process.env.NATALIA_KIMI_COMMAND ?? "kimi-cli";
// The product auto-opens the Hub. Keep this non-GUI smoke headless so it does
// not create or leave desktop windows behind during automated verification.
const registry = new NativeTerminalRegistry(createWezTermHost(), {
  autoOpenHub: false,
});
const session = await registry.start({
  id: `native_kimi_${Date.now()}`,
  cwd: process.cwd(),
  command,
});

try {
  const deadline = Date.now() + 10_000;
  let text = "";
  while (Date.now() < deadline) {
    text = await registry.read(session.id);
    if (text.includes("Welcome to Kimi Code CLI")) break;
    await Bun.sleep(250);
  }
  if (!text.includes("Welcome to Kimi Code CLI"))
    throw new Error("Kimi welcome screen did not appear in the native pane");
  if (text.includes("cursor position requests (CPR)"))
    throw new Error("Kimi reported an unsupported cursor position request");
  console.log(
    JSON.stringify({
      host: session.host,
      paneID: session.paneID,
      nativeKimiReady: true,
    }),
  );
} finally {
  await registry.stop(session.id);
}
