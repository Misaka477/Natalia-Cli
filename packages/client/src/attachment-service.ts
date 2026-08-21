import type { LocalAttachment } from "@natalia/contracts";
import type { SessionRecord } from "@natalia/session";
import {
  attachmentDataURL,
  attachmentText,
  cleanupUnreferencedAttachments,
  isTextAttachment,
  referencedAttachmentsForSessions,
  storeLocalAttachments,
} from "./attachments";

export type AttachmentService = ReturnType<typeof createAttachmentService>;

export function createAttachmentService(workspaceRoot: string) {
  return {
    store: (paths: string[]) => storeLocalAttachments({ workspaceRoot, paths }),
    dataURL: (attachment: LocalAttachment) =>
      attachmentDataURL(workspaceRoot, attachment),
    text: (attachment: LocalAttachment) =>
      attachmentText(workspaceRoot, attachment),
    isText: isTextAttachment,
    cleanup: (attachments: LocalAttachment[]) =>
      cleanupUnreferencedAttachments({ workspaceRoot, attachments }),
    referencedForSessions: (sessions: SessionRecord[]) =>
      referencedAttachmentsForSessions(sessions),
  };
}
