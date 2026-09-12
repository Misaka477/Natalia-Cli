/**
 * Forced command approval policy.
 *
 * Some commands are always human-gated even when the session permission mode
 * is `auto`. The first policy of this kind is git write operations: they are
 * never granted for a session, and read-only mode still refuses them.
 */

const FORCED_GIT_SUBCOMMANDS = new Set([
  "commit",
  "push",
  "merge",
  "rebase",
  "reset",
  "cherry-pick",
  "revert",
  "clean",
]);

export type ForcedApproval = {
  ruleID: "C-REL-001";
  subcommand: string;
  reason: string;
};

function stripShellQuotes(value: string): string {
  // Wrapper commands often leave a quote attached to only one side of a word
  // (`bash -lc 'git commit'` makes the subcommand token `commit'`). Trim any
  // leading/trailing shell quote characters rather than requiring a balanced
  // pair so conservative detection still sees the subcommand.
  return value.replace(/^["'`]+|["'`]+$/gu, "");
}

function shellTokens(value: string): string[] {
  return value.match(/(?:[^\s"'`]+|"[^"]*"|'[^']*')+/gu) ?? [];
}

function gitSubcommand(tokens: string[]): string | undefined {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = stripShellQuotes(tokens[index]!);
    if (
      token === "-C" ||
      token === "-c" ||
      token === "--git-dir" ||
      token === "--work-tree" ||
      token === "--namespace" ||
      token === "--exec-path"
    ) {
      index += 1;
      continue;
    }
    if (token.startsWith("--") && token.includes("=")) continue;
    if (token.startsWith("-")) continue;
    return token;
  }
  return undefined;
}

function isForcedGitSubcommand(
  subcommand: string | undefined,
  tokens: string[],
): boolean {
  if (!subcommand) return false;
  if (FORCED_GIT_SUBCOMMANDS.has(subcommand)) return true;
  if (subcommand === "branch") {
    const flags = tokens
      .slice(tokens.indexOf(subcommand) + 1)
      .map(stripShellQuotes);
    return (
      flags.includes("-D") ||
      (flags.includes("--delete") && flags.includes("--force"))
    );
  }
  if (subcommand === "tag") {
    const flags = tokens
      .slice(tokens.indexOf(subcommand) + 1)
      .map(stripShellQuotes);
    return !flags.includes("-l") && !flags.includes("--list");
  }
  return false;
}

/**
 * Detects git write operations that must always enter interactive approval.
 *
 * The detector is intentionally conservative: command obfuscation or a missed
 * compound form can only cause a false approval prompt, not an unapproved git
 * write, because the runtime also applies this to terminal input paths.
 */
export function requiresForcedGitApproval(
  commandText: string | undefined,
): ForcedApproval | undefined {
  if (!commandText) return undefined;
  const matcher = /\bgit(?:\.exe)?\b/giu;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(commandText))) {
    const rest = commandText.slice(match.index + match[0].length);
    const tokens = shellTokens(rest);
    const subcommand = gitSubcommand(tokens);
    if (isForcedGitSubcommand(subcommand, tokens))
      return {
        ruleID: "C-REL-001",
        subcommand: subcommand!,
        reason: `git ${subcommand}`,
      };
  }
  return undefined;
}
