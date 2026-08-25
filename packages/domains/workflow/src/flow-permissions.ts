import type {
  NataliaFlowDocument,
  PermissionProfile,
} from "@natalia/contracts";

export type FlowPermissionsInput = {
  profile?: PermissionProfile;
  flow: NataliaFlowDocument;
  taskCapabilities?: { reportIssue?: boolean; readDataSource?: boolean };
};

export type FlowPermissionsResult = {
  blocked: Array<{ moduleID: string; reason: string }>;
};

/** Host policy projection used by management views without importing the host. */
export type ResolveFlowPermissions = (
  input: FlowPermissionsInput,
) => FlowPermissionsResult;
