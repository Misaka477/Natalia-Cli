"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var syntax_1 = require("./syntax");
var worker = self;
worker.onmessage = function (event) {
    var _a = event.data, id = _a.id, text = _a.text, language = _a.language;
    try {
        var parts = (0, syntax_1.highlightLine)(text, language);
        worker.postMessage({ id: id, ok: true, parts: parts });
    }
    catch (error) {
        worker.postMessage({
            id: id,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
