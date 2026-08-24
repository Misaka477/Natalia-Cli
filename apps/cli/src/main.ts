import { createCliCommandAdapterHost } from "./cli-command-adapter";
import {
  isPluginMaintenanceCommand,
  runPluginMaintenanceCommand,
} from "./plugin-maintenance";

const argv = process.argv.slice(2);

if (isPluginMaintenanceCommand(argv)) {
  await runPluginMaintenanceCommand(argv);
} else {
  const host = await createCliCommandAdapterHost();
  try {
    await host.done;
  } finally {
    await host.close();
  }
}

function argumentValue(argv: readonly string[], name: string) {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (index >= 0 && (!value || value.startsWith("--")))
    throw new Error(`${name} requires an absolute or relative path`);
  return value;
}
