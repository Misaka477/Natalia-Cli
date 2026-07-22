import { createSignal, Show } from "solid-js";
import { DialogSelect } from "../dialog/DialogSelect";
import { DialogPrompt } from "../dialog/DialogPrompt";
import { useDialog } from "../dialog/provider";
import type { ConfigV2 } from "@natalia/contracts";
import { darkTheme } from "../theme/theme";
import { TextAttributes } from "@opentui/core";
import {
  configureDiscoveredProviderModel,
  discoverProviderModels,
} from "@natalia/config";

export function DialogProviderSetup(props: {
  config: ConfigV2;
  onPersist: (next: ConfigV2) => void;
}) {
  const dialog = useDialog();

  return (
    <DialogSelect
      title="Select Provider Type"
      options={[
        {
          value: "openai",
          title: "OpenAI",
          description: "API key",
          category: "Popular",
        },
        {
          value: "anthropic",
          title: "Anthropic",
          description: "API key",
          category: "Popular",
        },
        {
          value: "gemini",
          title: "Gemini",
          description: "API key",
          category: "Popular",
        },
        {
          value: "openai-compatible",
          title: "OpenAI Compatible",
          description: "Custom endpoint",
          category: "Other",
        },
      ]}
      onSelect={(option) => {
        dialog.replace(() => (
          <ProviderName
            type={option.value}
            config={props.config}
            onPersist={props.onPersist}
          />
        ));
      }}
    />
  );
}

function ProviderName(props: {
  type: string;
  config: ConfigV2;
  onPersist: (next: ConfigV2) => void;
}) {
  const dialog = useDialog();
  return (
    <DialogPrompt
      title="Provider Name"
      description={() => (
        <text fg={darkTheme.muted}>Unique name for this provider.</text>
      )}
      placeholder="my-provider"
      onConfirm={(value) => {
        if (!value.trim()) return;
        dialog.replace(() => (
          <ProviderKey
            type={props.type}
            name={value.trim()}
            config={props.config}
            onPersist={props.onPersist}
          />
        ));
      }}
    />
  );
}

function ProviderKey(props: {
  type: string;
  name: string;
  config: ConfigV2;
  onPersist: (next: ConfigV2) => void;
}) {
  const dialog = useDialog();
  return (
    <DialogPrompt
      title="API Key"
      description={() => (
        <text fg={darkTheme.muted}>
          Stored in project config and redacted in UI.
        </text>
      )}
      placeholder="sk-..."
      onConfirm={(value) => {
        if (!value.trim()) return;
        dialog.replace(() => (
          <ProviderURL
            type={props.type}
            name={props.name}
            apiKey={value.trim()}
            config={props.config}
            onPersist={props.onPersist}
          />
        ));
      }}
    />
  );
}

function ProviderURL(props: {
  type: string;
  name: string;
  apiKey: string;
  config: ConfigV2;
  onPersist: (next: ConfigV2) => void;
}) {
  const dialog = useDialog();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const hint =
    props.type === "openai"
      ? "https://api.openai.com/v1"
      : props.type === "anthropic"
        ? "https://api.anthropic.com"
        : props.type === "gemini"
          ? "https://generativelanguage.googleapis.com/v1beta"
          : "https://api.example.com/v1";
  return (
    <DialogPrompt
      title="API Base URL"
      description={() => (
        <box gap={1}>
          <text
            fg={darkTheme.muted}
          >{`${props.type} — enter base URL to discover models.`}</text>
          <Show when={error()}>
            <text fg={darkTheme.danger} wrapMode="word">
              {error()}
            </text>
          </Show>
        </box>
      )}
      placeholder={hint}
      onConfirm={async (value) => {
        const baseURL = value.trim();
        if (!baseURL || busy()) return;
        setBusy(true);
        setError("");
        try {
          const models = await discoverProviderModels(
            props.type,
            baseURL,
            props.apiKey,
          );
          if (!models.length) throw new Error("Provider returned no models");
          dialog.replace(() => (
            <ProviderModel
              type={props.type}
              name={props.name}
              apiKey={props.apiKey}
              baseURL={baseURL}
              models={models}
              config={props.config}
              onPersist={props.onPersist}
            />
          ));
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setBusy(false);
        }
      }}
    />
  );
}

function ProviderModel(props: {
  type: string;
  name: string;
  apiKey: string;
  baseURL: string;
  models: string[];
  config: ConfigV2;
  onPersist: (next: ConfigV2) => void;
}) {
  const dialog = useDialog();
  return (
    <DialogSelect
      title="Select Model"
      options={props.models.map((model) => ({ title: model, value: model }))}
      onSelect={(option) => {
        props.onPersist(
          configureDiscoveredProviderModel(props.config, {
            providerID: props.name,
            providerType: props.type,
            apiKey: props.apiKey,
            baseURL: props.baseURL,
            modelID: option.value,
            discoveredModels: props.models,
          }),
        );
        dialog.pop();
      }}
    />
  );
}
