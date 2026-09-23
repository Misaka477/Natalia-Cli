import type { PluginAdapterInstance } from "@anthelia/plugin";

type CliCommandAdapterInstance = PluginAdapterInstance & {
  done: Promise<void>;
};

type StartCliCommandAdapter = () => CliCommandAdapterInstance;

export async function createCliCommandAdapterHost(
  start: StartCliCommandAdapter = startCliCommandAdapter,
) {
  const adapter = start();
  let closed = false;
  return {
    done: adapter.done,
    async close() {
      if (closed) return;
      closed = true;
      await adapter.dispose();
    },
  };
}

function startCliCommandAdapter(): CliCommandAdapterInstance {
  return {
    done: import("./command-dispatcher").then(() => undefined),
    dispose() {},
  };
}
