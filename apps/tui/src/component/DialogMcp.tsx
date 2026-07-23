import { createMemo, createSignal, Show } from "solid-js";
import { DialogSelect } from "../dialog/DialogSelect";
import { DialogConfirm } from "../dialog/DialogConfirm";
import { DialogPrompt } from "../dialog/DialogPrompt";
import { useDialog } from "../dialog/provider";
import { darkTheme } from "../theme/theme";
import { TextAttributes } from "@opentui/core";
import type { ConfigV2 } from "@natalia/contracts";

function Status(props: {
  enabled: boolean;
  runtime?: { status: string; tools: number; message?: string };
}) {
  if (!props.enabled) {
    return <span style={{ fg: darkTheme.muted }}>○ Disabled</span>;
  }
  if (props.runtime?.status === "failed") {
    return <span style={{ fg: darkTheme.warning }}>× Failed</span>;
  }
  if (props.runtime?.status === "unsupported_auth_flow") {
    return <span style={{ fg: darkTheme.warning }}>! Auth unsupported</span>;
  }
  if (props.runtime?.status === "connected") {
    return (
      <span style={{ fg: darkTheme.success, attributes: TextAttributes.BOLD }}>
        ✓ {props.runtime.tools} tools
      </span>
    );
  }
  return <span style={{ fg: darkTheme.muted }}>⋯ Starting</span>;
}

export function DialogMcp(props: {
  config: ConfigV2;
  onPersist: (next: ConfigV2) => void;
  statuses?: Record<
    string,
    {
      status: "disabled" | "connected" | "failed" | "unsupported_auth_flow";
      tools: number;
      message?: string;
    }
  >;
}) {
  const dialog = useDialog();
  const [config, setConfig] = createSignal(props.config);
  const [loading, setLoading] = createSignal<string | null>(null);
  const [mode, setMode] = createSignal<"list" | "detail" | "add">("list");
  const [selected, setSelected] = createSignal("");

  const options = createMemo(() =>
    mode() === "list"
      ? [
          ...Object.entries(config().mcpServers ?? {}).map(
            ([name, server]) => ({
              value: name,
              title: name,
              description: `${server.enabled ? "Enabled" : "Disabled"}${server.readOnly ? " · read-only" : ""}`,
              footer: (
                <Status
                  enabled={server.enabled && loading() !== name}
                  runtime={props.statuses?.[name]}
                />
              ),
            }),
          ),
          {
            value: "$add",
            title: "+ Add MCP Server",
            description: "Configure a new MCP server",
          },
        ]
      : [],
  );

  if (mode() === "detail") {
    const name = selected();
    const srv = config().mcpServers[name];
    if (!srv) {
      setMode("list");
      return <span />;
    }
    return (
      <DialogSelect
        title={`MCP: ${name}`}
        options={[
          {
            value: "toggle",
            title: "Enabled",
            description: srv.enabled ? "On" : "Off",
          },
          {
            value: "readonly",
            title: "Read-only",
            description: srv.readOnly ? "On" : "Off",
          },
          {
            value: "timeout",
            title: "Timeout",
            description: `${srv.timeoutSec}s`,
          },
          {
            value: "command",
            title: "Command",
            description: srv.command ?? "(none)",
          },
          {
            value: "args",
            title: "Arguments",
            description: `${srv.args.length} arguments`,
          },
          {
            value: "cwd",
            title: "Working directory",
            description: srv.cwd ?? "(workspace root)",
          },
          {
            value: "url",
            title: "URL",
            description: srv.url ?? "(none)",
          },
          {
            value: "headers",
            title: "HTTP headers",
            description: `${Object.keys(srv.headers).length} entries`,
          },
          {
            value: "environment",
            title: "Environment",
            description: `${Object.keys(srv.environment).length} entries`,
          },
          {
            value: "allowed",
            title: "Allowed tools",
            description: `${srv.allowedTools.length} tools`,
          },
          {
            value: "excluded",
            title: "Excluded tools",
            description: `${srv.excludedTools.length} tools`,
          },
          {
            value: "status",
            title: "Runtime status",
            description:
              props.statuses?.[name]?.message ??
              props.statuses?.[name]?.status ??
              "Not reported by current runtime",
            footer: props.statuses?.[name]
              ? `${props.statuses[name]!.tools} tools`
              : undefined,
          },
          {
            value: "delete",
            title: "Delete server",
            description: "Remove this MCP server",
          },
        ]}
        onSelect={(option) => {
          const next = structuredClone(config());
          const sv = next.mcpServers[name];
          if (!sv) return;
          switch (option.value) {
            case "toggle":
              sv.enabled = !sv.enabled;
              persist(next);
              break;
            case "readonly":
              sv.readOnly = !sv.readOnly;
              persist(next);
              break;
            case "timeout":
              dialog.push(() => (
                <DialogPrompt
                  title="Timeout (seconds)"
                  placeholder={String(sv.timeoutSec)}
                  onConfirm={(v) => {
                    sv.timeoutSec = Number(v) || 30;
                    persist(next);
                  }}
                />
              ));
              break;
            case "command":
              dialog.push(() => (
                <DialogPrompt
                  title="Command"
                  placeholder={sv.command ?? ""}
                  onConfirm={(v) => {
                    sv.command = v.trim() || undefined;
                    persist(next);
                  }}
                />
              ));
              break;
            case "args":
              dialog.push(() => (
                <DialogPrompt
                  title="MCP Arguments"
                  description={() =>
                    'JSON string array, for example ["--stdio"].'
                  }
                  placeholder={JSON.stringify(sv.args)}
                  onConfirm={(value) => {
                    const parsed = parseStringArray(value);
                    if (!parsed) return;
                    sv.args = parsed;
                    persist(next);
                  }}
                />
              ));
              break;
            case "cwd":
              dialog.push(() => (
                <DialogPrompt
                  title="MCP Working Directory"
                  placeholder={sv.cwd ?? ""}
                  onConfirm={(value) => {
                    sv.cwd = value.trim() || undefined;
                    persist(next);
                  }}
                />
              ));
              break;
            case "url":
              dialog.push(() => (
                <DialogPrompt
                  title="URL"
                  placeholder={sv.url ?? ""}
                  onConfirm={(v) => {
                    sv.url = v.trim() || undefined;
                    persist(next);
                  }}
                />
              ));
              break;
            case "headers":
              dialog.push(() => (
                <DialogPrompt
                  title="MCP HTTP Headers"
                  description={() =>
                    "JSON string record. Values are not shown in the server list."
                  }
                  placeholder={JSON.stringify(sv.headers)}
                  onConfirm={(value) => {
                    const parsed = parseStringRecord(value);
                    if (!parsed) return;
                    sv.headers = parsed;
                    persist(next);
                  }}
                />
              ));
              break;
            case "environment":
              dialog.push(() => (
                <DialogPrompt
                  title="MCP Environment"
                  description={() =>
                    "JSON string record. Values are not shown in the server list."
                  }
                  placeholder={JSON.stringify(sv.environment)}
                  onConfirm={(value) => {
                    const parsed = parseStringRecord(value);
                    if (!parsed) return;
                    sv.environment = parsed;
                    persist(next);
                  }}
                />
              ));
              break;
            case "allowed":
            case "excluded":
              dialog.push(() => (
                <DialogPrompt
                  title={
                    option.value === "allowed"
                      ? "Allowed MCP Tools"
                      : "Excluded MCP Tools"
                  }
                  description={() => "Comma-separated MCP tool names."}
                  placeholder={
                    option.value === "allowed"
                      ? sv.allowedTools.join(", ")
                      : sv.excludedTools.join(", ")
                  }
                  onConfirm={(value) => {
                    const tools = value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean);
                    if (option.value === "allowed") sv.allowedTools = tools;
                    else sv.excludedTools = tools;
                    persist(next);
                  }}
                />
              ));
              break;
            case "delete":
              dialog.pop();
              delete next.mcpServers[name];
              persist(next);
              setMode("list");
              break;
          }
        }}
      />
    );
  }

  if (mode() === "add") {
    return (
      <DialogPrompt
        title="Add MCP Server"
        placeholder="server-name"
        onConfirm={(name) => {
          const id = name.trim();
          if (!id) return;
          const next = structuredClone(config());
          next.mcpServers = { ...next.mcpServers };
          next.mcpServers[id] = {
            type: "stdio",
            args: [],
            headers: {},
            environment: {},
            timeoutSec: 30,
            allowedTools: [],
            excludedTools: [],
            readOnly: false,
            enabled: true,
          };
          persist(next);
          setMode("list");
          dialog.push(() => (
            <DialogMcp config={next} onPersist={props.onPersist} />
          ));
        }}
      />
    );
  }

  return (
    <DialogSelect
      title="MCP Servers"
      options={options()}
      preserveSelection
      actions={[
        {
          command: "mcp.dialog.delete",
          title: "Delete",
          disabled: (option) => !option || option.value === "$add",
          onTrigger: (option) => {
            dialog.push(() => (
              <DialogConfirm
                title="Delete MCP server"
                message={`Remove "${option.title}" from this workspace?`}
                onConfirm={() => {
                  const next = structuredClone(config());
                  delete next.mcpServers[option.value];
                  persist(next);
                }}
              />
            ));
          },
        },
      ]}
      onSelect={(option) => {
        if (option.value === "$add") {
          setMode("add");
          return;
        }
        if (loading() !== null) return;
        setSelected(option.value);
        setMode("detail");
      }}
    />
  );

  function persist(next: ConfigV2) {
    setConfig(next);
    props.onPersist(next);
  }
}

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

function parseStringRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return undefined;
    return Object.entries(parsed).every(([, item]) => typeof item === "string")
      ? (parsed as Record<string, string>)
      : undefined;
  } catch {
    return undefined;
  }
}
