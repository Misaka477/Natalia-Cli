import type { PluginCommand } from "./types";

let globalCommands: PluginCommand[] = [];

export function setGlobalPluginCommands(commands: PluginCommand[]) {
  globalCommands = [...commands];
}

export function getPluginCommands() {
  return [...globalCommands];
}
