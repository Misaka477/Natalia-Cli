import type { AttachmentService } from "@natalia/runtime";
import { defineService } from "@natalia/runtime-services";

/** The attachment service token; lives with the mechanism. */
export const attachmentService = defineService<AttachmentService>(
  "attachment.service",
  { scope: "workspace", capability: "services" },
);
