export {
  NATIVE_INPUT_BROKER_VERSION,
  NativeTerminalRegistry,
  createWezTermHost,
  decodeNativeInputClaim,
  decodeNativeInputDecision,
  encodeNativeInputDecision,
  monospaceFontFallback,
  nativeInputBrokerDecision,
  nativeInputBrokerEndpoint,
  nativeTerminalForkBuildDir,
  nativeTerminalPaneCommand,
  reclaimStaleMuxRuntimeDirs,
  resolveNataliaWezTermForkExecutable,
  resolveWezTermExecutable,
  startNativeInputBroker,
  writeWezTermNativeDomainConfig,
  type NativeInputBroker,
  type NativeInputClaim,
  type NativeInputDecision,
  type NativeInputKind,
  type NativeTerminalAuditEvent,
  type NativeTerminalHost,
  type NativeTerminalHub,
  type NativeTerminalPane,
  type NativeTerminalSession,
  type NativeTerminalWriteResult,
} from "./native-terminal";
export {
  createTerminalController,
  type TerminalControllerInput,
} from "./terminal-controller";
export {
  createPtyTerminalController,
  type PtyFactory,
  type PtyProcess,
  type PtySpawnOptions,
  type PtyTerminalControllerInput,
} from "./pty-terminal-controller";
export { terminalToolFamily, terminalTools } from "./terminal-tools";
export {
  createTerminalPlugin,
  TERMINAL_PLUGIN_ID,
  TERMINAL_PLUGIN_MANIFEST,
} from "./terminal-plugin";
import type { Plugin, PluginAPI } from "@natalia/plugin";
import type { TerminalControllerInput } from "@natalia/runtime-services";
import {
  createTerminalPlugin,
  TERMINAL_PLUGIN_MANIFEST,
} from "./terminal-plugin";

export const TERMINAL_INPUT_SERVICE = "terminal.input";
export type TerminalRuntimeInput = TerminalControllerInput;

export default function terminalPlugin(): Plugin {
  let instance: Plugin | undefined;
  return {
    manifest: {
      ...TERMINAL_PLUGIN_MANIFEST,
      entry: "index.js",
      requires: [TERMINAL_INPUT_SERVICE],
    },
    async setup(api: PluginAPI) {
      const input = api.services.get<TerminalRuntimeInput>(
        TERMINAL_INPUT_SERVICE,
      );
      if (!input)
        throw new Error(`missing runtime service: ${TERMINAL_INPUT_SERVICE}`);
      instance = createTerminalPlugin(input);
      await instance.setup(api);
    },
    async dispose() {
      await instance?.dispose?.();
      instance = undefined;
    },
  };
}
