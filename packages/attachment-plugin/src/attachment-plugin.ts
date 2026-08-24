import type { Plugin } from "@natalia/plugin";
import type { SessionID } from "@natalia/contracts";
import { createAttachmentService } from "./attachment-service";
import { ATTACHMENT_SERVICE } from "@natalia/runtime-services";

export const ATTACHMENT_PLUGIN_ID = "natalia-attachment";
export type AttachmentPluginInput = {
  workspaceRoot: string;
  commands?: {
    submit(
      sessionID: SessionID,
      input: { text: string; attachments: string[] },
    ): Promise<void>;
  };
};

export function createAttachmentPlugin(input: AttachmentPluginInput): Plugin {
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
      integrationPoints: ["services", "commands"],
    },
    setup(api) {
      api.services.provide(
        ATTACHMENT_SERVICE,
        createAttachmentService(input.workspaceRoot),
      );
      if (input.commands)
        api.commands.register({
          name: "attach",
          title: "Attach",
          async run(invocation) {
            if (!invocation?.sessionID)
              throw new Error("attachment command requires a session");
            const [path, ...prompt] = invocation.args;
            if (!path || !prompt.length)
              throw new Error(
                "usage: /attach <workspace-relative-image> <prompt>",
              );
            await input.commands!.submit(invocation.sessionID as SessionID, {
              text: prompt.join(" "),
              attachments: [path],
            });
          },
        });
    },
  };
}
