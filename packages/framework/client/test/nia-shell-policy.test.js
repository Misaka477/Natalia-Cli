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
var collab_1 = require("@natalia/collab");
(0, bun_test_1.test)("Nia shell policy allows read-only inspection and verification commands", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _i, _a, command;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _i = 0, _a = [
                    "git status",
                    "git diff --stat",
                    "git log --oneline -5",
                    "git branch -l",
                    "git tag -l",
                    "git show HEAD",
                    "ls -la",
                    "cat README.md",
                    "grep -n needle file.txt",
                    "find . -maxdepth 2 -type f",
                    "wc -l file.txt",
                    "bun test",
                    "bun run typecheck",
                    "npm test",
                    "npm run typecheck",
                    "pytest -q",
                    "tsc --noEmit",
                    "prettier --check .",
                ];
                _b.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 4];
                command = _a[_i];
                return [4 /*yield*/, (0, bun_test_1.expect)((0, collab_1.niaShellPolicyDenial)(command)).resolves.toBeUndefined()];
            case 2:
                _b.sent();
                _b.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("Nia shell policy denies workspace and repository mutations", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _i, _a, command;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _i = 0, _a = [
                    "git commit -m test",
                    "git push",
                    "git checkout main",
                    "git branch -D old",
                    "git tag v1",
                    "rm -rf build",
                    "mv a b",
                    "sed -i s/a/b/ file.txt",
                    "find . -delete",
                    "find . -exec rm {} ;",
                    "bun run build",
                    "npm install",
                    "npm run docs:api-reference",
                    "tsc",
                    "eslint --fix .",
                    "tree -o listing.txt",
                    "date -s 2020-01-01",
                    "rg --pre 'rm' needle .",
                    "bash -lc 'git commit'",
                    "cat file > out.txt",
                ];
                _b.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 4];
                command = _a[_i];
                return [4 /*yield*/, (0, bun_test_1.expect)((0, collab_1.niaShellPolicyDenial)(command)).resolves.toBeString()];
            case 2:
                _b.sent();
                _b.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4: return [2 /*return*/];
        }
    });
}); });
