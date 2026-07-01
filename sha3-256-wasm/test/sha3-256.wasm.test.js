import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const DATA_OFFSET = 392;
const STATE_BYTES = 200;
const DIGEST_BYTES = 32;
const MEMORY_BYTES = 1024 * 1024;

const wasm_bytes = await readFile(
	new URL("../lib/sha3-256.wasm", import.meta.url),
);
const sha3_256_wasm_module = await WebAssembly.compile(wasm_bytes);

/**
 * @typedef {{
 *   memory: WebAssembly.Memory,
 *   absorb: (m: number) => void,
 * }} Sha3_256Exports
 */

/**
 * @returns {Promise<Sha3_256Exports>}
 */
async function instantiate_sha3_256() {
	const { exports } = await WebAssembly.instantiate(sha3_256_wasm_module);
	return /** @type {Sha3_256Exports} */ (exports);
}

/**
 * @param {string} hex
 * @returns {Uint8Array}
 */
function bytes_from_hex(hex) {
	assert.equal(hex.length % 2, 0);
	const bytes = new Uint8Array(hex.length / 2);
	for (let index = 0; index < bytes.length; index++) {
		bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
	}
	return bytes;
}

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
 * @param {string} padded_input_hex
 * @returns {Promise<Uint8Array>}
 */
async function run_sha3_256_padded(padded_input_hex) {
	const exports = await instantiate_sha3_256();
	const memory = new Uint8Array(exports.memory.buffer);
	const padded_input = bytes_from_hex(padded_input_hex);
	memory.fill(0, 0, STATE_BYTES);
	memory.set(padded_input, DATA_OFFSET);
	exports.absorb(padded_input.length);
	return memory.slice(0, DIGEST_BYTES);
}

/** @type {readonly { name: string, inputHex: string, expectedHex: string }[]} */
const SHA3_256_CASES = Object.freeze([
	{
		name: "empty padded input",
		inputHex: `06${"00".repeat(134)}80`,
		expectedHex:
			"a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a",
	},
	{
		name: "abc padded input",
		inputHex: `61626306${"00".repeat(131)}80`,
		expectedHex:
			"3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532",
	},
	{
		name: "rate minus one padding",
		inputHex: `${"33".repeat(135)}86`,
		expectedHex:
			"f2975f130c63461ae4a013a39200a51a6ef351f1eb315dfac3a514eca4d71313",
	},
	{
		name: "exact rate padding",
		inputHex: `${"44".repeat(136)}06${"00".repeat(134)}80`,
		expectedHex:
			"83d50be7f820c7c739b4af781132703a1bc5f3b52b716cea9a09d555c79dfe18",
	},
	{
		name: "200-byte padded input",
		inputHex: `${"a3".repeat(200)}06${"00".repeat(70)}80`,
		expectedHex:
			"79f38adec5c20307a98ef76e8324afbfd46cfd81b22e3973c65fa1bd9de31787",
	},
]);

test("SHA3-256 WASM memory is at least 1MiB", async (_t) => {
	const exports = await instantiate_sha3_256();
	assert(exports.memory.buffer.byteLength >= MEMORY_BYTES);
});

test("SHA3-256 WASM only exports absorb and memory", async (_t) => {
	const exports = await instantiate_sha3_256();
	assert.deepEqual(Object.keys(exports).sort(), ["absorb", "memory"]);
});

for (const sha3_256_case of SHA3_256_CASES) {
	test(`SHA3-256 WASM ${sha3_256_case.name}`, async (_t) => {
		const output = await run_sha3_256_padded(sha3_256_case.inputHex);
		assert.equal(hex_from_bytes(output), sha3_256_case.expectedHex);
	});
}

test("SHA3-256 WASM traps on nonmultiple input", async (_t) => {
	const exports = await instantiate_sha3_256();
	assert.throws(() => exports.absorb(1), WebAssembly.RuntimeError);
});

test("SHA3-256 WASM traps on absorb overflow", async (_t) => {
	const exports = await instantiate_sha3_256();
	assert.throws(
		() => exports.absorb(MEMORY_BYTES - DATA_OFFSET + 1),
		WebAssembly.RuntimeError,
	);
});
