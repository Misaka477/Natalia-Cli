export {
  createTerminalControllerPlugin,
  TERMINAL_CONTROLLER_SERVICE,
  TERMINAL_PLUGIN_ID,
} from "./terminal-controller-plugin";
export type { TerminalController } from "./terminal-controller";
export { createTerminalController } from "./terminal-controller";
export {
  resolveNataliaWezTermForkExecutable,
  NativeTerminalRegistry,
  type NativeTerminalSession,
} from "@natalia/native-terminal";
