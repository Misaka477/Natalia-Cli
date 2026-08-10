/**
 * Argument handling shared by every built-in tool.
 *
 * Tool arguments arrive as `unknown`: they were produced by a model, decoded from
 * JSON the model wrote, so nothing about their shape is guaranteed. These helpers
 * are the single place that turns that into typed values, and they throw rather
 * than coerce — a tool that silently accepts a wrong-typed argument runs with
 * something the caller did not ask for.
 *
 * `workspacePath` belongs here for the same reason: it is where a model-supplied
 * path is checked for containment before anything opens it.
 */
import { isAbsolute, relative, resolve } from "node:path";

/**
 * Resolves a workspace-relative path and refuses anything that escapes the
 * workspace, including by `..` or by being absolute. Every tool that touches a
 * path a model supplied goes through this.
 */
export function workspacePath(root: string, inputPath: string) {
  const path = resolve(root, inputPath);
  const rel = relative(resolve(root), path);
  if (isAbsolute(rel) || rel.startsWith(".."))
    throw new Error(`path escapes workspace: ${inputPath}`);
  return path;
}

export function requireObject(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("tool arguments must be an object");
  return input as Record<string, unknown>;
}

export function requireString(value: unknown, name: string) {
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  return value;
}

export function optionalString(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "string")
    throw new Error("optional value must be a string");
  return value;
}

export function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function positiveNumberOrUndefined(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    throw new Error("value must be a positive number");
  return value;
}

export function positiveNumberOr(value: unknown, fallback: number) {
  if (value === undefined) return fallback;
  return positiveNumberOrUndefined(value) ?? fallback;
}

export function optionalInteger(
  value: unknown,
  name: string,
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new Error(`${name} must be an integer`);
  return value;
}
