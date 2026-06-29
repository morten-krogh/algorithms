import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Shake256 } from "../src/shake-256.js";

const text_encoder = new TextEncoder();

const wasm_bytes = await readFile(
	new URL("../lib/shake-256.wasm", import.meta.url),
);
const wasm_url = `data:application/wasm;base64,${Buffer.from(
	wasm_bytes,
).toString("base64")}`;
const shake = await new Shake256().initialize(wasm_url);

// Gold known-answer vectors (SHAKE256, 64-byte output).
const SHAKE256_EMPTY_64 =
	"46b9dd2b0ba88d13233b3feb743eeb243fcd52ea62b81b82b50c27646ed5762f" +
	"d75dc4ddd8c0f200cb05019d67b592f6fc821c49479ab48640292eacb3b7c4be";
const SHAKE256_ABC_64 =
	"483366601360a8771c6863080cc4114d8db44530f8f1e1ee4f94ea37e78b5739" +
	"d5a15bef186a5386c75744c0527e1faa9f8726e462a12a4feb06bd8801e751e4";
const SHAKE256_A3_200_64 =
	"cd8a920ed141aa0407a22d59288652e9d9f1a7ee0c1e7c1ca699424da84a904d" +
	"2d700caae7396ece96604440577da4f3aa22aeb8857f961c4cd8e06f0ae6610b";

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function hex_from_bytes(bytes) {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

/**
 * Reference SHAKE256 output via Node's OpenSSL-backed crypto, used as an oracle
 * for derived/long cases that have no hand-written constant.
 * @param {Uint8Array} input
 * @param {number} outputLength
 * @returns {string}
 */
function oracle_hex(input, outputLength) {
	return createHash("shake256", { outputLength }).update(input).digest("hex");
}

test("shake-256.js has no Node-only imports or Buffer dependency", async (_t) => {
	const source = await readFile(
		new URL("../src/shake-256.js", import.meta.url),
		"utf8",
	);
	assert(!source.includes("node:"));
	assert(!/\bBuffer\b/.test(source));
	assert(!source.includes("Transform"));
	assert(!source.includes("readFileSync"));
});

test("shake-256.js only exports Shake256", async (_t) => {
	const fresh = await import(`../src/shake-256.js?exports=${Date.now()}`);
	assert.deepEqual(Object.keys(fresh), ["Shake256"]);
});

test("methods throw before initialize has initialized a WASM instance", (_t) => {
	assert.throws(
		() => new Shake256().update(new Uint8Array()),
		/not been initialized/,
	);
	assert.throws(() => new Shake256().digest(32), /not been initialized/);
	assert.throws(() => new Shake256().reset(), /not been initialized/);
});

test("Shake256 exposes its algorithm name", (_t) => {
	assert.equal(shake.algorithm, "shake-256");
});

test("Shake256 initializes from a precompiled WebAssembly.Module", async (_t) => {
	const wasm_module = await WebAssembly.compile(wasm_bytes);
	const from_module = await new Shake256().initialize(wasm_module);
	assert.equal(
		hex_from_bytes(from_module.update(text_encoder.encode("abc")).digest(64)),
		SHAKE256_ABC_64,
	);
});

test("Shake256 matches gold known-answer vectors (64-byte output)", (_t) => {
	assert.equal(hex_from_bytes(shake.reset().digest(64)), SHAKE256_EMPTY_64);
	assert.equal(
		hex_from_bytes(shake.reset().update(text_encoder.encode("abc")).digest(64)),
		SHAKE256_ABC_64,
	);
	assert.equal(
		hex_from_bytes(
			shake.reset().update(new Uint8Array(200).fill(0xa3)).digest(64),
		),
		SHAKE256_A3_200_64,
	);
});

test("digest(0) returns an empty Uint8Array", (_t) => {
	const out = shake.reset().update(text_encoder.encode("abc")).digest(0);
	assert(out instanceof Uint8Array);
	assert.equal(out.length, 0);
});

test("digest rejects invalid output lengths", (_t) => {
	assert.throws(
		() => shake.reset().digest(/** @type {never} */ ("32")),
		TypeError,
	);
	assert.throws(() => shake.reset().digest(-1), TypeError);
	assert.throws(() => shake.reset().digest(1.5), TypeError);
});

test("update supports chunked Uint8Array updates", (_t) => {
	const hash = shake.reset();
	hash.update(text_encoder.encode("a"));
	hash.update(text_encoder.encode("b"));
	hash.update(text_encoder.encode("c"));
	assert.equal(hex_from_bytes(hash.digest(64)), SHAKE256_ABC_64);
});

test("digest returns a fresh Uint8Array (not a Buffer)", (_t) => {
	const out = shake.reset().update(text_encoder.encode("abc")).digest(64);
	assert(out instanceof Uint8Array);
	assert(!(out instanceof Buffer));
	assert.equal(hex_from_bytes(out), SHAKE256_ABC_64);
});

test("reset reuses the instance for a new message", (_t) => {
	const abc = text_encoder.encode("abc");
	assert.equal(
		hex_from_bytes(shake.reset().update(abc).digest(64)),
		SHAKE256_ABC_64,
	);
	assert.equal(
		hex_from_bytes(shake.reset().update(abc).digest(64)),
		SHAKE256_ABC_64,
	);
});

test("multi-block squeeze matches the reference (>1 rate block)", (_t) => {
	const abc = text_encoder.encode("abc");
	assert.equal(
		hex_from_bytes(shake.reset().update(abc).digest(400)),
		oracle_hex(abc, 400),
	);
	assert.equal(
		hex_from_bytes(shake.reset().digest(400)),
		oracle_hex(new Uint8Array(0), 400),
	);
});

test("JS outer loop matches the reference for output larger than ~1 MiB", (_t) => {
	// One squeeze() call fills at most floor((1MiB - 392)/136)*136 = 1048152 bytes,
	// so this forces the JS-side loop to call squeeze() more than once.
	const length = 1048152 + 200;
	const abc = text_encoder.encode("abc");
	assert.equal(
		hex_from_bytes(shake.reset().update(abc).digest(length)),
		oracle_hex(abc, length),
	);
});

test("getState/setState fork a shared prefix sequentially", (_t) => {
	const a = text_encoder.encode("a");
	const b = text_encoder.encode("b");
	const c = text_encoder.encode("c");

	const hash = shake.reset().update(a);
	const snapshot = hash.getState();

	assert.equal(
		hex_from_bytes(hash.update(b).digest(64)),
		oracle_hex(text_encoder.encode("ab"), 64),
	);

	hash.setState(snapshot);
	assert.equal(
		hex_from_bytes(hash.update(c).digest(64)),
		oracle_hex(text_encoder.encode("ac"), 64),
	);
});

test("getState snapshot is portable to another instance across a block boundary", async (_t) => {
	const input = new Uint8Array(10_000);
	for (let i = 0; i < input.length; i++) {
		input[i] = i & 0xff;
	}
	const head = input.subarray(0, 5000);
	const tail = input.subarray(5000);

	const snapshot = shake.reset().update(head).getState();
	const resumed = await new Shake256().initialize(wasm_url);
	assert.equal(
		hex_from_bytes(resumed.setState(snapshot).update(tail).digest(64)),
		oracle_hex(input, 64),
	);
});

test("setState rejects malformed snapshots", (_t) => {
	assert.throws(() => shake.setState(new Uint8Array(8)), TypeError);
	assert.throws(() => shake.setState(/** @type {never} */ ("nope")), TypeError);
	const bad = new Uint8Array(400); // 200 state + 1 length + 199 pending
	bad[200] = 199; // pendingLength >= RATE_BYTES
	assert.throws(() => shake.setState(bad), /Invalid SHAKE-256 state/);
});

test("update throws clear errors for non-Uint8Array and finalized usage", (_t) => {
	assert.throws(
		() => shake.reset().update(/** @type {never} */ ("abc")),
		TypeError,
	);
	assert.throws(
		() =>
			shake
				.reset()
				.update(/** @type {never} */ (new DataView(new ArrayBuffer(1)))),
		TypeError,
	);

	const hash = shake.reset();
	hash.update(text_encoder.encode("abc"));
	hash.digest(64);
	assert.throws(() => hash.digest(64), /Digest already called/);
	assert.throws(() => hash.update(new Uint8Array([1])), /digest\(\)/);
});
