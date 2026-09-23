"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextMenuStyles = void 0;
exports.ContextMenu = ContextMenu;
var solid_js_1 = require("solid-js");
var web_1 = require("solid-js/web");
function ContextMenu(props) {
    var _a = (0, solid_js_1.createSignal)(-1), activeIndex = _a[0], setActiveIndex = _a[1];
    var enabledItems = function () {
        return props.items
            .map(function (entry, index) { return ({ entry: entry, index: index }); })
            .filter(function (candidate) { return candidate.entry.type !== "separator" && !candidate.entry.disabled; })
            .map(function (_a) {
            var entry = _a.entry, index = _a.index;
            return ({ item: entry, index: index });
        });
    };
    function moveActive(delta) {
        var list = enabledItems();
        if (!list.length)
            return;
        var currentIndex = list.findIndex(function (entry) { return entry.index === activeIndex(); });
        var nextIndex = (currentIndex + delta + list.length) % list.length;
        setActiveIndex(list[nextIndex].index);
    }
    function activateCurrent() {
        var list = enabledItems();
        var current = list.find(function (entry) { return entry.index === activeIndex(); });
        if (!current)
            return;
        void current.item.onClick();
        props.onClose();
    }
    (0, solid_js_1.createEffect)(function () {
        var onKeyDown = function (event) {
            if (event.key === "Escape") {
                event.preventDefault();
                props.onClose();
                return;
            }
            if (event.key === "ArrowDown") {
                event.preventDefault();
                moveActive(1);
                return;
            }
            if (event.key === "ArrowUp") {
                event.preventDefault();
                moveActive(-1);
                return;
            }
            if (event.key === "Enter") {
                event.preventDefault();
                activateCurrent();
                return;
            }
        };
        window.addEventListener("keydown", onKeyDown);
        (0, solid_js_1.onCleanup)(function () { return window.removeEventListener("keydown", onKeyDown); });
    });
    return (<web_1.Portal mount={document.body}>
      <div class="ui-kit-context-backdrop" onClick={props.onClose} onContextMenu={function (event) {
            event.preventDefault();
            props.onClose();
        }}>
        <div class="ui-kit-context-menu" style={{ left: "".concat(props.x, "px"), top: "".concat(props.y, "px") }} onClick={function (event) { return event.stopPropagation(); }}>
          <solid_js_1.For each={props.items}>
            {function (item, index) {
            return item.type === "separator" ? (<div class="ui-kit-context-separator"/>) : (<MenuItem item={item} active={activeIndex() === index()} onHover={function () { return setActiveIndex(index()); }} onClose={props.onClose}/>);
        }}
          </solid_js_1.For>
        </div>
      </div>
    </web_1.Portal>);
}
function MenuItem(props) {
    var _a, _b;
    var _c = (0, solid_js_1.createSignal)(false), open = _c[0], setOpen = _c[1];
    return (<div class="ui-kit-context-item-wrap" onMouseEnter={function () {
            props.onHover();
            setOpen(true);
        }} onMouseLeave={function () { return setOpen(false); }}>
      <button type="button" class="ui-kit-context-item" data-active={props.active} data-danger={props.item.danger || undefined} disabled={props.item.disabled} onClick={function () {
            void props.item.onClick();
            props.onClose();
        }}>
        <solid_js_1.Show when={props.item.icon}>
          <span class="ui-kit-context-icon">{props.item.icon}</span>
        </solid_js_1.Show>
        <span class="ui-kit-context-label">{props.item.label}</span>
        <solid_js_1.Show when={props.item.shortcut}>
          <span class="ui-kit-context-shortcut">{props.item.shortcut}</span>
        </solid_js_1.Show>
        <solid_js_1.Show when={(_a = props.item.children) === null || _a === void 0 ? void 0 : _a.length}>
          <span class="ui-kit-context-arrow">›</span>
        </solid_js_1.Show>
      </button>
      <solid_js_1.Show when={open() && ((_b = props.item.children) === null || _b === void 0 ? void 0 : _b.length)}>
        <div class="ui-kit-context-submenu">
          <solid_js_1.For each={props.item.children}>
            {function (child) {
            return child.type === "separator" ? (<div class="ui-kit-context-separator"/>) : (<button type="button" class="ui-kit-context-item" data-danger={child.danger || undefined} disabled={child.disabled} onClick={function () {
                    void child.onClick();
                    props.onClose();
                }}>
                  <solid_js_1.Show when={child.icon}>
                    <span class="ui-kit-context-icon">{child.icon}</span>
                  </solid_js_1.Show>
                  <span class="ui-kit-context-label">{child.label}</span>
                </button>);
        }}
          </solid_js_1.For>
        </div>
      </solid_js_1.Show>
    </div>);
}
exports.contextMenuStyles = "\n.ui-kit-context-backdrop {\n  position: fixed;\n  inset: 0;\n  z-index: 2000;\n}\n.ui-kit-context-menu {\n  position: fixed;\n  min-width: 180px;\n  background: var(--neu-bg-light);\n  border-radius: 12px;\n  padding: 6px;\n  box-shadow: 4px 4px 12px var(--neu-shadow-dark), -4px -4px 12px var(--neu-shadow-light);\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n}\n.ui-kit-context-item-wrap {\n  position: relative;\n}\n.ui-kit-context-item {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  width: 100%;\n  text-align: left;\n  padding: 7px 10px;\n  border: none;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--neu-text);\n  font-size: 12px;\n  cursor: pointer;\n}\n.ui-kit-context-item:hover,\n.ui-kit-context-item[data-active=\"true\"] {\n  background: var(--neu-bg);\n  color: var(--neu-accent);\n}\n.ui-kit-context-item[data-danger=\"true\"] {\n  color: var(--neu-error);\n}\n.ui-kit-context-item:disabled {\n  opacity: 0.4;\n  cursor: default;\n}\n.ui-kit-context-icon {\n  display: inline-flex;\n  width: 16px;\n  flex-shrink: 0;\n}\n.ui-kit-context-label {\n  flex: 1;\n  min-width: 0;\n}\n.ui-kit-context-shortcut {\n  color: var(--neu-muted);\n  font-size: 11px;\n}\n.ui-kit-context-arrow {\n  color: var(--neu-muted);\n  font-size: 12px;\n}\n.ui-kit-context-separator {\n  height: 1px;\n  margin: 4px 6px;\n  background: var(--neu-hairline-accent);\n}\n.ui-kit-context-submenu {\n  position: absolute;\n  left: calc(100% + 2px);\n  top: -4px;\n  min-width: 150px;\n  background: var(--neu-bg-light);\n  border-radius: 12px;\n  padding: 6px;\n  box-shadow: 4px 4px 12px var(--neu-shadow-dark), -4px -4px 12px var(--neu-shadow-light);\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  z-index: 2001;\n}\n";
