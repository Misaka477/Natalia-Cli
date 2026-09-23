"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAttachmentService = createAttachmentService;
var attachments_1 = require("./attachments");
function createAttachmentService(workspaceRoot) {
    return {
        store: function (paths) { return (0, attachments_1.storeLocalAttachments)({ workspaceRoot: workspaceRoot, paths: paths }); },
        storeBytes: function (input) {
            return (0, attachments_1.storeLocalAttachmentBytes)(__assign({ workspaceRoot: workspaceRoot }, input));
        },
        dataURL: function (attachment) {
            return (0, attachments_1.attachmentDataURL)(workspaceRoot, attachment);
        },
        text: function (attachment) {
            return (0, attachments_1.attachmentText)(workspaceRoot, attachment);
        },
        isText: attachments_1.isTextAttachment,
        cleanup: function (attachments) {
            return (0, attachments_1.cleanupUnreferencedAttachments)({ workspaceRoot: workspaceRoot, attachments: attachments });
        },
        referencedForSessions: function (sessions) {
            return (0, attachments_1.referencedAttachmentsForSessions)(sessions);
        },
    };
}
