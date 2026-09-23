"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
(0, bun_test_1.test)("context ledger restores completed turns and tool pairs once", function () {
    var attachment = {
        id: "att-1",
        path: ".natalia/attachments/att-1.png",
        filename: "diagram.png",
        mediaType: "image/png",
        byteLength: 3,
        sha256: "fixture",
    };
    var events = [
        {
            type: "turn.submitted",
            id: "turn-1",
            text: "inspect",
            byteLength: 7,
            lineCount: 1,
            sha256: "input",
            attachments: [attachment],
        },
        { type: "content.delta", id: "turn-1", text: "partial" },
        { type: "content.done", id: "turn-1", text: "final answer" },
        {
            type: "tool.update",
            id: "turn-1:tool",
            callID: "call-1",
            name: "read_file",
            status: "receiving_arguments",
            summary: "receiving",
            argumentsDelta: '{"path":"a.txt"}',
        },
        {
            type: "tool.update",
            id: "turn-1:tool",
            callID: "call-1",
            name: "read_file",
            status: "queued",
            summary: "queued",
        },
        {
            type: "tool.update",
            id: "turn-1:tool",
            callID: "call-1",
            name: "read_file",
            status: "succeeded",
            summary: "read",
            result: "contents",
        },
        {
            type: "tool.update",
            id: "turn-1:tool",
            callID: "call-1",
            name: "read_file",
            status: "succeeded",
            summary: "duplicate",
            result: "duplicate",
        },
        { type: "turn.finished", id: "turn-1", stopReason: "done" },
        { type: "content.delta", id: "turn-incomplete", text: "discard me" },
    ];
    var factory = (0, src_1.createContextLedgerFactory)();
    var context = factory.create();
    factory.restore(context, events);
    (0, bun_test_1.expect)(context.snapshot().entries).toEqual([
        bun_test_1.expect.objectContaining({
            id: "turn-1:user",
            role: "user",
            content: "inspect",
            attachments: [attachment],
        }),
        bun_test_1.expect.objectContaining({
            role: "tool_call",
            pairID: "call-1",
            content: 'read_file {"path":"a.txt"}',
        }),
        bun_test_1.expect.objectContaining({
            role: "tool_result",
            pairID: "call-1",
            content: "contents",
        }),
        bun_test_1.expect.objectContaining({
            id: "turn-1:assistant",
            role: "assistant",
            content: "final answer",
        }),
    ]);
});
(0, bun_test_1.test)("context ledger restores provider reasoning and tool thought signatures", function () {
    var events = [
        {
            type: "turn.submitted",
            id: "turn-reasoning",
            text: "inspect",
            byteLength: 7,
            lineCount: 1,
            sha256: "input",
        },
        {
            type: "thinking.done",
            id: "turn-reasoning",
            text: "need to read the file",
            reasoningField: "reasoning_content",
            reasoningSignature: "signature-1",
            reasoningBlocks: [
                { text: "need to read the file", signature: "signature-1" },
            ],
        },
        {
            type: "content.done",
            id: "turn-reasoning",
            text: "answer",
            textSignature: "text-signature",
            contentParts: [{ type: "text", text: "answer" }],
            providerMetadata: {
                openrouter: {
                    reasoning_details: [{ type: "reasoning.text", text: "thinking" }],
                },
            },
        },
        {
            type: "tool.update",
            id: "turn-reasoning:call-1",
            callID: "call-1",
            name: "read_file",
            status: "succeeded",
            summary: "read",
            argumentsDelta: '{"path":"a.txt"}',
            result: "contents",
            thoughtSignature: "tool-signature",
        },
        { type: "turn.finished", id: "turn-reasoning", stopReason: "done" },
    ];
    var factory = (0, src_1.createContextLedgerFactory)();
    var context = factory.create();
    factory.restore(context, events);
    (0, bun_test_1.expect)(context.snapshot().entries).toContainEqual(bun_test_1.expect.objectContaining({
        role: "tool_call",
        pairID: "call-1",
        reasoningContent: "need to read the file",
        reasoningField: "reasoning_content",
        reasoningSignature: "signature-1",
        reasoningBlocks: [
            { text: "need to read the file", signature: "signature-1" },
        ],
        textSignature: "text-signature",
        contentParts: [{ type: "text", text: "answer" }],
        providerMetadata: {
            openrouter: {
                reasoning_details: [{ type: "reasoning.text", text: "thinking" }],
            },
        },
        thoughtSignature: "tool-signature",
    }));
});
(0, bun_test_1.test)("context ledger factory is provided under the shared service key", function () {
    var factory = (0, src_1.createContextLedgerFactory)();
    (0, bun_test_1.expect)(src_1.contextLedgerFactory.id).toBe("context-ledger.factory");
    (0, bun_test_1.expect)(factory.create).toBeTypeOf("function");
    (0, bun_test_1.expect)(factory.restore).toBeTypeOf("function");
});
(0, bun_test_1.test)("context ledger restores an injected next-step message", function () {
    var events = [
        {
            type: "turn.submitted",
            id: "turn-1",
            text: "start",
            byteLength: 5,
            lineCount: 1,
            sha256: "x",
        },
        {
            type: "turn.input",
            turnID: "turn-1",
            inputID: "in-1",
            text: "also do X",
            delivery: "next-step",
        },
        { type: "content.done", id: "turn-1", text: "done" },
        { type: "turn.finished", id: "turn-1", stopReason: "done" },
    ];
    var factory = (0, src_1.createContextLedgerFactory)();
    var context = factory.create();
    factory.restore(context, events);
    (0, bun_test_1.expect)(context.snapshot().entries).toEqual([
        bun_test_1.expect.objectContaining({
            id: "turn-1:user",
            role: "user",
            content: "start",
        }),
        bun_test_1.expect.objectContaining({
            id: "in-1:user",
            role: "user",
            content: "also do X",
        }),
        bun_test_1.expect.objectContaining({
            id: "turn-1:assistant",
            role: "assistant",
            content: "done",
        }),
    ]);
});
