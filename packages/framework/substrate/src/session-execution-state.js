"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.announcedTurnIDsFrom = announcedTurnIDsFrom;
/** Seeds {@link SessionExecutionState.announcedTurnIDs} from the loaded journal. */
function announcedTurnIDsFrom(session) {
    var ids = new Set();
    for (var _i = 0, _a = session.events; _i < _a.length; _i++) {
        var event_1 = _a[_i];
        if (event_1.type === "turn.submitted")
            ids.add(event_1.id);
    }
    return ids;
}
