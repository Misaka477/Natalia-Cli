import {
  createWezTermHost,
  NativeTerminalRegistry,
} from "../packages/native-terminal/src/index";

const command = process.env.NATALIA_KIMI_COMMAND ?? "kimi-cli";
const registry = new NativeTerminalRegistry(createWezTermHost());

const session = await registry.start({
  id: `native_kimi_chat_${Date.now()}`,
  cwd: process.cwd(),
  command,
});

try {
  await waitForText("Welcome to Kimi Code CLI", 15_000);
  console.log("Kimi started in native pane", session.paneID);

  const prompts = ["hello", "math", "colors"];

  for (const [index, topic] of prompts.entries()) {
    const marker = `NATALIA_NATIVE_CHAT_${Date.now()}_${index}`;
    const prompt = `For ${topic}, reply with exactly ${marker} and nothing else.`;
    const before = await registry.read(session.id);
    await registry.write(session.id, `${prompt}\r`);
    console.log("model wrote:", JSON.stringify(prompt));

    const text = await waitForResponseMarker(before, marker, 30_000);
    if (occurrences(text, marker) < 2)
      throw new Error(
        `Kimi response marker '${marker}' was not visible in the shared pane`,
      );
    console.log(`  prompt echo and Kimi response visible in shared pane`);
  }

  console.log(
    JSON.stringify({
      host: session.host,
      paneID: session.paneID,
      rounds: prompts.length,
      passed: true,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      host: session.host,
      paneID: session.paneID,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
} finally {
  await registry.stop(session.id);
}

async function waitForText(needle: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await registry.read(session.id)).includes(needle)) return;
    await Bun.sleep(250);
  }
  throw new Error(`native pane did not produce '${needle}'`);
}

async function waitForResponseMarker(
  previous: string,
  marker: string,
  timeoutMs: number,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await registry.read(session.id);
    if (text !== previous && occurrences(text, marker) >= 2) return text;
    await Bun.sleep(500);
  }
  throw new Error("pane text did not change within timeout");
}

function occurrences(text: string, needle: string) {
  return text.split(needle).length - 1;
}
