/**
 * The session-store built-in plugin.
 *
 * The durable session store (JSON plus optional sqlite) now lives on the
 * unified plugin lifecycle: the plugin constructs it in `setup()` and provides
 * it as the `session-store.controller` service, so a disabled or absent plugin
 * constructs no store at all. The host resolves the service and drives `init`,
 * then every member that persists session events reads it from the kernel.
 */
import type { Plugin } from "@natalia/plugin";
import type { SessionID } from "@natalia/contracts";
import { createSessionStoreController } from "./session-store-controller";
import { ATTACHMENT_PLUGIN_ID } from "@natalia/attachment-plugin";
import {
  ATTACHMENT_SERVICE,
  SESSION_STORE_CONTROLLER_SERVICE,
  type AttachmentService,
} from "@natalia/runtime-services";

export const SESSION_STORE_PLUGIN_ID = "natalia-session-store";
export function createSessionStoreControllerPlugin(input: {
  workspaceRoot: string;
  sessionID(): SessionID;
  sessionDir?: string;
  useSqliteStore?: boolean;
  title?: string;
}): Plugin {
  let controller: ReturnType<typeof createSessionStoreController> | undefined;
  return {
    manifest: {
      apiVersion: 2,
      id: SESSION_STORE_PLUGIN_ID,
      version: "1.0.0",
      name: "Session Store",
      description: "Durable session persistence.",
      entry: "natalia:session-store",
      scope: "workspace",
      provides: [SESSION_STORE_CONTROLLER_SERVICE],
      requires: [ATTACHMENT_SERVICE],
      optionalRequires: [],
      conflicts: [],
      dependencies: [
        {
          id: ATTACHMENT_PLUGIN_ID,
          spec: ">=1.0.0",
          optional: false,
          peer: false,
        },
      ],
      hooks: {},
      integrationPoints: ["services", "commands"],
    },
    setup(api) {
      const attachments =
        api.services.get<AttachmentService>(ATTACHMENT_SERVICE);
      if (!attachments)
        throw new Error("attachment service unavailable (natalia-attachment)");
      controller = createSessionStoreController({ ...input, attachments });
      api.services.provide(SESSION_STORE_CONTROLLER_SERVICE, controller);
      api.commands.register({
        name: "sessions",
        title: "List sessions",
        async run() {
          if (!controller?.status().initialized)
            throw new Error("session store is not initialized");
          const listing = (await controller.list())
            .map((item) => `${item.id}  ${item.title}  ${item.events} events`)
            .join("\n");
          return listing || "no TS sessions found in this workspace";
        },
      });
    },
    async dispose() {
      await controller?.close();
      controller = undefined;
    },
  };
}
