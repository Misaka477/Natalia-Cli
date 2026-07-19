const VALUE_REF_RE = /^values\.([a-zA-Z_]\w*)$/u;
const DOT_PATH_RE = /^values\.([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)$/u;

export function evaluateCondition(
  condition: string,
  values: Record<string, string>,
): boolean {
  const trimmed = condition.trim();
  if (trimmed === "") return true;

  const tokens = tokenize(trimmed);
  const parser = new ExprParser(tokens, values);
  const result = parser.parseExpr();
  if (parser.pos < parser.tokens.length)
    throw new Error(
      `unexpected token "${parser.tokens[parser.pos].text}" at position ${parser.pos} in condition "${condition}"`,
    );
  return result;
}

function resolveRef(ref: string, values: Record<string, string>): string {
  const m = DOT_PATH_RE.exec(ref);
  if (!m) throw new Error(`invalid value reference "${ref}"`);
  const path = m[1]!;
  const v = values[path];
  if (v === undefined)
    throw new Error(`value "${path}" is not set (referenced by "${ref}")`);
  return v;
}

type Token = {
  type: "ident" | "string" | "number" | "op" | "paren" | "bool" | "null";
  text: string;
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    if (input[i] === " " || input[i] === "\t") {
      i++;
      continue;
    }

    if (input[i] === '"') {
      const end = input.indexOf('"', i + 1);
      if (end < 0) throw new Error("unterminated double-quoted string");
      tokens.push({ type: "string", text: input.slice(i + 1, end) });
      i = end + 1;
      continue;
    }

    if (input[i] === "'") {
      const end = input.indexOf("'", i + 1);
      if (end < 0) throw new Error("unterminated single-quoted string");
      tokens.push({ type: "string", text: input.slice(i + 1, end) });
      i = end + 1;
      continue;
    }

    if (input[i] === "(" || input[i] === ")") {
      tokens.push({ type: "paren", text: input[i] });
      i++;
      continue;
    }

    const identMatch = /^[a-zA-Z_][a-zA-Z0-9_.]*/u.exec(input.slice(i));
    if (identMatch) {
      const word = identMatch[0];
      if (word === "true" || word === "false") {
        tokens.push({ type: "bool", text: word });
      } else if (word === "null") {
        tokens.push({ type: "null", text: word });
      } else if (word === "and" || word === "or" || word === "not") {
        tokens.push({ type: "ident", text: word });
      } else {
        tokens.push({ type: "ident", text: word });
      }
      i += word.length;
      continue;
    }

    if (/^[0-9]+(?:\.[0-9]+)?/u.exec(input.slice(i))) {
      const numMatch = /^[0-9]+(?:\.[0-9]+)?/u.exec(input.slice(i))!;
      tokens.push({ type: "number", text: numMatch[0] });
      i += numMatch[0].length;
      continue;
    }

    if (/^[=!]=/u.test(input.slice(i)) || /^[<>]=?/u.test(input.slice(i))) {
      const opMatch = /^[=!]=|^[<>]=?/u.exec(input.slice(i))!;
      tokens.push({ type: "op", text: opMatch[0] });
      i += opMatch[0].length;
      continue;
    }

    throw new Error(`unexpected character "${input[i]}" in condition`);
  }
  return tokens;
}

class ExprParser {
  readonly tokens: Token[];
  readonly values: Record<string, string>;
  pos = 0;

  constructor(tokens: Token[], values: Record<string, string>) {
    this.tokens = tokens;
    this.values = values;
  }

  peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  consume(type?: Token["type"]): Token {
    const t = this.tokens[this.pos];
    if (!t) throw new Error("unexpected end of expression");
    if (type && t.type !== type)
      throw new Error(`expected ${type}, got "${t.text}"`);
    this.pos++;
    return t;
  }

  parseExpr(): boolean {
    let left = this.parseTerm();
    while (this.peek()?.text === "or") {
      this.consume();
      const right = this.parseTerm();
      left = left || right;
    }
    return left;
  }

  parseTerm(): boolean {
    let left = this.parseComparison();
    while (this.peek()?.text === "and") {
      this.consume();
      const right = this.parseComparison();
      left = left && right;
    }
    return left;
  }

  parseComparison(): boolean {
    const left = this.parsePrimary();

    const op = this.peek();
    if (op && op.type === "op") {
      this.consume();
      const right = this.parsePrimary();

      const compare = (a: string, b: string): number => {
        const na = Number(a);
        const nb = Number(b);
        if (Number.isFinite(na) && Number.isFinite(nb))
          return na < nb ? -1 : na > nb ? 1 : 0;
        return a < b ? -1 : a > b ? 1 : 0;
      };

      switch (op.text) {
        case "==":
          return compare(left, right) === 0;
        case "!=":
          return compare(left, right) !== 0;
        case ">":
          return compare(left, right) > 0;
        case "<":
          return compare(left, right) < 0;
        case ">=":
          return compare(left, right) >= 0;
        case "<=":
          return compare(left, right) <= 0;
        default:
          throw new Error(`unknown operator "${op.text}"`);
      }
    }

    return Boolean(left) && left !== "false" && left !== "";
  }

  parsePrimary(): string {
    if (this.peek()?.type === "paren" && this.peek()!.text === "(") {
      this.consume();
      const result = this.parseExpr();
      if (this.peek()?.text !== ")")
        throw new Error("expected closing parenthesis");
      this.consume();
      return result ? "true" : "false";
    }

    if (this.peek()?.text === "not") {
      this.consume();
      const inner = this.parseComparison();
      return inner ? "false" : "true";
    }

    const t = this.consume();
    switch (t.type) {
      case "string":
        return t.text;
      case "number":
        return t.text;
      case "bool":
        return t.text;
      case "null":
        return "";
      case "ident":
        return resolveRef(t.text, this.values);
      default:
        throw new Error(`unexpected token "${t.text}"`);
    }
  }
}

export function interpolate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([^}\s]+)\s*\}\}/gu, (_match, key) => {
    const path = (key as string).trim();
    const v = values[path];
    if (v === undefined)
      throw new Error(`interpolation value "${path}" is not set`);
    return v;
  });
}

export function walkValues(
  value: unknown,
  values: Record<string, string>,
): unknown {
  if (typeof value === "string") return interpolate(value, values);
  if (Array.isArray(value))
    return value.map((item) => walkValues(item, values));
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      result[k] = walkValues(v, values);
    return result;
  }
  return value;
}
