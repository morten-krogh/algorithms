import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const DATA_OFFSET = 392;
const RATE_BYTES = 136;
const MEMORY_BYTES = 1024 * 1024;
// One squeeze() call may emit at most this many whole rate blocks.
const MAX_BLOCKS = Math.floor((MEMORY_BYTES - DATA_OFFSET) / RATE_BYTES);

const wasm_bytes = await readFile(
	new URL("../lib/shake-256.wasm", import.meta.url),
);
const shake256_wasm_module = await WebAssembly.compile(wasm_bytes);

/**
 * @typedef {{
 *   memory: WebAssembly.Memory,
 *   absorb: (m: number) => void,
 *   squeeze: (num_blocks: number) => void,
 * }} Shake256Exports
 */

/**
 * @returns {Promise<Shake256Exports>}
 */
async function instantiate_shake256() {
	const { exports } = await WebAssembly.instantiate(shake256_wasm_module);
	return /** @type {Shake256Exports} */ (exports);
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
 * Absorb already-padded input, squeeze `num_blocks` rate blocks, and return the
 * produced output (written by the wasm at DATA_OFFSET).
 * @param {string} padded_input_hex
 * @param {number} num_blocks
 * @returns {Promise<Uint8Array>}
 */
async function run_shake256(padded_input_hex, num_blocks) {
	const exports = await instantiate_shake256();
	const memory = new Uint8Array(exports.memory.buffer);
	const padded_input = bytes_from_hex(padded_input_hex);
	memory.set(padded_input, DATA_OFFSET);
	exports.absorb(padded_input.length);
	exports.squeeze(num_blocks);
	return memory.slice(DATA_OFFSET, DATA_OFFSET + num_blocks * RATE_BYTES);
}

const SHAKE256_EMPTY_64 =
	"46b9dd2b0ba88d13233b3feb743eeb243fcd52ea62b81b82b50c27646ed5762f" +
	"d75dc4ddd8c0f200cb05019d67b592f6fc821c49479ab48640292eacb3b7c4be";
const SHAKE256_A3_200_64 =
	"cd8a920ed141aa0407a22d59288652e9d9f1a7ee0c1e7c1ca699424da84a904d" +
	"2d700caae7396ece96604440577da4f3aa22aeb8857f961c4cd8e06f0ae6610b";

// SHAKE padding: 0x1f domain suffix, zero fill, 0x80 in the last rate byte.
const EMPTY_PADDED = `1f${"00".repeat(RATE_BYTES - 2)}80`;
const A3_200_PADDED = `${"a3".repeat(200)}1f${"00".repeat(70)}80`;

test("SHAKE256 WASM memory is at least 1MiB", async (_t) => {
	const exports = await instantiate_shake256();
	assert(exports.memory.buffer.byteLength >= MEMORY_BYTES);
});

test("SHAKE256 WASM only exports absorb, squeeze and memory", async (_t) => {
	const exports = await instantiate_shake256();
	assert.deepEqual(Object.keys(exports).sort(), [
		"absorb",
		"memory",
		"squeeze",
	]);
});

test("SHAKE256 WASM empty input, first 64 output bytes", async (_t) => {
	const output = await run_shake256(EMPTY_PADDED, 1);
	assert.equal(hex_from_bytes(output.subarray(0, 64)), SHAKE256_EMPTY_64);
});

test("SHAKE256 WASM 200-byte input, first 64 output bytes", async (_t) => {
	const output = await run_shake256(A3_200_PADDED, 1);
	assert.equal(hex_from_bytes(output.subarray(0, 64)), SHAKE256_A3_200_64);
});

test("SHAKE256 WASM squeeze loop produces multiple blocks", async (_t) => {
	// Two rate blocks (272 bytes) cross the squeeze permutation boundary.
	const output = await run_shake256(EMPTY_PADDED, 2);
	const expected = createHash("shake256", { outputLength: 2 * RATE_BYTES })
		.update(new Uint8Array(0))
		.digest("hex");
	assert.equal(hex_from_bytes(output), expected);
});

test("SHAKE256 WASM traps on nonmultiple absorb input", async (_t) => {
	const exports = await instantiate_shake256();
	assert.throws(() => exports.absorb(1), WebAssembly.RuntimeError);
});

test("SHAKE256 WASM traps when squeeze output overflows memory", async (_t) => {
	const exports = await instantiate_shake256();
	assert.throws(
		() => exports.squeeze(MAX_BLOCKS + 1),
		WebAssembly.RuntimeError,
	);
});
