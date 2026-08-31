/**
 * Attachment upload surface exposed over RuntimeClient.
 *
 * The UI sends clipboard/drop image bytes as base64; the runtime stores them
 * directly in the attachment store (`.natalia/attachments/`) and returns a
 * durable LocalAttachment path for later submit. This avoids writing pasted
 * files into the user workspace.
 */
import type { LocalAttachment } from "@natalia/contracts";
import {
  ATTACHMENT_SERVICE,
  type AttachmentService,
} from "@natalia/runtime-services";
import type { RuntimeContext } from "./context";
import type { RuntimeServiceClient } from "@natalia/runtime-services";

export function createAttachmentRuntime(
  ctx: RuntimeContext,
): Pick<RuntimeServiceClient, "uploadAttachment"> {
  return {
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
