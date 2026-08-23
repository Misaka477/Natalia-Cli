import type { LocalAttachment } from "@natalia/contracts";
import type { SessionRecord } from "@natalia/session";
import type { AttachmentService } from "@natalia/runtime-services";
import {
  attachmentDataURL,
  attachmentText,
  cleanupUnreferencedAttachments,
  isTextAttachment,
  referencedAttachmentsForSessions,
  storeLocalAttachments,
} from "./attachments";

export function createAttachmentService(
  workspaceRoot: string,
): AttachmentService {
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
