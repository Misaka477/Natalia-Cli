import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
let serve: ChildProcess | undefined;

function portFree(port: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const server = createServer();
    server.once("error", () => resolvePromise(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolvePromise(true));
    });
  });
}

async function findFreePort(start = 8790): Promise<number> {
  for (let port = start; port < start + 100; port++) {
    if (await portFree(port)) return port;
  }
  throw new Error("no free runtime port found");
}

async function waitForServer(port: number, tries = 20): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`, {
        signal: AbortSignal.timeout(500),
      });
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  throw new Error(`runtime server did not start on ${port}`);
}

const port = await findFreePort();
console.log(`[dev-web-ui] starting runtime serve on ${port}`);
serve = spawn("bun", ["apps/cli/src/main.ts", "serve", String(port)], {
  cwd: root,
  stdio: "inherit",
});
serve.on("exit", (code) => {
  if (code && code !== 0) console.error(`[dev-web-ui] serve exited ${code}`);
});

await waitForServer(port);

const vite = spawn(
  "npm",
  ["--workspace", "@natalia/example-ui-web-shell", "run", "dev"],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_NATALIA_RUNTIME_URL: `http://127.0.0.1:${port}`,
    },
  },
);

async function shutdown(signal: string) {
  console.log(`[dev-web-ui] received ${signal}, shutting down`);
  vite.kill(signal as NodeJS.Signals);
  serve?.kill(signal as NodeJS.Signals);
  await once(vite, "exit").catch(() => undefined);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
await once(vite, "exit").catch(() => undefined);
serve?.kill();
process.exit(0);
