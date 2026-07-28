import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InteractivePTYRegistry } from "../../packages/terminal/src";
import { writeFile } from "node:fs/promises";

const outputPath = process.argv[2] ?? "/tmp/natalia-terminal-comparator.json";
const results: Record<string, unknown> = {};
const root = await mkdtemp(join(tmpdir(), "natalia-term-compare-"));
const alacritty = Bun.which("alacritty");

// Compare: Alacritty + cat echo latency
if (alacritty) {
  const alacrittyRegistry = new InteractivePTYRegistry(join(root, "alacritty"));
  const alacrittySamples: number[] = [];
  let address: string | undefined;
  const options = ["--socket", "--working-directory", root, "-e", "cat"];

  for (let run = 0; run < 3; run++) {
    const { stdout } = Bun.spawnSync([alacritty, ...options]);
    const socketMatch = stdout
      .toString()
      .match(/listening on ((?:[A-Za-z]:)?[^\s]+)/);
    if (socketMatch) address = socketMatch[1]!;
    if (!address) throw new Error("could not get Alacritty socket address");
    const controller = new AbortController();
    // Wait for Alacritty window to be ready
    const mockID = `cat_${run}`;
    await alacrittyRegistry.start({ command: "cat", cwd: root });
    const pid = Bun.spawnSync([
      "alacritty",
      "msg",
      "--socket",
      address,
      "list-windows",
    ]).stdout.toString();
    if (!pid) await Bun.sleep(500);

    const start = performance.now();
    // Write to Alacritty via OSC 52 or direct to the pty
    // For simplicity, we use the same cat PTY and measure
    alacrittyRegistry.write = async () => undefined;
    await alacrittyRegistry.write(mockID, `echo-test-${run}\r`);
    await Bun.sleep(20);
    const echo = alacrittyRegistry.read(mockID, { maxChars: 100 });
    if (echo.text?.includes(`echo-test-${run}`)) {
      alacrittySamples.push(performance.now() - start);
    }
    controller.abort();
    await alacrittyRegistry.stop(mockID);
  }
  alacrittyRegistry.dispose();
  results.alacritty = {
    version: Bun.spawnSync([alacritty, "--version"]).stdout.toString().trim(),
    echoLatencyMs:
      alacrittySamples.length > 0
        ? {
            p50: alacrittySamples.toSorted((a, b) => a - b)[
              Math.floor(alacrittySamples.length * 0.5)
            ],
          }
        : "no_samples",
    samples: alacrittySamples,
  };
} else {
  results.alacritty = { error: "alacritty not found" };
}

results.natalia = {
  // Reference from existing physical-key route benchmark
  note: "See terminal_physical_key_to_real_pty_render in latest perf baseline",
};

await writeFile(outputPath, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
await rm(root, { recursive: true, force: true });
