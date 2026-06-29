import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Sha3_256 } from "../src/sha3-256.js";

const text_encoder = new TextEncoder();

const wasm_bytes = await readFile(
	new URL("../lib/sha3-256.wasm", import.meta.url),
);
const wasm_url = `data:application/wasm;base64,${Buffer.from(
	wasm_bytes,
).toString("base64")}`;
const sha3_256 = await new Sha3_256().initialize(wasm_url);

const SHA3_256_EMPTY =
	"a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a";
const SHA3_256_ABC =
	"3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532";
const SHA3_256_10000_INCREMENTING =
	"27969a61a345750042b4e11d71534447a36c463f7e6dfdf66aea21a2f847dde4";
const SHA3_256_BYTES_1_2_3_4 =
	"966dbdcbd0e0348faa1ccbce5a62b8e73b0d08955d666db82243b303d9bd9502";
const SHA3_256_AB =
	"5c828b33397f4762922e39a60c35699d2550466a52dd15ed44da37eb0bdc61e6";
const SHA3_256_AC =
	"c308c11c84bc9cdccc9832e3ef15fc2285bcfff0867949aa4bf03a203eee52d7";

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
 * @param {Uint8Array} input
 * @param {string} expected_hex
 */
function assert_digest_hex(input, expected_hex) {
	assert.equal(
		hex_from_bytes(sha3_256.reset().update(input).digest()),
		expected_hex,
	);
}

test("sha3-256.js has no Node-only imports or Buffer dependency", async (_t) => {
	const source = await readFile(
		new URL("../src/sha3-256.js", import.meta.url),
		"utf8",
	);
	assert(!source.includes("node:"));
	assert(!/\bBuffer\b/.test(source));
	assert(!source.includes("Transform"));
	assert(!source.includes("readFileSync"));
});

test("sha3-256.js only exports Sha3_256", async (_t) => {
	const fresh = await import(`../src/sha3-256.js?exports=${Date.now()}`);
	assert.deepEqual(Object.keys(fresh), ["Sha3_256"]);
});

test("methods throw before initialize has initialized a WASM instance", (_t) => {
	assert.throws(
		() => new Sha3_256().update(new Uint8Array()),
		/not been initialized/,
	);
	assert.throws(() => new Sha3_256().digest(), /not been initialized/);
	assert.throws(() => new Sha3_256().reset(), /not been initialized/);
});

test("Sha3_256 exposes its algorithm name", (_t) => {
	assert.equal(sha3_256.algorithm, "sha3-256");
});

test("Sha3_256 initializes from a precompiled WebAssembly.Module", async (_t) => {
	const wasm_module = await WebAssembly.compile(wasm_bytes);
	const sha3_256_from_module = await new Sha3_256().initialize(wasm_module);
	assert.equal(
		hex_from_bytes(
			sha3_256_from_module.update(text_encoder.encode("abc")).digest(),
		),
		SHA3_256_ABC,
	);
});

test("Sha3_256 hashes abc", (_t) => {
	assert.equal(
		hex_from_bytes(
			sha3_256.reset().update(text_encoder.encode("abc")).digest(),
		),
		SHA3_256_ABC,
	);
});

test("Sha3_256 matches hard-coded digests for empty and long inputs", (_t) => {
	assert.equal(hex_from_bytes(sha3_256.reset().digest()), SHA3_256_EMPTY);

	const input = new Uint8Array(10_000);
	for (let i = 0; i < input.length; i++) {
		input[i] = i & 0xff;
	}
	assert_digest_hex(input, SHA3_256_10000_INCREMENTING);
});

test("update supports chunked Uint8Array updates", (_t) => {
	const a = text_encoder.encode("a");
	const b = text_encoder.encode("b");
	const c = text_encoder.encode("c");
	const hash = sha3_256.reset();
	assert.equal(hash.update(a), hash);
	hash.update(b);
	hash.update(c);
	assert.equal(hex_from_bytes(hash.digest()), SHA3_256_ABC);
});

test("update accepts Buffer as a Uint8Array subclass in Node", (_t) => {
	const input = Buffer.from([1, 2, 3, 4]);
	assert(input instanceof Uint8Array);
	assert_digest_hex(input, SHA3_256_BYTES_1_2_3_4);
});

test("digest returns a fresh Uint8Array", (_t) => {
	const input = text_encoder.encode("abc");
	const digest = sha3_256.reset().update(input).digest();
	assert(digest instanceof Uint8Array);
	assert(!(digest instanceof Buffer));
	assert.equal(hex_from_bytes(digest), SHA3_256_ABC);
});

test("reset reuses the instance for a new message", (_t) => {
	const abc = text_encoder.encode("abc");
	assert.equal(
		hex_from_bytes(sha3_256.reset().update(abc).digest()),
		SHA3_256_ABC,
	);
	// Without reset the instance is finalized and refuses further updates.
	assert.equal(
		hex_from_bytes(sha3_256.reset().update(abc).digest()),
		SHA3_256_ABC,
	);
});

test("getState/setState fork a shared prefix sequentially", (_t) => {
	const a = text_encoder.encode("a");
	const b = text_encoder.encode("b");
	const c = text_encoder.encode("c");

	const hash = sha3_256.reset().update(a);
	const snapshot = hash.getState();

	assert.equal(hex_from_bytes(hash.update(b).digest()), SHA3_256_AB);

	hash.setState(snapshot);
	assert.equal(hex_from_bytes(hash.update(c).digest()), SHA3_256_AC);
});

test("getState snapshot is portable to another instance across a block boundary", async (_t) => {
	const input = new Uint8Array(10_000);
	for (let i = 0; i < input.length; i++) {
		input[i] = i & 0xff;
	}
	const head = input.subarray(0, 5000);
	const tail = input.subarray(5000);

	const snapshot = sha3_256.reset().update(head).getState();
	const resumed = await new Sha3_256().initialize(wasm_url);
	assert.equal(
		hex_from_bytes(resumed.setState(snapshot).update(tail).digest()),
		SHA3_256_10000_INCREMENTING,
	);
});

test("setState rejects malformed snapshots", (_t) => {
	assert.throws(() => sha3_256.setState(new Uint8Array(8)), TypeError);
	assert.throws(
		() => sha3_256.setState(/** @type {never} */ ("nope")),
		TypeError,
	);
	const bad = new Uint8Array(400); // 200 state + 1 length + 199 pending
	bad[200] = 199; // pendingLength >= RATE_BYTES
	assert.throws(() => sha3_256.setState(bad), /Invalid SHA3-256 state/);
});

test("update throws clear errors for non-Uint8Array and finalized usage", (_t) => {
	assert.throws(
		() => sha3_256.reset().update(/** @type {never} */ ("abc")),
		TypeError,
	);
	assert.throws(
		() =>
			sha3_256
				.reset()
				.update(/** @type {never} */ (new DataView(new ArrayBuffer(1)))),
		TypeError,
	);

	const hash = sha3_256.reset();
	hash.update(text_encoder.encode("abc"));
	hash.digest();
	assert.throws(() => hash.digest(), /Digest already called/);
	assert.throws(() => hash.update(new Uint8Array([1])), /digest\(\)/);
});
