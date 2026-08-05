import { createHash } from "node:crypto";

const FINGERPRINT_MARKER_PREFIX = "natalia-fingerprint";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 10;
const DEFAULT_TIMEOUT_MS = 30_000;

export type NataliaIssueTargetKind = "gitea" | "github";

export type NataliaIssueTargetConfig = {
  kind: NataliaIssueTargetKind;
  /** Gitea instance root, or the GitHub API root. */
  baseURL: string;
  owner: string;
  repo: string;
  /** Bot credential. It is only ever sent as a request header. */
  token: string;
  /** Optional shared label used to narrow the reconciliation read-back. */
  label?: string;
  pageSize?: number;
  maxPages?: number;
  timeoutMs?: number;
};

export type NataliaIssueFinding = {
  fingerprint: string;
  title: string;
  body: string;
  labels?: string[];
};

export type NataliaRemoteIssue = {
  number: number;
  title: string;
  url: string;
  state: "open" | "closed";
  closeReason?: string;
  fingerprint?: string;
};

export type NataliaIssueTarget = {
  readonly kind: NataliaIssueTargetKind;
  readonly repository: string;
  findByFingerprint(
    fingerprint: string,
  ): Promise<NataliaRemoteIssue | undefined>;
  create(finding: NataliaIssueFinding): Promise<NataliaRemoteIssue>;
  update(
    issueNumber: number,
    finding: NataliaIssueFinding,
  ): Promise<NataliaRemoteIssue>;
};

export type NataliaIssueReconciliation =
  | { action: "suppressed"; fingerprint: string; reason: string }
  | {
      action: "suppressed_by_close";
      fingerprint: string;
      issue: NataliaRemoteIssue;
    }
  | { action: "updated"; fingerprint: string; issue: NataliaRemoteIssue }
  | { action: "created"; fingerprint: string; issue: NataliaRemoteIssue };

/**
 * Stable identity for a finding. The parts must be the durable shape of the
 * problem, never a timestamp, line number or model wording, otherwise the same
 * problem gets a new identity every night and the deduplication is worthless.
 */
export function findingFingerprint(parts: string[]): string {
  if (!parts.length || parts.some((part) => !part.trim()))
    throw new Error("finding fingerprint requires non-empty parts");
  const digest = createHash("sha256")
    .update(parts.map((part) => part.trim()).join("\n"))
    .digest("hex");
  return `fp_${digest.slice(0, 32)}`;
}

/**
 * The fingerprint lives in the issue body as a machine-readable marker, so the
 * reconciliation still works on a different machine or after the local state
 * file is deleted.
 */
export function fingerprintMarker(fingerprint: string) {
  return `<!-- ${FINGERPRINT_MARKER_PREFIX}: ${fingerprint} -->`;
}

export function fingerprintFromBody(body: string): string | undefined {
  return new RegExp(
    `<!--\\s*${FINGERPRINT_MARKER_PREFIX}:\\s*(\\S+)\\s*-->`,
    "u",
  ).exec(body)?.[1];
}

export function issueBodyWithFingerprint(finding: NataliaIssueFinding) {
  const marker = fingerprintMarker(finding.fingerprint);
  return finding.body.includes(marker)
    ? finding.body
    : `${finding.body.trimEnd()}\n\n${marker}\n`;
}

export function createIssueTarget(
  config: NataliaIssueTargetConfig,
  options: { fetch?: typeof fetch } = {},
): NataliaIssueTarget {
  const fetchImpl = options.fetch ?? fetch;
  const base = issuesEndpoint(config);
  const pageSize = config.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = config.maxPages ?? DEFAULT_MAX_PAGES;
  const request = async (
    path: string,
    init: { method: string; body?: unknown },
  ) => {
    const response = await fetchImpl(path, {
      method: init.method,
      headers: {
        "content-type": "application/json",
        accept:
          config.kind === "github"
            ? "application/vnd.github+json"
            : "application/json",
        // The credential exists only as a header: never in the URL, the body,
        // an error message, the journal or the model context.
        authorization:
          config.kind === "github"
            ? `Bearer ${config.token}`
            : `token ${config.token}`,
      },
      signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (!response.ok)
      throw new Error(
        `issue target request failed: ${init.method} ${redactedPath(path, config)} -> ${response.status}`,
      );
    return (await response.json()) as unknown;
  };
  return {
    kind: config.kind,
    repository: `${config.owner}/${config.repo}`,
    async findByFingerprint(fingerprint) {
      const marker = fingerprintMarker(fingerprint);
      for (let page = 1; page <= maxPages; page += 1) {
        const query = new URLSearchParams({
          state: "all",
          per_page: String(pageSize),
          page: String(page),
        });
        if (config.label) query.set("labels", config.label);
        const payload = (await request(`${base}?${query}`, {
          method: "GET",
        })) as RemoteIssuePayload[];
        if (!Array.isArray(payload))
          throw new Error("issue target returned an unexpected issue list");
        for (const issue of payload)
          if ((issue.body ?? "").includes(marker)) return remoteIssue(issue);
        if (payload.length < pageSize) return undefined;
      }
      // Failing closed here is deliberate: creating a duplicate issue because
      // the read-back was truncated is worse than refusing to act.
      throw new Error(
        `issue target read-back exceeded ${maxPages} pages; narrow it with a shared label before reconciling`,
      );
    },
    async create(finding) {
      const payload = (await request(base, {
        method: "POST",
        body: {
          title: finding.title,
          body: issueBodyWithFingerprint(finding),
          ...(finding.labels?.length || config.label
            ? {
                labels: [
                  ...new Set([
                    ...(config.label ? [config.label] : []),
                    ...(finding.labels ?? []),
                  ]),
                ],
              }
            : {}),
        },
      })) as RemoteIssuePayload;
      return remoteIssue(payload);
    },
    async update(issueNumber, finding) {
      const payload = (await request(`${base}/${issueNumber}`, {
        method: "PATCH",
        body: {
          title: finding.title,
          body: issueBodyWithFingerprint(finding),
        },
      })) as RemoteIssuePayload;
      return remoteIssue(payload);
    },
  };
}

/**
 * Declarative reconciliation: compute the desired finding, read the actual
 * remote state by fingerprint, then act on the difference. A human decision is
 * final, so a closed issue retires the fingerprint instead of being reopened or
 * updated.
 */
export async function reconcileFinding(input: {
  target: NataliaIssueTarget;
  state: {
    isSuppressed(fingerprint: string): boolean;
    suppress(input: {
      fingerprint: string;
      reason: string;
      at?: string;
    }): Promise<void>;
    mapFingerprint(input: {
      fingerprint: string;
      issue: string;
      at?: string;
    }): Promise<void>;
  };
  finding: NataliaIssueFinding;
  at?: string;
}): Promise<NataliaIssueReconciliation> {
  const { finding, state, target } = input;
  if (state.isSuppressed(finding.fingerprint))
    return {
      action: "suppressed",
      fingerprint: finding.fingerprint,
      reason: "fingerprint was retired by a human decision",
    };
  const existing = await target.findByFingerprint(finding.fingerprint);
  if (existing?.state === "closed") {
    await state.suppress({
      fingerprint: finding.fingerprint,
      reason: `${target.repository}#${existing.number} was closed${existing.closeReason ? ` as ${existing.closeReason}` : ""}`,
      at: input.at,
    });
    return {
      action: "suppressed_by_close",
      fingerprint: finding.fingerprint,
      issue: existing,
    };
  }
  const issue = existing
    ? await target.update(existing.number, finding)
    : await target.create(finding);
  await state.mapFingerprint({
    fingerprint: finding.fingerprint,
    issue: `${target.repository}#${issue.number}`,
    at: input.at,
  });
  return {
    action: existing ? "updated" : "created",
    fingerprint: finding.fingerprint,
    issue,
  };
}

function issuesEndpoint(config: NataliaIssueTargetConfig) {
  if (!config.token) throw new Error("issue target requires a token");
  if (!config.owner || !config.repo)
    throw new Error("issue target requires an owner and repo");
  let url: URL;
  try {
    url = new URL(config.baseURL);
  } catch {
    throw new Error(`issue target baseURL is not a URL: ${config.baseURL}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error(
      `issue target baseURL must be http or https: ${url.protocol}`,
    );
  // Credentials in the URL would leak into audit records and error messages.
  if (url.username || url.password)
    throw new Error("issue target baseURL must not embed credentials");
  const root = `${url.origin}${url.pathname.replace(/\/+$/u, "")}`;
  const prefix = config.kind === "gitea" ? `${root}/api/v1` : root;
  return `${prefix}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/issues`;
}

function redactedPath(path: string, config: NataliaIssueTargetConfig) {
  const withoutToken = path.split(config.token).join("[redacted]");
  try {
    const url = new URL(withoutToken);
    return `${url.origin}${url.pathname}`;
  } catch {
    return withoutToken;
  }
}

type RemoteIssuePayload = {
  number?: number;
  title?: string;
  body?: string;
  html_url?: string;
  state?: string;
  state_reason?: string | null;
};

function remoteIssue(payload: RemoteIssuePayload): NataliaRemoteIssue {
  if (typeof payload?.number !== "number")
    throw new Error("issue target returned an issue without a number");
  return {
    number: payload.number,
    title: payload.title ?? "",
    url: payload.html_url ?? "",
    state: payload.state === "closed" ? "closed" : "open",
    closeReason: payload.state_reason ?? undefined,
    fingerprint: fingerprintFromBody(payload.body ?? ""),
  };
}
