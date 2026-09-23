import { expect, test } from "bun:test";
import { niaShellPolicyDenial } from "@natalia/collab";

test("Nia shell policy allows read-only inspection and verification commands", async () => {
  for (const command of [
    "git status",
    "git diff --stat",
    "git log --oneline -5",
    "git branch -l",
    "git tag -l",
    "git show HEAD",
    "ls -la",
    "cat README.md",
    "grep -n needle file.txt",
    "find . -maxdepth 2 -type f",
    "wc -l file.txt",
    "bun test",
    "bun run typecheck",
    "npm test",
    "npm run typecheck",
    "pytest -q",
    "tsc --noEmit",
    "prettier --check .",
  ])
    await expect(niaShellPolicyDenial(command)).resolves.toBeUndefined();
});

test("Nia shell policy denies workspace and repository mutations", async () => {
  for (const command of [
    "git commit -m test",
    "git push",
    "git checkout main",
    "git branch -D old",
    "git tag v1",
    "rm -rf build",
    "mv a b",
    "sed -i s/a/b/ file.txt",
    "find . -delete",
    "find . -exec rm {} ;",
    "bun run build",
    "npm install",
    "npm run docs:api-reference",
    "tsc",
    "eslint --fix .",
    "tree -o listing.txt",
    "date -s 2020-01-01",
    "rg --pre 'rm' needle .",
    "bash -lc 'git commit'",
    "cat file > out.txt",
  ])
    await expect(niaShellPolicyDenial(command)).resolves.toBeString();
});
