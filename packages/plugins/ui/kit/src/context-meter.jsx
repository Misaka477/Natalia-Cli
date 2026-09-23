"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextMeter = ContextMeter;
var solid_js_1 = require("solid-js");
function formatTokens(value) {
    if (!Number.isFinite(value) || value < 0)
        return "—";
    if (value >= 1000000)
        return "".concat(Number((value / 1000000).toFixed(1)), "M");
    if (value >= 1000)
        return "".concat(Number((value / 1000).toFixed(1)), "k");
    return String(Math.round(value));
}
function titleFor(usage) {
    var _a, _b;
    var capacity = (_a = usage.max) !== null && _a !== void 0 ? _a : usage.contextWindow;
    return [
        "Context ".concat(usage.used).concat(capacity === undefined ? "" : " / ".concat(capacity)),
        "Source ".concat((_b = usage.source) !== null && _b !== void 0 ? _b : "estimate"),
        usage.reserved === undefined ? undefined : "Reserved ".concat(usage.reserved),
        usage.thresholdPercent === undefined
            ? undefined
            : "Compact threshold ".concat(usage.thresholdPercent, "%"),
        usage.trigger ? "Trigger ".concat(usage.trigger) : undefined,
    ]
        .filter(function (line) { return line !== undefined; })
        .join("\n");
}
function ContextMeter(props) {
    var capacity = function () { var _a, _b, _c; return (_b = (_a = props.usage) === null || _a === void 0 ? void 0 : _a.max) !== null && _b !== void 0 ? _b : (_c = props.usage) === null || _c === void 0 ? void 0 : _c.contextWindow; };
    var available = function () {
        var _a;
        return props.usage !== undefined &&
            capacity() !== undefined &&
            Number.isFinite(capacity()) &&
            ((_a = capacity()) !== null && _a !== void 0 ? _a : 0) > 0;
    };
    var percent = function () {
        var usage = props.usage;
        var max = capacity();
        if (!usage || max === undefined || max <= 0)
            return 0;
        return Math.max(0, Math.round((usage.used / max) * 100));
    };
    var status = function () {
        var _a;
        var usage = props.usage;
        if (!usage)
            return "normal";
        if (usage.trigger)
            return "compacting";
        var threshold = (_a = usage.thresholdPercent) !== null && _a !== void 0 ? _a : 85;
        if (percent() >= threshold)
            return "critical";
        if (percent() >= threshold * 0.8)
            return "warning";
        return "normal";
    };
    return (<solid_js_1.Show when={available()}>
      <span class="natalia-context-meter" data-status={status()} title={titleFor(props.usage)} style={{ "--context-percent": "".concat(Math.min(100, percent()), "%") }}>
        <span class="natalia-context-meter-ring" aria-hidden="true"/>
        <span class="natalia-context-meter-label">
          {props.compact
            ? "".concat(percent(), "%")
            : "".concat(percent(), "% \u00B7 ").concat(formatTokens(props.usage.used), "/").concat(formatTokens(capacity()))}
        </span>
      </span>
    </solid_js_1.Show>);
}
