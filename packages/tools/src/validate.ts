import type { ToolSchema } from "./index";

export type ToolParameterError = {
  path: string;
  message: string;
};

export function validateToolParameters(
  schema: ToolSchema,
  input: unknown,
): ToolParameterError[] {
  const errors: ToolParameterError[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    errors.push({ path: "", message: "expected an object" });
    return errors;
  }

  const obj = input as Record<string, unknown>;

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(obj)) {
      if (!(key in schema.properties)) {
        errors.push({
          path: key,
          message: `unexpected property "${key}"`,
        });
      }
    }
  }

  for (const key of schema.required ?? []) {
    if (!(key in obj)) {
      errors.push({
        path: key,
        message: `missing required property "${key}"`,
      });
    }
  }

  for (const [key, raw] of Object.entries(schema.properties)) {
    if (!(key in obj)) continue;
    const propSchema = raw as Record<string, unknown>;
    const type = propSchema.type as string | undefined;
    if (type) {
      const value = obj[key];
      const typeError = checkType(key, value, type, propSchema);
      if (typeError) errors.push(typeError);
    }
  }

  return errors;
}

function checkType(
  key: string,
  value: unknown,
  type: string,
  schema: Record<string, unknown>,
): ToolParameterError | undefined {
  const path = key;

  if (type === "string") {
    if (typeof value !== "string") {
      return { path, message: `expected string, got ${typeof value}` };
    }
    if (typeof schema.minLength === "number" && (value as string).length < schema.minLength) {
      return { path, message: `string too short (min ${schema.minLength})` };
    }
    if (typeof schema.maxLength === "number" && (value as string).length > schema.maxLength) {
      return { path, message: `string too long (max ${schema.maxLength})` };
    }
    if (typeof schema.enum === "object" && Array.isArray(schema.enum)) {
      if (!(schema.enum as string[]).includes(value as string)) {
        return {
          path,
          message: `expected one of: ${(schema.enum as string[]).join(", ")}`,
        };
      }
    }
    return undefined;
  }

  if (type === "number" || type === "integer") {
    if (typeof value !== "number" || (type === "integer" && !Number.isInteger(value))) {
      return {
        path,
        message: `expected ${type}, got ${typeof value}${typeof value === "number" ? " (non-integer)" : ""}`,
      };
    }
    return undefined;
  }

  if (type === "boolean") {
    if (typeof value !== "boolean") {
      return { path, message: `expected boolean, got ${typeof value}` };
    }
    return undefined;
  }

  if (type === "array") {
    if (!Array.isArray(value)) {
      return { path, message: `expected array, got ${typeof value}` };
    }
    return undefined;
  }

  if (type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { path, message: `expected object, got ${typeof value}` };
    }
    const required = schema.required as string[] | undefined;
    if (required) {
      for (const r of required) {
        if (!(r in (value as Record<string, unknown>))) {
          return { path, message: `missing required property "${r}"` };
        }
      }
    }
    return undefined;
  }

  if (type === "null") {
    if (value !== null) {
      return { path, message: "expected null" };
    }
    return undefined;
  }

  return undefined;
}

export function assertValidToolParameters(
  schema: ToolSchema,
  input: unknown,
): void {
  const errors = validateToolParameters(schema, input);
  if (errors.length) {
    const detail = errors
      .map((e) => `${e.path || "(root)"}: ${e.message}`)
      .join("; ");
    throw new Error(`tool parameter validation failed: ${detail}`);
  }
}
