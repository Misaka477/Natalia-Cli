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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
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
exports.TerminalPane = TerminalPane;
var solid_js_1 = require("solid-js");
var web_terminal_1 = require("./web-terminal");
require("./styles.css");
var MAX_TERMINALS_PER_SESSION = 8;
function newTerminalID() {
    return "terminal_".concat(crypto.randomUUID());
}
function tabTitle(index) {
    return "\u7EC8\u7AEF ".concat(index + 1);
}
function TerminalPane(props) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (props === void 0) { props = {}; }
    var _h = (0, solid_js_1.createSignal)([]), tabs = _h[0], setTabs = _h[1];
    var _j = (0, solid_js_1.createSignal)(), activeID = _j[0], setActiveID = _j[1];
    var _k = (0, solid_js_1.createSignal)(), limitError = _k[0], setLimitError = _k[1];
    var _l = (0, solid_js_1.createSignal)([]), sessions = _l[0], setSessions = _l[1];
    var _m = (0, solid_js_1.createSignal)("bash"), shellProfile = _m[0], setShellProfile = _m[1];
    var _o = (0, solid_js_1.createSignal)(""), searchQuery = _o[0], setSearchQuery = _o[1];
    var terminalApis = new Map();
    var activeApi = function () { var _a; return terminalApis.get((_a = activeID()) !== null && _a !== void 0 ? _a : ""); };
    var loadToken = 0;
    function retitle(next) {
        return next.map(function (tab, index) { return (__assign(__assign({}, tab), { title: tabTitle(index) })); });
    }
    function loadTabs(sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var token, listed, running, id, next, current;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        token = ++loadToken;
                        return [4 /*yield*/, ((_b = (_a = props.runtime) === null || _a === void 0 ? void 0 : _a.nativeTerminalList) === null || _b === void 0 ? void 0 : _b.call(_a, sessionID))];
                    case 1:
                        listed = (_c = (_e.sent())) !== null && _c !== void 0 ? _c : [];
                        if (token !== loadToken)
                            return [2 /*return*/];
                        setSessions(listed);
                        running = listed.filter(function (item) {
                            return item.status === "running" &&
                                (!item.sessionID || item.sessionID === sessionID);
                        });
                        if (!running.length) {
                            id = newTerminalID();
                            setTabs([{ id: id, title: tabTitle(0), cells: [id], layout: "horizontal" }]);
                            setActiveID(id);
                            setLimitError();
                            return [2 /*return*/];
                        }
                        next = retitle(running.map(function (item) { return ({
                            id: item.id,
                            title: "",
                            cells: [item.id],
                            layout: "horizontal",
                        }); }));
                        setTabs(next);
                        current = activeID();
                        setActiveID(current && next.some(function (tab) { return tab.id === current; }) ? current : (_d = next[0]) === null || _d === void 0 ? void 0 : _d.id);
                        setLimitError();
                        return [2 /*return*/];
                }
            });
        });
    }
    (0, solid_js_1.createEffect)(function (previous) {
        var sessionID = props.sessionID;
        var runtimeURL = props.runtimeURL;
        var key = "".concat(sessionID !== null && sessionID !== void 0 ? sessionID : "", "\0").concat(runtimeURL !== null && runtimeURL !== void 0 ? runtimeURL : "");
        if (!sessionID || !runtimeURL) {
            setTabs([]);
            setActiveID();
            setLimitError();
            return key;
        }
        if (previous === key)
            return key;
        void loadTabs(sessionID);
        return key;
    });
    (0, solid_js_1.createEffect)(function () {
        var events = props.events;
        var sessionID = props.sessionID;
        if (!events || !sessionID)
            return;
        var timer;
        var unsubscribe = events.subscribe(function (event) {
            var relevant = event.type === "terminal.update" ||
                (event.type === "terminal.action" &&
                    (event.action === "started" || event.action === "exit")) ||
                (event.type === "terminal.timeline" &&
                    (event.action === "started" || event.action === "exit"));
            if (!relevant)
                return;
            if (sessionID && event.sessionID && event.sessionID !== sessionID)
                return;
            if (timer)
                clearTimeout(timer);
            timer = setTimeout(function () {
                if (sessionID)
                    void loadTabs(sessionID);
            }, 50);
        });
        (0, solid_js_1.onCleanup)(function () {
            if (timer)
                clearTimeout(timer);
            unsubscribe();
        });
    });
    function refreshSessions() {
        return __awaiter(this, void 0, void 0, function () {
            var listed;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, ((_b = (_a = props.runtime) === null || _a === void 0 ? void 0 : _a.nativeTerminalList) === null || _b === void 0 ? void 0 : _b.call(_a, props.sessionID))];
                    case 1:
                        listed = (_c = (_d.sent())) !== null && _c !== void 0 ? _c : [];
                        setSessions(listed);
                        return [2 /*return*/];
                }
            });
        });
    }
    function claimActiveTerminal() {
        return __awaiter(this, void 0, void 0, function () {
            var id, _a;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        id = activeID();
                        if (!id)
                            return [2 /*return*/];
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, ((_c = (_b = props.runtime) === null || _b === void 0 ? void 0 : _b.nativeTerminalClaimHumanInput) === null || _c === void 0 ? void 0 : _c.call(_b, id, props.sessionID))];
                    case 2:
                        _d.sent();
                        return [4 /*yield*/, refreshSessions()];
                    case 3:
                        _d.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        _a = _d.sent();
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    function releaseActiveTerminal() {
        return __awaiter(this, void 0, void 0, function () {
            var id, _a;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        id = activeID();
                        if (!id)
                            return [2 /*return*/];
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, ((_c = (_b = props.runtime) === null || _b === void 0 ? void 0 : _b.nativeTerminalReleaseHumanControl) === null || _c === void 0 ? void 0 : _c.call(_b, id, props.sessionID))];
                    case 2:
                        _d.sent();
                        return [4 /*yield*/, refreshSessions()];
                    case 3:
                        _d.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        _a = _d.sent();
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    function toggleSecureInput() {
        return __awaiter(this, void 0, void 0, function () {
            var id, session, _a;
            var _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        id = activeID();
                        if (!id)
                            return [2 /*return*/];
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 7, , 8]);
                        session = sessions().find(function (item) { return item.id === id; });
                        if (!(session === null || session === void 0 ? void 0 : session.secureInput)) return [3 /*break*/, 3];
                        return [4 /*yield*/, ((_c = (_b = props.runtime) === null || _b === void 0 ? void 0 : _b.nativeTerminalEndSecureInput) === null || _c === void 0 ? void 0 : _c.call(_b, id, props.sessionID))];
                    case 2:
                        _f.sent();
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, ((_e = (_d = props.runtime) === null || _d === void 0 ? void 0 : _d.nativeTerminalBeginSecureInput) === null || _e === void 0 ? void 0 : _e.call(_d, id, props.sessionID))];
                    case 4:
                        _f.sent();
                        _f.label = 5;
                    case 5: return [4 /*yield*/, refreshSessions()];
                    case 6:
                        _f.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        _a = _f.sent();
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    }
    function addTab() {
        return __awaiter(this, void 0, void 0, function () {
            var id, next;
            return __generator(this, function (_a) {
                if (!props.sessionID)
                    return [2 /*return*/];
                if (tabs().length >= MAX_TERMINALS_PER_SESSION) {
                    setLimitError("\u6BCF\u4E2A\u4F1A\u8BDD\u6700\u591A ".concat(MAX_TERMINALS_PER_SESSION, " \u4E2A\u7EC8\u7AEF"));
                    return [2 /*return*/];
                }
                id = newTerminalID();
                next = retitle(__spreadArray(__spreadArray([], tabs(), true), [
                    { id: id, title: "", cells: [id], layout: "horizontal" },
                ], false));
                setTabs(next);
                setActiveID(id);
                setLimitError();
                return [2 /*return*/];
            });
        });
    }
    function splitActiveTab(direction) {
        var tab = tabs().find(function (item) { return item.id === activeID(); });
        if (!tab)
            return;
        var id = newTerminalID();
        var next = tabs().map(function (item) {
            return item.id === tab.id
                ? __assign(__assign({}, item), { cells: __spreadArray(__spreadArray([], item.cells, true), [id], false), layout: direction }) : item;
        });
        setTabs(next);
        setActiveID(id);
        setLimitError();
    }
    function closeTab(id) {
        return __awaiter(this, void 0, void 0, function () {
            var remaining, nextID, _a;
            var _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        remaining = tabs().filter(function (tab) { return tab.id !== id; });
                        if (!remaining.length) {
                            nextID = newTerminalID();
                            remaining = [
                                {
                                    id: nextID,
                                    title: tabTitle(0),
                                    cells: [nextID],
                                    layout: "horizontal",
                                },
                            ];
                            setTabs(remaining);
                            setActiveID(nextID);
                        }
                        else {
                            setTabs(retitle(remaining));
                            if (activeID() === id ||
                                !remaining.some(function (tab) { var _a; return tab.cells.includes((_a = activeID()) !== null && _a !== void 0 ? _a : ""); }))
                                setActiveID((_b = remaining[0]) === null || _b === void 0 ? void 0 : _b.cells[0]);
                        }
                        setLimitError();
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, ((_d = (_c = props.runtime) === null || _c === void 0 ? void 0 : _c.nativeTerminalStop) === null || _d === void 0 ? void 0 : _d.call(_c, id, props.sessionID))];
                    case 2:
                        _e.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _e.sent();
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    function closeCell(tab, cellID) {
        var _a, _b;
        var remainingCells = tab.cells.filter(function (item) { return item !== cellID; });
        var next = tabs().map(function (item) {
            return item.id === tab.id
                ? __assign(__assign({}, item), { cells: remainingCells.length ? remainingCells : [newTerminalID()], layout: "horizontal" }) : item;
        });
        setTabs(next);
        if (activeID() === cellID) {
            var replaced = next.find(function (item) { return item.id === tab.id; });
            setActiveID(replaced.cells[0]);
        }
        void ((_b = (_a = props.runtime) === null || _a === void 0 ? void 0 : _a.nativeTerminalStop) === null || _b === void 0 ? void 0 : _b.call(_a, cellID, props.sessionID).catch(function () { return undefined; }));
    }
    return (<div class="terminal-pane">
      <solid_js_1.Show when={props.sessionID && props.runtimeURL} fallback={<div class="terminal-output">
            <div class="terminal-line terminal-line-header">
              选择一个会话以打开交互式终端
            </div>
          </div>}>
        <div class="terminal-toolbar">
          <select class="neu-form-input terminal-profile-select" value={shellProfile()} onChange={function (event) { return setShellProfile(event.currentTarget.value); }}>
            <option value="bash">bash</option>
            <option value="zsh">zsh</option>
            <option value="sh">sh</option>
            <option value="pwsh">pwsh</option>
          </select>
          <span class="terminal-owner-badge" data-owner={(_b = (_a = sessions().find(function (item) { return item.id === activeID(); })) === null || _a === void 0 ? void 0 : _a.inputOwner) !== null && _b !== void 0 ? _b : "model"}>
            {((_c = sessions().find(function (item) { return item.id === activeID(); })) === null || _c === void 0 ? void 0 : _c.inputOwner) ===
            "human"
            ? "人工控制"
            : "模型控制"}
          </span>
          <solid_js_1.Show when={((_d = sessions().find(function (item) { return item.id === activeID(); })) === null || _d === void 0 ? void 0 : _d.inputOwner) ===
            "model"}>
            <button type="button" class="terminal-toolbar-btn" onClick={function () { return void claimActiveTerminal(); }} title="接管终端">
              接管
            </button>
          </solid_js_1.Show>
          <solid_js_1.Show when={((_e = sessions().find(function (item) { return item.id === activeID(); })) === null || _e === void 0 ? void 0 : _e.inputOwner) ===
            "human"}>
            <button type="button" class="terminal-toolbar-btn" onClick={function () { return void releaseActiveTerminal(); }} title="交还模型控制">
              交还模型
            </button>
            <button type="button" class="terminal-toolbar-btn" onClick={function () { return void toggleSecureInput(); }} title={((_f = sessions().find(function (item) { return item.id === activeID(); })) === null || _f === void 0 ? void 0 : _f.secureInput)
            ? "结束安全输入"
            : "开始安全输入"}>
              {((_g = sessions().find(function (item) { return item.id === activeID(); })) === null || _g === void 0 ? void 0 : _g.secureInput)
            ? "结束安全输入"
            : "安全输入"}
            </button>
          </solid_js_1.Show>
          <input class="terminal-search-input" value={searchQuery()} placeholder="搜索终端" onInput={function (event) { return setSearchQuery(event.currentTarget.value); }} onKeyDown={function (event) {
            var _a, _b;
            if (event.key === "Enter")
                (_a = activeApi()) === null || _a === void 0 ? void 0 : _a.findNext(searchQuery());
            if (event.key === "Escape") {
                setSearchQuery("");
                (_b = activeApi()) === null || _b === void 0 ? void 0 : _b.findNext("");
            }
        }}/>
          <button type="button" class="terminal-toolbar-btn" onClick={function () { var _a; return (_a = activeApi()) === null || _a === void 0 ? void 0 : _a.findNext(searchQuery()); }} title="下一个匹配">
            ↓
          </button>
          <button type="button" class="terminal-toolbar-btn" onClick={function () { var _a; return (_a = activeApi()) === null || _a === void 0 ? void 0 : _a.findPrevious(searchQuery()); }} title="上一个匹配">
            ↑
          </button>
          <button type="button" class="terminal-toolbar-btn" onClick={function () { var _a; return (_a = activeApi()) === null || _a === void 0 ? void 0 : _a.reset(); }} title="刷新/重连当前终端">
            刷新
          </button>
          <button type="button" class="terminal-toolbar-btn" onClick={function () { var _a; return (_a = activeApi()) === null || _a === void 0 ? void 0 : _a.clear(); }} title="清空">
            清空
          </button>
          <button type="button" class="terminal-toolbar-btn" onClick={function () { var _a; return void ((_a = activeApi()) === null || _a === void 0 ? void 0 : _a.copy()); }} title="复制">
            复制
          </button>
          <button type="button" class="terminal-toolbar-btn" onClick={function () { var _a; return void ((_a = activeApi()) === null || _a === void 0 ? void 0 : _a.paste()); }} title="粘贴">
            粘贴
          </button>
          <button type="button" class="terminal-toolbar-btn" onClick={function () { var _a; return (_a = activeApi()) === null || _a === void 0 ? void 0 : _a.zoomOut(); }} title="缩小字体">
            A-
          </button>
          <button type="button" class="terminal-toolbar-btn" onClick={function () { var _a; return (_a = activeApi()) === null || _a === void 0 ? void 0 : _a.zoomIn(); }} title="放大字体">
            A+
          </button>
          <button type="button" class="terminal-toolbar-btn" onClick={function () { return splitActiveTab("horizontal"); }} title="纵向分屏">
            分屏↕
          </button>
          <button type="button" class="terminal-toolbar-btn" onClick={function () { return splitActiveTab("vertical"); }} title="横向分屏">
            分屏↔
          </button>
        </div>
        <div class="terminal-tabs">
          <solid_js_1.For each={tabs()}>
            {function (tab) {
            var _a;
            return (<button type="button" class="terminal-tab" data-active={activeID() === tab.id || tab.cells.includes((_a = activeID()) !== null && _a !== void 0 ? _a : "")} onClick={function () { return setActiveID(tab.cells[0]); }}>
                <span class="terminal-tab-label">{tab.title}</span>
                <span class="terminal-tab-close" role="button" aria-label={"\u5173\u95ED ".concat(tab.title)} onClick={function (event) {
                    event.stopPropagation();
                    void closeTab(tab.id);
                }}>
                  ×
                </span>
              </button>);
        }}
          </solid_js_1.For>
          <button type="button" class="terminal-tab-add" title="新建终端" disabled={tabs().length >= MAX_TERMINALS_PER_SESSION} onClick={function () { return void addTab(); }}>
            +
          </button>
        </div>
        <solid_js_1.Show when={limitError()}>
          <div class="terminal-limit-error">{limitError()}</div>
        </solid_js_1.Show>
        <div class="terminal-xterm-stack">
          <solid_js_1.For each={tabs()}>
            {function (tab) {
            var _a, _b;
            return (<div class="terminal-xterm-host" data-active={tab.cells.includes((_a = activeID()) !== null && _a !== void 0 ? _a : "")} style={{
                    display: tab.cells.includes((_b = activeID()) !== null && _b !== void 0 ? _b : "")
                        ? "flex"
                        : "none",
                }}>
                <div class="terminal-split-stack" style={{
                    "flex-direction": tab.layout === "vertical" ? "row" : "column",
                }}>
                  <solid_js_1.For each={tab.cells}>
                    {function (cellID) {
                    var _a;
                    return (<div class="terminal-split-cell" data-active={activeID() === cellID} onClick={function () { return setActiveID(cellID); }}>
                        <web_terminal_1.WebTerminal sessionID={props.sessionID} terminalID={cellID} runtimeURL={(_a = props.runtimeURL) !== null && _a !== void 0 ? _a : ""} token={props.token} active={props.active && activeID() === cellID} command={shellProfile()} registerApi={function (api) {
                            if (api)
                                terminalApis.set(cellID, api);
                            else
                                terminalApis.delete(cellID);
                        }}/>
                      </div>);
                }}
                  </solid_js_1.For>
                </div>
              </div>);
        }}
          </solid_js_1.For>
        </div>
      </solid_js_1.Show>
    </div>);
}
