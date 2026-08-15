import { expect, test } from "bun:test";
import { webToolFamily, webTools } from "../src";

test("the web family describes the tools it ships", () => {
  const family = webToolFamily();
  expect(family.id).toBe("web");
  expect(family.scope).toBe("session");
  expect(family.tools).toEqual(webTools);
});

test("web_fetch enforces the network policy before reaching the network", async () => {
  const tool = webToolFamily().tools.find(
    (candidate) => candidate.name === "web_fetch",
  )!;
  await expect(
    tool.execute({ url: "file:///etc/passwd" }, { settings: {} } as never),
  ).rejects.toThrow(/http\(s\)/u);
  await expect(
    tool.execute({ url: "http://localhost:8080" }, {
      settings: { allowLocalhost: false },
    } as never),
  ).rejects.toThrow(/localhost/u);
});

test("web_fetch finalizes fetched content by stripping script blocks", () => {
  const tool = webToolFamily().tools.find(
    (candidate) => candidate.name === "web_fetch",
  )!;
  const content = `<html><script>alert(1)</script><p>hello</p><script type="module">run()</script></html>`;
  const finalized = tool.output!.finalizeContent!(content);
  expect(finalized).not.toContain("alert(1)");
  expect(finalized).not.toContain("run()");
  expect(finalized).toContain("<p>hello</p>");
});
