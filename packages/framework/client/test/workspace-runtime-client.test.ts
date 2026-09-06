import { expect, test } from "bun:test";
import {
  createWorkspaceRuntimeClient,
  type WorkspaceManager,
} from "../src/workspace-manager";

function emptyManager(): WorkspaceManager {
  return {
    async list() {
      return [];
    },
    async add() {
      throw new Error("unused");
    },
    async remove() {
      return { removed: true };
    },
    async activate() {
      throw new Error("unused");
    },
    async load() {},
    async workspaceRoots() {
      return [];
    },
    async workspaceAdd() {
      throw new Error("unused");
    },
    async workspaceRemove() {
      return { removed: true };
    },
    async workspaceActivate() {
      throw new Error("unused");
    },
    get() {
      return undefined;
    },
    getActive() {
      return undefined;
    },
    async summaryFor() {
      throw new Error("unused");
    },
    async workspacePermissionGet() {
      throw new Error("unused");
    },
    async workspacePermissionSet() {
      throw new Error("unused");
    },
    async workspaceToolGet() {
      throw new Error("unused");
    },
    async workspaceToolSet() {
      throw new Error("unused");
    },
    async dispose() {},
  };
}

test("workspace proxy throws when native terminal is used without an active workspace", async () => {
  const client = createWorkspaceRuntimeClient(emptyManager());
  await expect(
    client.nativeTerminalStart?.({ command: "bash" }),
  ).rejects.toThrow("no active workspace");
});
