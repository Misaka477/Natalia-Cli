const target =
  process.env.NATALIA_BUILD_TARGET ?? `${process.platform}-${process.arch}`;
const version = process.env.NATALIA_TS_VERSION ?? "0.0.0-ts7";
const outdir = process.env.NATALIA_BUILD_OUTDIR ?? "dist/ts";
const result = await Bun.build({
  entrypoints: ["apps/cli/src/main.ts"],
  outdir,
  target: "bun",
  format: "esm",
  naming: "natalia-ts.[ext]",
  define: {
    "process.env.NATALIA_TS_VERSION": JSON.stringify(version),
    "process.env.NATALIA_BUILD_TARGET": JSON.stringify(target),
  },
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  throw new Error("TS release build failed");
}
console.log(
  JSON.stringify(
    { version, target, outputs: result.outputs.map((output) => output.path) },
    null,
    2,
  ),
);
