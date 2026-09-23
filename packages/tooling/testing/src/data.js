"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeDigest = makeDigest;
exports.lineCount = lineCount;
exports.chinese300 = chinese300;
exports.chinese10000 = chinese10000;
exports.mixedGraphemes = mixedGraphemes;
exports.paste100KiB = paste100KiB;
exports.paste1MiB = paste1MiB;
function makeDigest(input) {
    return new Bun.CryptoHasher("sha256").update(input).digest("hex");
}
function lineCount(input) {
    return input.length === 0 ? 1 : input.split("\n").length;
}
function chinese300() {
    return "中".repeat(300);
}
function chinese10000() {
    return "界".repeat(10000);
}
function mixedGraphemes(count) {
    if (count === void 0) { count = 20000; }
    var unit = ["A", "中", "🙂", "e\u0301", "，", "क्‍ष"].join("");
    return unit.repeat(Math.ceil(count / 6));
}
function paste100KiB() {
    var unit = "日志行: 中文 emoji 🙂 e\u0301 ASCII 1234567890\n";
    return unit.repeat(Math.ceil((100 * 1024) / new TextEncoder().encode(unit).byteLength));
}
function paste1MiB() {
    var unit = "混合 grapheme e\u0301 🙂 全角，ASCII 1234567890\n";
    return unit.repeat(Math.ceil((1024 * 1024) / new TextEncoder().encode(unit).byteLength));
}
