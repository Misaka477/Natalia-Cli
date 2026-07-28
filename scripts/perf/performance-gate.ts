import { readFile } from "node:fs/promises";

const path = process.argv[2];
if (!path) throw new Error("expected perf baseline JSON path");
const report = JSON.parse(await readFile(path, "utf8")) as {
  scenarios: Array<{
    name: string;
    summary: { elapsedMs: { p50: number; p95: number } };
    result?: Record<string, number | string | boolean>;
  }>;
};
const scenario = (name: string) => {
  const value = report.scenarios.find((item) => item.name === name);
  if (!value) throw new Error(`missing required scenario: ${name}`);
  return value;
};
const checks = [
  {
    name: "history cache bounded",
    pass:
      Number(
        scenario("tui_2000_turn_history_cache_bound").result?.cachedMessages,
      ) <= 300,
  },
  {
    name: "history reload bounded",
    pass:
      Number(
        scenario("tui_10k_events_2k_blocks_history_scroll_reload").result
          ?.cachedBlocks,
      ) <= 300,
  },
  {
    name: "SQLite reader checkpoint not busy",
    pass:
      Number(
        scenario("sqlite_writer_three_readers_contention").result?.checkpointMs,
      ) < 20,
  },
  {
    name: "Terminal cleanup running count zero",
    pass:
      scenario("terminal_stop_unregister_waiter_cleanup").result
        ?.runningCountAfterStop === 0,
  },
  {
    name: "physical key to terminal render p50 <= 50ms",
    pass:
      scenario("terminal_physical_key_to_real_terminal_render").summary.elapsedMs
        .p50 <= 50,
  },
];
console.log(
  JSON.stringify({ passed: checks.every((check) => check.pass), checks }),
);
if (!checks.every((check) => check.pass)) process.exit(1);
