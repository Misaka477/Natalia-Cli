"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var index_1 = require("../src/index");
(0, bun_test_1.test)("agentSystemPrompt prepends the shared preamble then the persona", function () {
    var navi = (0, index_1.agentSystemPrompt)("navi");
    // Preamble first (shared discipline), then the persona tag.
    (0, bun_test_1.expect)(navi.startsWith((0, index_1.agentPromptPreamble)())).toBe(true);
    (0, bun_test_1.expect)(navi).toContain("<navi_chat_persona>");
    (0, bun_test_1.expect)(navi).toContain("</navi_chat_persona>");
    // The persona follows the preamble.
    (0, bun_test_1.expect)(navi.indexOf("<navi_chat_persona>")).toBeGreaterThan(navi.indexOf((0, index_1.agentPromptPreamble)()));
});
(0, bun_test_1.test)("each agent gets its own persona under the same preamble", function () {
    for (var _i = 0, _a = [
        ["natalia", "<natalia_cli_persona>"],
        ["navi", "<navi_chat_persona>"],
        ["nia", "<nia_chat_persona>"],
    ]; _i < _a.length; _i++) {
        var _b = _a[_i], agent = _b[0], tag = _b[1];
        var prompt_1 = (0, index_1.agentSystemPrompt)(agent);
        (0, bun_test_1.expect)(prompt_1.startsWith((0, index_1.agentPromptPreamble)())).toBe(true);
        (0, bun_test_1.expect)(prompt_1).toContain(tag);
    }
});
(0, bun_test_1.test)("extra static text is appended after the persona", function () {
    var prompt = (0, index_1.agentSystemPrompt)("nia", "Use the tools for filesystem work.");
    (0, bun_test_1.expect)(prompt.endsWith("Use the tools for filesystem work.")).toBe(true);
});
