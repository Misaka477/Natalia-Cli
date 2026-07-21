import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type LocalTuiState = {
  version: 1;
  pinnedSessions: string[];
  recentModels: string[];
  favoriteModels: string[];
  activeAgent?: string;
  mcpEnabled: Record<string, boolean>;
};

const defaults: LocalTuiState = {
  version: 1,
  pinnedSessions: [],
  recentModels: [],
  favoriteModels: [],
  mcpEnabled: {},
};

export async function loadLocalTuiState(workspaceRoot: string) {
  const path = statePath(workspaceRoot);
  try {
    return {
      ...defaults,
      ...(JSON.parse(await readFile(path, "utf8")) as Partial<LocalTuiState>),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return structuredClone(defaults);
    throw error;
  }
}

export async function saveLocalTuiState(
  workspaceRoot: string,
  state: LocalTuiState,
) {
  const path = statePath(workspaceRoot);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${crypto.randomUUID()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, path);
}

export async function trackModelUsage(
  workspaceRoot: string,
  modelName: string,
) {
  const state = await loadLocalTuiState(workspaceRoot);
  state.recentModels = [
    modelName,
    ...state.recentModels.filter((m) => m !== modelName),
  ].slice(0, 10);
  await saveLocalTuiState(workspaceRoot, state);
}

export async function toggleModelFavorite(
  workspaceRoot: string,
  modelName: string,
) {
  const state = await loadLocalTuiState(workspaceRoot);
  state.favoriteModels = state.favoriteModels.includes(modelName)
    ? state.favoriteModels.filter((m) => m !== modelName)
    : [...state.favoriteModels, modelName];
  await saveLocalTuiState(workspaceRoot, state);
}

export async function selectActiveAgent(workspaceRoot: string, agent?: string) {
  const state = await loadLocalTuiState(workspaceRoot);
  state.activeAgent = agent;
  await saveLocalTuiState(workspaceRoot, state);
}

export function sortModelOptions(
  names: string[],
  favorites: string[],
  recents: string[],
): string[] {
  const used = new Set<string>();
  const out: string[] = [];
  for (const name of favorites) {
    if (names.includes(name) && !used.has(name)) {
      out.push(name);
      used.add(name);
    }
  }
  for (const name of recents) {
    if (names.includes(name) && !used.has(name)) {
      out.push(name);
      used.add(name);
    }
  }
  for (const name of names) {
    if (!used.has(name)) out.push(name);
  }
  return out;
}

function statePath(workspaceRoot: string) {
  return resolve(workspaceRoot, ".natalia", "tui-local.json");
}
