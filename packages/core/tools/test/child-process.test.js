"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
// /proc/<pid>/stat: pid (comm) state ppid pgrp session tty_nr tpgid flags
// minflt cminflt majflt cmajflt utime stime cutime cstime priority nice
// num_threads itrealvalue starttime vsize rss rsslim ...
// starttime is field 22 (index 19 after the closing paren of comm).
var STAT_TAIL = " 1 1234 1234 0 -1 4194304 64 0 0 0 100 50 0 0 20 0 1 0 987654 500000 300 0 2 0 0";
(0, bun_test_1.test)("parseProcStatStartTicks reads field 22 for a plain comm", function () {
    (0, bun_test_1.expect)((0, src_1.parseProcStatStartTicks)("1234 (bash) S".concat(STAT_TAIL))).toBe("987654");
});
(0, bun_test_1.test)("parseProcStatStartTicks is correct when comm contains a space", function () {
    // A space in comm shifts every whitespace-split field; the parser must still
    // return starttime, not itrealvalue (which a whole-line split would read).
    (0, bun_test_1.expect)((0, src_1.parseProcStatStartTicks)("1234 (my app) S".concat(STAT_TAIL))).toBe("987654");
});
(0, bun_test_1.test)("parseProcStatStartTicks uses the last closing paren of comm", function () {
    (0, bun_test_1.expect)((0, src_1.parseProcStatStartTicks)("1234 (a(b)c) S".concat(STAT_TAIL))).toBe("987654");
    (0, bun_test_1.expect)((0, src_1.parseProcStatStartTicks)("1234 (x) (y) S".concat(STAT_TAIL))).toBe("987654");
});
