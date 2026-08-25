import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createIssueTarget,
  findingFingerprint,
  fingerprintFromBody,
  fingerprintMarker,
  NataliaUnattendedStateStore,
  reconcileFinding,
  type NataliaIssueTargetConfig,
  type NataliaIssueTargetKind,
} from "../src";

const TOKEN = "bot-token-do-not-leak";

type FakeIssue = {
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  state_reason?: string;
  labels: string[];
};

/**
 * One in-memory repository serving both the Gitea and the GitHub issue API
 * shapes, so the same reconciliation matrix runs against both.
 */
function fakeForge(kind: NataliaIssueTargetKind) {
  const issues: FakeIssue[] = [];
  const requests: Array<{
    method: string;
    path: string;
    authorization: string;
    accept: string;
    body?: Record<string, unknown>;
  }> = [];
  const prefix =
    kind === "gitea"
      ? "/api/v1/repos/natalia/logs/issues"
      : "/repos/natalia/logs/issues";
  const fetchImpl = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const body = init?.body
      ? (JSON.parse(String(init.body)) as Record<string, unknown>)
      : undefined;
    requests.push({
      method: init?.method ?? "GET",
      path: url.pathname,
      authorization: headers.get("authorization") ?? "",
      accept: headers.get("accept") ?? "",
      body,
    });
    const json = (payload: unknown, status = 200) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json" },
      });
    if (!url.pathname.startsWith(prefix)) return json({ message: "no" }, 404);
    if ((init?.method ?? "GET") === "GET") {
      const label = url.searchParams.get("labels");
      const perPage = Number(url.searchParams.get("per_page") ?? "100");
      const page = Number(url.searchParams.get("page") ?? "1");
      const filtered = label
        ? issues.filter((issue) => issue.labels.includes(label))
        : issues;
      return json(filtered.slice((page - 1) * perPage, page * perPage));
    }
    if (init?.method === "POST") {
      const issue: FakeIssue = {
        number: issues.length + 1,
        title: String(body?.title ?? ""),
        body: String(body?.body ?? ""),
        state: "open",
        labels: (body?.labels as string[] | undefined) ?? [],
      };
      issues.push(issue);
      return json(renderIssue(issue, kind));
    }
    if (init?.method === "PATCH") {
      const number = Number(url.pathname.slice(`${prefix}/`.length));
      const issue = issues.find((entry) => entry.number === number);
      if (!issue) return json({ message: "missing" }, 404);
      issue.title = String(body?.title ?? issue.title);
      issue.body = String(body?.body ?? issue.body);
      return json(renderIssue(issue, kind));
    }
    return json({ message: "unsupported" }, 405);
  }) as unknown as typeof fetch;
  return { issues, requests, fetchImpl };
}

function renderIssue(issue: FakeIssue, kind: NataliaIssueTargetKind) {
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    ...(kind === "github" ? { state_reason: issue.state_reason ?? null } : {}),
    html_url: `https://forge.example/natalia/logs/issues/${issue.number}`,
  };
}

function targetConfig(
  kind: NataliaIssueTargetKind,
  overrides: Partial<NataliaIssueTargetConfig> = {},
): NataliaIssueTargetConfig {
  return {
    kind,
    baseURL: "https://forge.example",
    owner: "natalia",
    repo: "logs",
    token: TOKEN,
    label: "natalia",
    ...overrides,
  };
}

const FINDING = {
  fingerprint: findingFingerprint(["null pointer", "src/auth.ts"]),
  title: "Null pointer in the auth path",
  body: "The nightly log scan found a repeated null pointer.",
};

test("a finding fingerprint is stable and ignores incidental whitespace", () => {
  expect(findingFingerprint(["a", "b"])).toBe(
    findingFingerprint([" a ", "b\n"]),
  );
  expect(findingFingerprint(["a", "b"])).not.toBe(
    findingFingerprint(["a", "c"]),
  );
  expect(findingFingerprint(["a"])).toMatch(/^fp_[0-9a-f]{32}$/u);
  expect(() => findingFingerprint([])).toThrow("non-empty parts");
  expect(() => findingFingerprint(["a", " "])).toThrow("non-empty parts");
});

test("the fingerprint marker round-trips through an issue body", () => {
  const marker = fingerprintMarker("fp_abc");
  expect(fingerprintFromBody(`text\n\n${marker}\n`)).toBe("fp_abc");
  expect(fingerprintFromBody("no marker here")).toBeUndefined();
});

for (const kind of ["gitea", "github"] as const) {
  test(`${kind}: the same finding creates one issue and then updates it`, async () => {
    const root = await mkdtemp(join(tmpdir(), `natalia-issue-${kind}-`));
    const forge = fakeForge(kind);
    const target = createIssueTarget(targetConfig(kind), {
      fetch: forge.fetchImpl,
    });
    const state = await NataliaUnattendedStateStore.open(root, "task_nightly");
    const first = await reconcileFinding({ target, state, finding: FINDING });
    expect(first).toMatchObject({ action: "created" });
    expect(forge.issues).toHaveLength(1);
    expect(forge.issues[0]!.body).toContain(
      fingerprintMarker(FINDING.fingerprint),
    );
    expect(forge.issues[0]!.labels).toContain("natalia");
    expect(state.issueFor(FINDING.fingerprint)?.issue).toBe("natalia/logs#1");
    const second = await reconcileFinding({
      target,
      state,
      finding: { ...FINDING, body: "Second night: still failing." },
    });
    expect(second).toMatchObject({ action: "updated" });
    // Two nights, one issue.
    expect(forge.issues).toHaveLength(1);
    expect(forge.issues[0]!.body).toContain("Second night");
    expect(
      forge.requests.filter((request) => request.method === "POST"),
    ).toHaveLength(1);
    expect(
      forge.requests.every(
        (request) =>
          request.authorization ===
          (kind === "github" ? `Bearer ${TOKEN}` : `token ${TOKEN}`),
      ),
    ).toBe(true);
  });

  test(`${kind}: losing the local state file does not duplicate the issue`, async () => {
    const root = await mkdtemp(join(tmpdir(), `natalia-issue-reset-${kind}-`));
    const forge = fakeForge(kind);
    const target = createIssueTarget(targetConfig(kind), {
      fetch: forge.fetchImpl,
    });
    const state = await NataliaUnattendedStateStore.open(root, "task_nightly");
    await reconcileFinding({ target, state, finding: FINDING });
    await rm(state.path, { force: true });
    // A fresh machine with no local memory still reconciles against the remote
    // fingerprint marker.
    const clean = await NataliaUnattendedStateStore.open(root, "task_nightly");
    expect(clean.issueFor(FINDING.fingerprint)).toBeUndefined();
    const again = await reconcileFinding({
      target,
      state: clean,
      finding: FINDING,
    });
    expect(again).toMatchObject({ action: "updated" });
    expect(forge.issues).toHaveLength(1);
  });

  test(`${kind}: a human close retires the fingerprint for good`, async () => {
    const root = await mkdtemp(join(tmpdir(), `natalia-issue-closed-${kind}-`));
    const forge = fakeForge(kind);
    const target = createIssueTarget(targetConfig(kind), {
      fetch: forge.fetchImpl,
    });
    const state = await NataliaUnattendedStateStore.open(root, "task_nightly");
    await reconcileFinding({ target, state, finding: FINDING });
    forge.issues[0]!.state = "closed";
    forge.issues[0]!.state_reason = "not_planned";
    const closed = await reconcileFinding({ target, state, finding: FINDING });
    expect(closed).toMatchObject({ action: "suppressed_by_close" });
    expect(state.isSuppressed(FINDING.fingerprint)).toBe(true);
    expect(forge.issues[0]!.state).toBe("closed");
    const writes = forge.requests.filter(
      (request) => request.method !== "GET",
    ).length;
    // The third night must not touch the forge at all.
    const requestsBefore = forge.requests.length;
    const suppressed = await reconcileFinding({
      target,
      state,
      finding: FINDING,
    });
    expect(suppressed).toMatchObject({ action: "suppressed" });
    expect(forge.requests).toHaveLength(requestsBefore);
    expect(
      forge.requests.filter((request) => request.method !== "GET"),
    ).toHaveLength(writes);
  });
}

test("the bot token never reaches state, results or errors", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-issue-secret-"));
  const forge = fakeForge("gitea");
  const target = createIssueTarget(targetConfig("gitea"), {
    fetch: forge.fetchImpl,
  });
  const state = await NataliaUnattendedStateStore.open(root, "task_nightly");
  const result = await reconcileFinding({ target, state, finding: FINDING });
  expect(JSON.stringify(result)).not.toContain(TOKEN);
  expect(JSON.stringify(state.state())).not.toContain(TOKEN);
  expect(await readFile(state.path, "utf8")).not.toContain(TOKEN);
  const failing = createIssueTarget(
    targetConfig("gitea", { owner: "missing" }),
    { fetch: forge.fetchImpl },
  );
  const error = await failing.create(FINDING).catch((issue: Error) => issue);
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).not.toContain(TOKEN);
  expect((error as Error).message).toContain("issue target request failed");
});

test("issue target configuration fails closed on unsafe endpoints", () => {
  expect(() => createIssueTarget(targetConfig("gitea", { token: "" }))).toThrow(
    "requires a token",
  );
  expect(() => createIssueTarget(targetConfig("gitea", { repo: "" }))).toThrow(
    "requires an owner and repo",
  );
  expect(() =>
    createIssueTarget(targetConfig("gitea", { baseURL: "forge.example" })),
  ).toThrow("is not a URL");
  expect(() =>
    createIssueTarget(targetConfig("gitea", { baseURL: "file:///etc" })),
  ).toThrow("must be http or https");
  expect(() =>
    createIssueTarget(
      targetConfig("gitea", { baseURL: "https://bot:secret@forge.example" }),
    ),
  ).toThrow("must not embed credentials");
});

test("a truncated read-back refuses to create a duplicate issue", async () => {
  const forge = fakeForge("gitea");
  const target = createIssueTarget(
    targetConfig("gitea", { pageSize: 1, maxPages: 2, label: undefined }),
    { fetch: forge.fetchImpl },
  );
  forge.issues.push(
    { number: 1, title: "a", body: "a", state: "open", labels: [] },
    { number: 2, title: "b", body: "b", state: "open", labels: [] },
    { number: 3, title: "c", body: "c", state: "open", labels: [] },
  );
  await expect(target.findByFingerprint("fp_missing")).rejects.toThrow(
    "read-back exceeded 2 pages",
  );
  expect(forge.requests.every((request) => request.method === "GET")).toBe(
    true,
  );
});

test("switching forges only changes configuration", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-issue-switch-"));
  const gitea = fakeForge("gitea");
  const github = fakeForge("github");
  const state = await NataliaUnattendedStateStore.open(root, "task_nightly");
  await reconcileFinding({
    target: createIssueTarget(targetConfig("gitea"), {
      fetch: gitea.fetchImpl,
    }),
    state,
    finding: FINDING,
  });
  const moved = await reconcileFinding({
    target: createIssueTarget(
      targetConfig("github", { baseURL: "https://api.github.example" }),
      { fetch: github.fetchImpl },
    ),
    state,
    finding: FINDING,
  });
  // The same finding definition reconciles against either forge; only the
  // target configuration differs.
  expect(moved).toMatchObject({ action: "created" });
  expect(gitea.issues).toHaveLength(1);
  expect(github.issues).toHaveLength(1);
  expect(gitea.requests[0]?.path).toStartWith("/api/v1/repos/");
  expect(github.requests[0]?.path).toStartWith("/repos/");
  expect(github.requests[0]?.accept).toBe("application/vnd.github+json");
});
