import { expect, test } from "bun:test";
import { buildSkillOptions } from "../src/component/DialogSkill";
import { buildVariantOptions } from "../src/component/DialogVariant";

test("variant dialog includes default and marks the selected variant", () => {
  expect(
    buildVariantOptions(
      {
        id: "alpha",
        name: "Alpha",
        provider: "local",
        variants: ["fast", "careful"],
      },
      "careful",
    ),
  ).toEqual([
    { title: "Default variant", value: "", footer: undefined },
    { title: "fast", value: "fast", footer: undefined },
    { title: "careful", value: "careful", footer: "current" },
  ]);
});

test("skill dialog renders only safe discovery metadata", () => {
  expect(
    buildSkillOptions([
      {
        name: "release",
        qualifiedName: "project:release",
        description: "Prepare\n a release",
        source: "project",
        requireApproval: true,
        sandboxRequired: false,
      },
    ]),
  ).toEqual([
    {
      title: "release",
      value: "release",
      category: "project",
      description: "Prepare a release",
      footer: "approval required",
    },
  ]);
});
