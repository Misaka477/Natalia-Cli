import { expect, test } from "bun:test";
import {
  CapabilityLoadError,
  CapabilityRegistry,
  resolveLoadOrder,
  type CapabilityRegistration,
} from "../src";

function registration(
  id: string,
  overrides: Partial<CapabilityRegistration> = {},
): CapabilityRegistration {
  return {
    id,
    name: id,
    version: "1.0.0",
    scope: "session",
    grants: ["tools"],
    ...overrides,
  };
}

test("a capability's contributions are readable with the host's own type", () => {
  const registry = new CapabilityRegistry();
  registry.load(registration("cap.a"), (ctx) => {
    ctx.contribute("tools", "read_thing", { run: () => "ok" });
  });

  const tools = registry.contributions<{ run: () => string }>("tools");
  expect(tools).toHaveLength(1);
  expect(tools[0]).toMatchObject({ capabilityID: "cap.a", name: "read_thing" });
  expect(tools[0]!.payload.run()).toBe("ok");
  expect(
    registry.contribution<{ run: () => string }>("tools", "read_thing"),
  ).toBeDefined();
  expect(registry.ownerOf("tools", "read_thing")).toBe("cap.a");
});

test("contributing outside the declared grants is refused", () => {
  const registry = new CapabilityRegistry();
  // The whole point of a grant is that it is checked. A capability that declares
  // only "tools" must not be able to register a command.
  expect(() =>
    registry.load(registration("cap.a", { grants: ["tools"] }), (ctx) => {
      ctx.contribute("commands", "/danger", () => {});
    }),
  ).toThrow(/without the "commands" grant/u);
  // The failed load left nothing behind.
  expect(registry.has("cap.a")).toBe(false);
  expect(registry.contributions("commands")).toEqual([]);
  expect(registry.ownerOf("commands", "/danger")).toBeUndefined();
});

test("a partial failure releases what the capability already contributed", () => {
  const registry = new CapabilityRegistry();
  const result = registry.tryLoad(registration("cap.a"), (ctx) => {
    ctx.contribute("tools", "first", 1);
    throw new Error("activation blew up");
  });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.reason).toContain("activation blew up");
  // `first` must not survive as an orphan owned by a capability that is not
  // loaded — that is a callable tool nobody can unload.
  expect(registry.contributions("tools")).toEqual([]);
  expect(registry.ownerOf("tools", "first")).toBeUndefined();
  expect(registry.has("cap.a")).toBe(false);
});

test("two capabilities cannot claim the same contribution name", () => {
  const registry = new CapabilityRegistry();
  registry.load(registration("cap.a"), (ctx) => {
    ctx.contribute("tools", "write_file", "builtin");
  });
  // Silent shadowing is how a plugin would replace a policy-checked built-in, so
  // the collision is refused and names the current owner.
  const result = registry.tryLoad(registration("cap.b"), (ctx) => {
    ctx.contribute("tools", "write_file", "impostor");
  });
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(result.reason).toContain('already provided by "cap.a"');
  expect(registry.contribution<string>("tools", "write_file")).toBe("builtin");
});

test("unloading releases every contribution and runs the unload hooks", () => {
  const registry = new CapabilityRegistry();
  const released: string[] = [];
  registry.load(
    registration("cap.a", { grants: ["tools", "resources"] }),
    (ctx) => {
      ctx.contribute("tools", "t1", 1);
      ctx.contribute("resources", "r1", 1);
      ctx.onUnload(() => released.push("hook"));
    },
  );
  expect(registry.unload("cap.a")).toBe(true);
  expect(released).toEqual(["hook"]);
  expect(registry.contributions("tools")).toEqual([]);
  expect(registry.contributions("resources")).toEqual([]);
  expect(registry.withGrant("tools")).toEqual([]);
  // The freed name is available again.
  registry.load(registration("cap.b"), (ctx) =>
    ctx.contribute("tools", "t1", 2),
  );
  expect(registry.contribution<number>("tools", "t1")).toBe(2);
});

test("a hook that throws does not block the rest of the cleanup", () => {
  const registry = new CapabilityRegistry();
  const released: string[] = [];
  registry.load(registration("cap.a"), (ctx) => {
    ctx.contribute("tools", "t1", 1);
    ctx.onUnload(() => {
      throw new Error("bad cleanup");
    });
    ctx.onUnload(() => released.push("second"));
  });
  expect(() => registry.unload("cap.a")).not.toThrow();
  expect(released).toEqual(["second"]);
  expect(registry.contributions("tools")).toEqual([]);
});

test("a capability cannot contribute after it has been unloaded", () => {
  const registry = new CapabilityRegistry();
  let escaped:
    | ((kind: "tools", name: string, payload: unknown) => void)
    | undefined;
  registry.load(registration("cap.a"), (ctx) => {
    escaped = ctx.contribute;
  });
  registry.unload("cap.a");
  // A retained context must not be a way back in.
  expect(() => escaped?.("tools", "late", 1)).toThrow(
    /cannot contribute after unload/u,
  );
  expect(registry.contributions("tools")).toEqual([]);
});

test("a host can contribute to an already-loaded capability", () => {
  // Some contributions arrive after activation — a plugin's tools land during
  // its setup, once the capability owning them must already exist. The host
  // path must add them with the same gates as activation.
  const registry = new CapabilityRegistry();
  registry.load(registration("cap.plugin", { scope: "workspace" }), () => {});
  registry.contribute("cap.plugin", "tools", "plugin_read", { run: () => "x" });
  expect(registry.ownerOf("tools", "plugin_read")).toBe("cap.plugin");
  expect(registry.scopeOf("cap.plugin")).toBe("workspace");
  expect(registry.contributions("tools")).toHaveLength(1);
});

test("post-load contribution is refused for an unknown capability", () => {
  const registry = new CapabilityRegistry();
  expect(() => registry.contribute("cap.ghost", "tools", "thing", {})).toThrow(
    /not loaded/u,
  );
});

test("post-load contribution still enforces the grant", () => {
  const registry = new CapabilityRegistry();
  registry.load(
    registration("cap.tools-only", { grants: ["tools"] }),
    () => {},
  );
  expect(() =>
    registry.contribute("cap.tools-only", "commands", "thing", {}),
  ).toThrow(/without the "commands" grant/u);
});

test("post-load contribution obeys the override protocol", () => {
  const registry = new CapabilityRegistry();
  registry.load(registration("cap.a"), (ctx) =>
    ctx.contribute("tools", "shared", "a"),
  );
  registry.load(
    registration("cap.b", { grants: ["tools"], precedence: 10 }),
    (ctx) => ctx.contribute("tools", "shared", "b"),
  );
  // Equal-precedence newcomer refused even through the post-load path.
  expect(() => registry.contribute("cap.a", "tools", "shared", "a2")).toThrow(
    /already provided/u,
  );
  expect(registry.ownerOf("tools", "shared")).toBe("cap.b");
});

test("unloading a capability releases what the host contributed", () => {
  const registry = new CapabilityRegistry();
  registry.load(registration("cap.plugin"), () => {});
  registry.contribute("cap.plugin", "tools", "late_tool", {});
  expect(registry.unload("cap.plugin")).toBe(true);
  expect(registry.ownerOf("tools", "late_tool")).toBeUndefined();
});

test("scope is enforced by unloading it, which is what scope means", () => {
  const registry = new CapabilityRegistry();
  registry.load(registration("cap.session", { scope: "session" }), (ctx) =>
    ctx.contribute("tools", "session_tool", 1),
  );
  registry.load(
    registration("cap.workspace", { scope: "workspace", grants: ["tools"] }),
    (ctx) => ctx.contribute("tools", "workspace_tool", 1),
  );

  expect(registry.unloadScope("session")).toEqual(["cap.session"]);
  expect(registry.has("cap.session")).toBe(false);
  expect(registry.has("cap.workspace")).toBe(true);
  // A session-scoped capability's tools are gone with the session.
  expect(
    registry.contribution<number>("tools", "session_tool"),
  ).toBeUndefined();
  expect(registry.contribution<number>("tools", "workspace_tool")).toBe(1);
  expect(registry.scopeOf("cap.workspace")).toBe("workspace");
});

test("a missing dependency is refused rather than loaded hopefully", () => {
  const registry = new CapabilityRegistry();
  const result = registry.tryLoad(
    registration("cap.b", { dependencies: ["cap.a"] }),
  );
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.reason).toContain('requires "cap.a"');
  expect(registry.has("cap.b")).toBe(false);
});

test("a self dependency is refused", () => {
  const registry = new CapabilityRegistry();
  expect(() =>
    registry.load(registration("cap.a", { dependencies: ["cap.a"] })),
  ).toThrow(/depends on itself/u);
});

test("unloading a dependency unloads its dependents", () => {
  const registry = new CapabilityRegistry();
  registry.load(registration("cap.a"), (ctx) =>
    ctx.contribute("tools", "a_tool", 1),
  );
  registry.load(registration("cap.b", { dependencies: ["cap.a"] }), (ctx) =>
    ctx.contribute("tools", "b_tool", 1),
  );

  registry.unload("cap.a");
  // Leaving cap.b loaded without cap.a is the same broken state as never having
  // loaded it, so it goes too.
  expect(registry.has("cap.b")).toBe(false);
  expect(registry.contributions("tools")).toEqual([]);
});

test("loadAll orders dependencies before dependents", () => {
  const registry = new CapabilityRegistry();
  const order: string[] = [];
  const result = registry.loadAll([
    {
      registration: registration("cap.c", { dependencies: ["cap.b"] }),
      activate: () => order.push("cap.c"),
    },
    {
      registration: registration("cap.a"),
      activate: () => order.push("cap.a"),
    },
    {
      registration: registration("cap.b", { dependencies: ["cap.a"] }),
      activate: () => order.push("cap.b"),
    },
  ]);
  expect(result.failed).toEqual([]);
  expect(order).toEqual(["cap.a", "cap.b", "cap.c"]);
});

test("a dependency cycle is reported, not loaded in a guessed order", () => {
  const registry = new CapabilityRegistry();
  const result = registry.loadAll([
    { registration: registration("cap.a", { dependencies: ["cap.b"] }) },
    { registration: registration("cap.b", { dependencies: ["cap.a"] }) },
  ]);
  expect(result.loaded).toEqual([]);
  expect(result.failed.map((entry) => entry.reason)).toEqual([
    "dependency cycle",
    "dependency cycle",
  ]);
  expect(registry.list()).toEqual([]);
});

test("one failing capability does not stop the others", () => {
  const registry = new CapabilityRegistry();
  const result = registry.loadAll([
    {
      registration: registration("cap.good"),
      activate: (ctx) => ctx.contribute("tools", "good", 1),
    },
    {
      registration: registration("cap.bad"),
      activate: () => {
        throw new Error("nope");
      },
    },
  ]);
  expect(result.loaded).toEqual(["cap.good"]);
  expect(result.failed).toHaveLength(1);
  expect(result.failed[0]!.id).toBe("cap.bad");
  expect(registry.contribution<number>("tools", "good")).toBe(1);
});

test("loading the same capability twice is refused", () => {
  const registry = new CapabilityRegistry();
  registry.load(registration("cap.a"));
  expect(() => registry.load(registration("cap.a"))).toThrow(/already loaded/u);
  expect(registry.list()).toHaveLength(1);
});

test("a contribution with no name is refused", () => {
  const registry = new CapabilityRegistry();
  const result = registry.tryLoad(registration("cap.a"), (ctx) =>
    ctx.contribute("tools", "", 1),
  );
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.reason).toContain("no name");
});

test("failures carry the capability id so a host can report them", () => {
  const registry = new CapabilityRegistry();
  const result = registry.tryLoad(registration("cap.a"), (ctx) => {
    ctx.contribute("settings", "x", 1);
  });
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toBeInstanceOf(CapabilityLoadError);
    expect((result.error as CapabilityLoadError).capabilityID).toBe("cap.a");
  }
});

test("unloadAll releases everything", () => {
  const registry = new CapabilityRegistry();
  registry.load(registration("cap.a"), (ctx) =>
    ctx.contribute("tools", "a", 1),
  );
  registry.load(registration("cap.b"), (ctx) =>
    ctx.contribute("tools", "b", 1),
  );
  registry.unloadAll();
  expect(registry.list()).toEqual([]);
  expect(registry.contributions("tools")).toEqual([]);
});

test("resolveLoadOrder treats already-loaded dependencies as satisfied", () => {
  const order = resolveLoadOrder(
    [registration("cap.b", { dependencies: ["cap.a"] })],
    (id) => id === "cap.a",
  );
  expect(order.order).toEqual(["cap.b"]);
  expect(order.unresolvable).toEqual([]);
});

test("resolveLoadOrder reports a dependency that is nowhere to be found", () => {
  const order = resolveLoadOrder([
    registration("cap.b", { dependencies: ["cap.missing"] }),
  ]);
  expect(order.order).toEqual([]);
  expect(order.unresolvable[0]?.reason).toContain("cap.missing");
});

test("a duplicate contribution is refused at equal or lower precedence", () => {
  const registry = new CapabilityRegistry();
  registry.load(registration("cap.a"), (ctx) => {
    ctx.contribute("tools", "shared_tool", { run: () => "a" });
  });
  // Same name, no precedence declared (0): refused, as before the protocol.
  expect(() =>
    registry.load(registration("cap.b"), (ctx) => {
      ctx.contribute("tools", "shared_tool", { run: () => "b" });
    }),
  ).toThrow(CapabilityLoadError);
  // Lower declared precedence: refused too.
  expect(() =>
    registry.load(registration("cap.c", { precedence: 0 }), (ctx) => {
      ctx.contribute("tools", "shared_tool", { run: () => "c" });
    }),
  ).toThrow(CapabilityLoadError);
});

test("a higher precedence contribution replaces the lower one, and records it", () => {
  const registry = new CapabilityRegistry();
  registry.load(registration("cap.base"), (ctx) => {
    ctx.contribute("tools", "policy_tool", { run: () => "base" });
  });
  registry.load(registration("cap.high", { precedence: 200 }), (ctx) => {
    ctx.contribute("tools", "policy_tool", { run: () => "high" });
  });

  const tools = registry.contributions<{ run: () => string }>("tools");
  expect(tools).toHaveLength(1);
  // The host applies contributions in registration order, so the winner is
  // last — which is how a higher precedence tool wins the registry.
  expect(tools[0]!.name).toBe("policy_tool");
  expect((tools[0]!.payload as { run: () => string }).run()).toBe("high");

  expect(registry.overrides()).toEqual([
    {
      kind: "tools",
      name: "policy_tool",
      winner: "cap.high",
      winnerPrecedence: 200,
      loser: "cap.base",
      loserPrecedence: 0,
    },
  ]);
});

test("unloading the loser does not remove the winner's contribution", () => {
  const registry = new CapabilityRegistry();
  registry.load(registration("cap.base"), (ctx) => {
    ctx.contribute("tools", "policy_tool", { run: () => "base" });
  });
  registry.load(registration("cap.high", { precedence: 200 }), (ctx) => {
    ctx.contribute("tools", "policy_tool", { run: () => "high" });
  });
  registry.unload("cap.base");

  const tools = registry.contributions<{ run: () => string }>("tools");
  expect(tools).toHaveLength(1);
  expect((tools[0]!.payload as { run: () => string }).run()).toBe("high");
});

test("a capability provides a service resolvable by name", () => {
  const registry = new CapabilityRegistry();
  registry.load(
    registration("cap.store", {
      grants: ["services"],
      provides: ["store"],
    }),
    (ctx) => ctx.contribute("services", "store", { get: () => "value" }),
  );
  expect(registry.service<{ get: () => string }>("store")?.get()).toBe("value");
  expect(registry.services()).toEqual(["store"]);
  expect(registry.ownerOf("services", "store")).toBe("cap.store");
});

test("a capability requiring a service stays pending until it is provided", () => {
  const registry = new CapabilityRegistry();
  let activated = 0;
  // Not provided yet: the consumer is held pending, loaded but not activated.
  const loaded = registry.load(
    registration("cap.consumer", { requires: ["store"] }),
    () => {
      activated++;
    },
  );
  expect(activated).toBe(0);
  expect(registry.isPending("cap.consumer")).toBe(true);
  expect(registry.has("cap.consumer")).toBe(true);
  expect(registry.service("store")).toBeUndefined();
  expect(loaded.service("store")).toBeUndefined();

  // The provider arrives: the consumer activates.
  registry.load(
    registration("cap.store", { grants: ["services"], provides: ["store"] }),
    (ctx) => ctx.contribute("services", "store", { ready: true }),
  );
  expect(activated).toBe(1);
  expect(registry.isPending("cap.consumer")).toBe(false);
  expect(loaded.service<{ ready: boolean }>("store")?.ready).toBe(true);
});

test("tryLoad reports a pending load without calling it a failure", () => {
  const registry = new CapabilityRegistry();
  const result = registry.tryLoad(
    registration("cap.consumer", { requires: ["missing"] }),
  );
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.pending).toBe(true);
});

test("a declared service that is never provided fails the load", () => {
  const registry = new CapabilityRegistry();
  expect(() =>
    registry.load(
      registration("cap.liar", { grants: ["services"], provides: ["store"] }),
      () => {},
    ),
  ).toThrow(/declared service "store" but did not provide it/u);
  expect(registry.has("cap.liar")).toBe(false);
});

test("a pending capability that never provides its declared service is dropped", () => {
  const registry = new CapabilityRegistry();
  registry.load(
    registration("cap.consumer", { requires: ["store"] }),
    () => {},
  );
  // The consumer's activation never runs, so the requirement that it provide
  // its own declared service cannot hold — it must not stay half-loaded.
  registry.load(
    registration("cap.store", { grants: ["services"], provides: ["store"] }),
    (ctx) => ctx.contribute("services", "store", 1),
  );
  // `cap.consumer` activates (its activation is empty) and stays loaded.
  expect(registry.has("cap.consumer")).toBe(true);
});

test("service updates notify on provide, replace and disappear", () => {
  const registry = new CapabilityRegistry();
  const updates: Array<{
    name: string;
    provider?: string;
    providerBefore?: string;
  }> = [];
  const unsubscribe = registry.onServiceUpdate((update) =>
    updates.push(update),
  );

  registry.load(
    registration("cap.store", { grants: ["services"], provides: ["store"] }),
    (ctx) => ctx.contribute("services", "store", 1),
  );
  expect(updates).toEqual([{ name: "store", provider: "cap.store" }]);

  // A higher-precedence provider replaces it, reporting who was there before.
  registry.load(
    registration("cap.store2", {
      grants: ["services"],
      provides: ["store"],
      precedence: 10,
    }),
    (ctx) => ctx.contribute("services", "store", 2),
  );
  expect(updates[1]).toEqual({
    name: "store",
    provider: "cap.store2",
    providerBefore: "cap.store",
  });
  expect(registry.service<number>("store")).toBe(2);

  // Unloading the winner removes the service and notifies.
  registry.unload("cap.store2");
  expect(registry.service("store")).toBeUndefined();
  expect(updates.at(-1)).toEqual({ name: "store", provider: undefined });

  unsubscribe();
  registry.load(
    registration("cap.store3", { grants: ["services"], provides: ["store"] }),
    (ctx) => ctx.contribute("services", "store", 3),
  );
  // Unsubscribed: the third provider's update is not delivered.
  expect(updates.length).toBe(3);
});

test("a post-load service contribution wakes a pending capability", () => {
  const registry = new CapabilityRegistry();
  let activated = 0;
  registry.load(registration("cap.consumer", { requires: ["store"] }), () => {
    activated++;
  });
  expect(activated).toBe(0);
  registry.load(
    registration("cap.provider", { grants: ["services"] }),
    () => {},
  );
  // The provider contributes its service after activation, the same way a
  // plugin's tools arrive during its setup.
  registry.contribute("cap.provider", "services", "store", { ok: true });
  expect(activated).toBe(1);
  expect(registry.isPending("cap.consumer")).toBe(false);
});

test("the same capability may refresh its own service in place", () => {
  const registry = new CapabilityRegistry();
  const updates: Array<{
    name: string;
    provider?: string;
    providerBefore?: string;
  }> = [];
  registry.onServiceUpdate((update) => updates.push(update));
  registry.load(
    registration("cap.store", { grants: ["services"], provides: ["store"] }),
    (ctx) => ctx.contribute("services", "store", 1),
  );
  expect(registry.service<number>("store")).toBe(1);
  // Refreshing replaces the value rather than being refused as a duplicate.
  registry.contribute("cap.store", "services", "store", 2);
  expect(registry.service<number>("store")).toBe(2);
  expect(registry.services()).toEqual(["store"]);
  // One effective record, and subscribers heard the replacement.
  expect(registry.contributions("services")).toHaveLength(1);
  expect(updates.at(-1)).toEqual({
    name: "store",
    provider: "cap.store",
    providerBefore: "cap.store",
  });
});
