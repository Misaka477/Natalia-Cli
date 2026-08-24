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
      async execute(name) {
        const command = (await runtime.commandCatalog?.())?.find(
          (entry) => entry.name === name,
        );
        if (!command) throw new Error(`command unavailable: ${name}`);
        await runtime.submit(`/${name}`);
      },
    },
  };
}
