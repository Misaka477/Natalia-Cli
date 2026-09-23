"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
(0, bun_test_1.test)("shell tools classify separately from terminal and generic tools", function () {
    (0, bun_test_1.expect)((0, src_1.classifyTool)("run_shell")).toBe("shell");
    (0, bun_test_1.expect)((0, src_1.classifyTool)("bash")).toBe("shell");
    (0, bun_test_1.expect)((0, src_1.classifyTool)("terminal_create")).toBe("terminal");
});
(0, bun_test_1.test)("file tools classify into dedicated presentation kinds", function () {
    (0, bun_test_1.expect)((0, src_1.classifyTool)("read_file")).toBe("read");
    (0, bun_test_1.expect)((0, src_1.classifyTool)("write_file")).toBe("write");
    (0, bun_test_1.expect)((0, src_1.classifyTool)("grep")).toBe("grep");
    (0, bun_test_1.expect)((0, src_1.classifyTool)("glob")).toBe("glob");
});
(0, bun_test_1.test)("interaction tools classify into dedicated presentation kinds", function () {
    (0, bun_test_1.expect)((0, src_1.classifyTool)("web_fetch")).toBe("webfetch");
    (0, bun_test_1.expect)((0, src_1.classifyTool)("web_search")).toBe("websearch");
    (0, bun_test_1.expect)((0, src_1.classifyTool)("ask_user")).toBe("question");
    (0, bun_test_1.expect)((0, src_1.classifyTool)("agent_spawn")).toBe("subagent");
    (0, bun_test_1.expect)((0, src_1.classifyTool)("skill_load")).toBe("skill");
});
(0, bun_test_1.test)("tool output collapse follows line and character budgets", function () {
    (0, bun_test_1.expect)((0, src_1.collapseToolOutput)("one\ntwo", 2, 20)).toEqual({
        output: "one\ntwo",
        overflow: false,
    });
    (0, bun_test_1.expect)((0, src_1.collapseToolOutput)("one\ntwo\nthree", 2, 20)).toEqual({
        output: "one\ntwo\n…",
        overflow: true,
    });
    (0, bun_test_1.expect)((0, src_1.collapseToolOutput)("abcdefgh", 2, 5)).toEqual({
        output: "abcd…",
        overflow: true,
    });
});
(0, bun_test_1.test)("shell output projection strips CSI and OSC control sequences", function () {
    (0, bun_test_1.expect)((0, src_1.stripAnsiOutput)("\u001b[32mok\u001b[0m")).toBe("ok");
    (0, bun_test_1.expect)((0, src_1.stripAnsiOutput)("before\u001b]0;title\u0007after")).toBe("beforeafter");
});
(0, bun_test_1.test)("projection cache reuses long markdown and tool projections", function () {
    var cache = new src_1.ProjectionCache();
    var text = "# title\n\n" + "内容🙂e\u0301\n".repeat(2000);
    var first = cache.markdownSegment("m", 1, text);
    var second = cache.markdownSegment("m", 1, text);
    (0, bun_test_1.expect)(second).toBe(first);
    (0, bun_test_1.expect)(cache.stats.markdownHits).toBe(1);
    var tool = cache.toolResult("tool", 1, "line\n".repeat(100));
    (0, bun_test_1.expect)(cache.toolResult("tool", 1, "line\n".repeat(100))).toBe(tool);
    (0, bun_test_1.expect)(cache.stats.toolHits).toBe(1);
    (0, bun_test_1.expect)((0, src_1.shouldLazyRenderDetail)("x".repeat(5000))).toBe(true);
});
(0, bun_test_1.test)("event batcher throttles background projection while modal is active", function () {
    var batcher = new src_1.EventBatcher();
    batcher.push("a");
    (0, bun_test_1.expect)(batcher.shouldFlush({ now: 0, modalActive: true })).toBe(true);
    batcher.flush(0);
    batcher.push("b");
    (0, bun_test_1.expect)(batcher.shouldFlush({ now: 50, modalActive: true })).toBe(false);
    (0, bun_test_1.expect)(batcher.shouldFlush({ now: 120, modalActive: true })).toBe(true);
});
(0, bun_test_1.test)("tool result projection turns sandbox JSON into readable change summaries", function () {
    var result = (0, src_1.resultView)(JSON.stringify([
        {
            kind: "modify",
            path: "sandbox-file.txt",
            content: "sandbox write test content",
        },
    ]), 8, 1200, { kind: "diff", name: "sandbox_diff" });
    (0, bun_test_1.expect)(result.summary).toBe("1 sandbox change");
    (0, bun_test_1.expect)(result.preview).toBe("Modified sandbox-file.txt\n  sandbox write test content");
    (0, bun_test_1.expect)(result.detail).toContain('"kind":"modify"');
});
(0, bun_test_1.test)("generic structured result projects scalar fields without raw JSON", function () {
    var result = (0, src_1.resultView)(JSON.stringify({ id: "proc_1", status: "running", pid: 1234 }), 8, 1200, { name: "process_start" });
    (0, bun_test_1.expect)(result.preview).toBe("id: proc_1\nstatus: running\npid: 1234");
    (0, bun_test_1.expect)(result.preview).not.toContain("{");
});
(0, bun_test_1.test)("browser and question JSON results project as human-readable summaries", function () {
    var browser = (0, src_1.resultView)(JSON.stringify({
        url: "https://example.com/",
        status: 200,
        title: "Example Domain",
        contentType: "text/html",
        textPreview: "Example Domain documentation preview",
    }), 8, 1200, { name: "browser_visit" });
    (0, bun_test_1.expect)(browser.summary).toBe("Visited Example Domain · HTTP 200");
    (0, bun_test_1.expect)(browser.preview).toContain("Preview: Example Domain");
    var question = (0, src_1.resultView)(JSON.stringify({ answers: [["选项1"]] }), 8, 1200, {
        name: "ask_user",
    });
    (0, bun_test_1.expect)(question.summary).toBe("User answered");
    (0, bun_test_1.expect)(question.preview).toBe("Answer: 选项1");
});
(0, bun_test_1.test)("projectToolRender decodes a tool's self-projected card", function () {
    var intent = (0, src_1.projectToolRender)({
        render: {
            kind: "read",
            title: "src/index.ts",
            summary: "1,024 chars",
            body: "export const x = 1;",
            meta: [["lines", "1"]],
        },
    });
    (0, bun_test_1.expect)(intent).toEqual({
        kind: "read",
        title: "src/index.ts",
        summary: "1,024 chars",
        body: "export const x = 1;",
        meta: [["lines", "1"]],
    });
});
(0, bun_test_1.test)("projectToolRender ignores a missing or malformed intent", function () {
    (0, bun_test_1.expect)((0, src_1.projectToolRender)({})).toBeUndefined();
    (0, bun_test_1.expect)((0, src_1.projectToolRender)({ render: "read" })).toBeUndefined();
    (0, bun_test_1.expect)((0, src_1.projectToolRender)({ render: { kind: "read" } })).toBeUndefined();
    (0, bun_test_1.expect)((0, src_1.projectToolRender)({ render: { title: "x", summary: "y" } })).toBeUndefined();
});
(0, bun_test_1.test)("projectToolCall decodes the call card from metadata.call", function () {
    var call = (0, src_1.projectToolCall)({
        call: { kind: "terminal", title: "make build", summary: "run" },
    });
    (0, bun_test_1.expect)(call).toEqual({
        kind: "terminal",
        title: "make build",
        summary: "run",
    });
    (0, bun_test_1.expect)((0, src_1.projectToolCall)({ render: { kind: "read", title: "x", summary: "y" } })).toBeUndefined();
});
