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
exports.createWorkGraphQueryTool = createWorkGraphQueryTool;
/**
 * Model-facing Work Graph query tool — runtime/work-graph-tools.ts.
 *
 * The minimal read surface (EI §8.4): query the session's work graph by
 * planID (or a plan document path, resolved to its planID) with cursor
 * pagination. The full version (filter by kind/direction/depth, checkpoint
 * provenance) lands with the B7 graph batch; this slice gives the model the
 * basic "what has this plan touched" read with bounded output.
 */
var session_1 = require("@anthelia/session");
var collab_1 = require("@natalia/collab");
var WORK_GRAPH_PAGE_LIMIT = 50;
function resolveExec(ctx, sessionID) {
    var exec = sessionID
        ? ctx.ports
            .getExecutionBySession()
            .get(sessionID)
        : undefined;
    return exec !== null && exec !== void 0 ? exec : ctx.ports.getActiveExec();
}
function createWorkGraphQueryTool(ctx) {
    return {
        name: "work_graph_query",
        description: "Query the session's Work Graph — the recorded fact graph of goals, plans, decisions, tool calls, approvals, checkpoints, validations and workspace changes. " +
            "Decision tree: leaving everything empty returns the ACTIVE plan's whole chain (or the whole session graph when no plan is active); fill exactly one precise query — `path` (a file/plan-document causal chain) or `findingID` (a drift finding's context); " +
            "narrow with the range filters planID / goalID / checkpointID / nodeKind. " +
            "Pagination: `limit` (default 50, max 200) and `cursor`; when the result is over the limit the response carries `truncated: true` and a `nextCursor` — pass that cursor back until `truncated` is false. " +
            "An empty result is `{ nodes: [], truncated: false }` (no matching chain, not an error).",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Precise query: a file path or plan-document path (resolved to its planID). Mutually exclusive with findingID.",
                },
                findingID: {
                    type: "string",
                    description: "Precise query: a drift findingID — returns the nodes in that finding's context. Mutually exclusive with path.",
                },
                planID: {
                    type: "string",
                    description: "Range filter: only nodes belonging to this plan.",
                },
                goalID: {
                    type: "string",
                    description: "Range filter: only nodes belonging to this goal.",
                },
                checkpointID: {
                    type: "string",
                    description: "Range filter: only nodes belonging to this checkpoint.",
                },
                nodeKind: {
                    type: "string",
                    enum: [
                        "goal",
                        "constraint",
                        "decision",
                        "plan",
                        "plan_step",
                        "agent_action",
                        "tool_call",
                        "approval",
                        "checkpoint",
                        "validation",
                        "workspace_change",
                    ],
                    description: "Range filter: only nodes of this kind.",
                },
                cursor: {
                    type: "string",
                    description: "Opaque pagination cursor from a previous work_graph_query result.",
                },
                limit: {
                    type: "number",
                    description: "Maximum nodes per page (default ".concat(WORK_GRAPH_PAGE_LIMIT, ", max 200)."),
                },
                direction: {
                    type: "string",
                    enum: ["out", "in", "both"],
                    description: "Which edge direction to traverse from the matched nodes (default both).",
                },
                depth: {
                    type: "number",
                    description: "How many edge hops to expand from the matched nodes (default 1, 0 = no traversal).",
                },
            },
            additionalProperties: false,
        },
        execute: function (parsed, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, exec, path, findingID, planID, plans, normalized_1, match, precise, narrowed, active, nodes, edges, matchesID, filtered, limit, offset, direction, depth, expanded, adjacency, _i, edges_1, edge, reached_1, frontier, hop, next, _a, frontier_1, id, _b, _c, link, page, nodeIDs, pageEdges, hasMore;
                var _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
                return __generator(this, function (_u) {
                    args = parsed;
                    exec = resolveExec(ctx, context.sessionID);
                    if (!exec)
                        return [2 /*return*/, "no session"];
                    path = (_d = args.path) === null || _d === void 0 ? void 0 : _d.trim();
                    findingID = (_e = args.findingID) === null || _e === void 0 ? void 0 : _e.trim();
                    // Exactly one precise query (path / findingID); the range filters are
                    // optional narrowers, not precise queries.
                    if (path && findingID)
                        return [2 /*return*/, "fill exactly one precise query: path or findingID, not both"];
                    planID = (_f = args.planID) === null || _f === void 0 ? void 0 : _f.trim();
                    if (path) {
                        plans = ctx.ports.planDocRuntime.planDocSnapshot();
                        normalized_1 = path.replace(/^\.?\/?natalia\/plans\//u, "");
                        match = plans.find(function (plan) {
                            return plan.documentPath === normalized_1 ||
                                plan.documentPath.endsWith(normalized_1) ||
                                plan.planID === normalized_1;
                        });
                        if (!match)
                            return [2 /*return*/, "unknown planID: ".concat(path)];
                        planID = match.planID;
                    }
                    precise = Boolean(path || findingID);
                    narrowed = Boolean(((_g = args.planID) === null || _g === void 0 ? void 0 : _g.trim()) ||
                        ((_h = args.goalID) === null || _h === void 0 ? void 0 : _h.trim()) ||
                        ((_j = args.checkpointID) === null || _j === void 0 ? void 0 : _j.trim()) ||
                        args.nodeKind);
                    if (!precise && !narrowed) {
                        active = (0, collab_1.activePlanForExec)(ctx, exec);
                        if (active)
                            planID = active.planID;
                    }
                    nodes = (0, session_1.projectedWorkGraphNodes)(exec.session.events);
                    edges = (0, session_1.projectedWorkGraphEdges)(exec.session.events);
                    matchesID = function (node, id) {
                        var _a;
                        return node.planID === id ||
                            node.target === id ||
                            ((_a = node.target) === null || _a === void 0 ? void 0 : _a.includes(id)) === true ||
                            node.summary.includes(id);
                    };
                    filtered = nodes;
                    if (findingID)
                        filtered = filtered.filter(function (node) { return matchesID(node, findingID); });
                    if (planID)
                        filtered = filtered.filter(function (node) { return matchesID(node, planID); });
                    if ((_k = args.goalID) === null || _k === void 0 ? void 0 : _k.trim())
                        filtered = filtered.filter(function (node) {
                            return matchesID(node, args.goalID.trim());
                        });
                    if ((_l = args.checkpointID) === null || _l === void 0 ? void 0 : _l.trim())
                        filtered = filtered.filter(function (node) {
                            return matchesID(node, args.checkpointID.trim());
                        });
                    if (args.nodeKind)
                        filtered = filtered.filter(function (node) { return node.kind === args.nodeKind; });
                    limit = Math.min(Math.max((_m = args.limit) !== null && _m !== void 0 ? _m : WORK_GRAPH_PAGE_LIMIT, 1), 200);
                    offset = Number((_o = args.cursor) !== null && _o !== void 0 ? _o : "0");
                    if (!Number.isFinite(offset) || offset < 0)
                        return [2 /*return*/, "invalid cursor; re-query without cursor"];
                    direction = (_p = args.direction) !== null && _p !== void 0 ? _p : "both";
                    depth = Math.max(Math.min((_q = args.depth) !== null && _q !== void 0 ? _q : 1, 5), 0);
                    expanded = filtered;
                    if (depth > 0) {
                        adjacency = new Map();
                        for (_i = 0, edges_1 = edges; _i < edges_1.length; _i++) {
                            edge = edges_1[_i];
                            if (direction !== "in")
                                ((_r = adjacency.get(edge.sourceID)) !== null && _r !== void 0 ? _r : adjacency.set(edge.sourceID, []).get(edge.sourceID)).push({ to: edge.targetID });
                            if (direction !== "out")
                                ((_s = adjacency.get(edge.targetID)) !== null && _s !== void 0 ? _s : adjacency.set(edge.targetID, []).get(edge.targetID)).push({ to: edge.sourceID });
                        }
                        reached_1 = new Set(filtered.map(function (node) { return node.id; }));
                        frontier = __spreadArray([], reached_1, true);
                        for (hop = 0; hop < depth; hop += 1) {
                            next = [];
                            for (_a = 0, frontier_1 = frontier; _a < frontier_1.length; _a++) {
                                id = frontier_1[_a];
                                for (_b = 0, _c = (_t = adjacency.get(id)) !== null && _t !== void 0 ? _t : []; _b < _c.length; _b++) {
                                    link = _c[_b];
                                    if (!reached_1.has(link.to)) {
                                        reached_1.add(link.to);
                                        next.push(link.to);
                                    }
                                }
                            }
                            if (!next.length)
                                break;
                            frontier = next;
                        }
                        expanded = nodes.filter(function (node) { return reached_1.has(node.id); });
                    }
                    page = expanded.slice(offset, offset + limit);
                    nodeIDs = new Set(page.map(function (node) { return node.id; }));
                    pageEdges = edges.filter(function (edge) { return nodeIDs.has(edge.sourceID) && nodeIDs.has(edge.targetID); });
                    hasMore = offset + limit < expanded.length;
                    return [2 /*return*/, JSON.stringify(__assign(__assign(__assign(__assign({}, (planID ? { planID: planID } : {})), (findingID ? { findingID: findingID } : {})), { total: expanded.length, truncated: hasMore, nodes: page, edges: pageEdges }), (hasMore ? { nextCursor: String(offset + limit) } : {})))];
                });
            });
        },
    };
}
