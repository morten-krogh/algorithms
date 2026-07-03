import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MEMORY_BYTES = 64 * 1024;
const WORDS_PER_BLOCK = 4;
const MAX_WASM_BLOCKS = 4096;
const M0 = 0xd2511f53n;
const M1 = 0xcd9e8d57n;
const W0 = 0x9e3779b9;
const W1 = 0xbb67ae85;
const U32_MASK = 0xffffffffn;

const wasm_bytes = await readFile(
	new URL("../lib/philox-4x32.wasm", import.meta.url),
);
const philox4x32_wasm_module = await WebAssembly.compile(wasm_bytes);

/**
 * @typedef {{
 *   memory: WebAssembly.Memory,
 *   fill: (
 *     blocks: number,
 *     c0: number,
 *     c1: number,
 *     c2: number,
 *     c3: number,
 *     k0: number,
 *     k1: number,
 *   ) => void,
 * }} Philox4x32Exports
 */

/**
 * @returns {Promise<Philox4x32Exports>}
 */
async function instantiate_philox4x32() {
	const { exports } = await WebAssembly.instantiate(philox4x32_wasm_module);
	return /** @type {Philox4x32Exports} */ (exports);
}

/**
 * @param {number} value
 * @returns {number}
 */
function u32(value) {
	return value >>> 0;
}

/**
 * @param {number} a
 * @param {number} b
 * @returns {[number, number]}
 */
function mulhilo(a, b) {
	const product = BigInt(u32(a)) * BigInt(u32(b));
	return [
		Number((product >> 32n) & U32_MASK) >>> 0,
		Number(product & U32_MASK) >>> 0,
	];
}

/**
 * @param {readonly number[]} counter
 * @param {readonly number[]} key
 * @returns {number[]}
 */
function philox4x32(counter, key) {
	let x0 = u32(counter[0] ?? 0);
	let x1 = u32(counter[1] ?? 0);
	let x2 = u32(counter[2] ?? 0);
	let x3 = u32(counter[3] ?? 0);
	let k0 = u32(key[0] ?? 0);
	let k1 = u32(key[1] ?? 0);

	for (let round = 0; round < 10; round++) {
		const [hi0, lo0] = mulhilo(Number(M0), x0);
		const [hi1, lo1] = mulhilo(Number(M1), x2);
		const n0 = u32(hi1 ^ x1 ^ k0);
		const n1 = lo1;
		const n2 = u32(hi0 ^ x3 ^ k1);
		const n3 = lo0;
		x0 = n0;
		x1 = n1;
		x2 = n2;
		x3 = n3;
		k0 = u32(k0 + W0);
		k1 = u32(k1 + W1);
	}

	return [x0, x1, x2, x3];
}

/**
 * @param {WebAssembly.Memory} memory
 * @param {number} words
 * @returns {number[]}
 */
function read_words(memory, words) {
	const view = new DataView(memory.buffer);
	const result = [];
	for (let index = 0; index < words; index++) {
		result.push(view.getUint32(index * 4, true));
	}
	return result;
}

/**
 * Random123 tests/kat_vectors Philox4x32-10 known answers.
 * @type {readonly { name: string, counter: number[], key: number[], expected: number[] }[]}
 */
const PHILOX4X32_10_KAT_VECTORS = Object.freeze([
	{
		name: "zero counter and key",
		counter: [0x00000000, 0x00000000, 0x00000000, 0x00000000],
		key: [0x00000000, 0x00000000],
		expected: [0x6627e8d5, 0xe169c58d, 0xbc57ac4c, 0x9b00dbd8],
	},
	{
		name: "max counter and key",
		counter: [0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff],
		key: [0xffffffff, 0xffffffff],
		expected: [0x408f276d, 0x41c83b0e, 0xa20bc7c6, 0x6d5451fd],
	},
	{
		name: "pi digits counter and key",
		counter: [0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344],
		key: [0xa4093822, 0x299f31d0],
		expected: [0xd16cfe09, 0x94fdcceb, 0x5001e420, 0x24126ea1],
	},
]);

test("Philox4x32 WASM memory is at least 64KiB", async (_t) => {
	const exports = await instantiate_philox4x32();
	assert(exports.memory.buffer.byteLength >= MEMORY_BYTES);
});

test("Philox4x32 WASM only exports fill and memory", async (_t) => {
	const exports = await instantiate_philox4x32();
	assert.deepEqual(Object.keys(exports).sort(), ["fill", "memory"]);
});

for (const kat of PHILOX4X32_10_KAT_VECTORS) {
	test(`Philox4x32 WASM ${kat.name}`, async (_t) => {
		const exports = await instantiate_philox4x32();
		exports.fill(
			1,
			kat.counter[0] ?? 0,
			kat.counter[1] ?? 0,
			kat.counter[2] ?? 0,
			kat.counter[3] ?? 0,
			kat.key[0] ?? 0,
			kat.key[1] ?? 0,
		);
		assert.deepEqual(read_words(exports.memory, WORDS_PER_BLOCK), kat.expected);
	});
}

test("Philox4x32 WASM leaves memory unchanged for zero blocks", async (_t) => {
	const exports = await instantiate_philox4x32();
	new DataView(exports.memory.buffer).setUint32(0, 0xdeadbeef, true);
	exports.fill(0, 0, 0, 0, 0, 0, 0);
	assert.deepEqual(read_words(exports.memory, 1), [0xdeadbeef]);
});

test("Philox4x32 WASM increments the counter with carry across blocks", async (_t) => {
	const exports = await instantiate_philox4x32();
	exports.fill(2, 0xffffffff, 0, 0, 0, 0, 0);
	assert.deepEqual(read_words(exports.memory, WORDS_PER_BLOCK), [
		...philox4x32([0xffffffff, 0, 0, 0], [0, 0]),
	]);
	assert.deepEqual(
		read_words(exports.memory, WORDS_PER_BLOCK * 2).slice(WORDS_PER_BLOCK),
		philox4x32([0, 1, 0, 0], [0, 0]),
	);
});

test("Philox4x32 WASM traps on fill overflow", async (_t) => {
	const exports = await instantiate_philox4x32();
	assert.throws(
		() => exports.fill(MAX_WASM_BLOCKS + 1, 0, 0, 0, 0, 0, 0),
		WebAssembly.RuntimeError,
	);
});
