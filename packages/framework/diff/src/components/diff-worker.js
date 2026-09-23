"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var diff_wasm_1 = require("@natalia/diff-wasm");
self.onmessage = function (event) {
    var _a = event.data, id = _a.id, oldText = _a.oldText, newText = _a.newText, stream = _a.stream;
    void (0, diff_wasm_1.diffWasmStructured)(oldText, newText)
        .then(function (result) {
        if (stream) {
            var start = {
                id: id,
                ok: true,
                stream: true,
                kind: "start",
                additions: result.additions,
                deletions: result.deletions,
            };
            self.postMessage(start);
            for (var _i = 0, _a = result.hunks; _i < _a.length; _i++) {
                var hunk = _a[_i];
                var message = {
                    id: id,
                    ok: true,
                    stream: true,
                    kind: "hunk",
                    hunk: hunk,
                };
                self.postMessage(message);
            }
            var done = {
                id: id,
                ok: true,
                stream: true,
                kind: "done",
            };
            self.postMessage(done);
            return;
        }
        var response = { id: id, ok: true, result: result };
        self.postMessage(response);
    })
        .catch(function (error) {
        var response = {
            id: id,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
        self.postMessage(response);
    });
};
