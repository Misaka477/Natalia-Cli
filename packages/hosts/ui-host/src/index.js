"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebTransport = exports.createMemoryTransport = exports.defineUiPlugin = exports.createMemoryPreferenceStore = exports.createSilentLogger = exports.createConsoleLogger = exports.createUiPluginHost = exports.eventMatches = exports.createUiEventBus = void 0;
/**
 * Thin UI plugin host.
 *
 * Owns mount points, event fan-out, view-store projection, transport, and
 * plugin lifecycle. It does not render business panels — those live in a UI
 * plugin package. Runtime creation stays with the shell that calls this host.
 */
var events_1 = require("./events");
Object.defineProperty(exports, "createUiEventBus", { enumerable: true, get: function () { return events_1.createUiEventBus; } });
Object.defineProperty(exports, "eventMatches", { enumerable: true, get: function () { return events_1.eventMatches; } });
var host_1 = require("./host");
Object.defineProperty(exports, "createUiPluginHost", { enumerable: true, get: function () { return host_1.createUiPluginHost; } });
var logger_1 = require("./logger");
Object.defineProperty(exports, "createConsoleLogger", { enumerable: true, get: function () { return logger_1.createConsoleLogger; } });
Object.defineProperty(exports, "createSilentLogger", { enumerable: true, get: function () { return logger_1.createSilentLogger; } });
var preferences_1 = require("./preferences");
Object.defineProperty(exports, "createMemoryPreferenceStore", { enumerable: true, get: function () { return preferences_1.createMemoryPreferenceStore; } });
var protocol_1 = require("./protocol");
Object.defineProperty(exports, "defineUiPlugin", { enumerable: true, get: function () { return protocol_1.defineUiPlugin; } });
var transport_1 = require("./transport");
Object.defineProperty(exports, "createMemoryTransport", { enumerable: true, get: function () { return transport_1.createMemoryTransport; } });
Object.defineProperty(exports, "createWebTransport", { enumerable: true, get: function () { return transport_1.createWebTransport; } });
