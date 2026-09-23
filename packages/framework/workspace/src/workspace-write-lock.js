"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkspaceWriteLock = createWorkspaceWriteLock;
function createWorkspaceWriteLock() {
    var chain = Promise.resolve();
    var requests = [];
    /** Acquires the lock; resolves with the release function. */
    function acquire(sessionID, paths) {
        if (paths === void 0) { paths = []; }
        var request = {
            sessionID: sessionID,
            paths: paths,
            queuedAt: Date.now(),
            acquiredAt: 0,
            active: false,
        };
        requests.push(request);
        var release;
        var released = false;
        var gate = new Promise(function (resolve) {
            release = function () {
                if (released)
                    return;
                released = true;
                request.active = false;
                request.acquiredAt = 0;
                var index = requests.indexOf(request);
                if (index >= 0)
                    requests.splice(index, 1);
                resolve();
            };
        });
        request.release = release;
        var previous = chain;
        chain = previous.then(function () { return gate; });
        return previous.then(function () {
            request.active = true;
            request.acquiredAt = Date.now();
            return release;
        });
    }
    function snapshot() {
        return requests.map(function (request) { return ({
            sessionID: request.sessionID,
            paths: request.paths,
            acquiredAt: request.acquiredAt,
            queuedAt: request.queuedAt,
            active: request.active,
        }); });
    }
    return { acquire: acquire, snapshot: snapshot };
}
