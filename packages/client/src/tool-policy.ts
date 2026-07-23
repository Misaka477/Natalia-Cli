export type ToolPolicy = {
  allow?: string[];
  exclude?: string[];
};

export type ResourceRule = {
  pattern: string;
  allow?: boolean;
  reason?: string;
};

export type PermissionRules = {
  tools?: ToolPolicy;
  files?: {
    readPaths?: ResourceRule[];
    writePaths?: ResourceRule[];
  };
  commands?: {
    allowPatterns?: string[];
    denyPatterns?: string[];
  };
  network?: {
    allowHosts?: string[];
    denyHosts?: string[];
    allowLocalhost?: boolean;
    allowPrivate?: boolean;
  };
  env?: {
    allowlist?: string[];
  };
  redactOutput?: boolean;
};

export type ToolHookEvent = {
  turnID: string;
  toolName: string;
  toolCallID: string;
  arguments: string;
};

export type ToolHookResult = {
  allowed: boolean;
  diagnostics: string[];
};

export type ToolHooks = {
  preExecute?: (
    event: ToolHookEvent,
  ) => ToolHookResult | Promise<ToolHookResult>;
  postExecute?: (
    event: ToolHookEvent & { result?: string; error?: string },
  ) => void | Promise<void>;
};

export type ToolPolicyHookLayer = {
  isToolAllowed(toolName: string): boolean;
  filterTools<T extends { name: string }>(tools: T[]): T[];
  preExecute(event: ToolHookEvent): Promise<ToolHookResult>;
  postExecute(
    event: ToolHookEvent & { result?: string; error?: string },
  ): Promise<void>;
};

export function createToolPolicyHookLayer(
  policy?: ToolPolicy,
  hooks?: ToolHooks,
): ToolPolicyHookLayer {
  const allowPatterns = compilePatterns(policy?.allow);
  const excludePatterns = compilePatterns(policy?.exclude);

  function isToolAllowed(toolName: string): boolean {
    if (
      allowPatterns.length > 0 &&
      !allowPatterns.some((p) => p.test(toolName))
    )
      return false;
    if (excludePatterns.some((p) => p.test(toolName))) return false;
    return true;
  }

  function filterTools<T extends { name: string }>(tools: T[]): T[] {
    return tools.filter((t) => isToolAllowed(t.name));
  }

  async function preExecute(event: ToolHookEvent): Promise<ToolHookResult> {
    const diagnostics: string[] = [];
    if (!isToolAllowed(event.toolName)) {
      diagnostics.push(`blocked by policy: ${event.toolName}`);
      return { allowed: false, diagnostics };
    }
    if (hooks?.preExecute) {
      const result = await hooks.preExecute(event);
      if (result) {
        diagnostics.push(...result.diagnostics);
        if (!result.allowed) return { allowed: false, diagnostics };
      }
    }
    return { allowed: true, diagnostics };
  }

  async function postExecute(
    event: ToolHookEvent & { result?: string; error?: string },
  ): Promise<void> {
    if (hooks?.postExecute) {
      await hooks.postExecute(event);
    }
  }

  return { isToolAllowed, filterTools, preExecute, postExecute };
}

export type PermissionCheck = {
  allowed: boolean;
  reason?: string;
  diagnostics: string[];
};

export function evaluatePermissionRules(
  rules: PermissionRules | undefined,
  toolName: string,
  args: Record<string, unknown>,
): PermissionCheck {
  const diags: string[] = [];
  if (!rules) return { allowed: true, diagnostics: diags };

  // Check tool allow/exclude
  if (rules.tools) {
    const allowP = compilePatterns(rules.tools.allow);
    const excludeP = compilePatterns(rules.tools.exclude);
    if (allowP.length && !allowP.some((p) => p.test(toolName))) {
      diags.push(`tool "${toolName}" not in allow list`);
      return {
        allowed: false,
        reason: "tool blocked by policy",
        diagnostics: diags,
      };
    }
    if (excludeP.some((p) => p.test(toolName))) {
      diags.push(`tool "${toolName}" in exclude list`);
      return {
        allowed: false,
        reason: "tool blocked by policy",
        diagnostics: diags,
      };
    }
  }

  const readsPath = ["read_file", "read_media_file", "glob", "grep"].includes(
    toolName,
  );
  const writesPath = [
    "write_file",
    "edit_file",
    "sandbox_write",
    "sandbox_merge",
    "browser_screenshot",
  ].includes(toolName);
  if (rules.files && (readsPath || writesPath)) {
    const path = typeof args.path === "string" ? args.path : undefined;
    if (path) {
      if (writesPath && rules.files.writePaths) {
        const denied = rules.files.writePaths.find(
          (r) => !r.allow && pathMatch(path, r.pattern),
        );
        if (denied) {
          diags.push(
            `write to "${path}" blocked: ${denied.reason ?? "path denied"}`,
          );
          return { allowed: false, reason: denied.reason, diagnostics: diags };
        }
      }
      if (readsPath && rules.files.readPaths) {
        const denied = rules.files.readPaths.find(
          (r) => !r.allow && pathMatch(path, r.pattern),
        );
        if (denied) {
          diags.push(
            `read of "${path}" blocked: ${denied.reason ?? "path denied"}`,
          );
          return { allowed: false, reason: denied.reason, diagnostics: diags };
        }
      }
    }
  }

  const runsCommand = [
    "run_shell",
    "sandbox_execute",
    "sandbox_resource_start",
    "process_start",
    "background_start",
    "interactive_start",
  ].includes(toolName);
  if (rules.commands && runsCommand) {
    const cmd = typeof args.command === "string" ? args.command : undefined;
    if (cmd) {
      const denied = matchesCommandPatterns(cmd, rules.commands.denyPatterns);
      if (denied.error) {
        diags.push(`invalid command deny pattern: ${denied.error}`);
        return {
          allowed: false,
          reason: "command policy configuration is invalid",
          diagnostics: diags,
        };
      }
      if (denied.matches) {
        diags.push(`command matches deny pattern`);
        return {
          allowed: false,
          reason: "command blocked by policy",
          diagnostics: diags,
        };
      }
      const allowed = matchesCommandPatterns(cmd, rules.commands.allowPatterns);
      if (allowed.error) {
        diags.push(`invalid command allow pattern: ${allowed.error}`);
        return {
          allowed: false,
          reason: "command policy configuration is invalid",
          diagnostics: diags,
        };
      }
      if (rules.commands.allowPatterns?.length && !allowed.matches) {
        diags.push(`command does not match any allow pattern`);
        return {
          allowed: false,
          reason: "command blocked by policy",
          diagnostics: diags,
        };
      }
    }
  }

  return { allowed: true, diagnostics: diags };
}

function pathMatch(path: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
    .replace(/\\\*/gu, ".*");
  return new RegExp(`^${escaped}$`, "u").test(path);
}

function matchesCommandPatterns(command: string, patterns?: string[]) {
  try {
    return {
      matches:
        patterns?.some((pattern) => new RegExp(pattern, "iu").test(command)) ??
        false,
    };
  } catch (error) {
    return {
      matches: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function compilePatterns(patterns?: string[]): RegExp[] {
  if (!patterns || patterns.length === 0) return [];
  return patterns.map((p) => {
    const escaped = p
      .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
      .replace(/\\\*/gu, ".*");
    return new RegExp(`^${escaped}$`, "u");
  });
}
