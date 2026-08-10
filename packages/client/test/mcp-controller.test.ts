import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createToolRegistry } from "@natalia/tools";
import { createMcpController } from "../src/mcp-controller";

test("MCP controller reload is a no-op when the extension is disabled", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-mcp-controller-"));
  const events: Array<{ type: string }> = [];
  const controller = createMcpController({
    servers: () => ({}),
    workspaceRoot: root,
    tools: createToolRegistry([]),
    enabled: () => false,
    publish: (event) => events.push(event),
  });
  await controller.reload();
  expect(controller.access).toHaveLength(0);
  await controller.close();
  expect(events).toHaveLength(0);
});
