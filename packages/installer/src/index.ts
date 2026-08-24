export { nataliaLockSchema } from "@natalia/contracts";
export type { NataliaLock } from "@natalia/contracts";
export {
  loadNataliaLock,
  pluginClosurePaths,
  saveNataliaLock,
  type PackageManagerRun,
} from "./closure";
export { listInstalledPlugins, type PluginCatalogRow } from "./catalog";
export { installPlugin, setPluginEnabled, uninstallPlugin } from "./lifecycle";
export {
  doctorPlugins,
  reconcilePlugins,
  type PluginDoctorFinding,
} from "./maintenance";
