"use strict";
/**
 * The quality gate on a subagent's final answer.
 *
 * The parent receives only the subagent's final text, so a one-word answer
 * leaves it with nothing to act on and no way to tell that from a complete one.
 * Rather than accept it, the gate gives the subagent one more turn and names
 * what is missing, because a model told only to say "more" restates the same
 * sentence at greater length.
 */
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
exports.RESULT_TOO_BRIEF_PROMPT = void 0;
exports.resultNeedsExpansion = resultNeedsExpansion;
exports.ensureUsableResult = ensureUsableResult;
/**
 * The prompt used when a subagent's final answer is too short to be useful.
 *
 * It names what is missing rather than asking for "more", because a model told
 * only that will usually restate the same sentence at greater length.
 */
exports.RESULT_TOO_BRIEF_PROMPT = [
    "Your previous response was too brief to be useful to the agent that delegated this task.",
    "Provide a more comprehensive summary that includes:",
    "1. Specific technical details and implementations.",
    "2. Detailed findings and analysis.",
    "3. All important information the parent agent should know.",
    "Do not repeat what you already said; add the detail that is missing.",
].join("\n");
/** Whether an answer is short enough to be worth one more turn. */
function resultNeedsExpansion(output, minChars) {
    if (minChars <= 0)
        return false;
    return output.trim().length < minChars;
}
/**
 * Give a subagent whose final answer is too short one more turn.
 *
 * At most once, and it may use one step beyond the nominal cap: a result nobody
 * can act on is worse than one extra step, and the step budget bounds the work
 * rather than the right to a usable answer.
 *
 * Returns the replacement answer, or the original when the gate does not apply
 * or the extra turn failed the same bar. A second one-liner is not an
 * improvement, and the parent can retry instead.
 */
function ensureUsableResult(input) {
    return __awaiter(this, void 0, void 0, function () {
        var extra, candidate;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!resultNeedsExpansion(input.output, input.minChars))
                        return [2 /*return*/, input.output];
                    input.setStatus("running");
                    // The ask has to reach the model as a real turn, so it joins the ledger rather
                    // than being passed beside it.
                    input.ledger.add({
                        id: "result-too-brief:".concat(input.step + 1),
                        role: "user",
                        content: exports.RESULT_TOO_BRIEF_PROMPT,
                    });
                    return [4 /*yield*/, input.runStep(input.step + 1)];
                case 1:
                    extra = _a.sent();
                    candidate = extra.output.trim();
                    // The replacement has to clear the same bar as the original, not merely beat
                    // it: a padded version of the same one-liner would hide the failure instead of
                    // reporting it, and the parent can retry.
                    return [2 /*return*/, resultNeedsExpansion(candidate, input.minChars)
                            ? input.output
                            : candidate];
            }
        });
    });
}
