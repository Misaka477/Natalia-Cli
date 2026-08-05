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

## Applying the example configuration

`config.json` here is a fragment showing the profiles, source, issue target and
alert channels the example tasks reference. Merge the parts you want into
`<workspace>/.natalia/config.json` and add your own providers and models. The
issue target and webhook tokens are intentionally empty: fill them in through
your own secure configuration, never in a task document or a prompt.
