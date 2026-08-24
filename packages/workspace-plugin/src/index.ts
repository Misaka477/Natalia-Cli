export {
  createWorkspacePlugin,
  WORKSPACE_PLUGIN_ID,
  WORKSPACE_PLUGIN_MANIFEST,
} from "./workspace-plugin";
export { createMutationRegistry } from "./mutation-registry";
export {
  createWorkspaceChangeAuditor,
  type WorkspaceChangeAuditor,
  type WorkspaceChangeIdentity,
} from "./workspace-change-auditor";
export {
  createWorkspaceFilesController,
  type WorkspaceMutationIdentity,
} from "./workspace-files-controller";
export {
  findWorkspaceFiles,
  globWorkspaceFiles,
  invalidateWorkspaceFiles,
  listWorkspaceFiles,
  readWorkspaceFile,
  searchWorkspaceFiles,
  watchWorkspaceFiles,
} from "@natalia/platform";
export {
  assertSecretSafeObservation,
  attributionFor,
  observationHealth,
  operationCorrelation,
  turnCorrelation,
} from "./workspace-observation";
export { createWorkspaceWriteLock } from "./workspace-write-lock";
