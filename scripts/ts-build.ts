import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

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
await mkdir(outdir, { recursive: true });
for (const artifact of [
  "LICENSE",
  "NOTICE",
  "THIRD_PARTY_NOTICES.md",
  "THIRD_PARTY_LICENSES.txt",
])
  await Bun.write(
    resolve(outdir, artifact),
    Bun.file(resolve(process.cwd(), artifact)),
  );
console.log(
  JSON.stringify(
    {
      version,
      target,
      outputs: [
        ...result.outputs.map((output) => output.path),
        ...[
          "LICENSE",
          "NOTICE",
          "THIRD_PARTY_NOTICES.md",
          "THIRD_PARTY_LICENSES.txt",
        ].map((artifact) => resolve(outdir, artifact)),
      ],
    },
    null,
    2,
  ),
);
