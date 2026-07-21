import { createMemo, createSignal, Show } from "solid-js";
import { DialogSelect } from "../dialog/DialogSelect";
import { DialogPrompt } from "../dialog/DialogPrompt";
import { useDialog } from "../dialog/provider";
import { darkTheme } from "../theme/theme";
import { TextAttributes } from "@opentui/core";
import type { ConfigV2 } from "@natalia/contracts";

function Status(props: { enabled: boolean }) {
  if (props.enabled) {
    return (
      <span style={{ fg: darkTheme.success, attributes: TextAttributes.BOLD }}>
        ✓ Enabled
      </span>
    );
  }
  return <span style={{ fg: darkTheme.muted }}>○ Disabled</span>;
}

export function DialogMcp(props: {
  config: ConfigV2;
  onPersist: (next: ConfigV2) => void;
}) {
  const dialog = useDialog();
  const [loading, setLoading] = createSignal<string | null>(null);
  const [mode, setMode] = createSignal<"list" | "detail" | "add">("list");
  const [selected, setSelected] = createSignal("");

  const options = createMemo(() =>
    mode() === "list"
      ? [
          ...Object.entries(props.config.mcpServers ?? {}).map(
            ([name, server]) => ({
              value: name,
              title: name,
              description: `${server.enabled ? "Enabled" : "Disabled"}${server.readOnly ? " · read-only" : ""}`,
              footer: <Status enabled={server.enabled && loading() !== name} />,
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
    const srv = props.config.mcpServers[name];
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
          { value: "timeout", title: "Timeout", description: `${srv.timeoutSec}s` },
          {
            value: "command",
            title: "Command",
            description: srv.command ?? "(none)",
          },
          {
            value: "url",
            title: "URL",
            description: srv.url ?? "(none)",
          },
          {
            value: "allowed",
            title: "Allowed tools",
            description: `${srv.allowedTools.length} tools`,
          },
          {
            value: "delete",
            title: "Delete server",
            description: "Remove this MCP server",
          },
        ]}
        onSelect={(option) => {
          const next = structuredClone(props.config);
          const sv = next.mcpServers[name];
          if (!sv) return;
          switch (option.value) {
            case "toggle":
              sv.enabled = !sv.enabled;
              props.onPersist(next);
              break;
            case "readonly":
              sv.readOnly = !sv.readOnly;
              props.onPersist(next);
              break;
            case "timeout":
              dialog.push(() => (
                <DialogPrompt
                  title="Timeout (seconds)"
                  placeholder={String(sv.timeoutSec)}
                  onConfirm={(v) => {
                    sv.timeoutSec = Number(v) || 30;
                    props.onPersist(next);
                    dialog.push(() => (
                      <DialogMcp config={next} onPersist={props.onPersist} />
                    ));
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
                    props.onPersist(next);
                    dialog.push(() => (
                      <DialogMcp config={next} onPersist={props.onPersist} />
                    ));
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
                    props.onPersist(next);
                    dialog.push(() => (
                      <DialogMcp config={next} onPersist={props.onPersist} />
                    ));
                  }}
                />
              ));
              break;
            case "delete":
              dialog.pop();
              delete (next.mcpServers as Record<string, unknown>)[name];
              props.onPersist(next);
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
          const next = structuredClone(props.config);
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
          props.onPersist(next);
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
      onSelect={(option) => {
        if (option.value === "$add") {
          setMode("add");
          return;
        }
        if (loading() !== null) return;
        setSelected(option.value);
        setMode("detail");
      }}
      onExtraKey={(key, option) => {
        if (key === "d" && option.value !== "$add") {
          const next = structuredClone(props.config);
          delete (next.mcpServers as Record<string, unknown>)[option.value];
          props.onPersist(next);
        }
      }}
    />
  );
}
