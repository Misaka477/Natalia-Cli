/**
 * Unified diff parsing and application, shared by the `apply_patch` tool and
 * the host's policy layer.
 *
 * The format is what `git diff` and `diff -u` emit, so a model can hand back a
 * patch it generated locally. It supports multi-file patches, new files
 * (`--- /dev/null`) and context-line hunks. Deletions (`+++ /dev/null`) are
 * rejected: `apply_patch` modifies and creates, it does not remove files.
 */

export type UnifiedPatchLine = {
  text: string;
  newline: boolean;
};

export type UnifiedPatchHunk = {
  /** 1-based old-file start line; 0 for a new file. */
  oldStart: number;
  /** Context plus removed lines, in order. */
  oldLines: UnifiedPatchLine[];
  /** Context plus added lines, in order. */
  newLines: UnifiedPatchLine[];
};

export type UnifiedPatchFile = {
  /** Workspace-relative path as written by the diff (a/b prefixes stripped). */
  path: string;
  newFile: boolean;
  /** True when the diff deletes the file (`+++ /dev/null`); applying rejects it. */
  deleted: boolean;
  hunks: UnifiedPatchHunk[];
};

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u;

function stripPathPrefix(path: string) {
  return path.replace(/^[ab]\//u, "");
}

/**
 * Parses a unified diff into per-file change sets. Malformed noise between
 * hunks is ignored; a file with no hunks is dropped unless it is a new file.
 */
export function parseUnifiedPatch(patch: string): UnifiedPatchFile[] {
  const lines = patch.split("\n");
  const files: UnifiedPatchFile[] = [];
  let currentFile: UnifiedPatchFile | undefined;
  let currentHunk: UnifiedPatchHunk | undefined;

  const finishHunk = () => {
    if (currentHunk) {
      currentFile?.hunks.push(currentHunk);
      currentHunk = undefined;
    }
  };

  for (const raw of lines) {
    if (raw.startsWith("--- ")) {
      finishHunk();
      const headerPath = raw.slice(4);
      currentFile = {
        path: stripPathPrefix(headerPath),
        newFile: headerPath === "/dev/null",
        deleted: false,
        hunks: [],
      };
      files.push(currentFile);
      continue;
    }
    if (raw.startsWith("+++ ")) {
      if (!currentFile) continue;
      const newPath = raw.slice(4);
      if (newPath !== "/dev/null") currentFile.path = stripPathPrefix(newPath);
      else currentFile.deleted = true;
      continue;
    }
    if (!currentFile) continue;
    const header = raw.match(HUNK_HEADER);
    if (header) {
      finishHunk();
      currentHunk = {
        oldStart: Number(header[1]),
        oldLines: [],
        newLines: [],
      };
      continue;
    }
    if (!currentHunk) continue;
    if (raw.startsWith("\\ ")) {
      // `\ No newline at end of file` — the line it follows carries no newline.
      for (const block of [currentHunk.oldLines, currentHunk.newLines]) {
        const last = block.at(-1);
        if (last) last.newline = false;
      }
      continue;
    }
    if (raw.startsWith(" ")) {
      const line = { text: raw.slice(1), newline: true };
      currentHunk.oldLines.push(line);
      currentHunk.newLines.push(line);
    } else if (raw.startsWith("-")) {
      currentHunk.oldLines.push({ text: raw.slice(1), newline: true });
    } else if (raw.startsWith("+")) {
      currentHunk.newLines.push({ text: raw.slice(1), newline: true });
    } else {
      finishHunk();
    }
  }
  finishHunk();
  return files.filter((file) => file.newFile || file.hunks.length > 0);
}

function toLines(content: string): UnifiedPatchLine[] {
  const parts = content.split("\n");
  const endsWithNewline = content.endsWith("\n");
  const texts = endsWithNewline ? parts.slice(0, -1) : parts;
  return texts.map((text, index) => ({
    text,
    newline: index < texts.length - 1 || endsWithNewline,
  }));
}

function joinLines(lines: UnifiedPatchLine[]) {
  if (!lines.length) return "";
  const last = lines.at(-1)!;
  return `${lines.map((line) => line.text).join("\n")}${
    last.newline ? "\n" : ""
  }`;
}

function matchesAt(
  lines: UnifiedPatchLine[],
  position: number,
  expected: UnifiedPatchLine[],
) {
  if (position < 0 || position + expected.length > lines.length) return false;
  for (let index = 0; index < expected.length; index++)
    if (lines[position + index]!.text !== expected[index]!.text) return false;
  return true;
}

function findMatch(lines: UnifiedPatchLine[], expected: UnifiedPatchLine[]) {
  if (!expected.length) return 0;
  for (let position = 0; position + expected.length <= lines.length; position++)
    if (matchesAt(lines, position, expected)) return position;
  return -1;
}

/**
 * Applies one file's hunks to its current content. All hunks must match before
 * any part of the content is replaced; a hunk that neither matches nor is
 * already applied throws, so a patch never half-applies.
 *
 * `changed` is false when every hunk was already applied.
 */
export function applyUnifiedPatchToText(
  current: string,
  file: UnifiedPatchFile,
): { next: string; changed: boolean } {
  if (file.deleted)
    throw new Error(
      `apply_patch: deleting files is not supported (${file.path})`,
    );
  let lines = toLines(current);
  let changed = false;
  let offset = 0;
  const originalLineCount = lines.length;
  const originalEndNewline = lines.at(-1)?.newline ?? false;
  for (const hunk of file.hunks) {
    const position =
      hunk.oldStart === 0 ? 0 : Math.max(0, hunk.oldStart - 1 + offset);
    let matchPosition: number;
    if (matchesAt(lines, position, hunk.oldLines)) matchPosition = position;
    else if (matchesAt(lines, position, hunk.newLines)) {
      offset += hunk.newLines.length - hunk.oldLines.length;
      continue;
    } else {
      matchPosition = findMatch(lines, hunk.oldLines);
      if (matchPosition < 0)
        throw new Error(
          `apply_patch: hunk at old line ${hunk.oldStart} did not match ${file.path}`,
        );
    }
    const newLines = [...hunk.newLines];
    // A hunk that consumes the file's final line carries that line's trailing
    // newline status, so a file without a trailing newline stays that way.
    if (
      newLines.length &&
      matchPosition + hunk.oldLines.length >= originalLineCount
    )
      newLines[newLines.length - 1] = {
        ...newLines.at(-1)!,
        newline: originalEndNewline,
      };
    lines = [
      ...lines.slice(0, matchPosition),
      ...newLines,
      ...lines.slice(matchPosition + hunk.oldLines.length),
    ];
    changed = true;
    offset += newLines.length - hunk.oldLines.length;
  }
  return { next: joinLines(lines), changed };
}
