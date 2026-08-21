import type { Plugin } from "@natalia/plugin";
import { createAttachmentService } from "../attachment-service";

export type { AttachmentService } from "../attachment-service";

export const ATTACHMENT_PLUGIN_ID = "natalia-attachment";
export const ATTACHMENT_SERVICE = "attachment.service";

export function createAttachmentPlugin(input: {
  workspaceRoot: string;
}): Plugin {
  return {
    manifest: {
      apiVersion: 2,
      id: ATTACHMENT_PLUGIN_ID,
      version: "1.0.0",
      name: "Attachment",
      description: "Durable local attachment storage and materialization.",
      entry: "natalia:attachment",
      scope: "workspace",
      provides: [ATTACHMENT_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      api.services.provide(
        ATTACHMENT_SERVICE,
        createAttachmentService(input.workspaceRoot),
      );
    },
  };
}
