import {
  nataliaFlowDocumentSchema,
  nataliaTaskDocumentSchema,
  type NataliaFlowDocument,
  type NataliaTaskDocument,
} from "@natalia/contracts";
import { parseDocument } from "yaml";

export type NataliaDocument = NataliaFlowDocument | NataliaTaskDocument;

export function parseNataliaDocumentYAML(input: string): NataliaDocument {
  const document = parseDocument(input, {
    prettyErrors: true,
    uniqueKeys: true,
  });
  if (document.errors.length)
    throw new Error(document.errors.map((error) => error.message).join("\n"));
  return validateNataliaDocument(document.toJS());
}

export function parseNataliaDocumentJSON(input: string): NataliaDocument {
  try {
    return validateNataliaDocument(JSON.parse(input));
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error(`invalid JSON: ${error.message}`);
    throw error;
  }
}

export function validateNataliaDocument(input: unknown): NataliaDocument {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("natalia document must be an object");
  const value = input as Record<string, unknown>;
  if (value.kind !== "natalia-flow" && value.kind !== "natalia-task")
    throw new Error(
      `unsupported natalia document kind: ${JSON.stringify(value.kind)}`,
    );
  if (value.version !== 1)
    throw new Error(
      `unsupported ${value.kind} major version: ${JSON.stringify(value.version)}`,
    );
  const parsed =
    value.kind === "natalia-flow"
      ? nataliaFlowDocumentSchema.safeParse(value)
      : nataliaTaskDocumentSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    );
  if (parsed.data.kind === "natalia-flow") {
    const ids = new Set<string>();
    for (const module of parsed.data.modules) {
      if (ids.has(module.id))
        throw new Error(`duplicate flow module id: ${module.id}`);
      ids.add(module.id);
    }
  }
  return parsed.data;
}
