export { compactionDisplayLine } from "./compaction-display";
export { createFakeBackend } from "./fixture";
export { retryDisplayLine } from "./retry-display";
export type {
  RuntimeClient,
  RuntimeEvent,
  SubmittedTurn,
} from "@natalia/contracts";

export type TransportKind =
  | "local-fixture"
  | "worker"
  | "rpc"
  | "stdio"
  | "daemon";

export type RuntimeTransportDescriptor = {
  kind: TransportKind;
  description: string;
  stable: boolean;
};

export const runtimeTransports: RuntimeTransportDescriptor[] = [
  {
    kind: "local-fixture",
    description: "in-process fixture runtime for frontend smoke",
    stable: true,
  },
  {
    kind: "worker",
    description: "future Bun worker runtime transport",
    stable: false,
  },
  {
    kind: "rpc",
    description: "future local RPC runtime transport",
    stable: false,
  },
  {
    kind: "stdio",
    description: "future automation stdio transport",
    stable: false,
  },
  {
    kind: "daemon",
    description: "future long-running daemon transport",
    stable: false,
  },
];
