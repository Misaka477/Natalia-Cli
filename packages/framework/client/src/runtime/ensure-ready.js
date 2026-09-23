"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEnsureReady = createEnsureReady;
function createEnsureReady(ctx) {
    return {
        ensureReady: ensureReady,
    };
    function ensureReady() {
        var _a = ctx.ports, getReady = _a.getReady, setReady = _a.setReady, initialize = _a.initialize, publish = _a.publish;
        var ready = getReady();
        if (!ready) {
            var initialization = initialize().catch(function (error) {
                var failure = error instanceof Error ? error : new Error(String(error));
                publish({
                    type: "diagnostic",
                    level: "error",
                    message: failure.message,
                });
                throw failure;
            });
            ready = initialization;
            setReady(initialization);
            void ready.catch(function () { return undefined; });
        }
        return ready;
    }
}
