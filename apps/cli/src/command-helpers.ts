import { resolve } from "node:path";
import { userStateHome } from "@natalia/platform";

export function valueAfter(argv: string[], flag: string, offset = 0) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1 + offset] : undefined;
}

export function withoutOption(argv: string[], flag: string) {
  const index = argv.indexOf(flag);
  return index < 0 ? argv : [...argv.slice(0, index), ...argv.slice(index + 2)];
}

export function daemonDir() {
  return resolve(userStateHome(), "natalia-cli", "daemon");
}

export function waitSignal() {
  return new Promise<void>((done) => {
    process.once("SIGINT", done);
    process.once("SIGTERM", done);
  });
}
