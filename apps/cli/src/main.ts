import { createCliCommandAdapterHost } from "./cli-command-adapter";
import {
  isPluginMaintenanceCommand,
  parsePluginMaintenanceArgs,
  runPluginMaintenanceCommand,
} from "./plugin-maintenance";
import { initializeOfficialPluginsForHostCommand } from "./official-plugins";

const argv = process.argv.slice(2);

if (isPluginMaintenanceCommand(argv)) {
  const command = parsePluginMaintenanceArgs(argv);
  await runPluginMaintenanceCommand(argv, command);
} else {
  await initializeOfficialPluginsForHostCommand(argv);
  const host = await createCliCommandAdapterHost();
  try {
    await host.done;
  } finally {
    await host.close();
  }
}
