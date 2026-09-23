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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
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
exports.serializeGeneration = serializeGeneration;
exports.parseGeneration = parseGeneration;
exports.storeGeneration = storeGeneration;
exports.loadGeneration = loadGeneration;
exports.buildGeneration = buildGeneration;
exports.deriveCompositionPointer = deriveCompositionPointer;
__exportStar(require("./switch"), exports);
__exportStar(require("./verification"), exports);
var contracts_1 = require("@natalia/contracts");
/**
 * The composition generation store (master plan P2 / NGM study G1).
 *
 * A generation is content-addressed through the object store: identical
 * content produces the identical id, so generations deduplicate for free and
 * the id is a stable handle for the journal's `composition.switched` events.
 * Nothing here mutates a stored generation — a change is a new object, which
 * is what makes the running composition immutable and the candidate/rollback
 * model (G2-G4) possible on top.
 */
/** Serializes a generation deterministically. */
function serializeGeneration(generation) {
    return JSON.stringify(generation);
}
/** Parses and schema-checks a stored generation. */
function parseGeneration(text) {
    var _a;
    var parsed = JSON.parse(text);
    if ((parsed === null || parsed === void 0 ? void 0 : parsed.schema) !== contracts_1.GENERATION_SCHEMA)
        throw new Error("unknown generation schema: ".concat(String(parsed === null || parsed === void 0 ? void 0 : parsed.schema), " (expected ").concat(contracts_1.GENERATION_SCHEMA, ")"));
    if (!Array.isArray(parsed.plugins))
        throw new Error("generation is missing its plugin catalog");
    // Generations stored before the constitution face existed carry no rows;
    // reading them as "carries no policy" is honest (the gate then fails
    // closed against active rules rather than inventing rows).
    return __assign(__assign({}, parsed), { policyRows: (_a = parsed.policyRows) !== null && _a !== void 0 ? _a : [] });
}
/** Stores a generation, returning its content id. */
function storeGeneration(store, generation) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, store.put(serializeGeneration(generation))];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
/** Loads a generation by content id. */
function loadGeneration(store, id) {
    return __awaiter(this, void 0, void 0, function () {
        var bytes;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, store.get(id)];
                case 1:
                    bytes = _a.sent();
                    return [2 /*return*/, parseGeneration(bytes.toString("utf8"))];
            }
        });
    });
}
/** Builds a generation from the live config and the desired catalog. */
function buildGeneration(input) {
    var plugins = input.catalog
        .map(function (_a) {
        var id = _a.id, enabled = _a.enabled, fingerprint = _a.fingerprint;
        return ({ id: id, enabled: enabled, fingerprint: fingerprint });
    })
        .sort(function (a, b) { return a.id.localeCompare(b.id); });
    var policyRows = __spreadArray([], input.policyRows, true).sort(function (a, b) {
        return a.id.localeCompare(b.id);
    });
    return {
        schema: contracts_1.GENERATION_SCHEMA,
        config: input.config,
        plugins: plugins,
        policyRows: policyRows,
    };
}
/**
 * Derives the composition pointer from an event stream.
 *
 * `current`/`previous` come from the recorded switches: the last switch wins,
 * its `from` becomes the rollback target. `candidate` is the most recent
 * proposal that was never switched to — the staged-but-uncommitted state.
 * A proposal that a later switch commits stops being a candidate. A stream
 * without any of these has no pointer, which is a valid state: the
 * composition existed before anyone pointed at it.
 */
function deriveCompositionPointer(events) {
    var _a;
    var current;
    var previous;
    var candidate;
    for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
        var event_1 = events_1[_i];
        if (event_1.type === "composition.switched") {
            previous = (_a = event_1.from) !== null && _a !== void 0 ? _a : previous;
            current = event_1.to;
            if (candidate === event_1.to)
                candidate = undefined;
            continue;
        }
        if (event_1.type === "composition.proposed")
            candidate = event_1.candidateID;
    }
    return __assign(__assign(__assign({}, (current ? { current: current } : {})), (previous ? { previous: previous } : {})), (candidate ? { candidate: candidate } : {}));
}
