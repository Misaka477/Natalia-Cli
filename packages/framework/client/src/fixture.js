"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFakeBackend = createFakeBackend;
var node_crypto_1 = require("node:crypto");
function createFakeBackend() {
    var sessionID = "ses_m0_spike";
    var sink;
    var activeTurn;
    var submission;
    var cancelled = new Set();
    var publish = function (event) { return sink === null || sink === void 0 ? void 0 : sink(event); };
    var checkActive = function (id) { return activeTurn === id; };
    var publishStatusSnapshot = function (detail) {
        if (detail === void 0) { detail = "fixture"; }
        return publish({
            type: "status.snapshot",
            model: "gpt-5.5 fixture",
            provider: "fake",
            context: "12.5k/200k 6%",
            step: activeTurn ? "1/1000" : "idle",
            permissions: "read-only placeholder",
            cwd: process.cwd(),
            background: detail,
        });
    };
    function shortResponse(id) {
        return __awaiter(this, void 0, void 0, function () {
            var startedAt, _i, _a, chunk, _b, _c, chunk;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        startedAt = Date.now();
                        publish({
                            type: "status.update",
                            status: "thinking",
                            detail: "streaming fixture",
                        });
                        _i = 0, _a = [
                            "分析输入完整性",
                            "，准备展示工具占位",
                            "，生成最终内容。",
                        ];
                        _d.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        chunk = _a[_i];
                        return [4 /*yield*/, Bun.sleep(15)];
                    case 2:
                        _d.sent();
                        if (!checkActive(id))
                            return [2 /*return*/];
                        publish({ type: "thinking.delta", id: id, text: chunk, visible: true });
                        _d.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        publish({ type: "thinking.done", id: id });
                        publishStatusSnapshot("thinking complete");
                        publish({
                            type: "tool.update",
                            id: id,
                            name: "fake_snapshot",
                            callID: "snapshot_1",
                            status: "receiving_arguments",
                            summary: "collecting arguments",
                            argumentsDelta: '{"path":"apps/tui","apiToken":"secret-value",',
                            metadata: { kind: "generic" },
                            startedAt: startedAt,
                        });
                        return [4 /*yield*/, Bun.sleep(5)];
                    case 5:
                        _d.sent();
                        publish({
                            type: "tool.update",
                            id: id,
                            name: "fake_snapshot",
                            callID: "snapshot_1",
                            status: "queued",
                            summary: "queued after complete arguments",
                            argumentsDelta: '"limit":20}',
                            metadata: { kind: "generic" },
                            startedAt: startedAt,
                        });
                        return [4 /*yield*/, Bun.sleep(15)];
                    case 6:
                        _d.sent();
                        publish({
                            type: "tool.update",
                            id: id,
                            name: "fake_snapshot",
                            callID: "snapshot_1",
                            status: "awaiting_approval",
                            summary: "waiting for M7 approval modal",
                            metadata: { kind: "generic" },
                            startedAt: startedAt,
                        });
                        publish({
                            type: "approval.request",
                            id: "apr_m0",
                            title: "Approve workspace snapshot?",
                            preview: "fake_snapshot would inspect workspace state",
                            detail: "fake_snapshot\n- reads apps/tui/src\n- collects test metadata\n- never sends secrets\n\nThis is a M7 fixture detail pager.",
                            keyArguments: ["path=apps/tui", "limit=20"],
                            sensitive: false,
                        });
                        publish({
                            type: "question.request",
                            id: "q_m0",
                            title: "Question fixture",
                            questions: [
                                {
                                    id: "format",
                                    header: "Format",
                                    question: "Choose response format",
                                    options: [
                                        { label: "继续", description: "Continue with markdown output" },
                                        { label: "取消", description: "Stop the fake fixture" },
                                    ],
                                    custom: true,
                                },
                                {
                                    id: "checks",
                                    header: "Checks",
                                    question: "Select validation checks",
                                    multiple: true,
                                    options: [
                                        { label: "format", description: "Run format check" },
                                        { label: "typecheck", description: "Run TypeScript check" },
                                        { label: "smoke", description: "Run terminal smoke" },
                                    ],
                                    custom: true,
                                },
                            ],
                        });
                        publish({
                            type: "tool.update",
                            id: id,
                            name: "fake_snapshot",
                            callID: "snapshot_1",
                            status: "running",
                            summary: "running after placeholder approval",
                            metadata: { kind: "generic" },
                            startedAt: startedAt,
                        });
                        publish({
                            type: "tool.update",
                            id: id,
                            name: "fake_snapshot",
                            callID: "snapshot_1",
                            status: "succeeded",
                            summary: "snapshot fixture ready",
                            result: "workspace: apps/tui\nfiles: src/context/state.tsx, src/routes/session/SessionRoute.tsx\n安全字段已脱敏。\n".repeat(12),
                            metadata: { kind: "generic" },
                            startedAt: startedAt,
                            endedAt: Date.now(),
                        });
                        for (_b = 0, _c = [
                            "# Streaming final\n\n- 收到 ",
                            "".concat(submission.byteLength, " bytes"),
                            "，SHA-256 已验证。\n\n```ts\nconst ok = ",
                            "true;\n```\n\n这是 final content，包含 CJK、emoji 🙂 和 e\u0301。",
                        ]; _b < _c.length; _b++) {
                            chunk = _c[_b];
                            publish({ type: "content.delta", id: id, text: chunk });
                        }
                        publish({ type: "content.done", id: id });
                        publishStatusSnapshot("final streamed");
                        return [2 /*return*/];
                }
            });
        });
    }
    function longResponse(id) {
        return __awaiter(this, void 0, void 0, function () {
            var thinkingParas, _i, thinkingParas_1, para, toolIndex, toolName, startedAt, line, paragraph, totalLines, lineIndex, chunk;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        publish({
                            type: "status.update",
                            status: "thinking",
                            detail: "generating long test output",
                        });
                        thinkingParas = [
                            "正在分析输入内容的结构和语义特征。",
                            "检测到测试指令，将生成包含多段思考、多次工具调用和大量最终内容的输出。",
                            "第一步：识别输入中的关键信息点。",
                            "第二步：按优先级排序需要处理的任务。",
                            "第三步：构建处理策略和工具调用序列。",
                            "第四步：验证各步骤的前置条件和依赖关系。",
                            "第五步：整体方案确认，开始执行。",
                        ];
                        _i = 0, thinkingParas_1 = thinkingParas;
                        _a.label = 1;
                    case 1:
                        if (!(_i < thinkingParas_1.length)) return [3 /*break*/, 4];
                        para = thinkingParas_1[_i];
                        if (!checkActive(id))
                            return [2 /*return*/];
                        publish({ type: "thinking.delta", id: id, text: para + "\n\n" });
                        return [4 /*yield*/, Bun.sleep(40)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        publish({ type: "thinking.done", id: id });
                        toolIndex = 0;
                        _a.label = 5;
                    case 5:
                        if (!(toolIndex < 8)) return [3 /*break*/, 10];
                        if (!checkActive(id))
                            return [2 /*return*/];
                        toolName = [
                            "apply_edits",
                            "todowrite",
                            "run_shell",
                            "background_process",
                            "task",
                            "pty_session",
                            "sandbox_diff",
                            "skill",
                        ][toolIndex];
                        startedAt = Date.now();
                        publish({
                            type: "tool.update",
                            id: id,
                            name: toolName,
                            callID: "".concat(toolName, "_").concat(toolIndex),
                            status: "receiving_arguments",
                            summary: "receiving ".concat(toolName, " arguments"),
                            argumentsDelta: JSON.stringify({
                                target: "apps/tui",
                                index: toolIndex,
                            }),
                            metadata: { kind: toolName },
                            startedAt: startedAt,
                        });
                        return [4 /*yield*/, Bun.sleep(10)];
                    case 6:
                        _a.sent();
                        publish({
                            type: "tool.update",
                            id: id,
                            name: toolName,
                            callID: "".concat(toolName, "_").concat(toolIndex),
                            status: "running",
                            summary: "executing ".concat(toolName, " on workspace"),
                            metadata: { kind: toolName },
                            startedAt: startedAt,
                        });
                        return [4 /*yield*/, Bun.sleep(30)];
                    case 7:
                        _a.sent();
                        publish({
                            type: "tool.update",
                            id: id,
                            name: toolName,
                            callID: "".concat(toolName, "_").concat(toolIndex),
                            status: "succeeded",
                            summary: "".concat(toolName, " completed (").concat(Math.floor(Math.random() * 50) + 10, " results)"),
                            result: toolName === "apply_edits"
                                ? "--- a/apps/tui/src/routes/session/SessionRoute.tsx\n+++ b/apps/tui/src/routes/session/SessionRoute.tsx\n@@ -339,6 +339,10 @@\n function ToolBlockView(props: {\n   block: MessageBlock;\n-  toolDetails: TuiPreferences[\"toolDetails\"];\n+  toolDetails: TuiPreferences[\"toolDetails\"];\n+  diffStyle: TuiPreferences[\"diffStyle\"];\n+  terminalWidth: number;\n }) {\n+  // Native split diff rendering follows terminal width.\n   const tool = () => props.block.tool!;\n"
                                : "".concat(toolName, " result summary\n").repeat(18),
                            metadata: { kind: toolName },
                            startedAt: startedAt,
                            endedAt: Date.now(),
                        });
                        return [4 /*yield*/, Bun.sleep(20)];
                    case 8:
                        _a.sent();
                        _a.label = 9;
                    case 9:
                        toolIndex++;
                        return [3 /*break*/, 5];
                    case 10:
                        publish({
                            type: "approval.request",
                            id: "apr_long",
                            title: "Approve batch file edit?",
                            preview: "This would modify 3 files in the workspace.",
                            detail: "diff -- fake\n--- a/apps/tui/src/dialog/DialogLayer.tsx\n+++ b/apps/tui/src/dialog/DialogLayer.tsx\n@@\n+ modal framework fixture\n",
                            keyArguments: ["files=3", "risk=medium"],
                        });
                        publish({
                            type: "question.request",
                            id: "q_long",
                            title: "Select output format",
                            options: ["plain text", "markdown", "json"],
                        });
                        publish({
                            type: "status.update",
                            status: "streaming",
                            detail: "writing final output",
                        });
                        line = "这是超长输出测试内容。OpenTUI 需要稳定处理持续流式内容，包含中文、English、emoji 🙂 和组合字符 e\u0301。";
                        paragraph = Array.from({ length: 8 }, function (_, i) { return "\u7B2C ".concat(i + 1, " \u6BB5\uFF1A").concat(line); }).join("\n\n");
                        totalLines = 160;
                        lineIndex = 0;
                        _a.label = 11;
                    case 11:
                        if (!(lineIndex < totalLines)) return [3 /*break*/, 14];
                        if (!checkActive(id))
                            return [2 /*return*/];
                        chunk = "[".concat(lineIndex + 1, "/").concat(totalLines, "] ").concat(paragraph, "\n\n");
                        publish({ type: "content.delta", id: id, text: chunk });
                        return [4 /*yield*/, Bun.sleep(lineIndex % 16 === 0 ? 12 : 2)];
                    case 12:
                        _a.sent();
                        _a.label = 13;
                    case 13:
                        lineIndex++;
                        return [3 /*break*/, 11];
                    case 14:
                        publish({ type: "content.done", id: id });
                        publishStatusSnapshot("long final streamed");
                        publish({
                            type: "snapshot.created",
                            id: "snap_long",
                            files: [
                                "apps/tui/src",
                                "apps/tui/test",
                                ".kilo/plans/execution/m05-shell-editor.zh-CN.md",
                            ],
                        });
                        publish({
                            type: "status.update",
                            status: "ready",
                            detail: "long output test complete (~".concat(totalLines, " blocks)"),
                        });
                        return [2 /*return*/];
                }
            });
        });
    }
    function retryResponse(id) {
        return __awaiter(this, void 0, void 0, function () {
            var waitMs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        publish({
                            type: "status.update",
                            status: "thinking",
                            detail: "retry fixture first attempt",
                        });
                        publish({
                            type: "content.delta",
                            id: id,
                            attempt: 1,
                            text: "# Retry demo\n\npartial duplicate",
                        });
                        waitMs = 1200;
                        publish({
                            type: "step.retry",
                            id: id,
                            operation: "llm_step",
                            step: 1,
                            attempt: 2,
                            maxAttempts: 3,
                            reason: "timeout",
                            waitMs: waitMs,
                        });
                        return [4 /*yield*/, Bun.sleep(waitMs)];
                    case 1:
                        _a.sent();
                        publish({
                            type: "content.delta",
                            id: id,
                            attempt: 2,
                            text: "# Retry demo\n\npartial duplicate",
                        });
                        publish({
                            type: "content.delta",
                            id: id,
                            attempt: 2,
                            text: " content committed once.\n",
                        });
                        publish({ type: "content.done", id: id, attempt: 2 });
                        publish({
                            type: "step.retry.cleared",
                            id: id,
                            operation: "llm_step",
                            step: 1,
                            attempts: 2,
                        });
                        return [2 /*return*/];
                }
            });
        });
    }
    function compactResponse(id, text) {
        return __awaiter(this, void 0, void 0, function () {
            var instruction;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        instruction = text.replace(/^\/compact\s*/i, "").trim() || undefined;
                        publish({
                            type: "context.status",
                            used: 172000,
                            max: 200000,
                            source: "pending_estimate",
                            thresholdPercent: 85,
                            reserved: 50000,
                            trigger: instruction ? "manual" : "ratio",
                        });
                        publish({
                            type: "compaction.begin",
                            id: "cmp_".concat(id),
                            trigger: "manual",
                            beforeTokens: 172000,
                            maxTokens: 200000,
                            thresholdPercent: 85,
                            reservedTokens: 50000,
                            instruction: instruction,
                            attempt: 1,
                            startedAt: new Date().toISOString(),
                        });
                        return [4 /*yield*/, Bun.sleep(100)];
                    case 1:
                        _a.sent();
                        publish({
                            type: "step.retry",
                            id: "cmp_".concat(id),
                            operation: "compaction",
                            step: 0,
                            attempt: 2,
                            maxAttempts: 3,
                            waitMs: 300,
                            reason: "timeout",
                        });
                        return [4 /*yield*/, Bun.sleep(300)];
                    case 2:
                        _a.sent();
                        publish({
                            type: "step.retry.cleared",
                            id: "cmp_".concat(id),
                            operation: "compaction",
                            step: 0,
                            attempts: 2,
                        });
                        publish({
                            type: "compaction.end",
                            id: "cmp_".concat(id),
                            trigger: "manual",
                            success: true,
                            beforeTokens: 172000,
                            afterTokens: 43000,
                            durationMs: 400,
                            attempts: 2,
                        });
                        publish({
                            type: "context.status",
                            used: 43000,
                            max: 200000,
                            source: "compaction_estimate",
                            thresholdPercent: 85,
                            reserved: 50000,
                        });
                        publish({
                            type: "content.delta",
                            id: id,
                            text: "Compaction fixture complete.\n",
                        });
                        publish({ type: "content.done", id: id });
                        return [2 /*return*/];
                }
            });
        });
    }
    function checkpointResponse(id, text) {
        return __awaiter(this, void 0, void 0, function () {
            var command, dryRun, checkpointID;
            return __generator(this, function (_a) {
                command = text.trim().toLowerCase();
                if (command.startsWith("/checkpoints")) {
                    publish({
                        type: "content.delta",
                        id: id,
                        text: "checkpoint_0 step=0 reason=baseline files=3 changes=0 tokens=128 complete\ncheckpoint_1 step=2 reason=manual files=4 changes=1 tokens=512 complete",
                    });
                    publish({ type: "content.done", id: id });
                    return [2 /*return*/];
                }
                if (command.startsWith("/checkpoint")) {
                    publish({
                        type: "checkpoint.created",
                        id: "checkpoint_1",
                        reason: "manual",
                        sequence: 1,
                        complete: true,
                        files: 4,
                        changes: 1,
                        contextJournalOffset: 6,
                        step: 2,
                        tokenEstimate: 512,
                        diskUsageBytes: 4096,
                    });
                    publish({
                        type: "content.delta",
                        id: id,
                        text: "Created checkpoint_1 with durable workspace + context snapshot.",
                    });
                    publish({ type: "content.done", id: id });
                    return [2 /*return*/];
                }
                if (command.startsWith("/rollback")) {
                    dryRun = command.includes("--dry-run");
                    checkpointID = command.includes("last")
                        ? "checkpoint_1"
                        : "checkpoint_0";
                    publish({
                        type: "rollback.previewed",
                        preview: {
                            checkpointID: checkpointID,
                            dryRun: dryRun,
                            changes: [{ kind: "delete", path: "test_example.py" }],
                            context: {
                                truncateMessages: 3,
                                targetJournalOffset: 1,
                                targetStep: 0,
                                targetTokens: 128,
                                compactionGeneration: 0,
                            },
                            resources: [
                                {
                                    kind: "terminal",
                                    id: "terminal_m11",
                                    action: "stop",
                                    summary: "running terminal cannot time travel",
                                },
                                {
                                    kind: "workflow",
                                    id: "wf_fixture",
                                    action: "invalidate",
                                    summary: "pending workflow modal invalidated",
                                },
                            ],
                            ignoredFiles: 1,
                            diskUsageBytes: 4096,
                            complete: true,
                            warnings: [],
                        },
                    });
                    if (!dryRun) {
                        publish({
                            type: "rollback.begin",
                            checkpointID: checkpointID,
                            safetyCheckpointID: "checkpoint_2",
                        });
                        publish({
                            type: "rollback.end",
                            checkpointID: checkpointID,
                            safetyCheckpointID: "checkpoint_2",
                            restoredFiles: 3,
                            deletedFiles: 1,
                            contextJournalOffset: 1,
                            step: 0,
                        });
                    }
                    publish({
                        type: "content.delta",
                        id: id,
                        text: dryRun
                            ? "Rollback dry-run preview rendered. No files changed."
                            : "Rollback applied atomically with safety checkpoint checkpoint_2.",
                    });
                    publish({ type: "content.done", id: id });
                }
                return [2 /*return*/];
            });
        });
    }
    function terminalResponse(id) {
        return __awaiter(this, void 0, void 0, function () {
            var target;
            return __generator(this, function (_a) {
                target = {
                    kind: "sandbox",
                    sandboxID: "box_m11",
                    root: "/tmp/kilo/m11-box",
                    isolationLevel: "workspace",
                };
                publish({
                    type: "terminal.action",
                    id: "terminal_m11",
                    action: "attach",
                    target: target,
                });
                publish({
                    type: "terminal.update",
                    id: "terminal_m11",
                    command: "bash --noprofile --norc",
                    cwd: "/tmp/kilo/m11-box",
                    status: "running",
                    attached: true,
                    rows: 24,
                    cols: 80,
                    prompt: "$",
                    activity: "waiting",
                    tail: "Natalia terminal smoke\n$",
                    transcript: "Natalia terminal smoke\n$",
                    lastAction: "attach",
                    target: target,
                });
                publish({
                    type: "terminal.action",
                    id: "terminal_m11",
                    action: "write",
                    redacted: true,
                    target: target,
                });
                publish({
                    type: "terminal.update",
                    id: "terminal_m11",
                    command: "bash --noprofile --norc",
                    cwd: "/tmp/kilo/m11-box",
                    status: "running",
                    attached: true,
                    rows: 40,
                    cols: 120,
                    prompt: "$",
                    activity: "waiting",
                    tail: "Natalia terminal smoke\n[redacted]\n$",
                    transcript: "Natalia terminal smoke\n[redacted]\n$",
                    lastAction: "resize",
                    target: target,
                });
                publish({
                    type: "content.delta",
                    id: id,
                    text: "Terminal fixture complete.\n",
                });
                publish({ type: "content.done", id: id });
                return [2 /*return*/];
            });
        });
    }
    function sandboxResponse(id) {
        return __awaiter(this, void 0, void 0, function () {
            var target;
            return __generator(this, function (_a) {
                target = {
                    kind: "sandbox",
                    sandboxID: "box_m11",
                    root: "/tmp/kilo/m11-box",
                    isolationLevel: "workspace",
                };
                publish({
                    type: "sandbox.update",
                    id: "box_m11",
                    status: "changed",
                    root: "/tmp/kilo/m11-box",
                    isolationLevel: "workspace",
                    changedFiles: 5,
                    runningResources: 1,
                    target: target,
                    resourcePolicy: "workspace isolation only; not container/VM security",
                });
                publish({
                    type: "sandbox.diff",
                    id: "box_m11",
                    changes: [
                        { kind: "add", path: "new.ts" },
                        { kind: "modify", path: "src/app.ts" },
                        { kind: "delete", path: "old.ts" },
                        { kind: "rename", oldPath: "a.ts", path: "b.ts" },
                        { kind: "mode", path: "script.sh", mode: "100755" },
                    ],
                });
                publish({
                    type: "sandbox.audit",
                    id: "box_m11",
                    action: "skill-script",
                    target: target,
                    approvalRequired: true,
                    checkpointPolicy: "sandbox_manifest",
                    message: "Skill/workflow activity in sandbox still requires approval.",
                });
                publish({ type: "content.delta", id: id, text: "Sandbox fixture complete.\n" });
                publish({ type: "content.done", id: id });
                return [2 /*return*/];
            });
        });
    }
    function modalResponse(id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                publish({
                    type: "status.update",
                    status: "awaiting input",
                    detail: "modal queue fixture",
                });
                publish({
                    type: "question.request",
                    id: "q_modal_first",
                    title: "Queued question",
                    options: ["alpha", "beta"],
                });
                publish({
                    type: "approval.request",
                    id: "apr_modal_priority",
                    title: "Priority approval",
                    preview: "Approval should appear before queued question.",
                    detail: "This request has higher priority than questions and should be active first.",
                    keyArguments: ["priority=approval", "queue=stable"],
                });
                publish({
                    type: "question.request",
                    id: "q_modal_multi",
                    title: "Multi question",
                    questions: [
                        {
                            id: "one",
                            header: "One",
                            question: "Pick one option",
                            options: [{ label: "A" }, { label: "B" }],
                            custom: true,
                        },
                        {
                            id: "many",
                            header: "Many",
                            question: "Pick multiple options",
                            options: [{ label: "X" }, { label: "Y" }],
                            multiple: true,
                            custom: true,
                        },
                    ],
                });
                publish({ type: "content.delta", id: id, text: "Modal fixture queued.\n" });
                publish({ type: "content.done", id: id });
                return [2 /*return*/];
            });
        });
    }
    return {
        canReloadConfig: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, activeTurn
                            ? { allowed: false, reason: "fixture turn is running" }
                            : { allowed: true }];
                });
            });
        },
        reloadConfig: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    // The precheck says "allowed" because nothing is running; the action says
                    // "nothing to apply" because a fixture has no configuration on disk. Two
                    // different answers, which is the point of reporting them separately.
                    return [2 /*return*/, {
                            applied: false,
                            reason: "the fixture runtime has no configuration on disk",
                        }];
                });
            });
        },
        start: function (onEvent) {
            sink = onEvent;
            publish({
                type: "session.created",
                sessionID: sessionID,
                title: "M7 Natalia TUI modals",
            });
            publish({
                type: "status.update",
                status: "ready",
                detail: "fake backend connected",
            });
            publish({ type: "session.ready", sessionID: sessionID });
            publishStatusSnapshot("boot ready");
        },
        submitAndWait: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.submit(typeof input === "string" ? input : ((_a = input.text) !== null && _a !== void 0 ? _a : ""))];
                        case 1: return [2 /*return*/, _b.sent()];
                    }
                });
            });
        },
        submit: function (text) {
            return __awaiter(this, void 0, void 0, function () {
                var id;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            id = "turn_".concat(Date.now().toString(36));
                            activeTurn = id;
                            submission = {
                                type: "turn.submitted",
                                id: id,
                                text: text,
                                byteLength: new TextEncoder().encode(text).byteLength,
                                lineCount: text.length === 0 ? 1 : text.split("\n").length,
                                sha256: (0, node_crypto_1.createHash)("sha256").update(text).digest("hex"),
                            };
                            publish(submission);
                            if (!text.trim().toLowerCase().startsWith("/modal")) return [3 /*break*/, 2];
                            return [4 /*yield*/, modalResponse(id)];
                        case 1:
                            _a.sent();
                            return [3 /*break*/, 20];
                        case 2:
                            if (!text.trim().toLowerCase().startsWith("/terminal")) return [3 /*break*/, 4];
                            return [4 /*yield*/, terminalResponse(id)];
                        case 3:
                            _a.sent();
                            return [3 /*break*/, 20];
                        case 4:
                            if (!text.trim().toLowerCase().startsWith("/sandbox")) return [3 /*break*/, 6];
                            return [4 /*yield*/, sandboxResponse(id)];
                        case 5:
                            _a.sent();
                            return [3 /*break*/, 20];
                        case 6:
                            if (!text.trim().toLowerCase().startsWith("/compact")) return [3 /*break*/, 8];
                            return [4 /*yield*/, compactResponse(id, text)];
                        case 7:
                            _a.sent();
                            return [3 /*break*/, 20];
                        case 8:
                            if (!text.trim().toLowerCase().startsWith("/checkpoint")) return [3 /*break*/, 10];
                            return [4 /*yield*/, checkpointResponse(id, text)];
                        case 9:
                            _a.sent();
                            return [3 /*break*/, 20];
                        case 10:
                            if (!text.trim().toLowerCase().startsWith("/checkpoints")) return [3 /*break*/, 12];
                            return [4 /*yield*/, checkpointResponse(id, text)];
                        case 11:
                            _a.sent();
                            return [3 /*break*/, 20];
                        case 12:
                            if (!text.trim().toLowerCase().startsWith("/rollback")) return [3 /*break*/, 14];
                            return [4 /*yield*/, checkpointResponse(id, text)];
                        case 13:
                            _a.sent();
                            return [3 /*break*/, 20];
                        case 14:
                            if (!text.trim().toLowerCase().startsWith("/retry")) return [3 /*break*/, 16];
                            return [4 /*yield*/, retryResponse(id)];
                        case 15:
                            _a.sent();
                            return [3 /*break*/, 20];
                        case 16:
                            if (!text.trim().toLowerCase().startsWith("/long")) return [3 /*break*/, 18];
                            return [4 /*yield*/, longResponse(id)];
                        case 17:
                            _a.sent();
                            return [3 /*break*/, 20];
                        case 18: return [4 /*yield*/, shortResponse(id)];
                        case 19:
                            _a.sent();
                            _a.label = 20;
                        case 20:
                            if (!checkActive(id) || cancelled.has(id))
                                return [2 /*return*/, submission];
                            publish({
                                type: "snapshot.created",
                                id: "snap_m0",
                                files: ["apps/tui", ".kilo/plans/execution/m05-shell-editor.zh-CN.md"],
                            });
                            publish({
                                type: "status.update",
                                status: "ready",
                                detail: "fake turn finished",
                            });
                            publish({ type: "turn.finished", id: id, stopReason: "done" });
                            activeTurn = undefined;
                            return [2 /*return*/, submission];
                    }
                });
            });
        },
        cancel: function (reason) {
            if (reason === void 0) { reason = "user cancel"; }
            if (!activeTurn)
                return;
            var id = activeTurn;
            activeTurn = undefined;
            cancelled.add(id);
            publish({ type: "turn.cancelled", id: id, reason: reason });
            publish({ type: "turn.finished", id: id, stopReason: "cancelled" });
            publish({ type: "status.update", status: "ready", detail: "cancelled" });
        },
        snapshot: function () {
            var event = {
                type: "snapshot.created",
                id: "snap_".concat(Date.now().toString(36)),
                files: ["apps/tui/src", "apps/tui/test"],
            };
            publish(event);
            return event;
        },
        diagnostic: function (message, level) {
            if (level === void 0) { level = "warning"; }
            publish({ type: "diagnostic", level: level, message: message });
        },
        lastSubmission: function () {
            return submission;
        },
        respondApproval: function (response) {
            publish({
                type: "approval.response",
                id: response.requestID,
                decision: response.decision,
                feedback: response.feedback,
            });
            // The fixture keeps no register of pending requests, so it accepts whatever
            // it is handed. Saying so is the point: a scripted backend that reported
            // refusals it cannot detect would be inventing them.
            return { accepted: true };
        },
        respondQuestion: function (response) {
            publish({
                type: "question.response",
                id: response.requestID,
                answers: response.answers,
                rejected: response.rejected,
            });
            return { accepted: true };
        },
    };
}
