import { beforeAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ObjectStore, rustCas } from "../src";

/**
 * T2 Phase A slice 1 — the Rust CAS proves itself against the TS
 * store in BOTH directions plus the hash oracle: NIST vectors, a live
 * diff against node:crypto across the padding boundaries (64-byte
 * block / 56-rem edge — where hand-written SHA-256 lives or dies), a
 * TS-writes/Rust-reads and Rust-writes/TS-reads round trip through the
 * SAME store dir, and the corrupt-object contract identical on both
 * sides (verify-on-read: the address IS the integrity check).
 */

const sha256 = (content: Buffer | string) =>
  createHash("sha256").update(content).digest("hex");

const PADDING_BOUNDARY_LENGTHS = [
  0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 121, 127, 128, 1000, 4096,
];

beforeAll(async () => {
  await rustCas.ensureBuilt();
});

test("the Rust SHA-256 matches the NIST vectors", () => {
  expect(rustCas.sha256Hex("")).toBe(
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  expect(rustCas.sha256Hex("abc")).toBe(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  expect(
    rustCas.sha256Hex(
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
    ),
  ).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  // the 80-byte input whose padding crosses into a second block
  expect(rustCas.sha256Hex("a".repeat(80))).toBe(sha256("a".repeat(80)));
});

test("the Rust hash live-diffs against node:crypto across padding boundaries", () => {
  let seed = 0x9e3779b9;
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
  for (const length of PADDING_BOUNDARY_LENGTHS) {
    const bytes = Buffer.alloc(length);
    for (let i = 0; i < length; i += 1) bytes[i] = next() & 0xff;
    expect(rustCas.sha256Hex(bytes)).toBe(sha256(bytes));
  }
  // plus pseudo-random sizes to cover unaligned multi-block tails
  for (let round = 0; round < 40; round += 1) {
    const bytes = Buffer.from(
      Array.from({ length: 1 + (next() % 3000) }, () => next() & 0xff),
    );
    expect(rustCas.sha256Hex(bytes)).toBe(sha256(bytes));
  }
});

test("TS writes, Rust reads: identical bytes through one store dir", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-rust-parity-"));
  const storeRoot = join(root, "objects");
  const objects = new ObjectStore(storeRoot);
  const id = await objects.put("written by the TS implementation");
  expect(rustCas.has(storeRoot, id)).toBe(true);
  expect(rustCas.get(storeRoot, id).toString("utf8")).toBe(
    "written by the TS implementation",
  );
  // the shard path both implementations share
  expect(id).toBe(sha256("written by the TS implementation"));
});

test("Rust writes, TS reads: the TS verify-on-read accepts Rust's bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-rust-write-"));
  const storeRoot = join(root, "objects");
  const objects = new ObjectStore(storeRoot);
  const id = rustCas.put(storeRoot, "written by the Rust implementation");
  expect(id).toBe(sha256("written by the Rust implementation"));
  // TS get() runs verify(): a mismatch would throw — this is the parity
  expect((await objects.get(id)).toString("utf8")).toBe(
    "written by the Rust implementation",
  );
  // dedup: a second put is a no-op returning the same id
  expect(rustCas.put(storeRoot, "written by the Rust implementation")).toBe(id);
  // the shard dir honors the same modes the TS store creates
  const shard = await stat(join(storeRoot, id.slice(0, 2)));
  expect(shard.mode & 0o777).toBe(0o700);
});

test("a corrupt object fails identically on both sides (verify-on-read)", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-rust-corrupt-"));
  const storeRoot = join(root, "objects");
  const objects = new ObjectStore(storeRoot);
  const id = await objects.put("honest bytes");
  // rot the content under the address
  await writeFile(join(storeRoot, id.slice(0, 2), id), "rotted bytes!");
  expect(() => objects.get(id)).toThrow(/is corrupt/u);
  expect(() => rustCas.get(storeRoot, id)).toThrow(/is corrupt/u);
  // has() is existence (both sides answer true — put dedups on it too)
  expect(rustCas.has(storeRoot, id)).toBe(true);
});
