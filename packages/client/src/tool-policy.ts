export type ToolPolicy = {
  allow?: string[];
  exclude?: string[];
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

function compilePatterns(patterns?: string[]): RegExp[] {
  if (!patterns || patterns.length === 0) return [];
  return patterns.map((p) => {
    const escaped = p
      .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
      .replace(/\\\*/gu, ".*");
    return new RegExp(`^${escaped}$`, "u");
  });
}
