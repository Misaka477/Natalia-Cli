/**
 * The workspace built-in plugin: observation, write serialisation and mutation
 * attribution for the mounted workspace.
 *
 * Three kernel services, owned by one plugin so a disabled or absent plugin
 * constructs none of them — in particular no filesystem watcher:
 *
 *   - `workspace.writeLock` serialises writes across parallel sessions;
 *   - `workspace.mutations` attributes each observed change to the tool, turn,
 *     sandbox merge or session that made it;
 *   - `workspace.files` reconciles observed changes against the expected
 *     mutation registry and reports un-attributed drift.
 */
import type { Plugin } from "@natalia/plugin";
import {
  createMutationRegistry,
  type MutationRegistry,
} from "../mutation-registry";
import {
  createWorkspaceFilesController,
  type WorkspaceFilesController,
  type WorkspaceMutationIdentity,
} from "../workspace-files-controller";
import {
  createWorkspaceWriteLock,
  type WorkspaceWriteLock,
} from "../workspace-write-lock";

export const WORKSPACE_PLUGIN_ID = "natalia-workspace";
export const WORKSPACE_WRITE_LOCK_SERVICE = "workspace.writeLock";
export const WORKSPACE_MUTATIONS_SERVICE = "workspace.mutations";
export const WORKSPACE_FILES_SERVICE = "workspace.files";

export function createWorkspacePlugin(input: {
  workspaceRoot: string;
  listPaths: () => Promise<string[]>;
}): Plugin {
  let files: WorkspaceFilesController | undefined;
  return {
    manifest: {
      apiVersion: 2,
      id: WORKSPACE_PLUGIN_ID,
      version: "1.0.0",
      name: "Workspace",
      description:
        "Workspace observation, write serialisation and mutation attribution.",
      entry: "natalia:workspace",
      scope: "workspace",
      provides: [
        WORKSPACE_WRITE_LOCK_SERVICE,
        WORKSPACE_MUTATIONS_SERVICE,
        WORKSPACE_FILES_SERVICE,
      ],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    async setup(api) {
      const mutations: MutationRegistry = createMutationRegistry();
      files = createWorkspaceFilesController({
        workspaceRoot: input.workspaceRoot,
        listPaths: input.listPaths,
        resolveMutation: (path) => {
          const mutation = mutations.match({ path, operation: "modified" });
          if (!mutation) return undefined;
          const identity: WorkspaceMutationIdentity = {
            origin: mutation.operationID ? "sandbox_merge" : "tool",
          };
          if (mutation.turnID) identity.turnID = mutation.turnID;
          if (mutation.callID) identity.callID = mutation.callID;
          if (mutation.operationID) identity.operationID = mutation.operationID;
          if (mutation.sessionID) identity.sessionID = mutation.sessionID;
          if (mutation.episodeID) identity.episodeID = mutation.episodeID;
          return identity;
        },
      });
      await files.init();
      const writeLock: WorkspaceWriteLock = createWorkspaceWriteLock();
      api.services.provide(WORKSPACE_WRITE_LOCK_SERVICE, writeLock);
      api.services.provide(WORKSPACE_MUTATIONS_SERVICE, mutations);
      api.services.provide(WORKSPACE_FILES_SERVICE, files);
    },
    dispose() {
      files?.close();
      files = undefined;
    },
  };
}
