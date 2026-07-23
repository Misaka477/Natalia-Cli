import { expect, test } from "bun:test";
import {
  diagnosticsSummary,
  formatDiagnosticsReport,
} from "../src/dialog/DialogLayer";

test("diagnostics dialog report formats only recorded safe diagnostic fields", () => {
  expect(
    formatDiagnosticsReport([
      {
        type: "diagnostic",
        level: "warning",
        message: "provider is unavailable",
        at: "2026-07-23T00:00:00.000Z",
      },
    ]),
  ).toBe("2026-07-23T00:00:00.000Z WARNING provider is unavailable");
});

test("diagnostics dialog summary retains each severity count", () => {
  expect(
    diagnosticsSummary([
      {
        type: "diagnostic",
        level: "info",
        message: "ready",
        at: "2026-07-23T00:00:00.000Z",
      },
      {
        type: "diagnostic",
        level: "warning",
        message: "retrying",
        at: "2026-07-23T00:00:01.000Z",
      },
      {
        type: "diagnostic",
        level: "error",
        message: "failed",
        at: "2026-07-23T00:00:02.000Z",
      },
    ]),
  ).toEqual({ info: 1, warning: 1, error: 1 });
});
