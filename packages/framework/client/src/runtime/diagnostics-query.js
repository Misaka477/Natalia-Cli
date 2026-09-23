"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryDiagnostics = queryDiagnostics;
function queryDiagnostics(input) {
    var _a, _b;
    var filter = (_a = input.filter) !== null && _a !== void 0 ? _a : {};
    var contains = (_b = filter.contains) === null || _b === void 0 ? void 0 : _b.toLowerCase();
    var journal = input.events.filter(function (event) {
        if (filter.sessionID && event.sessionID !== filter.sessionID)
            return false;
        if (filter.since) {
            var at = event.at;
            if (!at || at < filter.since)
                return false;
        }
        if (contains && !JSON.stringify(event).toLowerCase().includes(contains))
            return false;
        return true;
    });
    if (filter.limit)
        journal = journal.slice(-filter.limit);
    var operational = input.records.filter(function (record) {
        var _a;
        if (filter.sessionID && ((_a = record.corr) === null || _a === void 0 ? void 0 : _a.sessionID) !== filter.sessionID)
            return false;
        if (filter.component && record.component !== filter.component)
            return false;
        if (filter.level) {
            var order = {
                error: 0,
                warn: 1,
                info: 2,
                debug: 3,
                trace: 4,
            };
            if (order[record.level] > order[filter.level])
                return false;
        }
        if (filter.since && (!record.at || record.at < filter.since))
            return false;
        if (contains && !JSON.stringify(record).toLowerCase().includes(contains))
            return false;
        return true;
    });
    if (filter.limit)
        operational = operational.slice(-filter.limit);
    return { journal: journal, operational: operational };
}
