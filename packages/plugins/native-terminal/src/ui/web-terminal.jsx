"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebTerminal = WebTerminal;
var solid_js_1 = require("solid-js");
var xterm_1 = require("@xterm/xterm");
var ui_kit_1 = require("@natalia/ui-kit");
var addon_fit_1 = require("@xterm/addon-fit");
var addon_web_links_1 = require("@xterm/addon-web-links");
var addon_search_1 = require("@xterm/addon-search");
var addon_unicode11_1 = require("@xterm/addon-unicode11");
require("@xterm/xterm/css/xterm.css");
var TRANSIENT_CLOSE_CODES = new Set([1001, 1006, 1012, 1013]);
function terminalSocketURL(runtimeURL, sessionID, terminalID, token, command) {
    var url = new URL("/terminal/".concat(encodeURIComponent(sessionID), "/").concat(encodeURIComponent(terminalID)), runtimeURL);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    if (token)
        url.searchParams.set("token", token);
    if (command)
        url.searchParams.set("command", command);
    return url.toString();
}
function WebTerminal(props) {
    var host;
    var term;
    var fit;
    var searchAddon;
    var socket;
    var windowResizeHandler;
    var reconnectTimer;
    var closed = false;
    var lastError;
    var fatal = false;
    var sessionReady = false;
    var lastResizeKey = "";
    var lastInputSentAt;
    var lastEchoLogged = false;
    function fitSafely() {
        if (!host || !fit)
            return;
        if (host.clientWidth <= 0 || host.clientHeight <= 0)
            return;
        try {
            fit.fit();
        }
        catch (_a) {
            // xterm can throw if the pane is hidden or its host is mid-layout.
        }
    }
    function validResize(rows, cols) {
        return (Number.isInteger(rows) &&
            Number.isInteger(cols) &&
            rows >= 1 &&
            rows <= 500 &&
            cols >= 1 &&
            cols <= 500);
    }
    function clampResize(rows, cols) {
        return {
            rows: Math.max(1, Math.min(500, Math.floor(rows))),
            cols: Math.max(1, Math.min(500, Math.floor(cols))),
        };
    }
    function sendResize(rows, cols, source) {
        if (closed || !sessionReady || !validResize(rows, cols)) {
            if (!closed) {
                console.warn("[web-terminal] ignore invalid resize", {
                    source: source,
                    rows: rows,
                    cols: cols,
                });
            }
            return;
        }
        var resizeKey = "".concat(props.terminalID, ":").concat(rows, ":").concat(cols);
        if (resizeKey === lastResizeKey)
            return;
        lastResizeKey = resizeKey;
        if ((socket === null || socket === void 0 ? void 0 : socket.readyState) === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "resize", rows: rows, cols: cols }));
            return;
        }
    }
    function theme() {
        // Follow the active UiSkin instead of forcing a dark terminal pane. The
        // app defaults to the light Neumorphism theme; keeping a hardcoded dark
        // background made the terminal bottomless black and hard to read.
        // The terminal pane deliberately keeps a black background so full-screen
        // TUIs remain readable regardless of the surrounding light UI theme.
        var background = "#1e1e20";
        return {
            background: background,
            foreground: "#e5e5e5",
            cursor: (0, ui_kit_1.cssVar)("--neu-accent", "#5fd4b8"),
            selectionBackground: (0, ui_kit_1.cssVar)("--neu-accent-soft", "#7de8d0"),
            // Standard xterm 16-color palette. Keeps terminal apps that rely on
            // conventional ANSI colors (ls, vim, htop, tmux) looking normal while
            // staying readable on the dark #1b1e24 terminal background.
            black: "#000000",
            red: "#cd0000",
            green: "#00cd00",
            yellow: "#cdcd00",
            blue: "#0000ee",
            magenta: "#cd00cd",
            cyan: "#00cdcd",
            white: "#e5e5e5",
            brightBlack: "#7f7f7f",
            brightRed: "#ff0000",
            brightGreen: "#00ff00",
            brightYellow: "#ffff00",
            brightBlue: "#5c5cff",
            brightMagenta: "#ff00ff",
            brightCyan: "#00ffff",
            brightWhite: "#ffffff",
        };
    }
    function scheduleReconnect() {
        if (closed || fatal)
            return;
        if (reconnectTimer)
            clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 1500);
    }
    function handleServerMessage(message) {
        if (closed)
            return;
        if (message.type === "restore") {
            term === null || term === void 0 ? void 0 : term.clear();
            if (message.text)
                term === null || term === void 0 ? void 0 : term.write(message.text);
        }
        if (message.type === "output") {
            if (lastInputSentAt !== undefined && !lastEchoLogged) {
                lastEchoLogged = true;
                console.warn("[terminal] echo delay ".concat((performance.now() - lastInputSentAt).toFixed(1), "ms"));
                lastInputSentAt = undefined;
            }
            term === null || term === void 0 ? void 0 : term.write(message.data);
        }
        if (message.type === "error") {
            if (message.message === lastError)
                return;
            lastError = message.message;
            term === null || term === void 0 ? void 0 : term.writeln("\r\n[".concat(message.message, "]"));
            if (message.fatal)
                fatal = true;
        }
        if (message.type === "exit")
            term === null || term === void 0 ? void 0 : term.writeln("\r\n[terminated]");
        if (message.type === "ready") {
            lastError = undefined;
            if (term && fit) {
                fitSafely();
                var _a = clampResize(term.rows, term.cols), rows = _a.rows, cols = _a.cols;
                if (validResize(rows, cols))
                    sendResize(rows, cols, "ready");
            }
        }
    }
    function connect() {
        if (closed ||
            fatal ||
            !props.sessionID ||
            !props.terminalID ||
            !props.runtimeURL)
            return;
        console.log("[web-terminal] using WebSocket transport");
        var previous = socket;
        socket = undefined;
        previous === null || previous === void 0 ? void 0 : previous.close();
        var ws = new WebSocket(terminalSocketURL(props.runtimeURL, props.sessionID, props.terminalID, props.token, props.command));
        socket = ws;
        ws.onmessage = function (event) {
            var message;
            try {
                message = JSON.parse(String(event.data));
            }
            catch (_a) {
                return;
            }
            if (lastInputSentAt !== undefined && !lastEchoLogged) {
                lastEchoLogged = true;
                console.warn("[terminal] echo delay ".concat((performance.now() - lastInputSentAt).toFixed(1), "ms"));
                lastInputSentAt = undefined;
            }
            if (message.type === "restore") {
                term === null || term === void 0 ? void 0 : term.clear();
                if (message.text)
                    term === null || term === void 0 ? void 0 : term.write(message.text);
            }
            if (message.type === "output")
                term === null || term === void 0 ? void 0 : term.write(message.data);
            if (message.type === "error") {
                if (message.message === lastError)
                    return;
                lastError = message.message;
                term === null || term === void 0 ? void 0 : term.writeln("\r\n[".concat(message.message, "]"));
                if (message.fatal)
                    fatal = true;
            }
            if (message.type === "exit")
                term === null || term === void 0 ? void 0 : term.writeln("\r\n[terminated]");
            if (message.type === "ready") {
                lastError = undefined;
                if (term && fit && ws.readyState === WebSocket.OPEN) {
                    fitSafely();
                    var _b = clampResize(term.rows, term.cols), rows = _b.rows, cols = _b.cols;
                    if (validResize(rows, cols))
                        ws.send(JSON.stringify({
                            type: "resize",
                            rows: rows,
                            cols: cols,
                        }));
                }
            }
        };
        ws.onopen = function () {
            lastError = undefined;
            sessionReady = true;
            // The server replays the full PTY buffer through the output subscription
            // immediately after opening; clear before that arrives so reconnect does
            // not append a duplicate screen.
            try {
                term === null || term === void 0 ? void 0 : term.clear();
            }
            catch (_a) {
                // xterm may not be ready yet
            }
        };
        ws.onclose = function (event) {
            if (socket !== ws || closed || fatal)
                return;
            if (event.code === 1011) {
                fatal = true;
                if (!lastError) {
                    lastError = event.reason || "terminal unavailable";
                    term === null || term === void 0 ? void 0 : term.writeln("\r\n[".concat(lastError, "]"));
                }
                return;
            }
            if (TRANSIENT_CLOSE_CODES.has(event.code) || event.code === 1006) {
                scheduleReconnect();
                return;
            }
            if (!lastError) {
                lastError = event.reason || "disconnected (".concat(event.code, ")");
                term === null || term === void 0 ? void 0 : term.writeln("\r\n[".concat(lastError, "]"));
            }
            scheduleReconnect();
        };
    }
    (0, solid_js_1.onMount)(function () {
        var _a;
        if (!host)
            return;
        fit = new addon_fit_1.FitAddon();
        term = new xterm_1.Terminal({
            cursorBlink: true,
            fontFamily: '"JetBrains Mono", "SF Mono", Consolas, monospace',
            fontSize: 12,
            theme: theme(),
            convertEol: true,
            // xterm addons (WebGL/Canvas) use proposed APIs such as
            // registerCharacterJoiner; they require this flag to be enabled.
            allowProposedApi: true,
        });
        // Keep browser-only shortcuts (notably Ctrl+W, which closes the tab)
        // from stealing keys that terminal programs like vim/tmux need.
        term.attachCustomKeyEventHandler(function (event) {
            if (event.type !== "keydown" && event.type !== "keyup")
                return true;
            var key = event.key.toLowerCase();
            if (event.ctrlKey && event.shiftKey && key === "c") {
                event.preventDefault();
                var selected = term === null || term === void 0 ? void 0 : term.getSelection();
                if (selected)
                    void navigator.clipboard.writeText(selected);
                return false;
            }
            if (event.ctrlKey && event.shiftKey && key === "v") {
                event.preventDefault();
                void navigator.clipboard
                    .readText()
                    .then(function (text) {
                    if (text)
                        term === null || term === void 0 ? void 0 : term.paste(text);
                })
                    .catch(function () { return undefined; });
                return false;
            }
            if (event.ctrlKey && !event.shiftKey && key === "w") {
                event.preventDefault();
                return false;
            }
            return true;
        });
        term.loadAddon(fit);
        term.loadAddon(new addon_web_links_1.WebLinksAddon());
        var unicode11 = new addon_unicode11_1.Unicode11Addon();
        term.loadAddon(unicode11);
        term.unicode.activeVersion = "11";
        // Use the DOM renderer. On this desktop hardware acceleration is off by
        // default, and both WebGL and Canvas renderers under software rendering
        // make xterm input feel laggy.
        searchAddon = new addon_search_1.SearchAddon();
        term.loadAddon(searchAddon);
        term.open(host);
        fitSafely();
        term.onData(function (data) {
            if (closed)
                return;
            if ((socket === null || socket === void 0 ? void 0 : socket.readyState) === WebSocket.OPEN) {
                lastInputSentAt = performance.now();
                lastEchoLogged = false;
                socket.send(JSON.stringify({ type: "input", data: data }));
                return;
            }
        });
        term.onResize(function (_a) {
            var cols = _a.cols, rows = _a.rows;
            if (closed)
                return;
            sendResize(rows, cols, "xterm-onResize");
        });
        windowResizeHandler = function () {
            if (!props.active)
                return;
            fitSafely();
        };
        window.addEventListener("resize", windowResizeHandler);
        (_a = props.registerApi) === null || _a === void 0 ? void 0 : _a.call(props, api);
        connect();
    });
    (0, solid_js_1.createEffect)(function (previous) {
        var key = "".concat(props.sessionID, "\0").concat(props.terminalID, "\0").concat(props.runtimeURL);
        if (previous && previous !== key && term) {
            fatal = false;
            lastError = undefined;
            term.reset();
            connect();
        }
        return key;
    });
    (0, solid_js_1.createEffect)(function () {
        if (props.active)
            fitSafely();
    });
    var fontSize = 12;
    function changeFontSize(delta) {
        fontSize = Math.max(8, Math.min(24, fontSize + delta));
        if (term)
            term.options.fontSize = fontSize;
        fitSafely();
    }
    function copySelection() {
        return __awaiter(this, void 0, void 0, function () {
            var selected, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        selected = term === null || term === void 0 ? void 0 : term.getSelection();
                        if (!selected) return [3 /*break*/, 4];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, navigator.clipboard.writeText(selected)];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    function pasteFromClipboard() {
        return __awaiter(this, void 0, void 0, function () {
            var text, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, navigator.clipboard.readText()];
                    case 1:
                        text = _b.sent();
                        if (text)
                            term === null || term === void 0 ? void 0 : term.paste(text);
                        return [3 /*break*/, 3];
                    case 2:
                        _a = _b.sent();
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    var api = {
        clear: function () { return term === null || term === void 0 ? void 0 : term.clear(); },
        findNext: function (query) { return Boolean(searchAddon === null || searchAddon === void 0 ? void 0 : searchAddon.findNext(query)); },
        findPrevious: function (query) { return Boolean(searchAddon === null || searchAddon === void 0 ? void 0 : searchAddon.findPrevious(query)); },
        reset: function () {
            try {
                term === null || term === void 0 ? void 0 : term.reset();
                term === null || term === void 0 ? void 0 : term.clear();
            }
            catch (_a) {
                // xterm may be in a weird state; reconnect below
            }
            connect();
        },
        copy: copySelection,
        paste: pasteFromClipboard,
        zoomIn: function () { return changeFontSize(1); },
        zoomOut: function () { return changeFontSize(-1); },
    };
    (0, solid_js_1.onCleanup)(function () {
        var _a;
        console.log("[web-terminal] cleanup", {
            sessionID: props.sessionID,
            terminalID: props.terminalID,
        });
        closed = true;
        (_a = props.registerApi) === null || _a === void 0 ? void 0 : _a.call(props, undefined);
        if (reconnectTimer)
            clearTimeout(reconnectTimer);
        if (windowResizeHandler)
            window.removeEventListener("resize", windowResizeHandler);
        socket === null || socket === void 0 ? void 0 : socket.close();
        try {
            term === null || term === void 0 ? void 0 : term.dispose();
        }
        catch (error) {
            console.error("[web-terminal] xterm dispose failed", error);
        }
        term = undefined;
    });
    return <div class="web-terminal" ref={host}/>;
}
