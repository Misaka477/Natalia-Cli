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
var bun_test_1 = require("bun:test");
var index_1 = require("../src/index");
/**
 * An in-memory reporter double: the layer's DiagnosticsReporter is a
 * two-method seam by design (decoupling from the log package keeps the
 * composite graph acyclic), so the test doubles THAT — and asserting on
 * lines is stricter than asserting on files.
 */
function reporter() {
    var lines = [];
    return {
        lines: lines,
        log: {
            component: function (name) { return ({
                error: function (message, fields) {
                    return lines.push(JSON.stringify({
                        component: name,
                        level: "error",
                        message: message,
                        fields: fields,
                    }));
                },
                info: function (message, fields) {
                    return lines.push(JSON.stringify({ component: name, level: "info", message: message, fields: fields }));
                },
            }); },
        },
    };
}
var always = {
    id: "test.always",
    statement: "trips every time",
    check: function () { return [{ code: "test.trip", detail: "tripped" }]; },
};
var crasher = {
    id: "test.crasher",
    statement: "throws instead of checking",
    check: function () {
        throw new Error("checker blew up");
    },
};
var input = {
    sessions: [
        {
            sessionID: "ses_a",
            events: [],
            factStateComplete: true,
        },
    ],
};
(0, bun_test_1.test)("a violating invariant becomes an attributed finding in the report", function () {
    var out = reporter();
    var diagnostics = (0, index_1.createRuntimeDiagnostics)({
        sets: [{ owner: "test-domain", invariants: [always] }],
        log: out.log,
    });
    var findings = diagnostics.tick(input);
    (0, bun_test_1.expect)(findings).toHaveLength(1);
    (0, bun_test_1.expect)(findings[0]).toMatchObject({
        owner: "test-domain",
        invariant: "test.always",
        code: "test.trip",
    });
    (0, bun_test_1.expect)(diagnostics.state()).toMatchObject({ ticks: 1, findings: 1 });
    (0, bun_test_1.expect)(diagnostics.state().byInvariant["test-domain"]).toEqual({
        "test.always": 1,
    });
    var line = out.lines.find(function (entry) { return entry.includes("test.trip"); });
    (0, bun_test_1.expect)(line).toBeDefined();
    (0, bun_test_1.expect)(line).toContain('"component":"invariants"');
    (0, bun_test_1.expect)(line).toContain('"owner":"test-domain"');
});
(0, bun_test_1.test)("the global switch silences checks without undeploying them", function () {
    var out = reporter();
    var diagnostics = (0, index_1.createRuntimeDiagnostics)({
        sets: [{ owner: "test-domain", invariants: [always] }],
        log: out.log,
    });
    diagnostics.setEnabled(false);
    (0, bun_test_1.expect)(diagnostics.tick(input)).toHaveLength(0);
    (0, bun_test_1.expect)(diagnostics.state().enabled).toBe(false);
    diagnostics.setEnabled(true);
    (0, bun_test_1.expect)(diagnostics.tick(input)).toHaveLength(1);
});
(0, bun_test_1.test)("owner filtering: block wins, allow narrows", function () {
    var out = reporter();
    var diagnostics = (0, index_1.createRuntimeDiagnostics)({
        sets: [
            { owner: "kept", invariants: [always] },
            { owner: "blocked", invariants: [always] },
        ],
        log: out.log,
    });
    diagnostics.setOwnerFilter({
        allow: ["kept", "blocked"],
        block: ["blocked"],
    });
    (0, bun_test_1.expect)(diagnostics.tick(input).map(function (finding) { return finding.owner; })).toEqual([
        "kept",
    ]);
    diagnostics.setOwnerFilter({ allow: ["blocked"] });
    (0, bun_test_1.expect)(diagnostics.tick(input).map(function (finding) { return finding.owner; })).toEqual([
        "blocked",
    ]);
});
(0, bun_test_1.test)("a crashing checker is recorded as a finding, never as a crash", function () {
    var out = reporter();
    var diagnostics = (0, index_1.createRuntimeDiagnostics)({
        sets: [{ owner: "test-domain", invariants: [crasher] }],
        log: out.log,
    });
    var findings = diagnostics.tick(input);
    (0, bun_test_1.expect)(findings).toHaveLength(1);
    (0, bun_test_1.expect)(findings[0].code).toBe("test.crasher.checker_crashed");
    (0, bun_test_1.expect)(findings[0].detail).toContain("checker blew up");
});
(0, bun_test_1.test)("the interval runner ticks and stops", function () { return __awaiter(void 0, void 0, void 0, function () {
    var out, diagnostics, ticks;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                out = reporter();
                diagnostics = (0, index_1.createRuntimeDiagnostics)({
                    sets: [{ owner: "test-domain", invariants: [always] }],
                    log: out.log,
                });
                diagnostics.start(10, function () { return input; });
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 60); })];
            case 1:
                _a.sent();
                diagnostics.stop();
                ticks = diagnostics.state().ticks;
                (0, bun_test_1.expect)(ticks).toBeGreaterThan(0);
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 40); })];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(diagnostics.state().ticks).toBe(ticks); // stopped for real
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the journal seam is edge-triggered: open once, resolve, re-open", function () { return __awaiter(void 0, void 0, void 0, function () {
    var offending, controlled, published, out, diagnostics;
    return __generator(this, function (_a) {
        offending = true;
        controlled = {
            id: "test.edge",
            statement: "controlled by the test",
            check: function () {
                return offending
                    ? [
                        {
                            code: "test.edge_tripped",
                            detail: "still broken",
                            sessionID: "ses_edge",
                        },
                    ]
                    : [];
            },
        };
        published = [];
        out = reporter();
        diagnostics = (0, index_1.createRuntimeDiagnostics)({
            sets: [{ owner: "test-domain", invariants: [controlled] }],
            log: out.log,
            publish: function (event) { return published.push(event); },
        });
        // Ticks 1-3: the same violation — ONE opening event (no per-tick flood).
        diagnostics.tick(input);
        diagnostics.tick(input);
        diagnostics.tick(input);
        (0, bun_test_1.expect)(published).toHaveLength(1);
        (0, bun_test_1.expect)(published[0]).toMatchObject({
            type: "invariant.violation",
            owner: "test-domain",
            invariant: "test.edge",
            code: "test.edge_tripped",
            sessionID: "ses_edge",
        });
        // The problem clears: the closing edge publishes exactly once.
        offending = false;
        diagnostics.tick(input);
        diagnostics.tick(input);
        (0, bun_test_1.expect)(published).toHaveLength(2);
        (0, bun_test_1.expect)(published[1]).toMatchObject({
            type: "invariant.resolved",
            code: "test.edge_tripped",
            sessionID: "ses_edge",
        });
        // It comes back: a NEW opening (the lifecycle restarts).
        offending = true;
        diagnostics.tick(input);
        (0, bun_test_1.expect)(published).toHaveLength(3);
        (0, bun_test_1.expect)(published[2]).toMatchObject({ type: "invariant.violation" });
        return [2 /*return*/];
    });
}); });
