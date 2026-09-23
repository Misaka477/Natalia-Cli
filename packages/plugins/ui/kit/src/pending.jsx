"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingBadge = PendingBadge;
exports.PendingList = PendingList;
exports.PendingDetail = PendingDetail;
exports.PendingPanel = PendingPanel;
var solid_js_1 = require("solid-js");
/** Small count badge for a side tab. */
function PendingBadge(props) {
    return (<solid_js_1.Show when={props.count > 0}>
      <span class="natalia-pending-badge">
        {props.count > 99 ? "99+" : props.count}
      </span>
    </solid_js_1.Show>);
}
/** Read-only list of pending items; the host owns focus/dismiss state. */
function PendingList(props) {
    return (<ul class="natalia-pending-list">
      <solid_js_1.For each={props.items}>
        {function (item) {
            var _a, _b;
            return (<li class="natalia-pending-list-item">
            <button type="button" class="natalia-pending-row" data-active={props.activeId === item.id} onClick={function () { var _a; return (_a = props.onFocus) === null || _a === void 0 ? void 0 : _a.call(props, item.id); }}>
              <span class="natalia-pending-row-kind">{item.kind}</span>
              <span class="natalia-pending-row-title">
                {(_b = (_a = props.presenterFor(item.kind)) === null || _a === void 0 ? void 0 : _a.label(item)) !== null && _b !== void 0 ? _b : item.title}
              </span>
            </button>
            <solid_js_1.Show when={props.onDismiss}>
              <button type="button" class="natalia-pending-dismiss" onClick={function () { var _a; return (_a = props.onDismiss) === null || _a === void 0 ? void 0 : _a.call(props, item.id); }}>
                稍后
              </button>
            </solid_js_1.Show>
          </li>);
        }}
      </solid_js_1.For>
    </ul>);
}
/**
 * Generic detail renderer: a presenter's fields and controls are data, so any
 * UI can render approval/question/new kinds without knowing the kind.
 */
function PendingDetail(props) {
    var _a = (0, solid_js_1.createSignal)({}), draft = _a[0], setDraft = _a[1];
    function value(control) {
        var current = draft()[control.field];
        return control.index === undefined
            ? current
            : current === null || current === void 0 ? void 0 : current[control.index];
    }
    function write(control, next) {
        setDraft(function (current) {
            var _a, _b;
            var _c;
            if (control.index === undefined)
                return __assign(__assign({}, current), (_a = {}, _a[control.field] = next, _a));
            var list = __spreadArray([], ((_c = current[control.field]) !== null && _c !== void 0 ? _c : []), true);
            list[control.index] = next;
            return __assign(__assign({}, current), (_b = {}, _b[control.field] = list, _b));
        });
    }
    function toggleOption(control, label) {
        var _a;
        if (control.kind !== "options")
            return;
        var selected = (_a = value(control)) !== null && _a !== void 0 ? _a : [];
        write(control, control.multiple
            ? selected.includes(label)
                ? selected.filter(function (entry) { return entry !== label; })
                : __spreadArray(__spreadArray([], selected, true), [label], false)
            : [label]);
    }
    function respond(action) {
        var next = __assign(__assign({}, draft()), { action: action.id });
        setDraft(next);
        props.onRespond(props.presenter.buildResponse(props.item, next));
    }
    return (<div class="natalia-pending-detail">
      <div class="natalia-pending-detail-header">
        <span class="natalia-pending-detail-title">
          {props.presenter.label(props.item)}
        </span>
        <solid_js_1.Show when={props.onDismiss}>
          <button type="button" class="natalia-pending-dismiss" onClick={function () { var _a; return (_a = props.onDismiss) === null || _a === void 0 ? void 0 : _a.call(props); }}>
            稍后处理
          </button>
        </solid_js_1.Show>
      </div>
      <div class="natalia-pending-fields">
        <solid_js_1.For each={props.presenter.fields(props.item)}>
          {function (field) { return (<div class="natalia-pending-field">
              <span class="natalia-pending-field-label">{field.label}</span>
              <solid_js_1.Show when={field.kind === "pre" || field.kind === "list"} fallback={<div class="natalia-pending-field-value">{field.value}</div>}>
                <pre class="natalia-pending-field-pre">{field.value}</pre>
              </solid_js_1.Show>
            </div>); }}
        </solid_js_1.For>
      </div>
      <div class="natalia-pending-controls">
        <solid_js_1.For each={props.presenter.controls(props.item)}>
          {function (control) {
            var _a;
            return (<div class="natalia-pending-control">
              <span class="natalia-pending-control-label">{control.label}</span>
              <solid_js_1.Show when={control.kind === "options"} fallback={<input class="natalia-pending-input" placeholder={control.kind === "text" ? control.placeholder : undefined} value={String((_a = value(control)) !== null && _a !== void 0 ? _a : "")} onInput={function (event) {
                        return write(control, event.currentTarget.value);
                    }}/>}>
                <div class="natalia-pending-options">
                  <solid_js_1.For each={control.kind === "options" ? control.options : []}>
                    {function (option) {
                    var _a;
                    return (<button type="button" class="natalia-pending-option" data-active={((_a = value(control)) !== null && _a !== void 0 ? _a : []).includes(option.label)} onClick={function () { return toggleOption(control, option.label); }}>
                        <span>{option.label}</span>
                        <solid_js_1.Show when={option.description}>
                          <span class="natalia-pending-option-desc">
                            {option.description}
                          </span>
                        </solid_js_1.Show>
                      </button>);
                }}
                  </solid_js_1.For>
                </div>
              </solid_js_1.Show>
            </div>);
        }}
        </solid_js_1.For>
      </div>
      <div class="natalia-pending-actions">
        <solid_js_1.For each={props.presenter.actions(props.item)}>
          {function (action) {
            var _a;
            return (<button type="button" class="natalia-pending-action" data-tone={(_a = action.tone) !== null && _a !== void 0 ? _a : "default"} onClick={function () { return respond(action); }}>
              {action.label}
            </button>);
        }}
        </solid_js_1.For>
      </div>
    </div>);
}
/** List + detail composition; a side panel mounts this directly. */
function PendingPanel(props) {
    var _a, _b;
    return (<div class="natalia-pending-panel">
      <PendingList items={props.items} activeId={props.controller.activeID()} presenterFor={props.presenterFor} onFocus={function (id) { return props.controller.focus(id); }} onDismiss={function (id) { return props.controller.dismiss(id); }}/>
      <solid_js_1.Show keyed when={(_a = props.controller.activeID()) !== null && _a !== void 0 ? _a : (_b = props.items[0]) === null || _b === void 0 ? void 0 : _b.id} fallback={<div class="natalia-pending-empty">没有待处理事项</div>}>
        {function (id) {
            var item = function () { return props.items.find(function (entry) { return entry.id === id; }); };
            return (<solid_js_1.Show when={item()}>
              {function (current) { return (<solid_js_1.Show when={props.presenterFor(current().kind)}>
                  {function (presenter) { return (<PendingDetail item={current()} presenter={presenter()} onRespond={function (response) {
                            return props.onRespond(current(), response);
                        }} onDismiss={function () { return props.controller.dismiss(current().id); }}/>); }}
                </solid_js_1.Show>); }}
            </solid_js_1.Show>);
        }}
      </solid_js_1.Show>
    </div>);
}
