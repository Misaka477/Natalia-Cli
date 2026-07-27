import { workerData } from "node:worker_threads";
import {
  attachRuntimeClientWorker,
  createRealRuntimeClient,
} from "@natalia/client";

const input = workerData as {
  port: import("@natalia/client").RuntimeWorkerPort;
  workspaceRoot: string;
  sessionID: string;
};

attachRuntimeClientWorker(
  input.port,
  createRealRuntimeClient({
    workspaceRoot: input.workspaceRoot,
    sessionID: input.sessionID as never,
  }),
);
