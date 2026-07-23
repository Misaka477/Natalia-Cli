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
      rollback:
        "TS-only release; restore the prior repository revision if rollback is required",
      releaseReady: true,
    },
    null,
    2,
  ),
);
