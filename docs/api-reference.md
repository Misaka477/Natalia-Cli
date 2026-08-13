# Natalia Runtime API Reference — v1

> Status: **apiVersion 1** (see `API_VERSION` in `@natalia/contracts`).
> The tables under the "machine-derived" heading below are generated from the
> source tables the transport and the contracts use, and a drift guard
> (`packages/transport/test/api-reference.test.ts`) fails the test gate if this
> document disagrees with the code. Regenerate with
> `npm run docs:api-reference`. Everything here is exercised by
> `packages/sdk/test/consumer-conformance.test.ts`, which drives a real runtime
> over the real transport using only the consumer packages; if that test cannot
> do it, this document does not claim you can.

This reference is for a person building a UI or integration on a Natalia
runtime over HTTP. It covers the stable protocol surface: connecting and
authenticating, how calls fail, how to discover what the runtime you are
talking to can actually do, the event stream, and the write surface with its
idempotency and refusal semantics. It deliberately does not describe the
internal packages, the TUI, or features that exist only as declared types.
For the complete field shapes of every result type — nested objects expanded,
nothing to look up in source — see `docs/types-reference.md`; the full shape
of `.natalia/config.json` lives in `docs/config-reference.md`.

---

## 1. Scope and deployment shape

One server hosts exactly **one** runtime. `createRuntimeHttpServer` takes a
single `RuntimeClient`, and the RPC surface has no session routing: every call
acts on that one runtime. This is a runtime you host, not a service you connect
many users to. Running several tenants means running several runtimes, with
routing and quotas in your own layer — a security boundary does not belong
inside the runtime's composition root.

Everything in this document talks about that single-hosted-runtime shape. The
`session`-scoped API members manage _session records_ inside the one runtime,
not connections to several runtimes.

## 2. Packages and import rules

An external integration may depend on, and only on:

| Package                                   | Use it for                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| `@natalia/contracts`                      | every event, request and client type; failure kinds; version and capability constants |
| `@natalia/sdk`                            | talking to a runtime over HTTP (`createNataliaSDK({ baseURL, token })`)               |
| `@natalia/view-store`                     | folding a `RuntimeEvent` stream into displayable state                                |
| `@natalia/transport`                      | the RPC protocol (`callRuntimeRPC`) and the fetch recorder                            |
| `@natalia/client` **public exports only** | hosting a runtime in-process, and the task/flow helpers                               |

Do **not** import any package internal (`@natalia/x/...`), `@natalia/runtime`,
`@natalia/session`, `@natalia/tools`, or anything under `apps/`.
`npm run guard:imports` enforces these boundaries mechanically, including that
a consumer-contract package never reaches into the kernel. `@natalia/transport/host`
(serving a runtime, daemon lifecycle) is host-side only: speaking the protocol
must never confer the ability to host a runtime.

## 3. Connecting and authenticating

```ts
import { createNataliaSDK } from "@natalia/sdk";

const sdk = createNataliaSDK({ baseURL: "http://127.0.0.1:4700", token });
```

- `baseURL` — the runtime's HTTP endpoint. `/healthz`, `/events`, `/ws` and the
  JSON-RPC endpoint live under it.
- `token` — the bearer token the deployment issued. The SDK passes it as
  `Authorization: Bearer …`.
- `fetch` — optional injected fetch, used by tests and pinned-recording.

**Authentication is per-deployment; the default is open, not deny.** A server
configured with neither `token` nor `authorization` admits every request (the
CLI `serve` without a token prints `auth: disabled`). "Default deny" only
holds once credentials are configured: then requests without a token (or with
a wrong one) are rejected with the same `401` response, so the token cannot be
probed, and only `open: true` re-admits credential-less requests (logging a
startup warning). There is no built-in identity flow; a deployment that wants
one builds it outside the runtime.

Credentials come in two forms:

- `token` — shorthand for a single all-powerful credential (the daemon mints
  these; CLI flows are unchanged). It is equivalent to
  `authorization: { credentials: [{ token, write: true }] }` with `open: false`.
- Scoped credentials — carry three dimensions:
  - **capability groups**: which of the capability groups the caller may reach
    (absent = every group);
  - **`write`**: whether the caller may use the write surface (see §9);
  - **sessions**: which sessions the caller may subscribe to on the event
    stream.

The host configures them on the HTTP server options:

```ts
createRuntimeHttpServer({
  client,
  authorization: {
    // default deny: no credential, no access (unless open: true below)
    open: false,
    credentials: [
      {
        token: "readonly-1",
        write: false,
        groups: ["transcript", "workspace"],
      },
      { token: "write-1", write: true },
      { token: "events-only", write: false, sessions: ["ses_abc123"] },
    ],
  },
});
```

`open: true` allows unauthenticated access and logs a warning diagnostic at
startup; it is for local development, not production.

---

## 4. A minimal runtime and client

The fastest way to see the whole stack is two files. Host side — construct a
runtime, serve it:

```ts
import { createRealRuntimeClient } from "@natalia/client";
import { createRuntimeHttpServer } from "@natalia/transport/host";

const runtime = createRealRuntimeClient({
  workspaceRoot: "/home/me/project",
  sessionID: "ses_demo",
  permissionMode: "auto", // auto-approve tools; change for policy
  provider: {
    // plug a real provider here
    provider: "scripted",
    model: "scripted",
    async *stream() {
      yield { type: "content" as const, text: "Hello from your runtime. " };
      yield { type: "done" as const };
    },
  },
});
runtime.start(() => {}); // the in-process event sink
const server = createRuntimeHttpServer({
  client: runtime,
  token: "demo-token", // every deployment's own bearer token
});
console.log(`runtime listening at ${server.url}`);
```

Consumer side — any process, any machine:

```ts
import { createNataliaSDK } from "@natalia/sdk";
import { projectEvents, displayText } from "@natalia/view-store";

const sdk = createNataliaSDK({
  baseURL: "http://127.0.0.1:4700",
  token: "demo-token",
});

const submitted = await sdk.prompt("explain this repository");
console.log(submitted.type, submitted.id); // turn.submitted turn_…

// Replay the journal and fold it into renderable blocks.
const { events } = await sdk.history({ limit: 200 });
const state = projectEvents(events.map((entry) => entry.event));
for (const block of state.messages) console.log(displayText(block));
```

This is the whole shape of an integration: one process hosts (runtime +
HTTP server), any number of other processes consume (SDK + view-store). The
conformance suite (§10) exercises the same shape with every member the
runtime implements.

A read-only credential is refused on any write with `-32001 refused` and a
reason, whether or not the method exists — authorization errors never double as
existence probes. A server can also be explicitly configured `open: true`, which
allows unauthenticated access and logs a warning diagnostic at startup.

**Event subscription is filtered server-side.** Subscribe with `?session=…`;
the credential's session set is checked at subscription time (out of scope is
`403`), and events carrying another session id are never pushed — not even as
counts or types. Do not implement client-side filtering of a shared stream; the
server is the boundary.

## 5. How calls fail, and how "no" is a value

A failed call throws `RuntimeRPCError` (from `@natalia/sdk` and
`@natalia/transport`). `failureKind(error)` from `@natalia/contracts` returns
one of five kinds, each calling for a different reaction:

| Kind             | Code     | What it means                                                                                              | What to do                                                    |
| ---------------- | -------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `methodNotFound` | `-32601` | This runtime has no such route                                                                             | You and it disagree about the protocol: report it, or degrade |
| `notSupported`   | `-32000` | The route exists, this runtime does not implement the member. `data` carries `member` and its `capability` | Hide the whole capability group; retrying will never help     |
| `invalidParams`  | `-32602` | Your arguments are wrong                                                                                   | Fix the call                                                  |
| `refused`        | `-32001` | Policy or current state says no. `data.reason` says which                                                  | Tell the person; it may succeed later                         |
| `internal`       | `-32603` | Something broke. `data.errorID` correlates with a durable diagnostic                                       | Retry or escalate                                             |

An `internal` failure carries **no message detail on purpose**: an unclassified
error's text can contain an absolute path, a command line or a secret. Read
`diagnostics.list` and match `data.errorID` if you need the detail. Do not match
on message text for anything — the text is for people, the code and `data` are
for you. HTTP status is `400` for every failure, deliberately, so it cannot
become a second classification that disagrees with the first.

**Refusing is often a value, not an exception.** Some operations answer "I did
not do that, and here is why" in their result, because refusing is an ordinary
outcome and you must not have to tell it apart from a broken connection by
catching. Today: `reloadConfig` / `canReloadConfig` (`applied` / `allowed`),
`updateConfig` (`applied`), `pause` / `resume` (`paused` / `resumed`),
`selectAgent` (`outcome` is `applied`, `pending` or `rejected`), and
`respondApproval` / `respondQuestion` (`accepted`). The last pair matters most
for an external UI: answering a request that has already timed out returns
`accepted: false`, and the model was already told that call did not run —
rendering it as approved would be wrong. Which members must answer this way is
recorded per member in `packages/contracts/src/refusals.ts`, with a note for
each; a new member cannot be added to `RuntimeClient` without deciding this.

The SDK also performs a **version check**: before the first call it reads
`/healthz`, and if the runtime speaks a newer `apiVersion` than the SDK knows,
every call surface fails loudly with `RuntimeVersionMismatchError` (both
versions are on the error) instead of silently misreading the protocol.

## 6. Discovering what this connection can do

`sdk.availability()` (`runtime.availability`) is the only supported way to
answer "what can I call here". It is derived from the runtime and the transport
route table — not declared by them — so it cannot drift from the code, and it
carries `apiVersion`.

Per channel (pass no channel for the in-process view; the RPC channel is the
HTTP one), each member is one of:

- `implemented_reachable` — the runtime implements it and this connection
  routes it;
- `implemented_unreachable` — with a reason: either **intentionally local**
  (see below) or "this transport does not route it";
- `not_implemented` — the runtime itself does not implement it (the route
  answers `-32000`).

Group-level: a group is `reachable` only when every member is reachable on this
channel; a mixed group is flagged `partial`. The report also carries
`requiredMembers` — the stable required set on this channel — and per-member
`deprecated` information when a member has one.

Members that are **intentionally local** are routed away on purpose and
reported with their reason: `dispose` (a remote caller must not dispose another
party's runtime), `start` (remote consumers subscribe to `/events` instead),
`lastSubmission` (a local read), `diagnostic` (one-way local publishing).

Queries that answer **empty because nothing records them yet** are listed by
`UNIMPLEMENTED_QUERIES` in the contracts and marked in the report: `constitutionRules`,
`decisionRecords`, `evidenceRecords`, `driftFindings`, `registeredTools`. An
empty array cannot say "not implemented yet" by itself; the report can. Do not
build a feature on them until their writers exist.

`capabilities` (the RPC route) is a different fact from availability: it lists
the _capability records loaded into this runtime_, while availability lists
_which API members are implemented and reachable_. The names are close; the
facts are not.

The worker channel (used by the TUI) has its own route table and its own honest
report. Its gaps — `workgraph.*` and the intelligence queries are not routed
there — show up as `implemented_unreachable` rather than being silent.

## 7. The event stream and projection

`GET /events` (or `/ws`) streams `RuntimeEvent` objects as server-sent events.

- Subscribe with `?session=…`; the server enforces the credential's session set
  (see §3).
- `since` — a sequence marker. `sdk.events({ since })` replays from that marker;
  `since: 0` replays from the beginning (this is a documented fix: `0` is a
  real marker, not "none").
- **Idle streams are long-lived.** The server's HTTP idle timeout is 255s so a
  quiet event stream is not killed while a silent terminal is alive. Treat the
  stream as a push channel, not a polling one.
- **Deltas are not durable.** `content.delta` and `thinking.delta` are live-only
  and never journaled. Replaying `session.history` yields one `content.done`
  per provider step and no deltas at all.

Use `@natalia/view-store` to fold the stream into displayable state — it is the
main reason to use the package instead of writing your own reducer. It projects
most runtime event types and deliberately skips the rest (dialog and
terminal-pane-focus events are UI-only; the fact events listed in §6 have no
writer, so projecting them would advertise a feature the runtime does not
have). The projection handles retries without duplicating text, hides
provider-forbidden reasoning, treats `text` (confirmed) and `pendingText`
(in flight) differently, and bounds every growable slice except `messages`,
which is unbounded on purpose.

A tool event's `id` is not the turn id: the runtime publishes tool events as
`${turnID}:${callID}`. `view-store` normalises this and exports
`turnIDForTool` so state you key yourself agrees.

**Events without `sessionID` are runtime-level and visible to any authorized
session subscriber.** The runtime stamps every event published while a session
is active with that session's id, so turn, tool, approval and terminal events
belong to exactly one session. Only events published before the session exists
(early diagnostics) or events that carry their own id (`session.created`,
`session.ready`, work-graph nodes) escape the stamp — the "no session id =
runtime level" rule now applies to those alone.

### The turn lifecycle

One submission produces, in order, on the live stream and in the journal
(`history` replay):

1. `turn.submitted` — the request was accepted; `id` is the turn id.
2. `thinking.delta` / `thinking.done` — the model's reasoning. May be absent
   (the provider can forbid it, and `view-store` hides it then). Deltas are
   live-only; replay shows only `thinking.done`.
3. `content.delta` / `content.done` — the visible answer. Deltas are live-only
   and never journaled; replay shows exactly one `content.done` per provider
   step.
4. `tool.update` — one per tool invocation; `id` is `` `${turnID}:${callID}` ``
   (see §7).
5. `turn.finished` — `stopReason`: `"done"`, `"cancelled"` or `"error"`;
   `reason: "missing_final_response"` when the provider ended without a
   response. A turn that is waiting on you is `turn.paused`; the waiter events
   `approval.request` / `question.request` carry the request you must answer.
   `turn.retry` marks a replayed attempt.

- **`submitInput` has explicit delivery semantics.** `delivery: "steer"`
  (default) promotes the input into a turn immediately, with multiple steers
  running in admission order; `delivery: "queue"` queues it, draining only
  when no steer is pending. Re-submitting the same id is idempotent — an
  already-admitted input does not publish `turn.submitted` again (a steer
  keeps pushing the admitted input forward). `input.id` lets you choose the
  turn id (default `turn_…`); `attachments` are workspace-relative paths,
  stored and validated at submit time.

### Approvals and questions

- **An approval is a request, not a gate you hold open.** The waiter events
  (`approval.request`, `question.request`) carry `id`, `title`, `preview`,
  optional `detail`/`keyArguments`, `sensitive` (the detail was withheld from
  the model), `risk` (`terminal_low` / `terminal_high` for terminal scopes),
  `scope`, `expiresAt` and `revocable`.
- **Approvals time out, and a timeout is not a cancellation.** The runtime
  answers an approval with the model's chosen verdict once a human responds;
  if nobody responds, the request expires (`expiresAt`) and answering it
  afterwards returns `accepted: false` — the model was already told the call
  did not run. "Nobody answered" and "the turn was cancelled" are different
  facts; an external UI must render them differently.
- **`scope` is a grant key, not a label.** Approving an approval grants its
  `scope` for the session, so later requests in the same scope (for example
  the same tool) do not ask again until the scope expires (`expiresAt`) or is
  revoked (`revocable`). `respondApproval` with `accept: true` grants; the
  grant is session-scoped and never journaled.

## 8. Reading a session

The transcript and session record are readable by cursor and by sequence:

- `sdk.history({ after, limit })` — journal events by sequence, cursor-friendly.
- `sdk.messages({ limit, order, cursor })` — the projected message page.
- `sdk.sessionSnapshot()` / `sdk.snapshot()` — current state snapshots.
- `sdk.pendingInteractive()` — approvals and questions currently awaiting an
  answer (drives the "external UI takes over approvals" pattern).
- `sdk.workGraphNodes()` / `sdk.workGraphEdges()` — the durable causal record:
  agent actions, tool calls (including denied ones), approvals and workspace
  changes, correlated by `epi_*` ids. Deliberately carries no prompts, tool
  arguments, output or reasoning.

Three behaviours worth knowing before you build on them:

- **`checkpoint()`, `checkpoints()` and `rollback()` are slash-command
  aliases, not separate APIs.** They submit a real turn (`/checkpoint`,
  `/checkpoints`, `/rollback`): a provider must be present, a turn actually
  runs, and the command handles the rest. The dedicated members are
  `checkpointList`, `checkpointPreview` and `checkpointRollback` (see the
  generated route table); the aliases exist for the TUI's convenience. Use
  the dedicated members from an integration.
- **The dedicated checkpoint members.** `checkpointList()` lists the records
  (`sequence`, `reason` — e.g. `turn_begin`, `context-limit` — `complete`,
  `errors`, `files`, `changes`, `tokenEstimate`, `diskUsageBytes`);
  `checkpointPreview(id)` dry-runs a rollback — it returns a `CheckpointPreview`
  (affected files, target journal offset, resource policy, `warnings`) without
  touching the workspace; `checkpointRollback({ id, dryRun })` previews first,
  then acts: `dryRun: true` returns only the preview, otherwise the workspace
  is restored to that checkpoint (git on the real working tree). An unknown id
  is an argument error.
- **Session records are created, archived and exported over RPC.**
  `newSession({ id?, title? })` (`session.new`) creates a record — idempotent
  by id (`created: false` for an existing id, otherwise a minted `ses_…` id).
  `archiveSession` (`session.archive`) marks it `archived: true` (it stays
  listable and exportable); `exportSession` (`session.export`) dumps the
  journal as `{ seq, event }` pairs. `attachSession(id)` (`session.attach`)
  makes an existing record the active session without rebuilding the host
  process. It switches the session presented to the UI and direct calls; a
  turn, approval, or question already owned by another session continues in
  the background and records to that session's own journal. Session-scoped
  approvals remain with their owning session. Attach is therefore a
  multi-session focus operation, not a cancellation or migration of in-flight
  work.
- **The remaining session-record members are metadata operations; they never
  touch the journal.** `sessionTouch(id)` refreshes `lastAccessedAt`;
  `sessionRename(id, title)` changes the title (an empty title is refused);
  `sessionPin(id, pinned)` sets or clears the pin.
  `sessionDuplicate(id, title?)` copies the whole record (title defaults to
  `… (copy)`); `sessionFork(id, turnID, title?)` copies only the events and
  inbox up to the given turn (title defaults to `… (fork)`; the boundary turn
  itself is not included). `sessionDelete(id)` refuses to delete the running
  runtime's current session; deletion also cleans up attachments no session
  references anymore and returns `{ id, removedAttachments }`.
- **Sandboxes are isolated scratch workspaces** (the `sandbox` group):
  - `sandboxList()` — the existing sandboxes with their change/resource counts.
  - `sandboxDiff(id)` — a preview of the sandbox's pending changes against the
    main workspace.
  - `sandboxResources(id)` / `sandboxResourceOutput({ id, resourceID, maxBytes })`
    — the resources running inside a sandbox (command, pid, status, output
    path) and their output text (truncated at 20KB by default).
  - `sandboxMerge(id)` (write) — merges the changes back into the main
    workspace, authorizing path by path; if the sandbox's change set changes
    while the merge is being authorized, the merge is refused.
  - `sandboxResourceStop({ id, resourceID })` (write) — SIGTERM a resource
    running inside the sandbox.
  - `sandboxDelete(id)` (write) — stops every running resource and removes the
    sandbox tree; the return value honestly reports the discarded
    `pendingChanges` and `runningResources` — deleting is discarding, and the
    return value is the only chance to notice.
- **Paging has two cursor styles.** `messages({ limit, order, cursor })`
  returns `{ data, cursor: { previous?, next? } }` — pass `cursor.next` to go
  forward and `cursor.previous` to go back. `history({ after, limit })`
  returns `{ events, hasMore }` — pass the last event's sequence as `after`
  while `hasMore` is true.

## 9. The write surface

Writing is a first-class, separately-authorized surface. A credential without
the `write` dimension is refused on every method in the write table (machine
derived, see the generated section) with `-32001 refused`. The write surface
covers submissions and turn control, approvals and questions, agent/model
selection, config reload and update, checkpoint rollback, sandbox merge/delete
and resource stop, session management (touch/rename/pin/duplicate/fork/delete),
the native terminal controls (including secure-input begin/end — ending a
human's secure input remotely is a write of the strongest kind), and flow
document save/delete.

Task execution is a separate endpoint: `POST /tasks/run`. It is not a JSON-RPC
route and not in the write table: the host must explicitly install a `runTask`
handler, and without one the endpoint is a plain 404. A deployment that enables
it decides who may reach it.

**The terminal write surface is host-gated, off by default.** The
`nativeTerminal` group's `start`, `write` and `resize` are writes in the table
below, and a host must additionally enable them
(`terminalWrite: true` on the HTTP server options) before they can be called —
without the option they answer `-32001 refused`
("terminal write is not enabled by this host"), the same shape as `/tasks/run`.
A read-only credential is refused by authorization before the gate is even
consulted ("no write scope"). Remote callers are model-side actors: `write` is
refused while a human holds input or secure input is active, an
`idempotencyKey` replay answers `delivery: "duplicate"` instead of writing
twice, and `resize` goes through the same secure-input interlock as the
model-side tool.

**Idempotency by path.** `flow.save` (`sdk.saveFlowDocument({ path?, document })`)
uses the path as the idempotency key: replaying the same save answers
`created: true` the first time and `updated: true` afterwards. `flow.delete`
answers `alreadyDeleted: true` for an already-gone path. A path that escapes
the workspace, or a flow still referenced by a task, is a typed refusal
(`refused`), never an exception.

**Validation is a value, not an exception.** `task.preview`
(`sdk.taskPermissionPreview({ path })`) returns `{ valid, problems, blocked,
conditionlessModules }` so an orchestrator can check a task document before
delivering it.

**Config writes use the same refusal semantics as reload.** `config.update`
(`sdk.updateConfig({ patch, scope })`) writes the patch, merges it, and applies
it; applying under a running turn is refused as a value (`applied: false` with a
reason), the same shape as `reloadConfig`. The TUI's settings menu and a remote
consumer go through the same route.

### Attachments (images, video, PDFs and text)

`prompt(text, { attachments })` and `submitInput` take workspace-relative
paths; the runtime sniffs the **bytes** (magic headers, not extensions),
stores them under `.natalia/attachments` and lowers them into the provider
request:

| Media  | Accepted types                                                | How it reaches the model               |
| ------ | ------------------------------------------------------------- | -------------------------------------- |
| Images | `image/png`, `image/jpeg`, `image/webp`, `image/gif`          | provider-native image content          |
| Video  | `video/mp4`, `video/webm`                                     | inline video — Gemini only today (§11) |
| PDFs   | `application/pdf`                                             | provider-native document content       |
| Text   | `text/plain`, `text/markdown`, `application/json`, `text/csv` | read and pasted into the user message  |

- **No framework size ceiling.** The model/provider is the authority on what
  fits; a context-length check driven by the provider's own limits is a later
  feature, not a hardcoded constant.
- **Two gates, both checked.** The selected model's declared capabilities
  (`imageInput`, `pdfInput`, `videoInput`) and the provider adapter's lowering
  support must both accept the attachment; a mismatch refuses the turn with a
  message naming the missing side.
- Bytes matching no known type are refused; a path outside the workspace is
  refused. An attachment with an image-looking filename but non-image bytes is
  sniffed and refused, not trusted.
- **The TUI queues attachments three ways**: `Alt+A` (type a
  workspace-relative path), `Alt+Y` (paste the image from the system
  clipboard — needs `wl-paste`/`xclip` on Linux, `osascript` on macOS,
  PowerShell on Windows), and dragging files into the terminal: most terminals
  paste a dropped file as its path text, and the TUI recognizes paste text
  whose lines are all existing workspace files and queues them as
  attachments. `Alt+X` removes the most recent attachment directly from the
  composer (a single pasted image, for example); `Alt+O` opens the full list,
  where `Alt+X` removes the selected one. Alt-based bindings avoid the
  `Ctrl+Shift` chords that terminals and input methods capture.

### Management (the configuration surface)

Everything a deployment configures is configurable over RPC — validated
against the same schemas the config file is validated against, written to the
same file, and applied by the same reload path. All of it is in the write
table except the two reads:

- **Permission profiles** — `permissionList` (read), `permissionSave`
  (create or replace; a running turn may block the reload and answer
  `applied: false`), `permissionDelete` (idempotent; the active default
  profile refuses deletion).
- **MCP servers** — `mcpServerAdd` (create or replace; the runtime writes
  the config and reconnects, connection failures surface as diagnostics),
  `mcpServerRemove` (idempotent). Server config uses the MCP official field
  set (`type`, `command`, `args`, `url`, `headers`, `environment`, …).
- **Agents** — `agentCreate` (existing name answers `created: false`),
  `agentUpdate`, `agentDelete` (idempotent; the default agent refuses).
- **Providers** — `providerDiscover` (read-only probe of
  `{type, baseURL, apiKey}` against the provider's models endpoint),
  `providerAdd` (create or replace, applies immediately), `providerRemove`
  (idempotent; a provider referenced by a model refuses). The api key crosses
  the wire only in the request body of these calls — use a scoped credential
  with the `management` group for anything that touches them.
- **Plugins** — `pluginUnload` (idempotent), `pluginReload` (unloads and
  re-imports the module from its manifest path, busting the import cache).

The management group (`permissionList`/`permissionSave`/`permissionDelete`)
lets a deployment hand out a credential that can configure policy without
touching the rest of the surface.

### Terminal sessions (read surface, non-write members)

The `nativeTerminal` members other than `start`/`write`/`resize` need no host
gating, but the host must exist (they fail with "Native Terminal Host is
unavailable" otherwise):

- `nativeTerminalList()` — the existing sessions of the current session
  (reconciled with the mux server). Panes are addressed per session (I3):
  after `attachSession`, only the attached session's panes are visible, and a
  pane of another session is indistinguishable from an unknown id.
- `nativeTerminalRead(id)` — the session's text (at most 200 lines).
- `nativeTerminalOpenHub()` — opens a mux window, returns `{ muxWindowID }`.
- `nativeTerminalStop(id)` — terminates the session (answers
  `status: "exited"`).
- `nativeTerminalRevokeApprovalScope(id)` — revokes the approval scopes
  previously granted to that session.
- `nativeTerminalReleaseHumanControl(id)` — releases human control of the
  session.
- `nativeTerminalBeginSecureInput(id)` / `nativeTerminalEndSecureInput(id)` —
  the secure-input interlock: while active, both model-side and remote writes
  are refused.

## 10. Examples (executable, not prose)

The conformance suite `packages/sdk/test/consumer-conformance.test.ts` is this
document's contract in executable form — 18 tests across eight scenario
families, using only the consumer packages, against a real runtime over the
real transport:

1. **Round-trip rendering** — submit a prompt, consume events, replay history,
   fold with `view-store` (the minimal loop from the guide).
2. **Five-way failure distinction** — every failure kind is programmatically
   distinguishable; value refusals are asserted.
3. **Capability negotiation against a stub** — a minimal required-set runtime
   answers `-32000` honestly, and the report says so.
4. **An external UI takes over approvals** — render `approval.request`, answer
   via `respondApproval`, watch the turn continue; a rejected approval arrives
   as a policy decision, not a lie.
5. **An external orchestrator** — submit, consume the event stream, follow the
   Work Graph causal walk, read the task overview.
6. **A read-only integration** — one server, two credentials: the read-only one
   renders the session, is refused on every write with an honest report, and
   never sees another session's events.
7. **The routed surface** — every P0-C route is called at least once, including
   the empty-until-writers queries and `capabilities`.
8. **The management surface** — an external integration creates and archives
   sessions, edits permission profiles, agents and providers, and drives the
   plugin lifecycle over RPC, all idempotently.

If you need something this document promises but the conformance test does not
cover, extend the test first — that is how a gap becomes a tracked fact instead
of a surprise.

## 11. Known limitations and roadmap

Things that are deliberately not part of this v1 surface, stated so you can
plan around them rather than discover them:

- **One server, one runtime.** No session routing, no multi-tenancy. Multi-session
  is a planned protocol evolution, not a config flag.
- **No out-of-tree capability loading.** Capabilities are registered in-repo
  only. Plugins can contribute tools, commands and event listeners, but a
  plugin is `import()`ed in-process with path containment, no VM, no
  filesystem restriction and no timeout — **a plugin is trusted code, not a
  sandbox**. The public `settings` RPC surface is active; the extension grants
  for plugin-contributed `settings`, `workflows` and `projection` still have
  no host-side contribution handlers, so declaring those grants alone adds no
  plugin behavior yet.
- **Five fact queries answer empty** until their production writers exist
  (§6). Do not build a feature on them.
- **Terminal writes are host-gated, off by default.** The `nativeTerminal`
  group exposes the full interactive surface over RPC: `list`, `read`,
  `start`, `write`, `resize`, `stop`, `openHub`, `revokeApprovalScope`,
  `releaseHumanControl`, `beginSecureInput`, `endSecureInput`. `start`,
  `write` and `resize` are the terminal write surface (P0-H): a host must
  explicitly enable them (`terminalWrite: true` on the HTTP server options),
  and without that every one of the three answers `-32001 refused`
  ("terminal write is not enabled by this host") — remote terminal write is
  remote shell, so opting in is a deployment decision, exactly like
  `/tasks/run`. Remote callers are model-side actors for ownership and
  secure-input arbitration: writing is refused while a human holds input or
  secure input is active, and a replayed `idempotencyKey` answers
  `delivery: "duplicate"` instead of writing twice.
- **The worker channel** (TUI in-process proxy) routes a subset of the API and
  reports the rest honestly; it is not a second public integration target.
- **Every event published while a session is active is stamped with that
  session's id**; the "runtime-level, visible to any authorized subscriber"
  rule applies only to events published before the session exists, which in
  practice is early startup diagnostics.
- **Video attachments are Gemini-only today.** The Gemini adapter lowers
  `video/mp4` and `video/webm` to inline video; the Anthropic and
  OpenAI-compatible adapters answer `videoInput: false`, so a video attachment
  is refused with a message naming the adapter.

---

## 12. Wire protocol

Everything below is what the SDK already speaks; this section exists so you can
implement a client without the SDK, or audit a trace. The typed alternative to
hand-rolled fetch is `callRuntimeRPC` from `@natalia/transport`.

### JSON-RPC

`POST {baseURL}/rpc` with `Content-Type: application/json`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "prompt",
  "params": { "text": "explain this repository" }
}
```

Success:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { "type": "turn.submitted", "id": "turn_1", "text": "…" }
}
```

Failure — the HTTP status is **always 400** for a classified failure, and the
error carries the code and structured data:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32001,
    "message": "authorization refused: this credential has no write scope",
    "data": {
      "kind": "refused",
      "reason": "authorization refused: this credential has no write scope"
    }
  }
}
```

`data.kind` is one of the five kinds in §5. `data` carries `member` /
`capability` for `notSupported`, `reason` for `refused`, `errorID` for
`internal`. An authentication failure is a `401` with
`{ "error": "unauthorized" }` and is deliberately indistinguishable for a
missing or wrong token.

### Health check

`GET /healthz` — no authentication, no params:

```json
{ "ok": true, "apiVersion": 1 }
```

The SDK reads this once before its first call and refuses to guess when the
runtime speaks a newer version than it knows (§5).

### Events

`GET /events?session=ses_…&since=…` — SSE stream, `Authorization: Bearer …`
required when the server is secured. Each event is one `data:` line with a JSON
`RuntimeEvent`; events are separated by a blank line:

```
data: {"type":"turn.submitted","id":"turn_1","text":"hi"}

data: {"type":"thinking.delta","id":"turn_1","text":"Let me","episodeID":"epi_…"}
```

- `session` — the credential's session set is checked at subscription time;
  out of scope is `403`.
- `since` — replay from this sequence marker; `0` replays from the beginning.
- The same stream is available over WebSocket at `/ws`. The WS event envelope
  (a JSON-RPC 2.0 notification) is:

```json
{
  "jsonrpc": "2.0",
  "method": "event",
  "params": {
    "id": 42,
    "event": { "type": "content.delta", "id": "turn_1", "text": "hi" }
  }
}
```

`params.id` is the server-side incrementing event sequence; `params.event`
is the `RuntimeEvent` object. Subscription auth and `session` filtering are
the same as `GET /events` (out of bounds is `403`); on connect the server
**replays its last 500-event buffer**, but there is no `since` parameter —
for arbitrary-depth replay use `/events?since=…`.

### Running a task

`POST /tasks/run` — a dedicated endpoint, not a JSON-RPC route. It is only
present when the host installed a `runTask` handler; otherwise it answers
`404 { "error": "task delivery is not enabled" }`. Non-POST is `405`, a body
without `taskPath` is `400`:

```json
{
  "taskPath": "flows/check.yaml",
  "workspaceRoot": "/home/me/proj",
  "json": true
}
```

The response is the delivery result: `{ invocationID, status, waterlineAdvanced,
exitCode, output }`. `json: true` switches the task's own output to JSON. This
endpoint is not in the write table — a deployment that enables it decides who
may reach it.

---

## 13. Deployment

### The daemon

The CLI runs a runtime as a background daemon:

```sh
natalia daemon --port 4700
```

- The daemon mints its own bearer token on first start: 32 random bytes,
  base64url, written to the daemon dir's `token` file with mode `0o600` and
  reused on later starts. The CLI reads it from `NATALIA_TRANSPORT_TOKEN` when
  present, or from the token file otherwise.
- **The daemon never prints the token** (`natalia daemon` prints only
  `{ url }` — printing a secret to stdout leaks it into logs). To call the
  API, a consumer on the same machine and user reads the token file:
  `<daemon-dir>/token` (the `--daemon-dir` directory, default
  `$XDG_STATE_HOME/natalia-cli/daemon`, i.e. `~/.local/state/natalia-cli/daemon`
  on Linux; `natalia daemon-status` reports the exact path). For
  cross-machine or cross-user consumers, the deployment forwards the token
  value through its own configuration (env var, secret store) —
  `NATALIA_TRANSPORT_TOKEN` is the same path the CLI itself uses.
- `natalia daemon-status` reports the registered daemon; `natalia daemon-stop`
  stops it. `--daemon-dir` overrides where the daemon keeps its state;
  `--max-concurrent-tasks` bounds parallel task delivery.
- A daemon is a long-lived server, not a REPL wrapper: it serves the full
  surface this document describes (RPC, `/events`, `/tasks/run` when a task
  controller is configured, terminal writes only with `terminalWrite: true`).

### Hosting without the daemon

`createRuntimeHttpServer` (from `@natalia/transport/host`) serves any
`RuntimeClient`:

```ts
createRuntimeHttpServer({
  client: runtime,
  hostname: "127.0.0.1",
  port: 4700,
  token: "a-secret-you-generate",
  // or
  authorization: { credentials: [{ token: "ro", write: false }, { token: "op" }] },
  unix: "/tmp/natalia.sock",        // unix socket instead of TCP
  tls: { cert: "…", key: "…" },     // TLS termination in-process
  events: true,                     // SSE/WS event stream (default on)
  runTask: async (request) => …,    // enables POST /tasks/run
  terminalWrite: true,              // enables the terminal write surface
});
```

Deployment notes:

- **The token file and `token` are bearer credentials — treat them like
  passwords.** The daemon writes with `0o600`; a custom host should do the
  same. Rotate by replacing the file (or the option) and restarting.
- **`open: true` is for local development only.** It logs a startup warning
  and lets any caller through; a deployment without credentials is a
  deployment without an attacker model.
- **Put the runtime behind your own network boundary.** One server is one
  runtime, not a multi-tenant service; the runtime's credentials gate the
  API, they do not implement rate limiting, quotas or identity federation.
- **TLS and unix sockets are transport choices.** Both are plain options on
  `createRuntimeHttpServer`; when neither is set, the server listens on
  `hostname:port` (default `127.0.0.1`).

---

<!-- api-reference:generated -->
## Machine-derived reference

> All numbers and tables below are derived from the source tables the transport and the contracts use. Regenerate with `npm run docs:api-reference`. A hand edit inside this block, or any disagreement with the code, turns `packages/transport/test/api-reference.test.ts` red.

### Protocol version

- `apiVersion` = `1` (`API_VERSION`).
- Stable required surface (`API_STABLE_SURFACE.requiredMembers`, 8 members):
  `start`, `submit`, `cancel`, `snapshot`, `diagnostic`, `lastSubmission`, `respondApproval`, `respondQuestion`.
- Deprecated members (`DEPRECATED_RUNTIME_MEMBERS`): none (mechanism in place, table empty).

### Capability groups (19 groups · 116 optional members)

| Group          | Members (RuntimeClient names)                                                                                                                                                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| transcript     | `history` · `messages` · `pendingInteractive` · `submitInput`                                                                                                                                                                                                                                                         |
| turnControl    | `pause` · `resume`                                                                                                                                                                                                                                                                                                    |
| lifecycle      | `dispose` · `canReloadConfig` · `reloadConfig` · `updateConfig`                                                                                                                                                                                                                                                       |
| settings       | `settingsGet` · `settingsSet`                                                                                                                                                                                                                                                                                         |
| selection      | `agents` · `selectAgent` · `modelCatalog` · `modelSelection` · `selectModel` · `skills` · `agentCreate` · `agentUpdate` · `agentDelete` · `providerDiscover` · `providerAdd` · `providerRemove`                                                                                                                       |
| workspace      | `workspaceFiles` · `workspaceSearch` · `workspaceList` · `workspaceRead` · `workspaceGlob`                                                                                                                                                                                                                            |
| nativeTerminal | `nativeTerminalList` · `nativeTerminalRead` · `nativeTerminalOpenHub` · `nativeTerminalRevokeApprovalScope` · `nativeTerminalReleaseHumanControl` · `nativeTerminalBeginSecureInput` · `nativeTerminalEndSecureInput` · `nativeTerminalStop` · `nativeTerminalStart` · `nativeTerminalWrite` · `nativeTerminalResize` |
| checkpoint     | `checkpointList` · `checkpointPreview` · `checkpointRollback`                                                                                                                                                                                                                                                         |
| sandbox        | `sandboxList` · `sandboxDiff` · `sandboxResources` · `sandboxResourceOutput` · `sandboxMerge` · `sandboxDelete` · `sandboxResourceStop`                                                                                                                                                                               |
| sessions       | `sessionList` · `sessionTouch` · `sessionRename` · `sessionPin` · `sessionDuplicate` · `sessionFork` · `sessionDelete` · `sessionNew` · `sessionArchive` · `sessionExport` · `sessionAttach`                                                                                                                          |
| mcp            | `mcpCatalog` · `getMcpPrompt` · `readMcpResource` · `mcpServerAdd` · `mcpServerRemove`                                                                                                                                                                                                                                |
| extensions     | `plugins` · `commandCatalog` · `capabilities` · `pluginUnload` · `pluginReload`                                                                                                                                                                                                                                       |
| management     | `permissionList` · `permissionSave` · `permissionDelete`                                                                                                                                                                                                                                                              |
| automation     | `taskOverview` · `flowOverview` · `documentCatalog` · `saveFlowDocument` · `deleteFlowDocument` · `saveTaskDocument` · `deleteTaskDocument` · `taskSchedule` · `taskUnschedule` · `taskPermissionPreview`                                                                                                             |
| observability  | `runtimeStatus` · `diagnostics` · `sessionSnapshot`                                                                                                                                                                                                                                                                   |
| workGraph      | `workGraphNodes` · `workGraphEdges`                                                                                                                                                                                                                                                                                   |
| intelligence   | `constitutionRules` · `decisionRecords` · `recordDecision` · `evidenceRecords` · `recordValidation` · `completions` · `recordCompletion` · `driftFindings` · `evaluateDrift` · `acknowledgeDriftFinding` · `confirmedWorkspaceChanges` · `registeredTools`                                                            |
| mailbox        | `mailboxList` · `mailboxSend` · `mailboxDeliver` · `mailboxAcknowledge` · `mailboxDefer` · `mailboxSupersede`                                                                                                                                                                                                         |
| plans          | `planList` · `planCreate` · `planUpdate` · `planPropose` · `planAccept` · `planQueue` · `planActivate` · `planSupersede` · `planCompleted`                                                                                                                                                                            |

### RPC route table (121 methods → members)

| RPC method                           | RuntimeClient member                | Capability group | Write |
| ------------------------------------ | ----------------------------------- | ---------------- | ----- |
| `prompt`                             | `submit`                            | required         | write |
| `cancel`                             | `cancel`                            | required         | write |
| `snapshot`                           | `snapshot`                          | required         | read  |
| `approval.respond`                   | `respondApproval`                   | required         | write |
| `question.respond`                   | `respondQuestion`                   | required         | write |
| `interactive.pending`                | `pendingInteractive`                | transcript       | read  |
| `session.history`                    | `history`                           | transcript       | read  |
| `session.messages`                   | `messages`                          | transcript       | read  |
| `pause`                              | `pause`                             | turnControl      | write |
| `resume`                             | `resume`                            | turnControl      | write |
| `config.canReload`                   | `canReloadConfig`                   | lifecycle        | read  |
| `config.reload`                      | `reloadConfig`                      | lifecycle        | write |
| `config.update`                      | `updateConfig`                      | lifecycle        | write |
| `settings.get`                       | `settingsGet`                       | settings         | read  |
| `settings.set`                       | `settingsSet`                       | settings         | write |
| `agent.list`                         | `agents`                            | selection        | read  |
| `agent.select`                       | `selectAgent`                       | selection        | write |
| `model.catalog`                      | `modelCatalog`                      | selection        | read  |
| `model.selection`                    | `modelSelection`                    | selection        | read  |
| `model.select`                       | `selectModel`                       | selection        | write |
| `skills.list`                        | `skills`                            | selection        | read  |
| `workspace.files`                    | `workspaceFiles`                    | workspace        | read  |
| `workspace.search`                   | `workspaceSearch`                   | workspace        | read  |
| `workspace.list`                     | `workspaceList`                     | workspace        | read  |
| `workspace.read`                     | `workspaceRead`                     | workspace        | read  |
| `workspace.glob`                     | `workspaceGlob`                     | workspace        | read  |
| `checkpoint.list`                    | `checkpointList`                    | checkpoint       | read  |
| `checkpoint.preview`                 | `checkpointPreview`                 | checkpoint       | read  |
| `checkpoint.rollback`                | `checkpointRollback`                | checkpoint       | write |
| `sandbox.list`                       | `sandboxList`                       | sandbox          | read  |
| `sandbox.diff`                       | `sandboxDiff`                       | sandbox          | read  |
| `sandbox.resources`                  | `sandboxResources`                  | sandbox          | read  |
| `sandbox.resource.output`            | `sandboxResourceOutput`             | sandbox          | read  |
| `sandbox.merge`                      | `sandboxMerge`                      | sandbox          | write |
| `sandbox.delete`                     | `sandboxDelete`                     | sandbox          | write |
| `sandbox.resource.stop`              | `sandboxResourceStop`               | sandbox          | write |
| `session.list`                       | `sessionList`                       | sessions         | read  |
| `session.touch`                      | `sessionTouch`                      | sessions         | write |
| `session.rename`                     | `sessionRename`                     | sessions         | write |
| `session.pin`                        | `sessionPin`                        | sessions         | write |
| `session.duplicate`                  | `sessionDuplicate`                  | sessions         | write |
| `session.fork`                       | `sessionFork`                       | sessions         | write |
| `session.delete`                     | `sessionDelete`                     | sessions         | write |
| `session.new`                        | `sessionNew`                        | sessions         | write |
| `session.archive`                    | `sessionArchive`                    | sessions         | write |
| `session.export`                     | `sessionExport`                     | sessions         | read  |
| `session.attach`                     | `sessionAttach`                     | sessions         | write |
| `mcp.catalog`                        | `mcpCatalog`                        | mcp              | read  |
| `mcp.prompt`                         | `getMcpPrompt`                      | mcp              | read  |
| `mcp.resource`                       | `readMcpResource`                   | mcp              | read  |
| `mcp.server.add`                     | `mcpServerAdd`                      | mcp              | write |
| `mcp.server.remove`                  | `mcpServerRemove`                   | mcp              | write |
| `permission.list`                    | `permissionList`                    | management       | read  |
| `permission.save`                    | `permissionSave`                    | management       | write |
| `permission.delete`                  | `permissionDelete`                  | management       | write |
| `agent.create`                       | `agentCreate`                       | selection        | write |
| `agent.update`                       | `agentUpdate`                       | selection        | write |
| `agent.delete`                       | `agentDelete`                       | selection        | write |
| `provider.discover`                  | `providerDiscover`                  | selection        | read  |
| `provider.add`                       | `providerAdd`                       | selection        | write |
| `provider.remove`                    | `providerRemove`                    | selection        | write |
| `plugin.unload`                      | `pluginUnload`                      | extensions       | write |
| `plugin.reload`                      | `pluginReload`                      | extensions       | write |
| `plugin.list`                        | `plugins`                           | extensions       | read  |
| `command.catalog`                    | `commandCatalog`                    | extensions       | read  |
| `task.overview`                      | `taskOverview`                      | automation       | read  |
| `flow.overview`                      | `flowOverview`                      | automation       | read  |
| `document.catalog`                   | `documentCatalog`                   | automation       | read  |
| `runtime.availability`               | (availability route, no member)     | —                | read  |
| `runtime.status`                     | `runtimeStatus`                     | observability    | read  |
| `diagnostics.list`                   | `diagnostics`                       | observability    | read  |
| `workgraph.nodes`                    | `workGraphNodes`                    | workGraph        | read  |
| `workgraph.edges`                    | `workGraphEdges`                    | workGraph        | read  |
| `nativeTerminal.list`                | `nativeTerminalList`                | nativeTerminal   | read  |
| `nativeTerminal.read`                | `nativeTerminalRead`                | nativeTerminal   | read  |
| `nativeTerminal.stop`                | `nativeTerminalStop`                | nativeTerminal   | write |
| `nativeTerminal.openHub`             | `nativeTerminalOpenHub`             | nativeTerminal   | write |
| `nativeTerminal.revokeApprovalScope` | `nativeTerminalRevokeApprovalScope` | nativeTerminal   | write |
| `nativeTerminal.releaseHumanControl` | `nativeTerminalReleaseHumanControl` | nativeTerminal   | write |
| `nativeTerminal.beginSecureInput`    | `nativeTerminalBeginSecureInput`    | nativeTerminal   | write |
| `nativeTerminal.endSecureInput`      | `nativeTerminalEndSecureInput`      | nativeTerminal   | write |
| `nativeTerminal.start`               | `nativeTerminalStart`               | nativeTerminal   | write |
| `nativeTerminal.write`               | `nativeTerminalWrite`               | nativeTerminal   | write |
| `nativeTerminal.resize`              | `nativeTerminalResize`              | nativeTerminal   | write |
| `constitution.rules`                 | `constitutionRules`                 | intelligence     | read  |
| `decision.records`                   | `decisionRecords`                   | intelligence     | read  |
| `decision.record`                    | `recordDecision`                    | intelligence     | read  |
| `evidence.records`                   | `evidenceRecords`                   | intelligence     | read  |
| `evidence.record`                    | `recordValidation`                  | intelligence     | read  |
| `completion.records`                 | `completions`                       | intelligence     | read  |
| `completion.record`                  | `recordCompletion`                  | intelligence     | read  |
| `drift.findings`                     | `driftFindings`                     | intelligence     | read  |
| `drift.evaluate`                     | `evaluateDrift`                     | intelligence     | read  |
| `drift.acknowledge`                  | `acknowledgeDriftFinding`           | intelligence     | read  |
| `observation.confirmed`              | `confirmedWorkspaceChanges`         | intelligence     | read  |
| `tools.registered`                   | `registeredTools`                   | intelligence     | read  |
| `mailbox.list`                       | `mailboxList`                       | mailbox          | read  |
| `mailbox.send`                       | `mailboxSend`                       | mailbox          | read  |
| `mailbox.deliver`                    | `mailboxDeliver`                    | mailbox          | read  |
| `mailbox.acknowledge`                | `mailboxAcknowledge`                | mailbox          | read  |
| `mailbox.defer`                      | `mailboxDefer`                      | mailbox          | read  |
| `mailbox.supersede`                  | `mailboxSupersede`                  | mailbox          | read  |
| `plan.list`                          | `planList`                          | plans            | read  |
| `plan.create`                        | `planCreate`                        | plans            | read  |
| `plan.update`                        | `planUpdate`                        | plans            | read  |
| `plan.propose`                       | `planPropose`                       | plans            | read  |
| `plan.accept`                        | `planAccept`                        | plans            | read  |
| `plan.queue`                         | `planQueue`                         | plans            | read  |
| `plan.activate`                      | `planActivate`                      | plans            | read  |
| `plan.supersede`                     | `planSupersede`                     | plans            | read  |
| `plan.complete`                      | `planCompleted`                     | plans            | read  |
| `capabilities`                       | `capabilities`                      | extensions       | read  |
| `session.snapshot`                   | `sessionSnapshot`                   | observability    | read  |
| `submit.input`                       | `submitInput`                       | transcript       | write |
| `flow.save`                          | `saveFlowDocument`                  | automation       | write |
| `flow.delete`                        | `deleteFlowDocument`                | automation       | write |
| `task.save`                          | `saveTaskDocument`                  | automation       | write |
| `task.delete`                        | `deleteTaskDocument`                | automation       | write |
| `task.schedule`                      | `taskSchedule`                      | automation       | write |
| `task.unschedule`                    | `taskUnschedule`                    | automation       | write |
| `task.preview`                       | `taskPermissionPreview`             | automation       | read  |

### Write surface (`RPC_WRITE_METHODS`, 51 methods; read-only credentials get `-32001 refused`)

- `prompt`
- `cancel`
- `submit.input`
- `approval.respond`
- `question.respond`
- `pause`
- `resume`
- `agent.select`
- `model.select`
- `config.reload`
- `config.update`
- `settings.set`
- `checkpoint.rollback`
- `sandbox.merge`
- `sandbox.delete`
- `sandbox.resource.stop`
- `session.touch`
- `session.rename`
- `session.pin`
- `session.duplicate`
- `session.fork`
- `session.delete`
- `session.new`
- `session.archive`
- `session.attach`
- `mcp.server.add`
- `mcp.server.remove`
- `permission.save`
- `permission.delete`
- `agent.create`
- `agent.update`
- `agent.delete`
- `provider.add`
- `provider.remove`
- `plugin.unload`
- `plugin.reload`
- `nativeTerminal.stop`
- `nativeTerminal.revokeApprovalScope`
- `nativeTerminal.releaseHumanControl`
- `nativeTerminal.beginSecureInput`
- `nativeTerminal.endSecureInput`
- `nativeTerminal.openHub`
- `nativeTerminal.start`
- `nativeTerminal.write`
- `nativeTerminal.resize`
- `flow.save`
- `flow.delete`
- `task.save`
- `task.delete`
- `task.schedule`
- `task.unschedule`

### Intentionally local members (`RPC_INTENTIONALLY_LOCAL`; reported as `intentionally local`)

| Member           | Reason                                                                              |
| ---------------- | ----------------------------------------------------------------------------------- |
| `dispose`        | intentionally local: a remote caller must not dispose another party's runtime       |
| `start`          | intentionally local: remote consumers subscribe to /events instead of calling start |
| `lastSubmission` | intentionally local: a local read of the most recent submission                     |
| `diagnostic`     | intentionally local: one-way publishing from a local caller, not a query            |

### Empty-until-writers queries (`UNIMPLEMENTED_QUERIES`: reachable, implemented, no production writer yet)

| Member | Why it answers empty |
| ------ | -------------------- |

### Failure codes (`RUNTIME_RPC_ERROR_CODES`)

| Kind             | Code   | Meaning                                                                 |
| ---------------- | ------ | ----------------------------------------------------------------------- |
| `invalidRequest` | -32600 | The envelope is not a request.                                          |
| `methodNotFound` | -32601 | No route by that name.                                                  |
| `invalidParams`  | -32602 | The route exists and the arguments are wrong. Only that.                |
| `notSupported`   | -32000 | The route exists; this runtime does not implement the member behind it. |
| `refused`        | -32001 | Policy or current state says no. Carries a reason.                      |
| `internal`       | -32603 | Anything else. Carries no detail — see `RuntimeFailureData`.            |

### Value refusals (members that refuse with a value)

> These members answer an ordinary outcome instead of an error: the refusal is a field of the result. The field is listed per member; the same call shape never switches between value and error depending on state.

| Member                    | Refusal expressed by | Semantics                                                                                                                                                          |
| ------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `acknowledgeDriftFinding` | `acknowledged`       | acknowledges an open drift finding; the rationale is safe prose, never a command, content or secret                                                                |
| `agentCreate`             | `created`            | creating an existing name answers created:false with a reason                                                                                                      |
| `agentDelete`             | `deleted`            | the default agent refuses deletion; an unknown name is an idempotent success                                                                                       |
| `canReloadConfig`         | `allowed`            | advisory precheck; the action re-checks for itself                                                                                                                 |
| `evaluateDrift`           | `opened`             | runs the DriftEvaluator against safe signals and publishes findings; the evaluator has no write power, a finding only escalates to an approval/Chat/mailbox prompt |
| `mailboxAcknowledge`      | `acknowledged`       | acknowledges a delivered mailbox message                                                                                                                           |
| `mailboxDefer`            | `deferred`           | defers a queued mailbox message with a safe reason                                                                                                                 |
| `mailboxDeliver`          | `delivered`          | marks a queued mailbox message delivered; unknown messages answer delivered:false                                                                                  |
| `mailboxSend`             | `queued`             | enqueues a durable mailbox intent; the text is user intent prose that may reach the journal, so secrets must be redacted by the caller                             |
| `mailboxSupersede`        | `superseded`         | supersedes a queued mailbox message with a safe reason                                                                                                             |
| `mcpServerAdd`            | `saved`              | config write and reconnect; connection failures surface as diagnostics                                                                                             |
| `mcpServerRemove`         | `removed`            | an unknown server is an idempotent success                                                                                                                         |
| `pause`                   | `paused`             | nothing running, or already paused, is an ordinary answer                                                                                                          |
| `permissionDelete`        | `deleted`            | the default profile refuses deletion; an unknown name is an idempotent success                                                                                     |
| `permissionSave`          | `saved`              | the config file is written either way; a running turn blocks the reload and answers applied:false                                                                  |
| `planAccept`              | `accepted`           | accepts a proposed plan; the user's decision                                                                                                                       |
| `planActivate`            | `activated`          | activates a queued-next plan                                                                                                                                       |
| `planCompleted`           | `completed`          | marks an active plan completed; its task's evidence moves to accepted (E3)                                                                                         |
| `planCreate`              | `created`            | creates a plan draft; plan content is safe prose that may reach the journal, so secrets must be redacted by the caller                                             |
| `planPropose`             | `proposed`           | proposes a draft for user review                                                                                                                                   |
| `planQueue`               | `queued`             | queues an accepted plan as next, waiting for the current plan's safe finish                                                                                        |
| `planSupersede`           | `superseded`         | supersedes a plan with a safe reason                                                                                                                               |
| `planUpdate`              | `updated`            | updates a draft plan's content, bumping its version                                                                                                                |
| `pluginUnload`            | `unloaded`           | an unknown plugin id is an idempotent success                                                                                                                      |
| `providerAdd`             | `saved`              | config write and apply; apply may be blocked by a running turn                                                                                                     |
| `providerRemove`          | `removed`            | a provider referenced by a model refuses deletion; an unknown name is an idempotent success                                                                        |
| `recordCompletion`        | `recorded`           | records a completion card; changeSummary is safe prose, never a diff or file content                                                                               |
| `recordDecision`          | `recorded`           | records a durable decision fact; decision text and rationale are safe prose, never tool output or file content                                                     |
| `recordValidation`        | `recorded`           | runs a validation command and records the outcome; only the command, outcome, bounded safe summary and duration reach the journal — raw output is redacted         |
| `reloadConfig`            | `applied`            | the reference case: applying new policy under a running turn is refused, and refusing is normal                                                                    |
| `respondApproval`         | `accepted`           | a response to a request that timed out or was already answered is dropped, and the caller has to be told; it used to answer responded:true either way              |
| `respondQuestion`         | `accepted`           | same as respondApproval                                                                                                                                            |
| `resume`                  | `resumed`            | nothing paused is an ordinary answer                                                                                                                               |
| `selectAgent`             | `outcome`            | three real outcomes exist in the runtime — applied, deferred until the turn ends, unknown agent — and the caller could see none of them                            |
| `sessionArchive`          | `archived`           | archiving an archived session answers archived:true; an unknown session is an argument error                                                                       |
| `sessionNew`              | `created`            | creating an existing id answers created:false with the existing summary                                                                                            |
| `updateConfig`            | `applied`            | the file may be written while a running turn prevents application, and that is an ordinary answer                                                                  |

### Events and projection (source scan)

- Runtime event types (`RuntimeEventData` union): 88.
- view-store projections (`case` labels in `packages/view-store/src`): 57.

### SDK methods → RPC routes (source scan of `packages/sdk/src/index.ts`)

| SDK method                          | RPC method                           | Params                                                                                                                                                                                                                                                                                                                                                                                                       | Return type                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cancel`                            | `cancel`                             | `reason?`: string                                                                                                                                                                                                                                                                                                                                                                                            | void                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `pause`                             | `pause`                              | `reason?`: string                                                                                                                                                                                                                                                                                                                                                                                            | PauseOutcome                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `resume`                            | `resume`                             | —                                                                                                                                                                                                                                                                                                                                                                                                            | ResumeOutcome                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `selectAgent`                       | `agent.select`                       | `name?`: string                                                                                                                                                                                                                                                                                                                                                                                              | AgentSelectionOutcome                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `agents`                            | `agent.list`                         | —                                                                                                                                                                                                                                                                                                                                                                                                            | RuntimeAgentCatalogEntry[]                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `modelCatalog`                      | `model.catalog`                      | —                                                                                                                                                                                                                                                                                                                                                                                                            | RuntimeModelCatalogEntry[]                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `modelSelection`                    | `model.selection`                    | —                                                                                                                                                                                                                                                                                                                                                                                                            | RuntimeModelSelection                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `selectModel`                       | `model.select`                       | `modelID?`: string, `variant?`: string                                                                                                                                                                                                                                                                                                                                                                       | void                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `skills`                            | `skills.list`                        | —                                                                                                                                                                                                                                                                                                                                                                                                            | RuntimeSkillCatalogEntry[]                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `workspaceFiles`                    | `workspace.files`                    | `input?`: { query?: string; type?: "file" | "directory"; limit?: number; }                                                                                                                                                                                                                                                                                                                                   | RuntimeWorkspaceFileEntry[]                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `workspaceSearch`                   | `workspace.search`                   | `input`: { query: string; include?: string; limit?: number; }                                                                                                                                                                                                                                                                                                                                                | RuntimeWorkspaceMatch[]                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `workspaceList`                     | `workspace.list`                     | `input?`: { path?: string; offset?: number; limit?: number; }                                                                                                                                                                                                                                                                                                                                                | RuntimeWorkspaceListPage                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `workspaceRead`                     | `workspace.read`                     | `input`: { path: string; offset?: number; limit?: number; }                                                                                                                                                                                                                                                                                                                                                  | RuntimeWorkspaceContent                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `workspaceGlob`                     | `workspace.glob`                     | `input`: { pattern: string; path?: string; limit?: number; }                                                                                                                                                                                                                                                                                                                                                 | RuntimeWorkspaceFileEntry[]                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `sessions`                          | `session.list`                       | —                                                                                                                                                                                                                                                                                                                                                                                                            | RuntimeSessionSummary[]                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `touchSession`                      | `session.touch`                      | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | void                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `renameSession`                     | `session.rename`                     | `id`: string, `title`: string                                                                                                                                                                                                                                                                                                                                                                                | RuntimeSessionSummary                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `pinSession`                        | `session.pin`                        | `id`: string, `pinned`: boolean                                                                                                                                                                                                                                                                                                                                                                              | RuntimeSessionSummary                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `duplicateSession`                  | `session.duplicate`                  | `id`: string, `title?`: string                                                                                                                                                                                                                                                                                                                                                                               | RuntimeSessionSummary                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `forkSession`                       | `session.fork`                       | `id`: string, `turnID`: string, `title?`: string                                                                                                                                                                                                                                                                                                                                                             | RuntimeSessionSummary                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `deleteSession`                     | `session.delete`                     | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | { id: string; removedAttachments: number }                                                                                                                                                                                                                                                                                                                                                                                                            |
| `newSession`                        | `session.new`                        | `input?`: { id?: string; title?: string; }                                                                                                                                                                                                                                                                                                                                                                   | { sessionID: string; created: boolean }                                                                                                                                                                                                                                                                                                                                                                                                               |
| `archiveSession`                    | `session.archive`                    | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | { id: string; archived: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `exportSession`                     | `session.export`                     | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | { sessionID: string; title: string; createdAt: string; archived: boolean; events: Array<{ seq: number; event: RuntimeEvent }>; }                                                                                                                                                                                                                                                                                                                      |
| `attachSession`                     | `session.attach`                     | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | { sessionID: string }                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `permissionList`                    | `permission.list`                    | —                                                                                                                                                                                                                                                                                                                                                                                                            | { default: string; profiles: Array<{ name: string } & PermissionProfile>; }                                                                                                                                                                                                                                                                                                                                                                           |
| `permissionSave`                    | `permission.save`                    | `input`: { name: string; profile: PermissionProfile; }                                                                                                                                                                                                                                                                                                                                                       | { saved: boolean; applied: boolean; reason?: string }                                                                                                                                                                                                                                                                                                                                                                                                 |
| `permissionDelete`                  | `permission.delete`                  | `name`: string                                                                                                                                                                                                                                                                                                                                                                                               | { deleted: boolean; reason?: string; }                                                                                                                                                                                                                                                                                                                                                                                                                |
| `mcpServerAdd`                      | `mcp.server.add`                     | `input`: { name: string; config: MCPServerConfig; }                                                                                                                                                                                                                                                                                                                                                          | { saved: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `mcpServerRemove`                   | `mcp.server.remove`                  | `name`: string                                                                                                                                                                                                                                                                                                                                                                                               | { removed: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `createAgent`                       | `agent.create`                       | `input`: { name: string; config: AgentConfig; }                                                                                                                                                                                                                                                                                                                                                              | { created: boolean; reason?: string }                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `updateAgent`                       | `agent.update`                       | `input`: { name: string; config: AgentConfig; }                                                                                                                                                                                                                                                                                                                                                              | { updated: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `deleteAgent`                       | `agent.delete`                       | `name`: string                                                                                                                                                                                                                                                                                                                                                                                               | { deleted: boolean; reason?: string; }                                                                                                                                                                                                                                                                                                                                                                                                                |
| `discoverProvider`                  | `provider.discover`                  | `input`: { type: string; baseURL: string; apiKey: string; }                                                                                                                                                                                                                                                                                                                                                  | { models: string[] }                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `addProvider`                       | `provider.add`                       | `input`: { name: string; type: string; baseURL?: string; apiKey: string; }                                                                                                                                                                                                                                                                                                                                   | { saved: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `removeProvider`                    | `provider.remove`                    | `name`: string                                                                                                                                                                                                                                                                                                                                                                                               | { removed: boolean; reason?: string; }                                                                                                                                                                                                                                                                                                                                                                                                                |
| `unloadPlugin`                      | `plugin.unload`                      | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | { unloaded: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `reloadPlugin`                      | `plugin.reload`                      | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | { reloaded: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `respondApproval`                   | `approval.respond`                   | `response`: ApprovalResponse                                                                                                                                                                                                                                                                                                                                                                                 | InteractiveResponseOutcome                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `respondQuestion`                   | `question.respond`                   | `response`: QuestionResponse                                                                                                                                                                                                                                                                                                                                                                                 | InteractiveResponseOutcome                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `pendingInteractive`                | `interactive.pending`                | —                                                                                                                                                                                                                                                                                                                                                                                                            | { approvals: Array<Extract<RuntimeEvent, { type: "approval.request" }>>; questions: Array<Extract<RuntimeEvent, { type: "question.request" }>>; }                                                                                                                                                                                                                                                                                                     |
| `checkpoint`                        | `prompt`                             | —                                                                                                                                                                                                                                                                                                                                                                                                            | SubmittedTurn                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `checkpoints`                       | `prompt`                             | `limit?`: number                                                                                                                                                                                                                                                                                                                                                                                             | SubmittedTurn                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `rollback`                          | `prompt`                             | `checkpointID`: string, `options?`: { dryRun?: boolean }                                                                                                                                                                                                                                                                                                                                                     | SubmittedTurn                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `checkpointList`                    | `checkpoint.list`                    | —                                                                                                                                                                                                                                                                                                                                                                                                            | RuntimeCheckpoint[]                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `checkpointPreview`                 | `checkpoint.preview`                 | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | CheckpointPreview                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `checkpointRollback`                | `checkpoint.rollback`                | `input`: { id: string; dryRun?: boolean; }                                                                                                                                                                                                                                                                                                                                                                   | CheckpointPreview                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `sandboxList`                       | `sandbox.list`                       | —                                                                                                                                                                                                                                                                                                                                                                                                            | RuntimeSandbox[]                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `sandboxDiff`                       | `sandbox.diff`                       | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | RuntimeSandboxChange[]                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `sandboxResources`                  | `sandbox.resources`                  | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | RuntimeSandboxResource[]                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `sandboxResourceOutput`             | `sandbox.resource.output`            | `input`: { id: string; resourceID: string; maxBytes?: number; }                                                                                                                                                                                                                                                                                                                                              | string                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `sandboxMerge`                      | `sandbox.merge`                      | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | RuntimeSandboxChange[]                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `sandboxDelete`                     | `sandbox.delete`                     | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | { pendingChanges: RuntimeSandboxChange[]; runningResources: string[]; }                                                                                                                                                                                                                                                                                                                                                                               |
| `sandboxResourceStop`               | `sandbox.resource.stop`              | `input`: { id: string; resourceID: string; }                                                                                                                                                                                                                                                                                                                                                                 | RuntimeSandboxResource                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `snapshot`                          | `snapshot`                           | —                                                                                                                                                                                                                                                                                                                                                                                                            | RuntimeEvent                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `history`                           | `session.history`                    | `options?`: { after?: number; limit?: number }                                                                                                                                                                                                                                                                                                                                                               | { events: Array<{ seq: number; event: RuntimeEvent }>; hasMore: boolean; }                                                                                                                                                                                                                                                                                                                                                                            |
| `messages`                          | `session.messages`                   | `options?`: { limit?: number; order?: "asc" | "desc"; cursor?: string; }                                                                                                                                                                                                                                                                                                                                     | RuntimeMessagePage                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `mcpCatalog`                        | `mcp.catalog`                        | —                                                                                                                                                                                                                                                                                                                                                                                                            | MCPCatalogSnapshot                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `mcpPrompt`                         | `mcp.prompt`                         | `server`: string, `name`: string                                                                                                                                                                                                                                                                                                                                                                             | unknown                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `mcpResource`                       | `mcp.resource`                       | `server`: string, `uri`: string                                                                                                                                                                                                                                                                                                                                                                              | unknown                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `plugins`                           | `plugin.list`                        | —                                                                                                                                                                                                                                                                                                                                                                                                            | PluginStatus[]                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `commandCatalog`                    | `command.catalog`                    | —                                                                                                                                                                                                                                                                                                                                                                                                            | ContributedCommand[]                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `workGraphNodes`                    | `workgraph.nodes`                    | —                                                                                                                                                                                                                                                                                                                                                                                                            | WorkGraphNodeView[]                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `workGraphEdges`                    | `workgraph.edges`                    | —                                                                                                                                                                                                                                                                                                                                                                                                            | WorkGraphEdgeView[]                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `nativeTerminalList`                | `nativeTerminal.list`                | —                                                                                                                                                                                                                                                                                                                                                                                                            | RuntimeNativeTerminalSession[]                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `nativeTerminalRead`                | `nativeTerminal.read`                | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | { id: string; text: string }                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `nativeTerminalStop`                | `nativeTerminal.stop`                | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | RuntimeNativeTerminalSession                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `nativeTerminalOpenHub`             | `nativeTerminal.openHub`             | —                                                                                                                                                                                                                                                                                                                                                                                                            | { muxWindowID: number }                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `nativeTerminalRevokeApprovalScope` | `nativeTerminal.revokeApprovalScope` | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | Awaited< ReturnType< NonNullable<RuntimeClient["nativeTerminalRevokeApprovalScope"]> > >                                                                                                                                                                                                                                                                                                                                                              |
| `nativeTerminalReleaseHumanControl` | `nativeTerminal.releaseHumanControl` | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | Awaited< ReturnType< NonNullable<RuntimeClient["nativeTerminalReleaseHumanControl"]> > >                                                                                                                                                                                                                                                                                                                                                              |
| `nativeTerminalBeginSecureInput`    | `nativeTerminal.beginSecureInput`    | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | Awaited< ReturnType<NonNullable<RuntimeClient["nativeTerminalBeginSecureInput"]>> >                                                                                                                                                                                                                                                                                                                                                                   |
| `nativeTerminalEndSecureInput`      | `nativeTerminal.endSecureInput`      | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                 | Awaited< ReturnType<NonNullable<RuntimeClient["nativeTerminalEndSecureInput"]>> >                                                                                                                                                                                                                                                                                                                                                                     |
| `nativeTerminalStart`               | `nativeTerminal.start`               | `input`: { command: string; cwd?: string; id?: string; }                                                                                                                                                                                                                                                                                                                                                     | RuntimeNativeTerminalSession                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `nativeTerminalWrite`               | `nativeTerminal.write`               | `input`: { id: string; input: string; idempotencyKey?: string; }                                                                                                                                                                                                                                                                                                                                             | { id: string; writtenBytes: number; delivery: "accepted" | "duplicate" | "cancelled"; }                                                                                                                                                                                                                                                                                                                                                               |
| `nativeTerminalResize`              | `nativeTerminal.resize`              | `input`: { id: string; rows: number; cols: number; }                                                                                                                                                                                                                                                                                                                                                         | RuntimeNativeTerminalSession                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `constitutionRules`                 | `constitution.rules`                 | —                                                                                                                                                                                                                                                                                                                                                                                                            | Array<{ ruleID: string; statement: string; scope: "project" | "package" | "sandbox" | "task" | "release"; priority: "critical" | "high" | "medium" | "low"; source: "user" | "master_plan" | "policy"; enforcement: "deny" | "approval" | "warn"; overridePolicy: "forbidden" | "user_scoped" | "user_explicit"; }>                                                                                                                                   |
| `decisionRecords`                   | `decision.records`                   | —                                                                                                                                                                                                                                                                                                                                                                                                            | Array<{ decision: string; rationale: string[]; alternatives: { option: string; rejectedReason?: string }[]; consequences: string[]; status: "proposed" | "accepted" | "superseded"; linkedPlans: string[]; linkedConstraints: string[]; }>                                                                                                                                                                                                            |
| `recordDecision`                    | `decision.record`                    | `input`: { decision: string; rationale?: string[]; alternatives?: { option: string; rejectedReason?: string }[]; consequences?: string[]; linkedPlans?: string[]; linkedConstraints?: string[]; }                                                                                                                                                                                                            | { recorded: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `evidenceRecords`                   | `evidence.records`                   | —                                                                                                                                                                                                                                                                                                                                                                                                            | Array<{ taskID: string; objective: string; status: string; effectiveStatus?: string; changes: Array<{ path: string; changeType: "added" | "modified" | "deleted"; summary: string; }>; validations: Array<{ command: string; result: "passed" | "failed" | "skipped"; safeSummary: string; durationMs?: number; }>; knownGaps: string[]; }>                                                                                                           |
| `recordValidation`                  | `evidence.record`                    | `input`: { taskID: string; objective: string; command: string; timeoutSec?: number; knownGaps?: string[]; }                                                                                                                                                                                                                                                                                                  | { recorded: boolean; result?: "passed" | "failed"; safeSummary?: string; }                                                                                                                                                                                                                                                                                                                                                                            |
| `completions`                       | `completion.records`                 | —                                                                                                                                                                                                                                                                                                                                                                                                            | Array<{ completionID: string; taskID: string; objective: string; changeSummary: string; behaviorImpact?: string; validations: Array<{ command: string; result: "passed" | "failed" | "skipped"; safeSummary: string; }>; humanValidation?: string; knownGaps: string[]; externalSideEffects: string[]; rollbackState?: string; evidenceIDs: string[]; recordedAt: string; }>                                                                          |
| `recordCompletion`                  | `completion.record`                  | `input`: { taskID: string; objective: string; changeSummary: string; behaviorImpact?: string; validations?: Array<{ command: string; result: "passed" | "failed" | "skipped"; safeSummary: string; }>; humanValidation?: string; knownGaps?: string[]; externalSideEffects?: string[]; rollbackState?: "clean" | "available" | "none" | "needs_promotion"; evidenceIDs?: string[]; changePaths?: string[]; } | { recorded: boolean; completionID?: string }                                                                                                                                                                                                                                                                                                                                                                                                          |
| `mailboxList`                       | `mailbox.list`                       | —                                                                                                                                                                                                                                                                                                                                                                                                            | Array<{ messageID: string; source: "user_via_live_chat" | "system"; priority: "normal" | "high" | "urgent"; intent: string; text: string; safeSummary: string; relatedPlanID?: string; deliveryPolicy: string; createdAt: string; status: string; reason?: string; }>                                                                                                                                                                                 |
| `mailboxSend`                       | `mailbox.send`                       | `input`: { source?: "user_via_live_chat" | "system"; priority?: "normal" | "high" | "urgent"; intent: string; text: string; safeSummary?: string; relatedPlanID?: string; deliveryPolicy?: string; }                                                                                                                                                                                                         | { queued: boolean; messageID?: string }                                                                                                                                                                                                                                                                                                                                                                                                               |
| `mailboxDeliver`                    | `mailbox.deliver`                    | `messageID`: string                                                                                                                                                                                                                                                                                                                                                                                          | { delivered: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `mailboxAcknowledge`                | `mailbox.acknowledge`                | `messageID`: string                                                                                                                                                                                                                                                                                                                                                                                          | { acknowledged: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `mailboxDefer`                      | `mailbox.defer`                      | `messageID`: string, `reason?`: string                                                                                                                                                                                                                                                                                                                                                                       | { deferred: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `mailboxSupersede`                  | `mailbox.supersede`                  | `messageID`: string, `reason?`: string                                                                                                                                                                                                                                                                                                                                                                       | { superseded: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `planList`                          | `plan.list`                          | —                                                                                                                                                                                                                                                                                                                                                                                                            | Array<{ planID: string; version: number; title: string; author: "user" | "live_chat" | "main_agent"; objective: string; steps: Array<{ id: string; title: string; detail?: string; verification?: string; }>; constraints: string[]; verification: string[]; riskNotes: string[]; relatedMailboxMessageID?: string; supersedesPlanID?: string; createdAt: string; status: string; reason?: string; }>                                                 |
| `planCreate`                        | `plan.create`                        | `input`: { title: string; author?: "user" | "live_chat" | "main_agent"; objective: string; steps: Array<{ id: string; title: string; detail?: string; verification?: string; }>; constraints?: string[]; verification?: string[]; riskNotes?: string[]; relatedMailboxMessageID?: string; supersedesPlanID?: string; taskID?: string; }                                                                      | { created: boolean; planID?: string }                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `planUpdate`                        | `plan.update`                        | `input`: { planID: string; objective?: string; steps?: Array<{ id: string; title: string; detail?: string; verification?: string; }>; constraints?: string[]; verification?: string[]; riskNotes?: string[]; reason?: string; }                                                                                                                                                                              | { updated: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `planPropose`                       | `plan.propose`                       | `planID`: string                                                                                                                                                                                                                                                                                                                                                                                             | { proposed: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `planAccept`                        | `plan.accept`                        | `planID`: string                                                                                                                                                                                                                                                                                                                                                                                             | { accepted: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `planQueue`                         | `plan.queue`                         | `planID`: string                                                                                                                                                                                                                                                                                                                                                                                             | { queued: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `planActivate`                      | `plan.activate`                      | `planID`: string                                                                                                                                                                                                                                                                                                                                                                                             | { activated: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `planSupersede`                     | `plan.supersede`                     | `planID`: string, `reason?`: string                                                                                                                                                                                                                                                                                                                                                                          | { superseded: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `planCompleted`                     | `plan.complete`                      | `planID`: string                                                                                                                                                                                                                                                                                                                                                                                             | { completed: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `driftFindings`                     | `drift.findings`                     | —                                                                                                                                                                                                                                                                                                                                                                                                            | Array<{ findingID: string; severity: "advisory" | "warning" | "high"; confidence: number; originalObjective: string; currentActivity: string; evidence: string[]; status: string; }>                                                                                                                                                                                                                                                                  |
| `evaluateDrift`                     | `drift.evaluate`                     | `input`: { objective: string; currentActivity: string; applicableConstraints?: string[]; changes?: Array<{ path?: string; action?: string; target?: string; summary?: string; }>; evidenceRefs?: string[]; }                                                                                                                                                                                                 | { opened: number }                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `acknowledgeDriftFinding`           | `drift.acknowledge`                  | `input`: { findingID: string; status: "explained" | "dismissed" | "corrected"; rationale?: string; }                                                                                                                                                                                                                                                                                                         | { acknowledged: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `confirmedWorkspaceChanges`         | `observation.confirmed`              | —                                                                                                                                                                                                                                                                                                                                                                                                            | Array<{ id: string; workspaceRoot: string; path: string; operation: "added" | "modified" | "deleted" | "renamed"; origin: | "tool" | "sandbox_merge" | "checkpoint_rollback" | "external" | "unknown"; attribution: "attributed" | "unattributed" | "indeterminate"; correlation: { sessionID?: string; episodeID?: string; turnID?: string; callID?: string; operationID?: string; }; health: "healthy" | "degraded" | "unavailable"; at: string; }> |
| `registeredTools`                   | `tools.registered`                   | —                                                                                                                                                                                                                                                                                                                                                                                                            | Array<{ name: string; owner: string; scope: string; recovery: string; precedence: number; requiresApproval: boolean; }>                                                                                                                                                                                                                                                                                                                               |
| `capabilities`                      | `capabilities`                       | —                                                                                                                                                                                                                                                                                                                                                                                                            | CapabilityRecordView[]                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `sessionSnapshot`                   | `session.snapshot`                   | —                                                                                                                                                                                                                                                                                                                                                                                                            | | { agentStatus: string; currentStep?: string; activeTool?: string; changedFiles: number; unvalidatedChanges: number; hasPTY: boolean; hasSandbox: boolean; } | undefined                                                                                                                                                                                                                                                                             |
| `deleteFlowDocument`                | `flow.delete`                        | `input`: { path: string }                                                                                                                                                                                                                                                                                                                                                                                    | { path: string; deleted: boolean; alreadyDeleted: boolean; }                                                                                                                                                                                                                                                                                                                                                                                          |
| `deleteTaskDocument`                | `task.delete`                        | `input`: { path: string }                                                                                                                                                                                                                                                                                                                                                                                    | { path: string; deleted: boolean; alreadyDeleted: boolean; }                                                                                                                                                                                                                                                                                                                                                                                          |
| `taskSchedule`                      | `task.schedule`                      | `input`: { path: string; calendar: string; scope: "user" | "system"; }                                                                                                                                                                                                                                                                                                                                       | { path: string; taskID: string; timerUnit: string; scope: "user" | "system"; normalizedCalendar: string; next: string[]; commands: string[]; }                                                                                                                                                                                                                                                                                                        |
| `taskUnschedule`                    | `task.unschedule`                    | `input`: { path: string }                                                                                                                                                                                                                                                                                                                                                                                    | { path: string; removed: boolean; commands: string[]; }                                                                                                                                                                                                                                                                                                                                                                                               |
| `updateConfig`                      | `config.update`                      | `input`: { patch: Record<string, unknown>; scope?: "project" | "global"; }                                                                                                                                                                                                                                                                                                                                   | { applied: boolean; reason?: string }                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `settingsGet`                       | `settings.get`                       | —                                                                                                                                                                                                                                                                                                                                                                                                            | { config: Record<string, unknown>; sources: Array<{ scope: "defaults" | "global" | "project"; path?: string; applied: boolean; diagnostic?: string; }>; }                                                                                                                                                                                                                                                                                             |
| `settingsSet`                       | `settings.set`                       | `patch`: Record<string, `scope`: "global" | "project"                                                                                                                                                                                                                                                                                                                                                        | { applied: boolean }                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `taskPermissionPreview`             | `task.preview`                       | `input`: { path: string }                                                                                                                                                                                                                                                                                                                                                                                    | { taskID: string; displayName: string; permissionProfile: string; flowID: string; flowDisplayName: string; enabledModules: number; blocked: Array<{ moduleID: string; reason: string }>; conditionlessModules: string[]; problems: string[]; valid: boolean; }                                                                                                                                                                                        |
| `taskOverview`                      | `task.overview`                      | —                                                                                                                                                                                                                                                                                                                                                                                                            | ScheduledTaskOverview                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `flowOverview`                      | `flow.overview`                      | —                                                                                                                                                                                                                                                                                                                                                                                                            | FlowOverview                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `documentCatalog`                   | `document.catalog`                   | —                                                                                                                                                                                                                                                                                                                                                                                                            | WorkflowDocumentChoice[]                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `reloadConfig`                      | `config.reload`                      | —                                                                                                                                                                                                                                                                                                                                                                                                            | { applied: boolean; reason?: string }                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `canReloadConfig`                   | `config.canReload`                   | —                                                                                                                                                                                                                                                                                                                                                                                                            | { allowed: boolean; reason?: string }                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `availability`                      | `runtime.availability`               | —                                                                                                                                                                                                                                                                                                                                                                                                            | RuntimeCapabilityReport                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `runtimeStatus`                     | `runtime.status`                     | —                                                                                                                                                                                                                                                                                                                                                                                                            | RuntimeStatusSnapshot                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `diagnostics`                       | `diagnostics.list`                   | `limit?`: number                                                                                                                                                                                                                                                                                                                                                                                             | RuntimeDiagnostic[]                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `health`                            | `—`                                  | —                                                                                                                                                                                                                                                                                                                                                                                                            | { ok: boolean; apiVersion: number }                                                                                                                                                                                                                                                                                                                                                                                                                   |

### Runtime event dictionary (source scan of `packages/contracts/src/events.ts`)

| Event type                  | Fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Trigger                                                                                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `session.created`           | `sessionID`: SessionID, `title`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | a session record was created                                                                                                                                                         |
| `session.ready`             | `sessionID`: SessionID                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | the runtime's session finished loading (startup)                                                                                                                                     |
| `turn.submitted`            | `id`: string, `text`: string, `byteLength`: number, `lineCount`: number, `sha256`: string, `attachments?`: LocalAttachment[], `resources?`: PromptResourceMention[], `agents?`: PromptAgentMention[]                                                                                                                                                                                                                                                                                                                       | a turn was accepted; `id` is the turn id                                                                                                                                             |
| `turn.cancelled`            | `id`: string, `reason`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | a turn was cancelled; `reason`                                                                                                                                                       |
| `turn.paused`               | `id`: string, `reason`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | a turn is waiting on an approval or question                                                                                                                                         |
| `turn.resumed`              | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | a paused turn resumed                                                                                                                                                                |
| `thinking.delta`            | `id`: string, `text`: string, `visible?`: boolean, `attempt?`: number                                                                                                                                                                                                                                                                                                                                                                                                                                                      | streaming reasoning text; live only, never journaled                                                                                                                                 |
| `thinking.done`             | `id`: string, `text?`: string, `visible?`: boolean, `attempt?`: number                                                                                                                                                                                                                                                                                                                                                                                                                                                     | completed reasoning text; journaled                                                                                                                                                  |
| `content.delta`             | `id`: string, `text`: string, `attempt?`: number                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | streaming answer text; live only, never journaled                                                                                                                                    |
| `content.done`              | `id`: string, `text?`: string, `attempt?`: number                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | one completed answer chunk per provider step; journaled                                                                                                                              |
| `turn.retry`                | `id`: string, `attempt`: number, `maxAttempts`: number, `reason`: string, `retryAfterMs`: number                                                                                                                                                                                                                                                                                                                                                                                                                           | a whole turn is being retried (retry policy)                                                                                                                                         |
| `step.retry`                | `id`: string, `operation`: StepRetryOperation, `step`: number, `attempt`: number, `maxAttempts`: number, `waitMs`: number, `reason`: ErrorKind, `statusCode?`: number                                                                                                                                                                                                                                                                                                                                                      | a provider step is being retried                                                                                                                                                     |
| `step.retry.cleared`        | `id`: string, `operation`: StepRetryOperation, `step`: number, `attempts`: number                                                                                                                                                                                                                                                                                                                                                                                                                                          | a pending step retry was cleared                                                                                                                                                     |
| `step.retry.exhausted`      | `id`: string, `operation`: StepRetryOperation, `step`: number, `attempts`: number, `maxAttempts`: number, `reason`: ErrorKind, `statusCode?`: number, `message`: string, `retryable?`: boolean                                                                                                                                                                                                                                                                                                                             | a step retry was exhausted; the step fails                                                                                                                                           |
| `tool.update`               | `id`: string, `name`: string, `callID?`: string, `status`: ToolStatus, `summary`: string, `argumentsDelta?`: string, `result?`: string, `metadata?`: Record<string, unknown>, `startedAt?`: number, `endedAt?`: number                                                                                                                                                                                                                                                                                                     | one per tool invocation: status, arguments and result                                                                                                                                |
| `policy.decision`           | `turnID`: string, `toolName`: string, `toolCallID?`: string, `decision`: "allow" | "deny" | "approval_required" | "rejected", `reason?`: string                                                                                                                                                                                                                                                                                                                                                                            | a tool or action policy decision was made (allow/deny/approval_required/rejected)                                                                                                    |
| `subagent.update`           | `id`: string, `attached`: boolean, `task?`: string, `text?`: string, `parentSessionID?`: string, `parentAgentID?`: string, `continuation?`: number                                                                                                                                                                                                                                                                                                                                                                         | a subagent session changed state                                                                                                                                                     |
| `mcp.status`                | `server`: string, `status`: "disabled" | "connected" | "failed" | "unsupported_auth_flow", `tools`: number, `message?`: string                                                                                                                                                                                                                                                                                                                                                                                             | an MCP server connection changed state                                                                                                                                               |
| `agent.selection`           | `name?`: string, `pending`: boolean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | an agent was selected or switched; `pending: false` after a deferred switch applied                                                                                                  |
| `model.selection`           | `modelID?`: string, `variant?`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | the model was selected or switched                                                                                                                                                   |
| `plugin.update`             | `id`: string, `status`: "loaded" | "unloaded" | "denied" | "failed", `detail?`: string                                                                                                                                                                                                                                                                                                                                                                                                                                     | a plugin loaded, unloaded or reported a lifecycle change                                                                                                                             |
| `session.snapshot`          | `id`: string, `agentStatus`: string, `currentStep?`: string, `activeTool?`: string, `changedFiles`: number, `unvalidatedChanges`: number, `recentOutput?`: string, `hasPTY`: boolean, `hasSandbox`: boolean                                                                                                                                                                                                                                                                                                                | a complete session state snapshot (projection)                                                                                                                                       |
| `drift.finding_opened`      | `id`: string, `findingID`: string, `severity`: "advisory" | "warning" | "high", `confidence`: number, `originalObjective`: string, `currentActivity`: string, `evidence`: string[], `applicableConstraints`: string[]                                                                                                                                                                                                                                                                                                      | a drift finding was opened; no writer yet                                                                                                                                            |
| `drift.finding_updated`     | `id`: string, `findingID`: string, `status`: "open" | "explained" | "dismissed" | "corrected", `rationale?`: string                                                                                                                                                                                                                                                                                                                                                                                                        | a drift finding was updated; no writer yet                                                                                                                                           |
| `tool.registered`           | `id`: string, `name`: string, `owner`: string, `scope`: "process" | "workspace" | "session", `recovery`: "none" | "retry" | "restart" | "fail_closed", `precedence`: number, `requiresApproval`: boolean                                                                                                                                                                                                                                                                                                                   | a tool was registered in the catalogue                                                                                                                                               |
| `tool.unregistered`         | `id`: string, `name`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | a tool was unregistered from the catalogue                                                                                                                                           |
| `capability.loaded`         | `id`: string, `apiVersion`: number, `name`: string, `version`: string, `scope`: "process" | "workspace" | "session", `grants`: string[]                                                                                                                                                                                                                                                                                                                                                                                    | an optional capability finished loading                                                                                                                                              |
| `capability.unloaded`       | `id`: string, `name`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | an optional capability was unloaded                                                                                                                                                  |
| `capability.failed`         | `id`: string, `name`: string, `reason`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | an optional capability failed to load                                                                                                                                                |
| `workgraph.node_added`      | `id`: string, `nodeID`: string, `kind`: import("./schemas").WorkGraphNodeKind, `summary`: string, `actor?`: string, `target?`: string, `sessionID?`: string, `turnID?`: string                                                                                                                                                                                                                                                                                                                                             | a work graph node was added                                                                                                                                                          |
| `workgraph.edge_added`      | `id`: string, `sourceID`: string, `targetID`: string, `kind`: import("./schemas").WorkGraphEdgeKind, `reason?`: string                                                                                                                                                                                                                                                                                                                                                                                                     | a work graph edge was added                                                                                                                                                          |
| `evidence.recorded`         | `id`: string, `taskID`: string, `objective`: string, `knownGaps?`: string[]                                                                                                                                                                                                                                                                                                                                                                                                                                                | evidence for a task objective was recorded; no writer yet                                                                                                                            |
| `completion.recorded`       | `id`: string, `taskID`: string, `objective`: string, `changeSummary`: string, `behaviorImpact?`: string, `humanValidation?`: string, `knownGaps?`: string[], `externalSideEffects?`: string[], `rollbackState?`: "clean" | "available" | "none" | "needs_promotion", `evidenceIDs?`: string[], `recordedAt`: string                                                                                                                                                                                                        | —                                                                                                                                                                                    |
| `constitution.check`        | `id`: string, `ruleID`: string, `statement`: string, `priority`: "critical" | "high" | "medium" | "low", `enforcement`: "deny" | "approval" | "warn", `action`: string, `resource`: string, `conflict`: boolean                                                                                                                                                                                                                                                                                                            | a constitution rule was evaluated against a workspace change                                                                                                                         |
| `constitution.rule_added`   | `id`: string, `ruleID`: string, `statement`: string, `scope`: "project" | "package" | "sandbox" | "task" | "release", `priority`: "critical" | "high" | "medium" | "low", `source`: "user" | "master_plan" | "policy", `enforcement`: "deny" | "approval" | "warn", `overridePolicy`: "forbidden" | "user_scoped" | "user_explicit", `evidenceRefs?`: string[]                                                                                                                                                             | a constitution rule was added                                                                                                                                                        |
| `constitution.rule_updated` | `id`: string, `ruleID`: string, `statement?`: string, `priority?`: "critical" | "high" | "medium" | "low"                                                                                                                                                                                                                                                                                                                                                                                                                  | a constitution rule was updated                                                                                                                                                      |
| `decision.recorded`         | `id`: string, `decision`: string, `rationale?`: string[], `consequences?`: string[], `status`: "proposed" | "accepted" | "superseded", `linkedPlans?`: string[], `linkedConstraints?`: string[]                                                                                                                                                                                                                                                                                                                            | a decision record was appended; no writer yet                                                                                                                                        |
| `mailbox.queued`            | `id`: string, `messageID`: string, `source`: "user_via_live_chat" | "system", `priority`: "normal" | "high" | "urgent", `text`: string, `safeSummary`: string, `relatedPlanID?`: string, `createdAt`: string                                                                                                                                                                                                                                                                                                               | —                                                                                                                                                                                    |
| `mailbox.delivered`         | `id`: string, `messageID`: string, `deliveredAt`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | —                                                                                                                                                                                    |
| `mailbox.acknowledged`      | `id`: string, `messageID`: string, `acknowledgedAt`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                | —                                                                                                                                                                                    |
| `mailbox.deferred`          | `id`: string, `messageID`: string, `reason`: string, `deferredAt`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                  | —                                                                                                                                                                                    |
| `mailbox.superseded`        | `id`: string, `messageID`: string, `reason`: string, `supersededAt`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                | —                                                                                                                                                                                    |
| `plan.draft.created`        | `id`: string, `planID`: string, `version`: number, `title`: string, `author`: "user" | "live_chat" | "main_agent", `objective`: string, `constraints?`: string[], `verification?`: string[], `riskNotes?`: string[], `relatedMailboxMessageID?`: string, `taskID?`: string, `supersedesPlanID?`: string, `createdAt`: string, `reason?`: string                                                                                                                                                                            | —                                                                                                                                                                                    |
| `plan.draft.updated`        | `id`: string, `planID`: string, `version`: number, `updatedAt`: string, `reason?`: string                                                                                                                                                                                                                                                                                                                                                                                                                                  | —                                                                                                                                                                                    |
| `plan.proposed`             | `id`: string, `planID`: string, `version`: number, `proposedAt`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                    | —                                                                                                                                                                                    |
| `plan.accepted`             | `id`: string, `planID`: string, `version`: number, `acceptedBy`: "user", `acceptedAt`: string                                                                                                                                                                                                                                                                                                                                                                                                                              | —                                                                                                                                                                                    |
| `plan.queued`               | `id`: string, `planID`: string, `version`: number, `queuedAt`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                      | —                                                                                                                                                                                    |
| `plan.activated`            | `id`: string, `planID`: string, `version`: number, `activatedAt`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                   | —                                                                                                                                                                                    |
| `plan.superseded`           | `id`: string, `planID`: string, `version`: number, `reason`: string, `supersededAt`: string                                                                                                                                                                                                                                                                                                                                                                                                                                | —                                                                                                                                                                                    |
| `plan.completed`            | `id`: string, `planID`: string, `version`: number, `completedAt`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                   | —                                                                                                                                                                                    |
| `plan.archived`             | `id`: string, `planID`: string, `version`: number, `archivedAt`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                    | —                                                                                                                                                                                    |
| `status.update`             | `status`: string, `detail?`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | the runtime status changed (paused, resumed, running, …)                                                                                                                             |
| `status.snapshot`           | `model`: string, `provider`: string, `context`: string, `step`: string, `permissions`: string, `cwd`: string, `background`: string                                                                                                                                                                                                                                                                                                                                                                                         | a full status snapshot (startup, or after significant changes)                                                                                                                       |
| `context.status`            | `used`: number, `max`: number, `source`: ContextStatusSource, `thresholdPercent`: number, `reserved`: number, `trigger?`: CompactionTrigger                                                                                                                                                                                                                                                                                                                                                                                | the context ledger status changed (token estimate vs configured limits)                                                                                                              |
| `compaction.begin`          | `id`: string, `trigger`: CompactionTrigger, `beforeTokens`: number, `maxTokens`: number, `thresholdPercent`: number, `reservedTokens`: number, `instruction?`: string, `attempt`: number, `startedAt`: string                                                                                                                                                                                                                                                                                                              | context compaction started                                                                                                                                                           |
| `compaction.end`            | `id`: string, `trigger`: CompactionTrigger, `success`: boolean, `beforeTokens`: number, `afterTokens?`: number, `durationMs`: number, `attempts`: number, `error?`: string                                                                                                                                                                                                                                                                                                                                                 | context compaction finished with the retained summary                                                                                                                                |
| `context.limit.recovery`    | `id`: string, `step`: number, `attempted`: boolean, `compacted`: boolean, `reason`: "context_limit"                                                                                                                                                                                                                                                                                                                                                                                                                        | a provider context-limit hit and recovery (compaction plus retry) ran                                                                                                                |
| `context.checkpoint`        | `id`: string, `snapshot`: DurableContextCheckpointRecord                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | the context journal reached a durable checkpoint (projection point)                                                                                                                  |
| `terminal.update`           | `id`: string, `command`: string, `cwd`: string, `status`: TerminalStatus, `attached`: boolean, `rows`: number, `cols`: number, `prompt?`: string, `activity`: "waiting" | "running", `tail`: string, `transcript?`: string, `lastAction?`: TerminalAction, `target`: ExecutionTarget, `ownership?`: TerminalOwnership, `approvalID?`: string, `screen?`: TerminalScreenSnapshot, `revision?`: number, `lastOutputAt?`: string, `viewers?`: TerminalViewer[], `inputOwner?`: TerminalOwner, `geometryOwner?`: TerminalOwner | a terminal session's status or screen changed                                                                                                                                        |
| `terminal.action`           | `id`: string, `action`: TerminalAction, `redacted?`: boolean, `target`: ExecutionTarget                                                                                                                                                                                                                                                                                                                                                                                                                                    | a terminal action was performed (human or model side)                                                                                                                                |
| `terminal.timeline`         | `id`: string, `actor`: "model" | "user" | "system", `action`: TerminalAction | "created" | "approval", `summary`: string, `at`: string                                                                                                                                                                                                                                                                                                                                                                                     | a terminal action was appended to the timeline                                                                                                                                       |
| `terminal.approval`         | `id`: string, `approvalID`: string, `state`: "awaiting" | "approved" | "rejected", `action`: TerminalAction, `reason`: string, `target`: ExecutionTarget                                                                                                                                                                                                                                                                                                                                                                   | a terminal approval scope was granted or revoked                                                                                                                                     |
| `terminal.viewer`           | `id`: string, `viewerID`: string, `viewerKind?`: "external" | "embedded", `inputOwner`: TerminalOwner, `geometryOwner`: TerminalOwner, `at`: string                                                                                                                                                                                                                                                                                                                                                                        | a terminal viewer was opened; UI-only                                                                                                                                                |
| `terminal.pane.select`      | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | a terminal pane was selected; UI-only                                                                                                                                                |
| `terminal.pane.focus`       | `focus`: "chat" | "terminal"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | the terminal pane focus changed; UI-only                                                                                                                                             |
| `sandbox.update`            | `id`: string, `status`: SandboxStatus, `root`: string, `isolationLevel`: "workspace" | "container" | "vm", `changedFiles`: number, `runningResources`: number, `target`: ExecutionTarget, `resourcePolicy`: string                                                                                                                                                                                                                                                                                                         | a sandbox's status or change/resource counts changed                                                                                                                                 |
| `sandbox.diff`              | `id`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | a sandbox's pending change set was recorded or read                                                                                                                                  |
| `sandbox.audit`             | `id`: string, `action`: string, `target`: ExecutionTarget, `approvalRequired`: boolean, `message`: string                                                                                                                                                                                                                                                                                                                                                                                                                  | a sandbox management action was audited                                                                                                                                              |
| `checkpoint.created`        | `id`: string, `reason`: string, `turnID?`: string, `stepID?`: string, `sequence`: number, `complete`: boolean, `files`: number, `changes`: number, `contextJournalOffset`: number, `step`: number, `tokenEstimate`: number, `diskUsageBytes`: number                                                                                                                                                                                                                                                                       | a durable checkpoint was created (turn start, compaction, context-limit recovery)                                                                                                    |
| `checkpoint.failed`         | `reason`: string, `message`: string, `incomplete?`: boolean, `errors?`: string[]                                                                                                                                                                                                                                                                                                                                                                                                                                           | a checkpoint could not be created; `reason`/`message` say why                                                                                                                        |
| `checkpoint.unavailable`    | `reason`: string, `suggestion`: string, `disabledByConfig?`: boolean                                                                                                                                                                                                                                                                                                                                                                                                                                                       | checkpointing is unavailable (for example no git present)                                                                                                                            |
| `rollback.previewed`        | `preview`: CheckpointPreview                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | a rollback dry-run produced a preview                                                                                                                                                |
| `rollback.begin`            | `checkpointID`: string, `safetyCheckpointID`: string, `dryRun?`: boolean, `sessionID?`: string                                                                                                                                                                                                                                                                                                                                                                                                                             | a workspace rollback started                                                                                                                                                         |
| `rollback.end`              | `checkpointID`: string, `safetyCheckpointID`: string, `restoredFiles`: number, `deletedFiles`: number, `contextJournalOffset`: number, `step`: number, `sessionID?`: string                                                                                                                                                                                                                                                                                                                                                | a workspace rollback finished                                                                                                                                                        |
| `rollback.failed`           | `checkpointID`: string, `safetyCheckpointID?`: string, `message`: string, `recovered`: boolean, `sessionID?`: string                                                                                                                                                                                                                                                                                                                                                                                                       | a workspace rollback failed                                                                                                                                                          |
| `diagnostic`                | `level`: "info" | "warning" | "error", `message`: string, `at?`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                    | an error, warning or info message; `level` and `message`                                                                                                                             |
| `dialog.open`               | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | the TUI dialog opened; UI-only                                                                                                                                                       |
| `dialog.close`              | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | the TUI dialog closed; UI-only                                                                                                                                                       |
| `approval.request`          | `id`: string, `title`: string, `preview`: string, `detail?`: string, `keyArguments?`: string[], `sensitive?`: boolean, `risk?`: "terminal_low" | "terminal_high", `scope?`: string, `expiresAt?`: string, `revocable?`: boolean                                                                                                                                                                                                                                                                                            | a tool or action needs approval; carries the request the caller must answer                                                                                                          |
| `approval.response`         | `id`: string, `decision`: ApprovalResponse["decision"], `feedback?`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                | an approval was answered or timed out; `accepted: false` means it was too late                                                                                                       |
| `question.request`          | `id`: string, `title`: string, `options?`: string[], `questions?`: QuestionItem[]                                                                                                                                                                                                                                                                                                                                                                                                                                          | a question needs an answer; carries the interactive request                                                                                                                          |
| `question.response`         | `id`: string, `answers`: string[][], `rejected?`: boolean                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | a question was answered                                                                                                                                                              |
| `snapshot.created`          | `id`: string, `files`: string[]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | the `snapshot` member was called (a named snapshot id is minted)                                                                                                                     |
| `turn.finished`             | `id`: string, `stopReason`: "done" | "cancelled" | "error" | "waiting_human", `reason?`: "missing_final_response"                                                                                                                                                                                                                                                                                                                                                                                                          | a turn ended; `stopReason`: done, cancelled or error                                                                                                                                 |
| `flow.module_event`         | `moduleID`: string, `moduleType?`: string, `outcome?`: "complete" | "incomplete" | "blocked", `reason?`: string                                                                                                                                                                                                                                                                                                                                                                                                            | a flow module's arbitration lifecycle changed (activated, claimed, evaluated, completed, blocked, stalled, continued); streamed from task delivery so the TUI can render arbitration |
| `flow.finished`             | `outcome`: "succeeded" | "failed" | "skipped", `reason?`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                           | a flow task finished (succeeded, failed or skipped); emitted by the flow submit path                                                                                                 |
| `flow.evaluator`            | `moduleID?`: string, `phase`: "thinking" | "content", `text`: string                                                                                                                                                                                                                                                                                                                                                                                                                                                       | streaming reasoning/content text from a flow module evaluator (task delivery only)                                                                                                   |
| `settings.updated`          | `scope`: "global" | "project"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | —                                                                                                                                                                                    |
<!-- /api-reference:generated -->
