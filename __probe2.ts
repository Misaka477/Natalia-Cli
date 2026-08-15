import { discoverLocalToolFamilies } from "@natalia/client";
const found = await discoverLocalToolFamilies("/tmp/kilo/cli-install-probe/root/.natalia/tools");
console.log("found:", found.map((e) => e.path));
