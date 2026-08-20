import { expect, test } from "bun:test";
import {
  parseCompactionThreshold,
  parseSettingsStringRecord,
  parseSettingsRecord,
} from "../src/app/settings-utils";

test("parseSettingsStringRecord", () => {
  expect(parseSettingsStringRecord('{"a":"x","b":"y"}')).toEqual({
    a: "x",
    b: "y",
  });
  expect(parseSettingsStringRecord('{"a":1}')).toBeUndefined();
  expect(parseSettingsStringRecord("invalid")).toBeUndefined();
  expect(parseSettingsStringRecord("null")).toBeUndefined();
});

test("parseCompactionThreshold accepts only integer percentages from 50 to 99", () => {
  expect(parseCompactionThreshold("50")).toBe(50);
  expect(parseCompactionThreshold(" 85 ")).toBe(85);
  expect(parseCompactionThreshold("99")).toBe(99);
  expect(parseCompactionThreshold("49")).toBeUndefined();
  expect(parseCompactionThreshold("100")).toBeUndefined();
  expect(parseCompactionThreshold("85.5")).toBeUndefined();
  expect(parseCompactionThreshold("invalid")).toBeUndefined();
});

test("parseSettingsRecord", () => {
  expect(parseSettingsRecord('{"a":1,"b":"x"}')).toEqual({ a: 1, b: "x" });
  expect(parseSettingsRecord("invalid")).toBeUndefined();
  expect(parseSettingsRecord('"str"')).toBeUndefined();
});
