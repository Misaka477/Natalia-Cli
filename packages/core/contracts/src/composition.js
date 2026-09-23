"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GENERATION_SCHEMA = void 0;
/**
 * Composition generations (master plan P2, NGM study G1).
 *
 * A generation is a named, addressable snapshot of what the runtime is made
 * of. The study's full shape also carries prompts, skills, policy rows and
 * adapter bindings; this first cut holds only the two things that are real
 * and serializable today — the resolved config and the desired plugin
 * catalog — because a generation field without a producer is a stub.
 *
 * Plugins are referenced by identity plus the catalog's content fingerprint
 * rather than by embedding manifests: the fingerprint is the entry's content
 * hash, so a generation entry addresses exactly the content it was resolved
 * against, and the catalog itself stays the one place manifests live.
 */
exports.GENERATION_SCHEMA = "natalia.generation/1";
