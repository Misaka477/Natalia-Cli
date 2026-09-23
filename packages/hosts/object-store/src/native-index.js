"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NativePackIndex = void 0;
exports.nativePackIndexAvailable = nativePackIndexAvailable;
var bun_ffi_1 = require("bun:ffi");
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var lib;
var libAttempted = false;
function candidatePaths() {
    var dir = import.meta.dir;
    var base = "native-index/target/release";
    return [
        (0, node_path_1.resolve)(dir, "..", base, "libnatalia_index_native.so"),
        (0, node_path_1.resolve)(dir, "..", "..", base, "libnatalia_index_native.so"),
        (0, node_path_1.resolve)(process.cwd(), "packages", "hosts", "object-store", base, "libnatalia_index_native.so"),
    ];
}
function loadLib() {
    if (libAttempted)
        return lib;
    libAttempted = true;
    for (var _i = 0, _a = candidatePaths(); _i < _a.length; _i++) {
        var path = _a[_i];
        if (!(0, node_fs_1.existsSync)(path))
            continue;
        try {
            lib = (0, bun_ffi_1.dlopen)(path, {
                native_index_load: {
                    args: [bun_ffi_1.FFIType.cstring],
                    returns: bun_ffi_1.FFIType.pointer,
                },
                native_index_find: {
                    args: [bun_ffi_1.FFIType.pointer, bun_ffi_1.FFIType.cstring, bun_ffi_1.FFIType.pointer],
                    returns: bun_ffi_1.FFIType.int,
                },
                native_index_free: {
                    args: [bun_ffi_1.FFIType.pointer],
                    returns: bun_ffi_1.FFIType.void,
                },
            });
            return lib;
        }
        catch (_b) {
            lib = undefined;
        }
    }
    return undefined;
}
var NativePackIndex = /** @class */ (function () {
    function NativePackIndex(path) {
        var loaded = loadLib();
        if (!loaded)
            throw new Error("native index library unavailable");
        var handle = loaded.symbols.native_index_load(path);
        if (!handle)
            throw new Error("native index load failed");
        this.handle = handle;
    }
    NativePackIndex.prototype.find = function (id) {
        var loaded = loadLib();
        if (!loaded)
            return undefined;
        var out = Buffer.alloc(24); // repr(C): 4*u32 + u8 + padding + u32
        var outPtr = (0, bun_ffi_1.ptr)(out);
        var found = loaded.symbols.native_index_find(this.handle, id, outPtr);
        if (!found)
            return undefined;
        return {
            offset: out.readUInt32LE(0),
            dataOffset: out.readUInt32LE(4),
            origLen: out.readUInt32LE(8),
            compLen: out.readUInt32LE(12),
            kind: out[16],
            deltaLen: out.readUInt32LE(20),
        };
    };
    NativePackIndex.prototype.free = function () {
        var loaded = loadLib();
        if (!loaded)
            return;
        loaded.symbols.native_index_free(this.handle);
    };
    return NativePackIndex;
}());
exports.NativePackIndex = NativePackIndex;
function nativePackIndexAvailable() {
    return loadLib() !== undefined;
}
