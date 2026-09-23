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
var src_1 = require("../src");
function forced(command) {
    return (0, src_1.requiresForcedGitApproval)(command);
}
(0, bun_test_1.test)("git forced approval ignores read-only commands", function () {
    for (var _i = 0, _a = [
        "git status",
        "git log --oneline -5",
        "git branch -l",
        "git tag -l",
        "git tag --list v1",
        "git diff",
        "git show HEAD",
    ]; _i < _a.length; _i++) {
        var command = _a[_i];
        (0, bun_test_1.expect)(forced(command)).toBeUndefined();
    }
});
(0, bun_test_1.test)("git forced approval covers write subcommands", function () {
    for (var _i = 0, _a = [
        ["git commit -m test", "commit"],
        ["git push origin main", "push"],
        ["git merge feature", "merge"],
        ["git rebase main", "rebase"],
        ["git reset --hard", "reset"],
        ["git cherry-pick abc123", "cherry-pick"],
        ["git revert HEAD", "revert"],
        ["git clean -fd", "clean"],
        ["git tag v1", "tag"],
        ["git branch -D old", "branch"],
    ]; _i < _a.length; _i++) {
        var _b = _a[_i], command = _b[0], subcommand = _b[1];
        (0, bun_test_1.expect)(forced(command)).toMatchObject({
            ruleID: "C-REL-001",
            subcommand: subcommand,
        });
    }
});
(0, bun_test_1.test)("git forced approval sees through common wrapper and option forms", function () {
    for (var _i = 0, _a = [
        "echo x && git commit",
        "git status && git commit -m test",
        "bash -lc 'git commit'",
        'sh -c "git commit -m test"',
        "git -C /repo commit",
        "git --git-dir=/repo commit",
        "git --work-tree /repo commit",
        "git.exe commit",
        "env GIT_AUTHOR_NAME=x git commit",
    ]; _i < _a.length; _i++) {
        var command = _a[_i];
        (0, bun_test_1.expect)(forced(command)).toMatchObject({
            ruleID: "C-REL-001",
            subcommand: "commit",
        });
    }
});
(0, bun_test_1.test)("git forced approval does not match non-git commands", function () {
    for (var _i = 0, _a = ["xgit commit", "git-commit", "github commit"]; _i < _a.length; _i++) {
        var command = _a[_i];
        (0, bun_test_1.expect)(forced(command)).toBeUndefined();
    }
});
(0, bun_test_1.test)("git forced approval AST resolves aliases, functions, eval and assignments", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _i, _a, command;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _i = 0, _a = [
                    "alias g=git; g commit",
                    "alias g='git commit'; g",
                    "g=git; $g commit",
                    "f() { git commit; }; f",
                    "f() { local g=git; $g commit; }; f",
                    "eval 'git commit'",
                    "bash -lc 'alias g=git; g commit'",
                    "sh -c 'g=git; $g commit'",
                ];
                _b.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 4];
                command = _a[_i];
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.requiresForcedGitApprovalAst)(command)).resolves.toMatchObject({
                        ruleID: "C-REL-001",
                        subcommand: "commit",
                    })];
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
(0, bun_test_1.test)("git forced approval AST leaves read-only aliases and assignments alone", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _i, _a, command;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _i = 0, _a = [
                    "alias g=git; g status",
                    "alias g='git diff'; g",
                    "g=git; $g status",
                    "eval 'git status'",
                    "bash -lc 'alias g=git; g log --oneline'",
                ];
                _b.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 4];
                command = _a[_i];
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.requiresForcedGitApprovalAst)(command)).resolves.toBeUndefined()];
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
