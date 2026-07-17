import { defaultConfigPath } from "@natalia/config";
import { plainStatus, startupDiagnostics } from "./index";

const args = new Set(process.argv.slice(2));
const configPath = process.env.NATALIA_CONFIG ?? defaultConfigPath();

if (args.has("--diagnostics")) {
  console.log(JSON.stringify(await startupDiagnostics(configPath), null, 2));
} else {
  console.log(JSON.stringify(await plainStatus(configPath), null, 2));
}
