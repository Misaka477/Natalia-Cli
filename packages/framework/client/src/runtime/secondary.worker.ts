import { parentPort } from "node:worker_threads";
import { manifestIntegrationPoints } from "@natalia/plugin";

export type SecondaryWorkerRequest =
  | {
      id: number;
      op: "configClone";
      config: import("@natalia/contracts").ConfigV3;
    }
  | {
      id: number;
      op: "pluginList";
      plugins: unknown[];
    };

export type SecondaryWorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

const port = parentPort;
if (!port) throw new Error("secondary worker requires parentPort");

port.on("message", (request: SecondaryWorkerRequest) => {
  try {
    let result: unknown;
    if (request.op === "configClone") {
      result = structuredClone(request.config);
    } else {
      result = request.plugins.map((plugin) => {
        const value = plugin as {
          id: string;
          version: string;
          name: string;
          description: string;
        };
        return {
          id: value.id,
          version: value.version,
          name: value.name,
          description: value.description,
          capabilities: manifestIntegrationPoints(plugin as never),
        };
      });
    }
    const response: SecondaryWorkerResponse = {
      id: request.id,
      ok: true,
      result,
    };
    port.postMessage(response);
  } catch (error) {
    const response: SecondaryWorkerResponse = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    port.postMessage(response);
  }
});

export {};
