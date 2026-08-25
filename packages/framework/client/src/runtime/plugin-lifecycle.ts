import type { SessionID } from "@natalia/contracts";
import {
  MCP_SERVICE,
  SANDBOX_SERVICE,
  TERMINAL_CONTROLLER_SERVICE,
  type McpService,
  type SandboxService,
  type TerminalController,
} from "@natalia/runtime-services";
import type { RuntimeContext } from "./context";

export function createPluginLifecycle(ctx: RuntimeContext) {
  async function runPluginLifecyclePostReconcile(
    selectedSkills: Map<SessionID, string> = new Map(),
  ) {
    const terminal = ctx.ports.resolveService<TerminalController>(
      TERMINAL_CONTROLLER_SERVICE,
    );
    const sandbox = ctx.ports.resolveService<SandboxService>(SANDBOX_SERVICE);
    const mcp = ctx.ports.resolveService<McpService>(MCP_SERVICE);
    await mcp?.reload();
    await terminal?.init();
    terminal?.setActiveSession(ctx.ports.getSessionID());
    await sandbox?.init();

    const skills = ctx.ports.skillService();
    for (const [id, exec] of ctx.ports.getExecutionBySession()) {
      const qualifiedName = selectedSkills.get(id);
      if (!qualifiedName || !skills) {
        exec.activeSkill = undefined;
        continue;
      }
      try {
        exec.activeSkill = skills.resolve(qualifiedName);
      } catch {
        exec.activeSkill = undefined;
      }
    }
    ctx.ports.setActiveSkill(ctx.ports.getActiveExec()?.activeSkill);
  }

  return { runPluginLifecyclePostReconcile };
}
