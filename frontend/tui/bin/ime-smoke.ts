import { runTuiShell } from "../src/app/runtime";

console.error("Natalia TUI IME manual smoke");
console.error("1. Switch to a Chinese IME and type: 你好，输入法预编辑测试🙂é");
console.error("2. Move left/right across CJK, emoji and combining characters.");
console.error(
  "3. Press Ctrl+J and Alt+Enter for newlines, then Enter to submit.",
);
console.error(
  "4. Record terminal, IME engine, OS/session, Bun/OpenTUI versions and screenshot/recording path.",
);

const handle = await runTuiShell();
process.once("SIGINT", () => handle.stop());
process.once("SIGTERM", () => handle.stop());
await new Promise<void>((resolve) => handle.renderer.once("destroy", resolve));
