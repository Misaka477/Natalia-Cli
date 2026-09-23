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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var capability_1 = require("@natalia/capability");
var tool_family_capabilities_1 = require("../src/capabilities/tool-family-capabilities");
var tool_publish_1 = require("../src/runtime/tool-publish");
// The built-in tools are capabilities now, so they must be assemblable without a
// runtime. If any of this needed a real client, nothing would have been decoupled.
// Every built-in family is a plugin now, so the family-capability machinery below
// is exercised with synthetic families rather than host-built ones.
function syntheticFamily(id) {
    return {
        id: id,
        name: id,
        version: "1.0.0",
        description: "synthetic ".concat(id),
        scope: "session",
        tools: [
            {
                name: "".concat(id, "_run"),
                description: "Run",
                requiresApproval: false,
                parameters: { type: "object", properties: {} },
                execute: function () {
                    return __awaiter(this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, "ok"];
                        });
                    });
                },
            },
        ],
    };
}
(0, bun_test_1.test)("the effective tool catalogue names migrated plugin tools", function () {
    (0, bun_test_1.expect)((0, tool_family_capabilities_1.runtimeToolNames)()).toContain("ask_user");
    (0, bun_test_1.expect)((0, tool_family_capabilities_1.runtimeToolNames)()).toEqual(bun_test_1.expect.arrayContaining(["plan", "todo_read", "todo_write"]));
    (0, bun_test_1.expect)((0, tool_family_capabilities_1.runtimeToolNames)()).toEqual(bun_test_1.expect.arrayContaining(["glob", "grep"]));
    (0, bun_test_1.expect)((0, tool_family_capabilities_1.runtimeToolNames)()).toEqual(bun_test_1.expect.arrayContaining(["read_file", "write_file", "edit_file"]));
    (0, bun_test_1.expect)((0, tool_family_capabilities_1.runtimeToolNames)()).toContain("apply_edits");
    (0, bun_test_1.expect)((0, tool_family_capabilities_1.runtimeToolNames)()).toContain("web_fetch");
    (0, bun_test_1.expect)((0, tool_family_capabilities_1.runtimeToolNames)()).toContain("run_shell");
    (0, bun_test_1.expect)((0, tool_family_capabilities_1.runtimeToolNames)()).toContain("agent_spawn");
    (0, bun_test_1.expect)((0, tool_family_capabilities_1.runtimeToolNames)()).toContain("interactive_terminal_start");
    (0, bun_test_1.expect)((0, tool_family_capabilities_1.runtimeToolNames)()).toContain("interactive_start");
    (0, bun_test_1.expect)((0, tool_family_capabilities_1.runtimeToolNames)()).toContain("sandbox_create");
    (0, bun_test_1.expect)((0, tool_family_capabilities_1.runtimeToolNames)()).toContain("process_start");
    (0, bun_test_1.expect)((0, tool_family_capabilities_1.runtimeToolNames)()).toContain("background_start");
});
(0, bun_test_1.test)("each family declares exactly the tools grant", function () {
    var family = syntheticFamily("alpha");
    var registration = (0, tool_family_capabilities_1.toolFamilyRegistration)(family);
    (0, bun_test_1.expect)(registration.id).toBe("natalia-tool-".concat(family.id));
    (0, bun_test_1.expect)(registration.grants).toEqual(["tools"]);
    (0, bun_test_1.expect)(registration.scope).toBe(family.scope);
});
(0, bun_test_1.test)("every tool is owned by the family that contributed it", function () {
    var registry = new capability_1.CapabilityRegistry();
    var family = syntheticFamily("alpha");
    var _a = (0, tool_family_capabilities_1.createToolRegistryFromCapabilities)({
        registry: registry,
        families: [family],
    }), tools = _a.tools, outcome = _a.outcome;
    (0, bun_test_1.expect)(outcome.failed).toEqual([]);
    for (var _i = 0, _b = family.tools; _i < _b.length; _i++) {
        var tool = _b[_i];
        (0, bun_test_1.expect)(tools.has(tool.name)).toBe(true);
        (0, bun_test_1.expect)(registry.ownerOf("tools", tool.name)).toBe((0, tool_family_capabilities_1.toolFamilyCapabilityID)(family.id));
    }
    // Nothing is in the registry that the kernel does not own: a tool the kernel
    // never accepted must not be callable.
    for (var _c = 0, _d = tools.keys(); _c < _d.length; _c++) {
        var name_1 = _d[_c];
        (0, bun_test_1.expect)(registry.ownerOf("tools", name_1)).toBeString();
    }
});
(0, bun_test_1.test)("a family that fails to load leaves none of its tools callable", function () {
    var registry = new capability_1.CapabilityRegistry();
    var good = syntheticFamily("good");
    var broken = __assign(__assign({}, syntheticFamily("broken")), { tools: __spreadArray(__spreadArray([], syntheticFamily("broken").tools, true), [
            __assign(__assign({}, syntheticFamily("broken").tools[0]), { name: "" }),
        ], false) });
    var _a = (0, tool_family_capabilities_1.createToolRegistryFromCapabilities)({
        registry: registry,
        families: [good, broken],
    }), tools = _a.tools, outcome = _a.outcome;
    (0, bun_test_1.expect)(outcome.failed.map(function (entry) { return entry.id; })).toEqual([
        (0, tool_family_capabilities_1.toolFamilyCapabilityID)("broken"),
    ]);
    // Activation rolled back, so the family is absent rather than half-present:
    // the tools it had already contributed before the bad one are gone too.
    for (var _i = 0, _b = broken.tools; _i < _b.length; _i++) {
        var tool = _b[_i];
        (0, bun_test_1.expect)(tools.has(tool.name)).toBe(false);
    }
    // The good family still loads.
    (0, bun_test_1.expect)(tools.has("good_run")).toBe(true);
});
(0, bun_test_1.test)("registering the same families twice is refused, not silently doubled", function () {
    var registry = new capability_1.CapabilityRegistry();
    var families = [syntheticFamily("alpha")];
    (0, bun_test_1.expect)((0, tool_family_capabilities_1.registerToolFamilyCapabilities)(registry, families).failed).toEqual([]);
    var second = (0, tool_family_capabilities_1.registerToolFamilyCapabilities)(registry, families);
    (0, bun_test_1.expect)(second.loaded).toEqual([]);
    (0, bun_test_1.expect)(second.failed.length).toBe(families.length);
    for (var _i = 0, _a = second.failed; _i < _a.length; _i++) {
        var failure = _a[_i];
        (0, bun_test_1.expect)(failure.reason).toMatch(/already registered/u);
    }
});
(0, bun_test_1.test)("dependency ordering registers a dependent after its dependency", function () {
    var registry = new capability_1.CapabilityRegistry();
    var dependent = __assign(__assign({}, syntheticFamily("later")), { dependencies: ["earlier"] });
    var earlier = syntheticFamily("earlier");
    // Dependent listed first on purpose: ordering must fix it, not the caller.
    var _a = (0, tool_family_capabilities_1.createToolRegistryFromCapabilities)({
        registry: registry,
        families: [dependent, earlier],
    }), tools = _a.tools, outcome = _a.outcome;
    (0, bun_test_1.expect)(outcome.failed).toEqual([]);
    (0, bun_test_1.expect)(outcome.loaded.map(function (entry) { return entry.registration.id; })).toEqual([
        (0, tool_family_capabilities_1.toolFamilyCapabilityID)("earlier"),
        (0, tool_family_capabilities_1.toolFamilyCapabilityID)("later"),
    ]);
    (0, bun_test_1.expect)(tools.has("earlier_run")).toBe(true);
    (0, bun_test_1.expect)(tools.has("later_run")).toBe(true);
    (0, bun_test_1.expect)(registry.has((0, tool_family_capabilities_1.toolFamilyCapabilityID)("later"))).toBe(true);
    (0, bun_test_1.expect)(registry.has((0, tool_family_capabilities_1.toolFamilyCapabilityID)("earlier"))).toBe(true);
});
(0, bun_test_1.test)("publishing capabilities reports the ones that went away", function () {
    // Publishing only `loaded` made the stream additive: a consumer accumulated
    // capabilities and never heard about one going away, so a reload that dropped
    // a family left it on screen. The sync is what makes removal observable.
    var published = [];
    var present = [
        {
            id: "family_a",
            name: "Family A",
            version: "1.0.0",
            scope: "session",
            grants: [],
        },
        {
            id: "family_b",
            name: "Family B",
            version: "1.0.0",
            scope: "session",
            grants: [],
        },
    ];
    var tools = (0, tool_publish_1.createToolPublish)({
        ports: {
            publish: function (event) {
                return published.push(event);
            },
            getCapabilityRegistry: function () { return ({ list: function () { return present; } }); },
        },
    }, {});
    tools.publishRuntimeCapabilities();
    (0, bun_test_1.expect)(published.map(function (event) { return "".concat(event.type, ":").concat(event.id); })).toEqual([
        "capability.loaded:cap:family_a",
        "capability.loaded:cap:family_b",
    ]);
    // A reload drops family_b.
    present = [present[0]];
    published.length = 0;
    tools.publishRuntimeCapabilities();
    (0, bun_test_1.expect)(published.map(function (event) { return "".concat(event.type, ":").concat(event.id); })).toEqual([
        "capability.loaded:cap:family_a",
        "capability.unloaded:cap:family_b",
    ]);
    // The removal carries the name, which is what a UI needs to say what left.
    (0, bun_test_1.expect)(published[1].name).toBe("Family B");
});
