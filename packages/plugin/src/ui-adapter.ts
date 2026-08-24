import type {
  RuntimeClient,
  RuntimeEvent,
  UiAdapterMountInput,
} from "@natalia/contracts";

export function createUiAdapterMountInput(
  runtime: RuntimeClient,
): UiAdapterMountInput {
  const listeners = new Set<(event: RuntimeEvent) => void>();
  runtime.start((event) => {
    for (const listener of listeners) listener(event);
  });
  return {
    runtime,
    events: {
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    commands: {
      list: async () => (await runtime.commandCatalog?.()) ?? [],
    },
  };
}
