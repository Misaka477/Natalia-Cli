"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var service_graph_1 = require("../src/service-graph");
function file(path, text) {
    return { path: path, pkg: (0, service_graph_1.packageOf)(path), text: text };
}
var TOKEN = function (name, id, extra) {
    if (extra === void 0) { extra = ""; }
    return "export const ".concat(name, " = defineService<object>(\"").concat(id, "\", {\n  scope: \"workspace\",\n  capability: \"services\",").concat(extra, "\n});");
};
(0, bun_test_1.test)("packageOf classifies plugin and framework paths", function () {
    (0, bun_test_1.expect)((0, service_graph_1.packageOf)("packages/plugins/team/src/team-plugin.ts")).toBe("@natalia/team-plugin");
    (0, bun_test_1.expect)((0, service_graph_1.packageOf)("packages/framework/client/src/state.ts")).toBe("@natalia/client");
    (0, bun_test_1.expect)((0, service_graph_1.packageOf)("apps/cli/src/main.ts")).toBe("@natalia/host");
});
(0, bun_test_1.test)("a sound declaration set produces no problems", function () {
    // The real shape: the host binds the shared services, the plugin binds its
    // own and consumes the host's.
    var report = (0, service_graph_1.analyzeServiceGraph)([
        file("packages/core/runtime-services/src/service-tokens.ts", "".concat(TOKEN("alphaService", "alpha.service"), "\n").concat(TOKEN("betaService", "beta.service"), "\n").concat(TOKEN("gammaService", "gamma.service"))),
        file("packages/framework/client/src/runtime/initialize/framework-services.ts", "import { alphaService, betaService } from \"@natalia/runtime-services\";\nctx.state.serviceDirectory.provide(alphaService, {});\nctx.state.serviceDirectory.provide(betaService, {});"),
        file("packages/plugins/team/src/team-plugin.ts", "import { alphaService, betaService, gammaService } from \"@natalia/runtime-services\";\nexport const manifest = {\n  provides: [gammaService.id],\n  requires: [alphaService.id, betaService.id],\n};\nexport function setup(api) {\n  api.services.provide(gammaService.id, {});\n  const a = api.services.get<object>(alphaService.id);\n}"),
    ]);
    (0, bun_test_1.expect)(report.problems).toEqual([]);
    (0, bun_test_1.expect)(report.tokens.map(function (t) { return t.id; }).sort()).toEqual([
        "alpha.service",
        "beta.service",
        "gamma.service",
    ]);
});
(0, bun_test_1.test)("duplicate ids fail with both sites named", function () {
    var report = (0, service_graph_1.analyzeServiceGraph)([
        file("packages/framework/retry/src/service-token.ts", TOKEN("retryService", "retry.service")),
        file("packages/framework/compaction/src/service-token.ts", TOKEN("retryService", "retry.service")),
    ]);
    (0, bun_test_1.expect)(report.problems.some(function (p) {
        return p.startsWith('duplicate service id "retry.service"');
    })).toBe(true);
});
(0, bun_test_1.test)("a required service without a provider fails", function () {
    var report = (0, service_graph_1.analyzeServiceGraph)([
        file("packages/plugins/team/src/team-plugin.ts", "export const manifest = { provides: [], requires: [\"ghost.service\"] };"),
    ]);
    (0, bun_test_1.expect)(report.problems.some(function (p) {
        return p.includes('service "ghost.service" is required by @natalia/team-plugin but no package provides it');
    })).toBe(true);
});
(0, bun_test_1.test)("a service provided by two packages fails with Chord's wording", function () {
    var report = (0, service_graph_1.analyzeServiceGraph)([
        file("packages/core/runtime-services/src/service-tokens.ts", TOKEN("sandboxService", "sandbox.service")),
        file("packages/framework/client/src/runtime/initialize/framework-services.ts", "import { sandboxService } from \"@natalia/runtime-services\";\nctx.state.serviceDirectory.provide(sandboxService, {});"),
        file("packages/plugins/team/src/team-plugin.ts", "import { sandboxService } from \"@natalia/runtime-services\";\nexport const manifest = { provides: [sandboxService.id], requires: [] };"),
    ]);
    (0, bun_test_1.expect)(report.problems.some(function (p) {
        return p.includes('service "sandbox.service" is provided by both');
    })).toBe(true);
});
(0, bun_test_1.test)("two plugins requiring each other's services are a cycle", function () {
    var report = (0, service_graph_1.analyzeServiceGraph)([
        file("packages/core/runtime-services/src/service-tokens.ts", "".concat(TOKEN("leftService", "left.service"), "\n").concat(TOKEN("rightService", "right.service"))),
        file("packages/plugins/team/src/team-plugin.ts", "import { leftService, rightService } from \"@natalia/runtime-services\";\nexport const manifest = { provides: [leftService.id], requires: [rightService.id] };"),
        file("packages/plugins/skills/src/skills-plugin.ts", "import { leftService, rightService } from \"@natalia/runtime-services\";\nexport const manifest = { provides: [rightService.id], requires: [leftService.id] };"),
    ]);
    (0, bun_test_1.expect)(report.problems.some(function (p) { return p.startsWith("dependency cycle:"); })).toBe(true);
});
(0, bun_test_1.test)("a declared token nobody provides is an orphan stub", function () {
    var report = (0, service_graph_1.analyzeServiceGraph)([
        file("packages/framework/retry/src/service-token.ts", TOKEN("retryService", "retry.service")),
    ]);
    (0, bun_test_1.expect)(report.problems.some(function (p) {
        return p.includes('token "retry.service" is declared in packages/framework/retry/src/service-token.ts but never provided');
    })).toBe(true);
});
(0, bun_test_1.test)("invalid scope and missing capability fail validation", function () {
    var report = (0, service_graph_1.analyzeServiceGraph)([
        file("packages/framework/retry/src/service-token.ts", "export const retryService = defineService<object>(\"retry.service\", {\n  scope: \"galaxy\",\n});"),
    ]);
    (0, bun_test_1.expect)(report.problems.some(function (p) { return p.includes('declares invalid scope "galaxy"'); })).toBe(true);
    (0, bun_test_1.expect)(report.problems.some(function (p) { return p.includes("declares no capability"); })).toBe(true);
});
