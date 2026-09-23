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
exports.buildWorkGraphForest = buildWorkGraphForest;
exports.buildWorkGraphNavigation = buildWorkGraphNavigation;
exports.buildWorkGraphFileNavigation = buildWorkGraphFileNavigation;
exports.selectWorkGraphByPlan = selectWorkGraphByPlan;
exports.selectWorkGraphNeighborhood = selectWorkGraphNeighborhood;
exports.selectUnattributedWorkGraphNodes = selectUnattributedWorkGraphNodes;
exports.deriveSessionUsageView = deriveSessionUsageView;
var contracts_1 = require("@natalia/contracts");
var DEFAULT_MAX_DEPTH = 8;
function edgeDirection(edge, nodeID) {
    if (edge.sourceID === nodeID)
        return "out";
    if (edge.targetID === nodeID)
        return "in";
    return undefined;
}
/** Builds one branch of the causal tree, guarding against cycles and depth. */
function buildBranch(nodes, edges, nodeID, via, 
/** "out" follows source→target (what this node causes); "in" the reverse. */
follow, depth, maxDepth, visited) {
    var node = nodes[nodeID];
    if (!node)
        return undefined;
    if (depth >= maxDepth || visited.has(nodeID))
        return __assign(__assign({ node: node }, (via ? { via: via } : {})), { children: [] });
    visited.add(nodeID);
    var children = [];
    for (var _i = 0, edges_1 = edges; _i < edges_1.length; _i++) {
        var edge = edges_1[_i];
        var direction = edgeDirection(edge, nodeID);
        if (!direction)
            continue;
        // For a forward ("out") branch, follow edges leaving this node; for a
        // backward ("in") branch, follow edges entering it.
        if (follow === "out" && direction !== "out")
            continue;
        if (follow === "in" && direction !== "in")
            continue;
        var childID = follow === "out" ? edge.targetID : edge.sourceID;
        var child = buildBranch(nodes, edges, childID, edge.kind, follow, depth + 1, maxDepth, visited);
        if (child)
            children.push(child);
    }
    return __assign(__assign({ node: node }, (via ? { via: via } : {})), { children: children });
}
function buildWorkGraphForest(state, maxDepth) {
    if (maxDepth === void 0) { maxDepth = DEFAULT_MAX_DEPTH; }
    var nodes = state.workGraphNodes;
    var edges = Object.values(state.workGraphEdges);
    var hasInbound = new Set(edges.map(function (edge) { return edge.targetID; }));
    var roots = Object.values(nodes).filter(function (node) {
        return !hasInbound.has(node.nodeID) &&
            // Runtime self-protection constraints (release-scope rules, actor
            // "runtime") are background facts, not the user's causal chain — keep
            // them out of the default forest roots. They still surface as children
            // when a tool call is actually constrained by them.
            !(node.kind === "constraint" && node.actor === "runtime");
    });
    var forest = [];
    for (var _i = 0, roots_1 = roots; _i < roots_1.length; _i++) {
        var root = roots_1[_i];
        var tree = buildBranch(nodes, edges, root.nodeID, undefined, "out", 0, maxDepth, new Set());
        if (tree)
            forest.push(tree);
    }
    return forest;
}
/**
 * The bidirectional navigation for one focus (a file change, a plan, a goal…).
 * `forward` walks what the focus causes; `backward` walks what leads into it —
 * together the two directions the graph exists to answer ("what does this
 * touch" / "why did this change").
 */
function buildWorkGraphNavigation(state, focusID, maxDepth) {
    var _a, _b, _c, _d;
    if (maxDepth === void 0) { maxDepth = DEFAULT_MAX_DEPTH; }
    var nodes = state.workGraphNodes;
    var edges = Object.values(state.workGraphEdges);
    var focus = focusID ? nodes[focusID] : undefined;
    var forward = focus
        ? ((_b = (_a = buildBranch(nodes, edges, focus.nodeID, undefined, "out", 0, maxDepth, new Set())) === null || _a === void 0 ? void 0 : _a.children) !== null && _b !== void 0 ? _b : [])
        : [];
    var backward = focus
        ? ((_d = (_c = buildBranch(nodes, edges, focus.nodeID, undefined, "in", 0, maxDepth, new Set())) === null || _c === void 0 ? void 0 : _c.children) !== null && _d !== void 0 ? _d : [])
        : [];
    return __assign(__assign({}, (focus ? { focus: focus } : {})), { forward: forward, backward: backward, unattributed: selectUnattributedWorkGraphNodes(state) });
}
function buildWorkGraphFileNavigation(state, filePath) {
    var needle = filePath.trim();
    var matches = needle
        ? Object.values(state.workGraphNodes).filter(function (node) {
            var target = node.target;
            if (!target)
                return false;
            return (target === needle ||
                target.endsWith("/".concat(needle)) ||
                target.endsWith(needle));
        })
        : [];
    var whyChanged = [];
    var whatChanged = [];
    var seenWhy = new Set();
    var seenWhat = new Set();
    for (var _i = 0, matches_1 = matches; _i < matches_1.length; _i++) {
        var match = matches_1[_i];
        var nav = buildWorkGraphNavigation(state, match.nodeID);
        for (var _a = 0, _b = nav.backward; _a < _b.length; _a++) {
            var node = _b[_a];
            if (!seenWhy.has(node.node.nodeID)) {
                seenWhy.add(node.node.nodeID);
                whyChanged.push(node);
            }
        }
        for (var _c = 0, _d = nav.forward; _c < _d.length; _c++) {
            var node = _d[_c];
            if (!seenWhat.has(node.node.nodeID)) {
                seenWhat.add(node.node.nodeID);
                whatChanged.push(node);
            }
        }
    }
    return { filePath: filePath, matches: matches, whyChanged: whyChanged, whatChanged: whatChanged };
}
/** The causal slice for one plan (its committed scope, via the planID
 * provenance on nodes) plus every edge between those nodes. */
function selectWorkGraphByPlan(state, planID) {
    var nodes = Object.values(state.workGraphNodes).filter(function (node) { return node.planID === planID; });
    var ids = new Set(nodes.map(function (node) { return node.nodeID; }));
    var edges = Object.values(state.workGraphEdges).filter(function (edge) { return ids.has(edge.sourceID) && ids.has(edge.targetID); });
    return { planID: planID, nodes: nodes, edges: edges };
}
/**
 * A bounded neighbourhood around one node for an external graph navigator.
 * Depth 0 is the focus only; each increment walks one edge hop.
 */
function selectWorkGraphNeighborhood(state, focusID, depth) {
    if (depth === void 0) { depth = 1; }
    var hops = Math.max(0, Math.min(depth, 4));
    var included = new Set();
    if (state.workGraphNodes[focusID])
        included.add(focusID);
    var frontier = new Set(included);
    for (var hop = 0; hop < hops; hop += 1) {
        var next = new Set();
        for (var _i = 0, _a = Object.values(state.workGraphEdges); _i < _a.length; _i++) {
            var edge = _a[_i];
            if (frontier.has(edge.sourceID) && state.workGraphNodes[edge.targetID])
                next.add(edge.targetID);
            if (frontier.has(edge.targetID) && state.workGraphNodes[edge.sourceID])
                next.add(edge.sourceID);
        }
        for (var _b = 0, next_1 = next; _b < next_1.length; _b++) {
            var id = next_1[_b];
            included.add(id);
        }
        frontier = next;
    }
    var nodes = __spreadArray([], included, true).map(function (id) { return state.workGraphNodes[id]; })
        .filter(function (node) { return Boolean(node); });
    var edges = Object.values(state.workGraphEdges).filter(function (edge) { return included.has(edge.sourceID) && included.has(edge.targetID); });
    return {
        focusID: focusID,
        nodes: nodes,
        edges: edges,
        unattributed: selectUnattributedWorkGraphNodes(state),
    };
}
/**
 * Workspace changes with no inbound edge remain unattributed so a navigator can
 * mark unknown provenance instead of inventing a cause.
 */
function selectUnattributedWorkGraphNodes(state) {
    var inbound = new Set(Object.values(state.workGraphEdges).map(function (edge) { return edge.targetID; }));
    return Object.values(state.workGraphNodes).filter(function (node) { return node.kind === "workspace_change" && !inbound.has(node.nodeID); });
}
/**
 * Derives the display figures from the raw session usage sums (the dashboard's
 * data interface): total input including cache traffic, cache hit rate, average
 * first-token latency, and decode throughput. Pure — never mutates the state,
 * so any UI (or a future TUI) computes the same figures from the same sums.
 *
 * The two cache figures come from the shared `@natalia/contracts` helpers so a
 * session bar and the provider trace can never report different rates for the
 * same tokens.
 */
function deriveSessionUsageView(stats) {
    return __assign(__assign({}, stats), { totalInputTokens: (0, contracts_1.totalInputTokens)(stats), cacheHitRate: (0, contracts_1.cacheHitRate)(stats), avgTtftMs: stats.ttftSteps > 0 ? stats.ttftMs / stats.ttftSteps : 0, tokensPerSecond: stats.decodeMs > 0 ? (stats.outputTokens / stats.decodeMs) * 1000 : 0 });
}
