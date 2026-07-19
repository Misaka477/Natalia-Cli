const version = process.env.NATALIA_TS_VERSION ?? "0.0.0-ts7";
const target =
  process.env.NATALIA_BUILD_TARGET ?? `${process.platform}-${process.arch}`;
const entrypoint = "apps/cli/src/main.ts";

if (!Bun.file(entrypoint).size)
  throw new Error(`missing TS CLI entrypoint: ${entrypoint}`);

console.log(
  JSON.stringify(
    {
      name: "natalia-ts",
      version,
      target,
      entrypoint,
      install: "npx bun apps/cli/src/main.ts",
      rollback: "legacy Go launcher remains installed until M13 approval",
      releaseReady: true,
    },
    null,
    2,
  ),
);
