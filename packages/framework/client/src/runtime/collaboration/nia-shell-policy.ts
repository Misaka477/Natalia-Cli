import { parseBashSimpleCommand } from "@natalia/tools";

/**
 * Nia may run inspection and verification commands, but must not mutate the
 * workspace, repository, dependencies or service state. This policy is
 * intentionally deny-by-default: a command must match a safe shape before the
 * existing shell tool is allowed to execute it.
 */
const SAFE_EXECUTABLES = new Set([
  "basename",
  "cat",
  "cmp",
  "cut",
  "df",
  "diff",
  "dirname",
  "du",
  "echo",
  "false",
  "file",
  "grep",
  "head",
  "id",
  "ls",
  "md5sum",
  "printf",
  "pwd",
  "readlink",
  "realpath",
  "rg",
  "sha1sum",
  "sha256sum",
  "sort",
  "stat",
  "tail",
  "test",
  "tr",
  "true",
  "uname",
  "uniq",
  "wc",
  "which",
  "whereis",
  "whoami",
]);

const SAFE_TEST_EXECUTABLES = new Set(["jest", "pytest", "vitest"]);
const SAFE_PACKAGE_SCRIPTS = new Set(["format", "test", "typecheck"]);

function executableName(token: string | undefined) {
  return token?.split(/[\\/]/u).pop() ?? "";
}

function unsafeShellSyntax(command: string) {
  return /[|&;<>$`\n\r(){}!\\]/u.test(command);
}

function shellTokens(command: string) {
  return (command.match(/(?:[^\s"'`]+|"[^"]*"|'[^']*')+/gu) ?? []).map(
    (token) =>
      token.length >= 2 &&
      ((token.startsWith('"') && token.endsWith('"')) ||
        (token.startsWith("'") && token.endsWith("'")))
        ? token.slice(1, -1)
        : token,
  );
}

function hasFlag(tokens: string[], ...flags: string[]) {
  return tokens.some((token) => flags.includes(token));
}

function hasFlagPrefix(tokens: string[], ...prefixes: string[]) {
  return tokens.some((token) =>
    prefixes.some((prefix) => token.startsWith(prefix)),
  );
}

function gitReadOnly(tokens: string[]) {
  const subcommand = tokens[1];
  if (subcommand === undefined) return false;
  if (subcommand.startsWith("-")) return subcommand === "--version";
  switch (subcommand) {
    case "blame":
    case "cat-file":
    case "describe":
    case "diff":
    case "grep":
    case "log":
    case "ls-files":
    case "name-rev":
    case "reflog":
    case "rev-parse":
    case "shortlog":
    case "show":
    case "status":
    case "whatchanged":
      return true;
    case "branch": {
      const args = tokens.slice(2);
      if (args.some((arg) => !arg.startsWith("-"))) return false;
      return args.every((arg) =>
        [
          "-a",
          "--all",
          "-l",
          "--list",
          "-r",
          "--remotes",
          "-v",
          "-vv",
          "--verbose",
        ].includes(arg),
      );
    }
    case "tag":
      return hasFlag(tokens.slice(2), "-l", "--list");
    case "remote":
      return hasFlag(tokens.slice(2), "-v", "--verbose");
    case "config":
      return hasFlag(
        tokens.slice(2),
        "-l",
        "--list",
        "--get",
        "--get-all",
        "--get-regexp",
      );
    default:
      return false;
  }
}

function packageManagerReadOnly(tokens: string[]) {
  const first = tokens[1];
  if (first === "test") return true;
  if (first === "--version" || first === "-v") return true;
  if (first !== "run") return false;
  let index = 2;
  while (tokens[index]?.startsWith("-")) index += 1;
  return SAFE_PACKAGE_SCRIPTS.has(tokens[index] ?? "");
}

function bunReadOnly(tokens: string[]) {
  const first = tokens[1];
  if (first === "test") return true;
  if (first === "--version" || first === "-v") return true;
  if (first !== "run") return false;
  let index = 2;
  while (tokens[index]?.startsWith("-")) index += 1;
  return SAFE_PACKAGE_SCRIPTS.has(tokens[index] ?? "");
}

function findReadOnly(tokens: string[]) {
  return !hasFlag(
    tokens,
    "-delete",
    "-exec",
    "-execdir",
    "-ok",
    "-okdir",
    "-fls",
    "-fprint",
    "-fprint0",
    "-fprintf",
  );
}

function formatterReadOnly(tokens: string[]) {
  return !hasFlag(tokens, "--write", "-w", "--fix", "--fix-only");
}

function tscReadOnly(tokens: string[]) {
  return hasFlag(tokens, "--noEmit");
}

function goReadOnly(tokens: string[]) {
  return ["env", "list", "test", "vet"].includes(tokens[1] ?? "");
}

function cargoReadOnly(tokens: string[]) {
  return ["check", "clippy", "metadata", "test"].includes(tokens[1] ?? "");
}

function denoReadOnly(tokens: string[]) {
  return ["check", "lint", "test"].includes(tokens[1] ?? "");
}

function pythonReadOnly(tokens: string[]) {
  if (tokens[1] !== "-m") return false;
  return ["mypy", "pytest", "ruff", "unittest"].includes(tokens[2] ?? "");
}

export async function niaShellPolicyDenial(
  command: string,
): Promise<string | undefined> {
  const parsed = await parseBashSimpleCommand(command);
  let tokens: string[];
  if (parsed.ok) {
    tokens = parsed.command.tokens;
  } else {
    // Tree-sitter rejects some harmless numeric flag values (`git log -5`,
    // `find . -maxdepth 2`). Fall back to a conservative tokenizer only when
    // the command contains none of the shell metacharacters that make a
    // compound or redirecting command possible.
    if (unsafeShellSyntax(command))
      return `Nia shell is read-only and only supports one simple command: ${parsed.reason}`;
    tokens = shellTokens(command);
    if (!tokens.length)
      return `Nia shell is read-only and only supports one simple command: ${parsed.reason}`;
  }
  const executable = executableName(tokens[0]);
  if (!executable) return "Nia shell command is empty";

  if (executable === "git") {
    return gitReadOnly(tokens)
      ? undefined
      : "Nia shell is read-only and cannot change git state";
  }
  if (executable === "find")
    return findReadOnly(tokens)
      ? undefined
      : "Nia shell is read-only and find cannot execute or delete files";
  if (executable === "rg" && hasFlagPrefix(tokens, "--pre"))
    return "Nia shell is read-only and rg cannot execute a preprocessor";
  if (
    executable === "prettier" ||
    executable === "eslint" ||
    executable === "ruff"
  )
    return formatterReadOnly(tokens)
      ? undefined
      : "Nia shell is read-only and formatters may only check";
  if (executable === "tsc")
    return tscReadOnly(tokens)
      ? undefined
      : "Nia shell is read-only; tsc must run with --noEmit";
  if (executable === "bun") {
    return bunReadOnly(tokens)
      ? undefined
      : "Nia shell is read-only and only bun test/run typecheck|test|format is allowed";
  }
  if (executable === "npm" || executable === "pnpm" || executable === "yarn") {
    return packageManagerReadOnly(tokens)
      ? undefined
      : "Nia shell is read-only and only test/typecheck/format scripts are allowed";
  }
  if (executable === "go") {
    return goReadOnly(tokens)
      ? undefined
      : "Nia shell is read-only and only go test/vet/list/env are allowed";
  }
  if (executable === "cargo") {
    return cargoReadOnly(tokens)
      ? undefined
      : "Nia shell is read-only and only cargo check/test/clippy/metadata are allowed";
  }
  if (executable === "deno") {
    return denoReadOnly(tokens)
      ? undefined
      : "Nia shell is read-only and only deno check/lint/test are allowed";
  }
  if (
    executable === "python" ||
    executable === "python3" ||
    executable === "pypy" ||
    executable === "pypy3"
  ) {
    return pythonReadOnly(tokens)
      ? undefined
      : "Nia shell is read-only; Python may only run mypy/pytest/ruff/unittest";
  }
  if (SAFE_TEST_EXECUTABLES.has(executable)) return undefined;
  if (SAFE_EXECUTABLES.has(executable)) return undefined;
  return `Nia shell is read-only; command not allowed: ${executable}`;
}
