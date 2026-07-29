import { expect, test } from "bun:test";
import {
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

test("parseSettingsRecord", () => {
  expect(parseSettingsRecord('{"a":1,"b":"x"}')).toEqual({ a: 1, b: "x" });
  expect(parseSettingsRecord("invalid")).toBeUndefined();
  expect(parseSettingsRecord('"str"')).toBeUndefined();
});
