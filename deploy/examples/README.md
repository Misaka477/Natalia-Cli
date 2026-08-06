# Unattended task examples

These are **examples, not the product**. A Natalia task is an arbitrary
engineering job that runs without a person watching it. Nothing in the runtime
knows about log triage, code review or release notes: those three files are
simply the shapes that happened to be written down first.

A task is assembled from general building blocks:

| Block | What it decides | Where it lives |
|---|---|---|
| Task document | identity, cadence, prompt, retry budget, alert channels, which flow to run | `.natalia/tasks/<name>.yaml`, version controlled |
| Flow document | which stages run, in order, and what "done" means for each | `.natalia/flows/<name>.yaml`, version controlled |
| Permission profile | the outer safety boundary: tools, writable paths, commands, extensions | configuration |
| Append-only source | optional: what the task resumes from between runs | configuration |
| Issue target | optional: where findings are filed and reconciled | configuration |
| Alert channels | where the terminal outcome is announced | configuration |

Every optional block is genuinely optional. `release-notes.yaml` declares no
source and no issue target: it resumes nothing and reports nothing externally.

## How a task resumes: two watermark kinds

An append-only source is declared with `kind`, and the choice is about which
failure you expect:

| Kind | Position | Fits | Costs |
|---|---|---|---|
| `offset` (default) | byte count | any growing text file | a rotated file invalidates the position, so the source is reread from the start |
| `timestamp` | each entry's own time | rotated files, and sources copied between machines | requires JSON lines and a `timestampField` naming the ISO-8601 field |

`timestamp` deliberately supports nothing but JSON lines with an operator-named
field. Sniffing plain-text log formats would mean one adapter per vendor, and a
misread timestamp moves a watermark by days. Delivery is at-least-once: entries
sharing the watermark's exact instant are read again, because dropping a sibling
written in the same millisecond is the one loss that cannot be recovered. A line
that is not JSON, is missing the field, or carries an unparsable time fails the
run instead of being skipped, and a bounded read that cannot see all the way
back to the watermark fails as well - raise `maxBytes` or schedule more often.

In both kinds the watermark only advances when the whole task succeeds, so a
failed run reprocesses the same content rather than skipping it.

## The three examples, and why they differ

| Example | Shape it demonstrates |
|---|---|
| `log-triage` | resumes an append-only source across runs, files and updates issues by fingerprint |
| `code-quality` | reviews a bounded slice, verifies findings with whitelisted repository commands |
| `release-notes` | writes into the workspace instead of scanning, with writes restricted to one path |

Between them they cover reading, running commands, writing files and reporting
externally. A task of your own is written the same way: pick the stages, say what
each stage must achieve, and pick the profile that bounds it.

## Writing your own

1. Copy a flow, replace the modules with the stages your job actually has. The
   module types are capability bundles, not job names: `read_search`, `terminal`,
   `shell_command`, `workspace_changes`, `web_fetch`, `skills`, `mcp`,
   `plugins`, `subagents`, `report_output`.
2. Write each stage's minimum completion conditions in plain language. They are
   what the evaluator checks; the platform's own hard floor is enforced in code
   and cannot be relaxed by a prompt.
3. Copy a task, point it at your flow, and pick a permission profile that grants
   only what those stages need. An unattended profile must use `approval: auto`,
   because nothing will be there to approve.
4. Preflight it: `natalia task validate .natalia/tasks/<name>.yaml`. A missing
   flow, profile, source, issue target, alert channel or evaluator model fails
   here rather than halfway through a run at 02:00.
5. Run it once by hand: `natalia task run .natalia/tasks/<name>.yaml --json`.
   This is the same path a timer takes.
6. Schedule it with a unit pair like `deploy/systemd/natalia-task-*.timer`. The
   unit names only the task document, so no prompt and no credential ever lands
   in a unit file or a command line.

## One-shot or resident

A timer can run a task in either of two ways, and both drive exactly the same
controller, print the same event stream and return the same exit code:

| Form | Unit | When it fits |
|---|---|---|
| one-shot | `natalia-task-log-triage.service` runs `task run` | a few tasks, or no long-lived process wanted |
| resident | `natalia-task-log-triage-submit.service` runs `task submit` against `natalia-daemon.service` | many tasks, where paying a cold start per task dominates |

The resident form needs `natalia-daemon.service` running; the submitting unit
declares `Requires=` and `After=` so a delivery that cannot reach the executor
fails instead of being recorded as a successful run. The executor bounds how many
tasks run at once (`--max-concurrent-tasks`, default one) because tasks share a
working tree.

Readiness of the executor is its registration file, not the URL it prints: a
piped stdout is buffered, so a supervisor waiting for that line would stall.

## Outbound traffic is yours to bound

Natalia enforces a host allowlist only where fetch-style tools build a request
URL. A command run through `run_shell`, or typed into a native terminal, opens
its own sockets and is **not** constrained by that allowlist. Both `/doctor`
inside the agent and `natalia doctor` state this in one line so it is not a
surprise.

This is deliberate, not an omission. Blocking `curl` would leave `wget`,
`python -c`, `nc` and `/dev/tcp`, so a command blocklist buys a false sense of
safety rather than an egress boundary. If a task must not reach the open
internet, enforce that where it can actually be enforced: a firewall rule, or a
container network with an egress ACL as `deploy/run-unattended.sh` requires. A
permission profile that never allows `run_shell` or terminal input is the other
way to keep the fetch-tool allowlist meaningful.

## Applying the example configuration

`config.json` here is a fragment showing the profiles, source, issue target and
alert channels the example tasks reference. Merge the parts you want into
`<workspace>/.natalia/config.json` and add your own providers and models. The
issue target and webhook tokens are intentionally empty: fill them in through
your own secure configuration, never in a task document or a prompt.
