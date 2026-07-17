export type ToolExecutionBoundary = {
  name: string;
  requiresApproval: boolean;
  timeoutSec?: number;
};

export type ToolRegistry = Map<string, ToolExecutionBoundary>;

export function createToolRegistry(
  tools: ToolExecutionBoundary[] = [],
): ToolRegistry {
  return new Map(tools.map((tool) => [tool.name, tool]));
}
