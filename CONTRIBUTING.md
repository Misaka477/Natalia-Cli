# Working on this repository

`npm run verify` is the definition of "this change is done". CI runs exactly
that, so a green local run and a green CI run mean the same thing.

```sh
bun install
npm run verify      # format → typecheck → test (incl. docs:check) → import guard
```

The rest of this file is the part `verify` cannot check for you. Every rule below
is here because it was broken and something shipped that should not have.

## Verify with the repo's gate, over the whole tree

Not a subset you picked, and not a command you assembled.

A gate is only worth having if it is the one you actually run. Four separate
failures in one stretch of work came from checking a hand-chosen subset instead:
a typecheck break survived ten rounds because only the packages that had been
touched were compiled, an import guard had never been run at all, a format gate
reported 86 files for long enough that nobody read its output, and one package's
tests were never in the root `test` script — so they only ran when invoked by
hand, and were reported as passing.

The last one is worth dwelling on: **a test that is not in `npm test` does not
run.** If you add a package with tests, add it to the root `test` script.

The root script also sets `--max-concurrency=4`. Running the suite bare at full
concurrency produces a handful of timeouts that are load, not logic — they change
between runs, which makes them easy to wave away and easy to stop reading. Use
the script.

## A test is not evidence until you have watched it fail

Write the assertion, then break the thing it is about, then confirm it goes red.

A test you have only ever seen pass tells you nothing: it may be exercising the
wrong path, asserting something trivially true, or checking a value that would
hold whether or not the code works. Two tests written here as proof of a fix
turned out to pass with the fix removed — one drove a code path that raised
before reaching the code under test, and one asserted on a branch no correct
implementation would take.

This is cheap. Delete the fix, run the one test, put the fix back.

## Assert on the outcome, not on the absence of failure

`expect(answer).not.toContain("refused")` cannot distinguish "the gate let this
through" from "something else refused it first" — it reads as proof the gate
works while proving nothing.

Assert the thing you actually mean: that the goal is `complete`, that the file is
gone, that the second promotion was refused _and the first candidate's work is
still there_. Negative assertions are the ones that pass for the wrong reason.

## A completion claim cites a gate, not a recollection

A checklist you wrote and updated cannot establish that the work is done — it is
your own answer key. One item here was recorded complete and was not: the
consumer of a field had a passing test, the field's contract was correct, and the
producer that was supposed to fill it did not exist, so the value was silently
absent for nineteen rounds of work.

**If a claim can be checked by a command, run the command and quote it.** Where a
contract declares a field, the test that proves it belongs on the _producer_ —
the code that writes the field — not only on the consumer that reads it.

## Related

- `docs/api-reference.md`, `docs/types-reference.md`, `docs/config-reference.md`
  are generated. `docs:check` (inside `npm test`) fails when they are stale, and
  tells you the command to regenerate them.
- `packages/tooling/testing/bin/import-guard.ts` enforces the package boundary
  rules. When it flags a dependency, the fix is usually to add the package to the
  right allowlist only if the dependency is genuinely intended — it is there to
  make the boundary decision explicit, not to be silenced.
