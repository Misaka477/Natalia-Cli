"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var session_date_1 = require("../src/session-date");
(0, bun_test_1.test)("a date renders as YYYY-MM-DD with zero padding", function () {
    // Without padding the string sorts wrong and reads oddly next to other dates.
    (0, bun_test_1.expect)((0, session_date_1.calendarDate)(new Date(2026, 0, 5))).toBe("2026-01-05");
    (0, bun_test_1.expect)((0, session_date_1.calendarDate)(new Date(2026, 11, 31))).toBe("2026-12-31");
});
(0, bun_test_1.test)("the date is local, because that is what today means to the user", function () {
    // 2026-09-20 07:00 in UTC+8 is still 2026-09-19 in UTC, and a user at that
    // hour means the 20th.
    var at = new Date(2026, 8, 20, 7, 0, 0);
    (0, bun_test_1.expect)((0, session_date_1.calendarDate)(at)).toBe("2026-09-20");
});
(0, bun_test_1.test)("today reads the injectable clock", function () {
    (0, bun_test_1.expect)((0, session_date_1.today)(function () { return new Date(2026, 8, 19); })).toBe("2026-09-19");
});
(0, bun_test_1.test)("no rollover while the recorded date is today's", function () {
    (0, bun_test_1.expect)((0, session_date_1.dateRolledOver)("2026-09-19", "2026-09-19")).toBe(false);
});
(0, bun_test_1.test)("a rollover needs a recorded date to move away from", function () {
    // A session whose date was never recorded has nothing to contradict, so
    // appending a notice would claim a change that was never observed.
    (0, bun_test_1.expect)((0, session_date_1.dateRolledOver)(undefined, "2026-09-20")).toBe(false);
});
(0, bun_test_1.test)("a rollover is detected when the recorded date is behind", function () {
    (0, bun_test_1.expect)((0, session_date_1.dateRolledOver)("2026-09-19", "2026-09-20")).toBe(true);
});
(0, bun_test_1.test)("the rollover notice names both dates", function () {
    // "The date changed" alone leaves the model to guess the direction.
    var content = (0, session_date_1.dateRolloverContent)("2026-09-19", "2026-09-20");
    (0, bun_test_1.expect)(content).toContain("from 2026-09-19 to 2026-09-20");
    (0, bun_test_1.expect)(content).toContain('source="date_rollover"');
    (0, bun_test_1.expect)(content).toContain('trust="runtime"');
});
(0, bun_test_1.test)("the entry id is stable per session and date, so it cannot duplicate", function () {
    (0, bun_test_1.expect)((0, session_date_1.dateRolloverEntryID)("s1", "2026-09-20")).toBe("date:s1:2026-09-20");
    (0, bun_test_1.expect)((0, session_date_1.dateRolloverEntryID)("s1", "2026-09-20")).toBe((0, session_date_1.dateRolloverEntryID)("s1", "2026-09-20"));
    (0, bun_test_1.expect)((0, session_date_1.dateRolloverEntryID)("s1", "2026-09-21")).not.toBe((0, session_date_1.dateRolloverEntryID)("s1", "2026-09-20"));
});
/** A ledger surface for the rollover tests. */
function fakeLedger() {
    var entries = [];
    return {
        entries: entries,
        snapshot: function () { return ({
            entries: entries,
        }); },
        add: function (entry) {
            entries.push(entry);
        },
    };
}
(0, bun_test_1.test)("no notice while the recorded date is today's", function () {
    var ledger = fakeLedger();
    (0, bun_test_1.expect)((0, session_date_1.appendDateRollover)({
        ledger: ledger,
        sessionID: "s1",
        recorded: "2026-09-20",
        todayDate: "2026-09-20",
    })).toBe("unchanged");
    (0, bun_test_1.expect)(ledger.entries).toHaveLength(0);
});
(0, bun_test_1.test)("a rollover appends exactly one notice, and nothing is rewritten", function () {
    var ledger = fakeLedger();
    ledger.add({ id: "u1", role: "user", content: "earlier work" });
    var outcome = (0, session_date_1.appendDateRollover)({
        ledger: ledger,
        sessionID: "s1",
        recorded: "2026-09-19",
        todayDate: "2026-09-20",
    });
    (0, bun_test_1.expect)(outcome).toBe("appended");
    // The earlier entry is untouched: a rollover appends, it never rewrites.
    (0, bun_test_1.expect)(ledger.entries[0]).toEqual({
        id: "u1",
        role: "user",
        content: "earlier work",
    });
    var notice = ledger.entries[1];
    (0, bun_test_1.expect)(notice.role).toBe("dynamic");
    (0, bun_test_1.expect)(notice.id).toBe("date:s1:2026-09-20");
    (0, bun_test_1.expect)(notice.content).toContain("from 2026-09-19 to 2026-09-20");
});
(0, bun_test_1.test)("the notice is not appended twice for the same date", function () {
    // The entry id is stable per date, so a session that crosses midnight and then
    // takes another turn does not gain a second notice.
    var ledger = fakeLedger();
    for (var turn = 0; turn < 3; turn += 1)
        (0, session_date_1.appendDateRollover)({
            ledger: ledger,
            sessionID: "s1",
            recorded: "2026-09-19",
            todayDate: "2026-09-20",
        });
    (0, bun_test_1.expect)(ledger.entries).toHaveLength(1);
});
(0, bun_test_1.test)("each date crossing appends its own notice", function () {
    var ledger = fakeLedger();
    var input = function (recorded, todayDate) { return ({
        ledger: ledger,
        sessionID: "s1",
        recorded: recorded,
        todayDate: todayDate,
    }); };
    (0, bun_test_1.expect)((0, session_date_1.appendDateRollover)(input("2026-09-19", "2026-09-20"))).toBe("appended");
    (0, bun_test_1.expect)((0, session_date_1.appendDateRollover)(input("2026-09-20", "2026-09-21"))).toBe("appended");
    (0, bun_test_1.expect)(ledger.entries.map(function (e) { return e.id; })).toEqual([
        "date:s1:2026-09-20",
        "date:s1:2026-09-21",
    ]);
});
(0, bun_test_1.test)("a session with no recorded date gains no notice", function () {
    // There is nothing to contradict, so claiming a change never observed would be
    // inventing context.
    var ledger = fakeLedger();
    (0, bun_test_1.expect)((0, session_date_1.appendDateRollover)({
        ledger: ledger,
        sessionID: "s1",
        recorded: undefined,
        todayDate: "2026-09-20",
    })).toBe("unchanged");
    (0, bun_test_1.expect)(ledger.entries).toHaveLength(0);
});
