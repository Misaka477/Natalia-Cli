import { rm } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Deletes the generated dev plugin store so the next `serve`/`npm run ts:ui`
 * initializes it from the freshly built `dist/ts/plugins`.
 *
 * This is needed after changing plugin manifests/UI entries because the store
 * marker otherwise keeps stale package copies around.
 */
const pluginStoreRoot = resolve("dist/ts/plugin-store");
await rm(pluginStoreRoot, { recursive: true, force: true });
console.log(`[refresh-plugin-store] removed ${pluginStoreRoot}`);
