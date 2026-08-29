import { workerData } from "node:worker_threads";
import {
  attachRuntimeClientWorker,
  createRealRuntimeClient,
} from "@natalia/client";
import { CapabilityHost } from "@natalia/capability";

const input = workerData as {
  port: import("@natalia/client").RuntimeWorkerPort;
  workspaceRoot: string;
  pluginStoreRoot: string;
  sessionID: string;
  globalConfigPath?: string;
  sessionDir?: string;
};

const capabilityHost = new CapabilityHost({
  workspaceRoot: input.workspaceRoot,
});
let runtime = createRealRuntimeClient({
  workspaceRoot: input.workspaceRoot,
  pluginStoreRoot: input.pluginStoreRoot,
  sessionID: input.sessionID as never,
  globalConfigPath: input.globalConfigPath,
  sessionDir: input.sessionDir,
  useSqliteStore: true,
  capabilityHost,
});
const createRuntime = () => {
  runtime = createRealRuntimeClient({
    workspaceRoot: input.workspaceRoot,
    pluginStoreRoot: input.pluginStoreRoot,
    sessionID: input.sessionID as never,
    globalConfigPath: input.globalConfigPath,
    sessionDir: input.sessionDir,
    useSqliteStore: true,
    capabilityHost,
  });
  return runtime;
};

attachRuntimeClientWorker(input.port, runtime, {
  reload: createRuntime,
  disposeHost: () => capabilityHost.dispose(),
});
