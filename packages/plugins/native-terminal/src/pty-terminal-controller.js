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
exports.createPtyTerminalController = createPtyTerminalController;
var node_crypto_1 = require("node:crypto");
var node_child_process_1 = require("node:child_process");
var node_module_1 = require("node:module");
var node_path_1 = require("node:path");
var native_terminal_1 = require("./native-terminal");
var DEFAULT_ROWS = 24;
var DEFAULT_COLS = 80;
var MAX_OUTPUT_BYTES = 256 * 1024;
var DEFAULT_MAX_PER_SESSION = 8;
var DEFAULT_IDLE_MS = 15 * 60 * 1000;
var PYTHON_PTY_BRIDGE = "\nimport fcntl, json, os, pty, select, signal, struct, sys, termios\n\nstdin = sys.stdin.fileno()\nstdout = sys.stdout.fileno()\npending = b\"\"\n\ndef read_line():\n    global pending\n    while True:\n        index = pending.find(b\"\\n\")\n        if index >= 0:\n            line = pending[:index]\n            pending = pending[index + 1:]\n            return line.decode(\"utf-8\")\n        chunk = os.read(stdin, 4096)\n        if not chunk:\n            return None\n        pending += chunk\n\nspec = json.loads(read_line())\npid, master = pty.fork()\nif pid == 0:\n    os.chdir(spec[\"cwd\"])\n    env = os.environ.copy()\n    env.update(spec.get(\"env\") or {})\n    os.execvpe(spec[\"file\"], [spec[\"file\"], *spec[\"args\"]], env)\nfcntl.ioctl(\n    master,\n    termios.TIOCSWINSZ,\n    struct.pack(\"HHHH\", spec[\"rows\"], spec[\"cols\"], 0, 0),\n)\nos.write(stdout, (json.dumps({\"pid\": pid}) + \"\\n\").encode(\"ascii\"))\n\ndef send(kind, payload=b\"\"):\n    data = payload if isinstance(payload, bytes) else payload.encode(\"utf-8\")\n    os.write(stdout, f\"{kind} {len(data)}\\n\".encode(\"ascii\"))\n    if data:\n        os.write(stdout, data)\n\ndef handle_line(line):\n    message = json.loads(line)\n    kind = message.get(\"type\")\n    if kind == \"input\":\n        os.write(master, message.get(\"data\", \"\").encode(\"utf-8\"))\n        return True\n    if kind == \"resize\":\n        fcntl.ioctl(\n            master,\n            termios.TIOCSWINSZ,\n            struct.pack(\"HHHH\", int(message[\"rows\"]), int(message[\"cols\"]), 0, 0),\n        )\n        return True\n    if kind == \"kill\":\n        os.kill(pid, signal.SIGTERM)\n        return False\n    return True\n\n# A message can arrive in the same socket read as the startup spec \u2014 the host\n# writes its first input the instant start() returns, before this interpreter\n# has finished booting. read_line leaves such a line in pending, and the\n# select loop below only reacts to NEW bytes, so without this drain the first\n# input of a freshly started terminal is silently dropped. Process whatever\n# the spec read already consumed before blocking in select.\nalive = True\nwhile True:\n    index = pending.find(b\"\\n\")\n    if index < 0:\n        break\n    line = pending[:index].decode(\"utf-8\")\n    pending = pending[index + 1:]\n    if not handle_line(line):\n        alive = False\n        break\n\nwhile alive:\n    readable, _, _ = select.select([stdin, master], [], [])\n    if stdin in readable:\n        chunk = os.read(stdin, 4096)\n        if not chunk:\n            alive = False\n            break\n        pending += chunk\n        while True:\n            index = pending.find(b\"\\n\")\n            if index < 0:\n                break\n            line = pending[:index].decode(\"utf-8\")\n            pending = pending[index + 1:]\n            if not handle_line(line):\n                alive = False\n                break\n    if not alive:\n        break\n    if master in readable:\n        try:\n            chunk = os.read(master, 4096)\n        except OSError:\n            chunk = b\"\"\n        if not chunk:\n            alive = False\n            break\n        send(\"o\", chunk)\ntry:\n    waited, status = os.waitpid(pid, 0)\n    code = os.WEXITSTATUS(status) if os.WIFEXITED(status) else 1\nexcept ChildProcessError:\n    code = 0\nsend(\"x\", str(code))\n";
function loadNodePty() {
    var candidates = [
        import.meta.url,
        (0, node_path_1.resolve)(process.cwd(), "packages/plugins/native-terminal/package.json"),
        (0, node_path_1.resolve)(process.cwd(), "package.json"),
    ];
    var lastError;
    for (var _i = 0, candidates_1 = candidates; _i < candidates_1.length; _i++) {
        var candidate = candidates_1[_i];
        try {
            var pty = (0, node_module_1.createRequire)(candidate)("node-pty");
            if (typeof pty.spawn !== "function")
                throw new Error("node-pty spawn is missing");
            return pty;
        }
        catch (error) {
            lastError = error;
        }
    }
    throw lastError instanceof Error
        ? lastError
        : new Error("node-pty is not installed");
}
function spawnWithNodePty(options) {
    var pty = loadNodePty();
    var child = pty.spawn(options.file, options.args, {
        name: "xterm-256color",
        cols: options.cols,
        rows: options.rows,
        cwd: options.cwd,
        env: options.env,
    });
    return {
        pid: child.pid,
        write: function (data) {
            child.write(data);
        },
        resize: function (cols, rows) {
            child.resize(cols, rows);
        },
        kill: function (signal) {
            child.kill(signal);
        },
        onData: function (listener) {
            return child.onData(listener);
        },
        onExit: function (listener) {
            return child.onExit(listener);
        },
    };
}
function spawnWithPythonPty(options) {
    var _a, _b;
    var child = (0, node_child_process_1.spawn)("python3", ["-u", "-c", PYTHON_PTY_BRIDGE], {
        stdio: ["pipe", "pipe", "inherit"],
    });
    if (!child.stdin || !child.stdout || child.pid == null)
        throw new Error("python pty bridge failed to start");
    child.stdin.write("".concat(JSON.stringify({
        file: options.file,
        args: options.args,
        cwd: options.cwd,
        cols: options.cols,
        rows: options.rows,
        env: (_a = options.env) !== null && _a !== void 0 ? _a : {},
    }), "\n"));
    var dataListeners = new Set();
    var exitListeners = new Set();
    var pid = child.pid;
    var leftover = Buffer.alloc(0);
    var header;
    var exited = false;
    function emitExit(exitCode) {
        if (exited)
            return;
        exited = true;
        for (var _i = 0, exitListeners_1 = exitListeners; _i < exitListeners_1.length; _i++) {
            var listener = exitListeners_1[_i];
            listener({ exitCode: exitCode });
        }
    }
    function consume(chunk) {
        leftover = Buffer.concat([leftover, chunk]);
        while (leftover.length) {
            if (!header) {
                var newline = leftover.indexOf(10);
                if (newline < 0)
                    return;
                var line = leftover.subarray(0, newline).toString("utf8");
                leftover = leftover.subarray(newline + 1);
                if (line.startsWith("{")) {
                    try {
                        var parsed = JSON.parse(line);
                        if (typeof parsed.pid === "number")
                            pid = parsed.pid;
                    }
                    catch (_a) {
                        // ignore malformed handshake
                    }
                    continue;
                }
                var match = /^(o|x) (\d+)$/u.exec(line);
                if (!match)
                    continue;
                header = { kind: match[1], size: Number(match[2]) };
                continue;
            }
            if (leftover.length < header.size)
                return;
            var payload = leftover.subarray(0, header.size);
            leftover = leftover.subarray(header.size);
            if (header.kind === "o") {
                var text = payload.toString("utf8");
                for (var _i = 0, dataListeners_1 = dataListeners; _i < dataListeners_1.length; _i++) {
                    var listener = dataListeners_1[_i];
                    listener(text);
                }
            }
            else {
                emitExit(Number(payload.toString("utf8") || "0"));
            }
            header = undefined;
        }
    }
    var childEvents = child;
    (_b = childEvents.stdout) === null || _b === void 0 ? void 0 : _b.on("data", function (chunk) {
        consume(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    childEvents.on("exit", function (code) { return emitExit(code !== null && code !== void 0 ? code : 0); });
    function send(message) {
        var _a;
        if (!((_a = child.stdin) === null || _a === void 0 ? void 0 : _a.writable))
            return;
        child.stdin.write("".concat(JSON.stringify(message), "\n"));
    }
    return {
        get pid() {
            return pid;
        },
        write: function (data) {
            send({ type: "input", data: data });
        },
        resize: function (cols, rows) {
            send({ type: "resize", cols: cols, rows: rows });
        },
        kill: function () {
            send({ type: "kill" });
            child.kill();
        },
        onData: function (listener) {
            dataListeners.add(listener);
            return {
                dispose: function () {
                    dataListeners.delete(listener);
                },
            };
        },
        onExit: function (listener) {
            exitListeners.add(listener);
            return {
                dispose: function () {
                    exitListeners.delete(listener);
                },
            };
        },
    };
}
function defaultSpawn() {
    return function (options) {
        if (typeof Bun !== "undefined")
            return spawnWithPythonPty(options);
        try {
            return spawnWithNodePty(options);
        }
        catch (_a) {
            return spawnWithPythonPty(options);
        }
    };
}
function envRecord() {
    var env = {};
    for (var _i = 0, _a = Object.entries(process.env); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        if (typeof value === "string")
            env[key] = value;
    }
    env.TERM = env.TERM || "xterm-256color";
    env.COLORTERM = env.COLORTERM || "truecolor";
    return env;
}
function trimOutput(text) {
    if (text.length <= MAX_OUTPUT_BYTES)
        return text;
    return text.slice(text.length - MAX_OUTPUT_BYTES);
}
function lineWindow(text, maxLines) {
    if (!maxLines || maxLines <= 0)
        return text;
    var lines = text.split("\n");
    if (lines.at(-1) === "")
        lines.pop();
    return lines.slice(-maxLines).join("\n");
}
/**
 * In-process PTY TerminalController for the Web interactive terminal.
 * One Natalia session may own several PTYs (capped); start() is idempotent
 * per terminalID; close() kills every remaining process.
 */
function createPtyTerminalController(input) {
    var _a, _b, _c;
    var sessions = new Map();
    var idempotency = new Map();
    var writes = new Map();
    var revisionWaiters = new Map();
    var outputListeners = new Map();
    var activeSession;
    var closed = false;
    var initialized = false;
    var spawnPty = (_a = input.spawn) !== null && _a !== void 0 ? _a : defaultSpawn();
    var maxPerSession = Math.max(1, (_b = input.maxPerSession) !== null && _b !== void 0 ? _b : DEFAULT_MAX_PER_SESSION);
    var idleMs = Math.max(1, (_c = input.idleMs) !== null && _c !== void 0 ? _c : DEFAULT_IDLE_MS);
    function sessionVisible(session) {
        return activeSession === undefined || session.sessionID === activeSession;
    }
    function assertSessionOwner(session, sessionID) {
        var expected = sessionID !== null && sessionID !== void 0 ? sessionID : activeSession;
        if (expected && session.sessionID && session.sessionID !== expected)
            throw new Error("terminal ".concat(session.id, " belongs to session ").concat(session.sessionID));
    }
    function get(id) {
        var session = sessions.get(id);
        if (!session)
            throw new Error("native terminal session not found: ".concat(id));
        return session;
    }
    function notifyRevision(id) {
        var _a;
        for (var _i = 0, _b = (_a = revisionWaiters.get(id)) !== null && _a !== void 0 ? _a : []; _i < _b.length; _i++) {
            var wake = _b[_i];
            wake();
        }
    }
    function waitForRevision(id, timeoutMs) {
        return new Promise(function (resolve) {
            var _a;
            var waiters = (_a = revisionWaiters.get(id)) !== null && _a !== void 0 ? _a : new Set();
            var wake = function () {
                clearTimeout(timer);
                waiters.delete(wake);
                if (!waiters.size)
                    revisionWaiters.delete(id);
                resolve();
            };
            var timer = setTimeout(wake, timeoutMs);
            waiters.add(wake);
            revisionWaiters.set(id, waiters);
        });
    }
    function publishAudit(session, action, actor, detail) {
        var sessionID = session.sessionID;
        input.publish(__assign(__assign({ type: "terminal.action", id: session.id }, (sessionID ? { sessionID: sessionID } : {})), { action: action, redacted: action === "write" ? false : undefined, target: { kind: "host", cwd: session.cwd } }));
        input.publish(__assign(__assign({ type: "terminal.timeline", id: session.id }, (sessionID ? { sessionID: sessionID } : {})), { actor: actor === "human" ? "user" : actor, action: action, status: "executed", summary: action === "request_human"
                ? (detail !== null && detail !== void 0 ? detail : "pty terminal requests human attention")
                : action === "started"
                    ? "pty terminal started"
                    : action === "write"
                        ? "pty terminal input accepted"
                        : "pty terminal ".concat(action, " executed"), at: new Date().toISOString() }));
    }
    function publicSession(session) {
        var _a, _b;
        return __assign(__assign({ id: session.id, host: "pty", paneID: (_b = (_a = session.pty) === null || _a === void 0 ? void 0 : _a.pid) !== null && _b !== void 0 ? _b : 0, windowID: 0, muxWindowID: 0, tabID: 0, command: session.command, cwd: session.cwd, status: session.status, inputOwner: session.inputOwner, geometryOwner: session.geometryOwner, secureInput: session.secureInput, rows: session.rows, cols: session.cols, startedAt: session.startedAt, attached: session.attached }, (session.sessionID ? { sessionID: session.sessionID } : {})), (session.agentID ? { agentID: session.agentID } : {}));
    }
    function touch(session) {
        session.lastActivityAt = Date.now();
    }
    function appendOutput(session, chunk) {
        var _a;
        if (!chunk)
            return;
        session.output = trimOutput(session.output + chunk);
        session.revision += 1;
        session.lastOutputAt = Date.now();
        touch(session);
        notifyRevision(session.id);
        for (var _i = 0, _b = (_a = outputListeners.get(session.id)) !== null && _a !== void 0 ? _a : []; _i < _b.length; _i++) {
            var listener = _b[_i];
            listener(chunk);
        }
    }
    function markExited(session, actor) {
        if (session.status === "exited")
            return;
        session.status = "exited";
        session.attached = false;
        session.revision += 1;
        notifyRevision(session.id);
        idempotency.delete(session.id);
        writes.delete(session.id);
        for (var _i = 0, _a = session.disposers; _i < _a.length; _i++) {
            var disposer = _a[_i];
            disposer.dispose();
        }
        session.disposers = [];
        session.pty = undefined;
        publishAudit(session, "exit", actor);
    }
    function runningForSession(sessionID) {
        var key = sessionID !== null && sessionID !== void 0 ? sessionID : "__default__";
        return __spreadArray([], sessions.values(), true).filter(function (session) {
            var _a;
            var owner = (_a = session.sessionID) !== null && _a !== void 0 ? _a : "__default__";
            return owner === key && session.status === "running";
        });
    }
    function recycleOldestIdle(sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var now, idle, victim;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = Date.now();
                        idle = runningForSession(sessionID)
                            .filter(function (session) { return now - session.lastActivityAt >= idleMs; })
                            .sort(function (a, b) { return a.lastActivityAt - b.lastActivityAt; });
                        victim = idle[0];
                        if (!victim)
                            return [2 /*return*/, false];
                        return [4 /*yield*/, stop(victim.id, "system")];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    }
    function assertRunning(session) {
        if (session.status !== "running")
            throw new Error("terminal session has exited");
    }
    function assertReadable(session) {
        assertRunning(session);
        if (session.secureInput)
            throw new Error("terminal output is hidden during secure human input");
    }
    function init() {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (closed)
                    throw new Error("terminal controller is closed");
                initialized = true;
                return [2 /*return*/];
            });
        });
    }
    function list(sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, __spreadArray([], sessions.values(), true).filter(function (session) {
                        return sessionID ? session.sessionID === sessionID : sessionVisible(session);
                    })
                        .map(publicSession)];
            });
        });
    }
    function reconcile() {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, list()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function read(id, options) {
        return __awaiter(this, void 0, void 0, function () {
            var session;
            return __generator(this, function (_a) {
                session = get(id);
                assertSessionOwner(session, options === null || options === void 0 ? void 0 : options.sessionID);
                assertReadable(session);
                return [2 /*return*/, {
                        text: lineWindow(session.output, options === null || options === void 0 ? void 0 : options.maxLines),
                        cursorX: 0,
                        cursorY: 0,
                        rows: session.rows,
                        cols: session.cols,
                    }];
            });
        });
    }
    function openHub() {
        return __awaiter(this, void 0, void 0, function () {
            var first;
            return __generator(this, function (_a) {
                first = __spreadArray([], sessions.values(), true).find(function (session) { return session.status === "running" && sessionVisible(session); });
                if (!first)
                    throw new Error("no running native terminal session");
                first.attached = true;
                return [2 /*return*/, { muxWindowID: 0 }];
            });
        });
    }
    function releaseHumanControl(id, sessionID) {
        var session = get(id);
        assertSessionOwner(session, sessionID);
        if (session.secureInput)
            throw new Error("secure input must end before returning control to model");
        session.inputOwner = "model";
        session.revision += 1;
        notifyRevision(session.id);
        publishAudit(session, "detach", "human");
        return publicSession(session);
    }
    function beginSecureInput(id, sessionID) {
        var session = get(id);
        assertSessionOwner(session, sessionID);
        assertRunning(session);
        if (session.inputOwner !== "human")
            throw new Error("secure input requires human terminal control");
        session.secureInput = true;
        session.revision += 1;
        notifyRevision(session.id);
        publishAudit(session, "secure_input", "human");
        return publicSession(session);
    }
    function endSecureInput(id, sessionID) {
        var session = get(id);
        assertSessionOwner(session, sessionID);
        session.secureInput = false;
        session.revision += 1;
        notifyRevision(session.id);
        publishAudit(session, "secure_input", "human");
        return publicSession(session);
    }
    function claimHumanInput(id, sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var session;
            return __generator(this, function (_a) {
                session = get(id);
                assertSessionOwner(session, sessionID);
                assertRunning(session);
                if (session.secureInput && session.inputOwner !== "human")
                    throw new Error("secure input requires human terminal control");
                if (session.inputOwner === "human")
                    return [2 /*return*/, publicSession(session)];
                session.inputOwner = "human";
                session.revision += 1;
                notifyRevision(session.id);
                publishAudit(session, "write", "human");
                return [2 /*return*/, publicSession(session)];
            });
        });
    }
    function stop(id, actor, sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var session;
            var _a;
            return __generator(this, function (_b) {
                session = get(id);
                assertSessionOwner(session, sessionID);
                if (session.status === "running") {
                    try {
                        (_a = session.pty) === null || _a === void 0 ? void 0 : _a.kill();
                    }
                    catch (_c) {
                        // process already gone
                    }
                }
                markExited(session, actor);
                return [2 /*return*/, publicSession(session)];
            });
        });
    }
    function start(startInput) {
        return __awaiter(this, void 0, void 0, function () {
            var owningSession, existing, running, recycled, argv, file, args, id, now, session, started, pty;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (closed)
                            throw new Error("terminal controller is closed");
                        if (!!initialized) return [3 /*break*/, 2];
                        return [4 /*yield*/, init()];
                    case 1:
                        _d.sent();
                        _d.label = 2;
                    case 2:
                        owningSession = (_a = startInput.sessionID) !== null && _a !== void 0 ? _a : activeSession;
                        if (startInput.id) {
                            existing = sessions.get(startInput.id);
                            if ((existing === null || existing === void 0 ? void 0 : existing.status) === "running") {
                                if (existing.sessionID &&
                                    owningSession &&
                                    existing.sessionID !== owningSession)
                                    throw new Error("terminal ".concat(existing.id, " belongs to session ").concat(existing.sessionID));
                                touch(existing);
                                return [2 /*return*/, publicSession(existing)];
                            }
                        }
                        running = runningForSession(owningSession);
                        if (!(running.length >= maxPerSession)) return [3 /*break*/, 4];
                        return [4 /*yield*/, recycleOldestIdle(owningSession)];
                    case 3:
                        recycled = _d.sent();
                        if (!recycled || runningForSession(owningSession).length >= maxPerSession)
                            throw new Error("session already has ".concat(maxPerSession, " running terminals"));
                        _d.label = 4;
                    case 4:
                        argv = (0, native_terminal_1.nativeTerminalPaneCommand)(startInput.command);
                        file = (_b = argv[0]) !== null && _b !== void 0 ? _b : "/bin/sh";
                        args = argv.slice(1);
                        id = (_c = startInput.id) !== null && _c !== void 0 ? _c : "terminal_".concat((0, node_crypto_1.randomUUID)());
                        now = Date.now();
                        session = __assign(__assign({ id: id, sessionID: owningSession }, (startInput.agentID ? { agentID: startInput.agentID } : {})), { command: startInput.command, cwd: startInput.cwd, startedAt: new Date().toISOString(), status: "running", inputOwner: "model", geometryOwner: "human", secureInput: false, attached: true, rows: DEFAULT_ROWS, cols: DEFAULT_COLS, revision: 0, output: "", lastActivityAt: now, disposers: [] });
                        started = performance.now();
                        pty = spawnPty({
                            file: file,
                            args: args,
                            cwd: startInput.cwd,
                            cols: DEFAULT_COLS,
                            rows: DEFAULT_ROWS,
                            env: envRecord(),
                        });
                        session.pty = pty;
                        session.disposers.push(pty.onData(function (chunk) {
                            appendOutput(session, chunk);
                        }), pty.onExit(function () {
                            markExited(session, "system");
                        }));
                        sessions.set(id, session);
                        input.onPerformance("pty.start", performance.now() - started);
                        publishAudit(session, "started", "model");
                        return [2 /*return*/, publicSession(session)];
                }
            });
        });
    }
    function write(id, value, options) {
        return __awaiter(this, void 0, void 0, function () {
            var session, writtenBytes, keys, previous_1, previous, cancelled, delivery, error_1;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        session = get(id);
                        assertSessionOwner(session, options === null || options === void 0 ? void 0 : options.sessionID);
                        assertRunning(session);
                        if (session.inputOwner !== "model")
                            throw new Error("terminal input is controlled by a human");
                        if (session.secureInput)
                            throw new Error("terminal is accepting secure human input");
                        writtenBytes = new TextEncoder().encode(value).byteLength;
                        if (options === null || options === void 0 ? void 0 : options.idempotencyKey) {
                            keys = (_a = idempotency.get(id)) !== null && _a !== void 0 ? _a : new Map();
                            previous_1 = keys.get(options.idempotencyKey);
                            if (previous_1 !== undefined) {
                                if (previous_1 !== value)
                                    throw new Error("terminal idempotency key was reused with different input");
                                return [2 /*return*/, { writtenBytes: writtenBytes, delivery: "duplicate" }];
                            }
                            keys.set(options.idempotencyKey, value);
                            idempotency.set(id, keys);
                            while (keys.size > 256)
                                keys.delete(keys.keys().next().value);
                        }
                        previous = (_b = writes.get(id)) !== null && _b !== void 0 ? _b : Promise.resolve();
                        cancelled = false;
                        delivery = previous.then(function () {
                            var _a;
                            if (session.inputOwner !== "model" || session.status !== "running") {
                                cancelled = true;
                                return;
                            }
                            (_a = session.pty) === null || _a === void 0 ? void 0 : _a.write(value);
                        });
                        writes.set(id, delivery.catch(function () { return undefined; }));
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, delivery];
                    case 2:
                        _e.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _e.sent();
                        if (options === null || options === void 0 ? void 0 : options.idempotencyKey)
                            (_c = idempotency.get(id)) === null || _c === void 0 ? void 0 : _c.delete(options.idempotencyKey);
                        throw error_1;
                    case 4:
                        if (cancelled) {
                            if (options === null || options === void 0 ? void 0 : options.idempotencyKey)
                                (_d = idempotency.get(id)) === null || _d === void 0 ? void 0 : _d.delete(options.idempotencyKey);
                            return [2 /*return*/, { writtenBytes: writtenBytes, delivery: "cancelled" }];
                        }
                        session.revision += 1;
                        session.lastModelWriteAt = Date.now();
                        touch(session);
                        notifyRevision(session.id);
                        publishAudit(session, "write", "model");
                        return [2 /*return*/, { writtenBytes: writtenBytes, delivery: "accepted" }];
                }
            });
        });
    }
    function resize(id, rows, cols, actor, sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var session;
            var _a;
            return __generator(this, function (_b) {
                session = get(id);
                assertSessionOwner(session, sessionID);
                assertRunning(session);
                if (!Number.isInteger(rows) || rows < 1 || rows > 500)
                    throw new Error("terminal rows must be an integer between 1 and 500");
                if (!Number.isInteger(cols) || cols < 1 || cols > 500)
                    throw new Error("terminal cols must be an integer between 1 and 500");
                (_a = session.pty) === null || _a === void 0 ? void 0 : _a.resize(cols, rows);
                session.rows = rows;
                session.cols = cols;
                session.revision += 1;
                touch(session);
                notifyRevision(session.id);
                publishAudit(session, "resize", actor);
                return [2 /*return*/, publicSession(session)];
            });
        });
    }
    function snapshot(id) {
        return __awaiter(this, void 0, void 0, function () {
            var session;
            return __generator(this, function (_a) {
                session = get(id);
                assertReadable(session);
                return [2 /*return*/, {
                        text: session.output,
                        cursorX: 0,
                        cursorY: 0,
                        rows: session.rows,
                        cols: session.cols,
                        revision: session.revision,
                        status: session.status,
                        inputOwner: session.inputOwner,
                        highlightRanges: [],
                    }];
            });
        });
    }
    function observe(id, afterRevision, options) {
        return __awaiter(this, void 0, void 0, function () {
            var session, timeoutMs, deadline, text;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        session = get(id);
                        timeoutMs = Math.max(1, Math.min((_a = options === null || options === void 0 ? void 0 : options.timeoutMs) !== null && _a !== void 0 ? _a : 5000, 30000));
                        deadline = performance.now() + timeoutMs;
                        _b.label = 1;
                    case 1:
                        if (!true) return [3 /*break*/, 3];
                        if (session.status === "exited")
                            return [2 /*return*/, {
                                    session: { revision: session.revision },
                                    text: "",
                                    cursorX: 0,
                                    cursorY: 0,
                                    rows: session.rows,
                                    cols: session.cols,
                                    afterRevision: afterRevision,
                                    changed: session.revision > afterRevision,
                                    reason: "exited",
                                }];
                        text = lineWindow(session.output, options === null || options === void 0 ? void 0 : options.maxLines);
                        if (session.revision > afterRevision)
                            return [2 /*return*/, {
                                    session: { revision: session.revision },
                                    text: text,
                                    cursorX: 0,
                                    cursorY: 0,
                                    rows: session.rows,
                                    cols: session.cols,
                                    afterRevision: afterRevision,
                                    changed: true,
                                    reason: "session_activity",
                                }];
                        if (performance.now() >= deadline)
                            return [2 /*return*/, {
                                    session: { revision: session.revision },
                                    text: text,
                                    cursorX: 0,
                                    cursorY: 0,
                                    rows: session.rows,
                                    cols: session.cols,
                                    afterRevision: afterRevision,
                                    changed: false,
                                    reason: "timeout",
                                }];
                        return [4 /*yield*/, waitForRevision(session.id, Math.max(10, Math.min(500, deadline - performance.now())))];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 1];
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    function session(id) {
        var current = get(id);
        return { lastObservedText: current.lastObservedText };
    }
    function markObserved(id, text, revision) {
        var current = get(id);
        current.lastObservedText = text;
        current.lastObservedRevision = revision;
    }
    function requestHuman(id, reason, sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var current;
            return __generator(this, function (_a) {
                current = get(id);
                assertSessionOwner(current, sessionID);
                assertRunning(current);
                if (typeof reason !== "string" || reason.length === 0)
                    throw new Error("request_human requires a reason");
                if (reason.length > 240)
                    throw new Error("request_human reason must be 240 characters or fewer; describe the kind of input needed, never screen content or secrets");
                publishAudit(current, "request_human", "model", reason);
                return [2 /*return*/, publicSession(current)];
            });
        });
    }
    function ttyName(id) {
        return __awaiter(this, void 0, void 0, function () {
            var current, pid;
            var _a;
            return __generator(this, function (_b) {
                current = get(id);
                pid = (_a = current.pty) === null || _a === void 0 ? void 0 : _a.pid;
                return [2 /*return*/, pid ? "/proc/".concat(pid, "/fd/0") : undefined];
            });
        });
    }
    function subscribeOutput(id, listener) {
        var _a;
        var session = get(id);
        var listeners = (_a = outputListeners.get(session.id)) !== null && _a !== void 0 ? _a : new Set();
        listeners.add(listener);
        outputListeners.set(session.id, listeners);
        if (session.output)
            listener(session.output);
        return function () {
            listeners.delete(listener);
            if (!listeners.size)
                outputListeners.delete(session.id);
        };
    }
    function setActiveSession(sessionID) {
        if (sessionID !== undefined)
            for (var _i = 0, _a = sessions.values(); _i < _a.length; _i++) {
                var session_1 = _a[_i];
                if (session_1.sessionID === undefined && session_1.status === "running")
                    session_1.sessionID = sessionID;
            }
        activeSession = sessionID;
    }
    function stopForSession(sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var owned;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        owned = __spreadArray([], sessions.values(), true).filter(function (session) {
                            return session.sessionID === sessionID && session.status === "running";
                        });
                        return [4 /*yield*/, Promise.allSettled(owned.map(function (session) { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, stop(session.id, "system")];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function close() {
        return __awaiter(this, void 0, void 0, function () {
            var running;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (closed)
                            return [2 /*return*/];
                        closed = true;
                        running = __spreadArray([], sessions.values(), true).filter(function (session) { return session.status === "running"; });
                        return [4 /*yield*/, Promise.allSettled(running.map(function (session) { return __awaiter(_this, void 0, void 0, function () {
                                var _a;
                                return __generator(this, function (_b) {
                                    try {
                                        (_a = session.pty) === null || _a === void 0 ? void 0 : _a.kill();
                                    }
                                    catch (_c) {
                                        // already gone
                                    }
                                    markExited(session, "system");
                                    return [2 /*return*/];
                                });
                            }); }))];
                    case 1:
                        _a.sent();
                        sessions.clear();
                        idempotency.clear();
                        writes.clear();
                        revisionWaiters.clear();
                        outputListeners.clear();
                        return [2 /*return*/];
                }
            });
        });
    }
    return {
        init: init,
        list: list,
        reconcile: reconcile,
        read: read,
        openHub: openHub,
        claimHumanInput: claimHumanInput,
        releaseHumanControl: releaseHumanControl,
        beginSecureInput: beginSecureInput,
        endSecureInput: endSecureInput,
        stop: stop,
        start: start,
        write: write,
        resize: resize,
        snapshot: snapshot,
        observe: observe,
        session: session,
        markObserved: markObserved,
        requestHuman: requestHuman,
        ttyName: ttyName,
        setActiveSession: setActiveSession,
        subscribeOutput: subscribeOutput,
        stopForSession: stopForSession,
        close: close,
    };
}
