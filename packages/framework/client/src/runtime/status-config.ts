/** The resolved context window status carried by the runtime and each exec. */
export type RuntimeContextStatusConfig = {
  max: number;
  thresholdPercent: number;
  reserved: number;
};
