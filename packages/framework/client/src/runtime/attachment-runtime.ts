/**
 * Attachment upload surface exposed over RuntimeClient.
 *
 * The UI sends clipboard/drop image bytes as base64; the runtime stores them
 * directly in the attachment store (`.natalia/attachments/`) and returns a
 * durable LocalAttachment path for later submit. This avoids writing pasted
 * files into the user workspace.
 */
import type { LocalAttachment, SessionID } from "@natalia/contracts";
import {
  ATTACHMENT_SERVICE,
  SESSION_STORE_CONTROLLER_SERVICE,
  type AttachmentService,
  type SessionStoreController,
} from "@natalia/runtime-services";
import type { RuntimeContext } from "./context";
import type { RuntimeServiceClient } from "@natalia/runtime-services";

export function createAttachmentRuntime(
  ctx: RuntimeContext,
): Pick<RuntimeServiceClient, "uploadAttachment" | "attachmentDataUrl"> {
  return {
    async attachmentDataUrl(input: {
      path?: string;
      mediaType?: string;
      attachmentID?: string;
      sessionID?: string;
    }): Promise<string> {
      await ctx.ports.getReady();
      const attachments =
        ctx.ports.resolveService<AttachmentService>(ATTACHMENT_SERVICE);
      if (!attachments)
        throw new Error("attachment service unavailable (natalia-attachments)");

      if (input.attachmentID || input.sessionID) {
        if (!input.attachmentID || !input.sessionID)
          throw new Error(
            "attachmentDataUrl requires attachmentID and sessionID together",
          );
        const session =
          ctx.ports.getExecutionBySession().get(input.sessionID as SessionID)
            ?.session ??
          (await (async () => {
            const store = ctx.ports.resolveService<SessionStoreController>(
              SESSION_STORE_CONTROLLER_SERVICE,
            );
            if (!store)
              throw new Error(
                "session store unavailable (natalia-session-store)",
              );
            return (await store.load(input.sessionID as SessionID)).session;
          })());
        const referenced = attachments.referencedForSessions([session]);
        const attachment = referenced.find(
          (item) => item.id === input.attachmentID,
        );
        if (!attachment)
          throw new Error(
            `attachment is not referenced by session: ${input.attachmentID}`,
          );
        return await attachments.dataURL(attachment);
      }

      if (!input.path || !input.mediaType)
        throw new Error(
          "attachmentDataUrl requires path+mediaType or attachmentID+sessionID",
        );
      const filename = input.path.split(/[\\/]/u).pop() ?? "attachment";
      return await attachments.dataURL({
        id: "",
        path: input.path,
        filename,
        mediaType: input.mediaType as LocalAttachment["mediaType"],
        byteLength: 0,
        sha256: "",
      });
    },
    async uploadAttachment(input: {
      name: string;
      mediaType: string;
      data: string;
    }): Promise<LocalAttachment> {
      await ctx.ports.getReady();
      const attachments =
        ctx.ports.resolveService<AttachmentService>(ATTACHMENT_SERVICE);
      if (!attachments)
        throw new Error("attachment service unavailable (natalia-attachments)");
      const bytes = Buffer.from(input.data, "base64");
      return await attachments.storeBytes({
        name: input.name,
        mediaType: input.mediaType,
        data: new Uint8Array(bytes),
      });
    },
  };
}
