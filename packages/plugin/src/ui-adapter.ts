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
      async execute(input) {
        const command = (await runtime.commandCatalog?.())?.find(
          (entry) => entry.name === input.name,
        );
        if (!command) throw new Error(`command unavailable: ${input.name}`);
        if (!runtime.commandExecute)
          throw new Error("runtime command execution unavailable");
        await runtime.commandExecute(input);
      },
    },
  };
}
