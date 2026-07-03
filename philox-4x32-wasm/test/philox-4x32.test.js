import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Philox4x32 } from "../src/philox-4x32.js";

const M0 = 0xd2511f53n;
const M1 = 0xcd9e8d57n;
const W0 = 0x9e3779b9;
const W1 = 0xbb67ae85;
const U32_MASK = 0xffffffffn;
const WORDS_PER_BLOCK = 4;

const wasm_bytes = await readFile(
	new URL("../lib/philox-4x32.wasm", import.meta.url),
);
const wasm_url = `data:application/wasm;base64,${Buffer.from(
	wasm_bytes,
).toString("base64")}`;
const philox4x32 = await new Philox4x32().initialize(wasm_url);

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
function philox4x32_reference(counter, key) {
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
 * @param {readonly number[]} counter
 * @param {number} blocks
 * @returns {number[]}
 */
function increment_counter(counter, blocks) {
	const c0 = u32((counter[0] ?? 0) + blocks);
	let c1 = u32(counter[1] ?? 0);
	let c2 = u32(counter[2] ?? 0);
	let c3 = u32(counter[3] ?? 0);
	if (c0 < (counter[0] ?? 0)) {
		c1 = u32(c1 + 1);
		if (c1 === 0) {
			c2 = u32(c2 + 1);
			if (c2 === 0) {
				c3 = u32(c3 + 1);
			}
		}
	}
	return [c0, c1, c2, c3];
}

test("philox-4x32.js has no Node-only imports or Buffer dependency", async (_t) => {
	const source = await readFile(
		new URL("../src/philox-4x32.js", import.meta.url),
		"utf8",
	);
	assert(!source.includes("node:"));
	assert(!/\bBuffer\b/.test(source));
	assert(!source.includes("readFileSync"));
});

test("philox-4x32.js only exports Philox4x32", async (_t) => {
	const fresh = await import(`../src/philox-4x32.js?exports=${Date.now()}`);
	assert.deepEqual(Object.keys(fresh), ["Philox4x32"]);
});

test("methods throw before initialize has initialized a WASM instance", (_t) => {
	const philox = new Philox4x32();
	assert.throws(
		() => philox.generate(new Uint32Array(WORDS_PER_BLOCK), new Uint32Array(2)),
		/not been initialized/,
	);
	assert.throws(
		() =>
			philox.fill(
				new Uint32Array(WORDS_PER_BLOCK),
				new Uint32Array(2),
				new Uint32Array(WORDS_PER_BLOCK),
			),
		/not been initialized/,
	);
});

test("Philox4x32 exposes its algorithm name", (_t) => {
	assert.equal(philox4x32.algorithm, "philox-4x32");
});

test("Philox4x32 initializes from a precompiled WebAssembly.Module", async (_t) => {
	const wasm_module = await WebAssembly.compile(wasm_bytes);
	const from_module = await new Philox4x32().initialize(wasm_module);
	assert.deepEqual(
		Array.from(
			from_module.generate(
				new Uint32Array([0, 0, 0, 0]),
				new Uint32Array([0, 0]),
			),
		),
		[0x6627e8d5, 0xe169c58d, 0xbc57ac4c, 0x9b00dbd8],
	);
});

for (const kat of PHILOX4X32_10_KAT_VECTORS) {
	test(`Philox4x32 generate matches ${kat.name} KAT`, (_t) => {
		assert.deepEqual(
			Array.from(
				philox4x32.generate(
					new Uint32Array(kat.counter),
					new Uint32Array(kat.key),
				),
			),
			kat.expected,
		);
	});
}

test("Philox4x32 fill writes sequential counter blocks", (_t) => {
	const counter = [0xffffffff, 0, 0, 0];
	const key = [0xa4093822, 0x299f31d0];
	const output = philox4x32.fill(
		new Uint32Array(counter),
		new Uint32Array(key),
		new Uint32Array(WORDS_PER_BLOCK * 3),
	);
	const expected = [
		...philox4x32_reference(counter, key),
		...philox4x32_reference(increment_counter(counter, 1), key),
		...philox4x32_reference(increment_counter(counter, 2), key),
	];
	assert.deepEqual(Array.from(output), expected);
});

test("Philox4x32 fill chunks outputs larger than raw WASM memory", (_t) => {
	const counter = new Uint32Array([0xfffffff0, 0xffffffff, 0, 0]);
	const key = new Uint32Array([0, 0]);
	const output = philox4x32.fill(
		counter,
		key,
		new Uint32Array(WORDS_PER_BLOCK * 4098),
	);
	assert.deepEqual(
		Array.from(output.subarray(0, WORDS_PER_BLOCK)),
		philox4x32_reference(Array.from(counter), Array.from(key)),
	);
	assert.deepEqual(
		Array.from(output.subarray(4097 * WORDS_PER_BLOCK, 4098 * WORDS_PER_BLOCK)),
		philox4x32_reference([0x00000ff1, 0, 1, 0], [0, 0]),
	);
});

test("Philox4x32 does not mutate counter or key inputs", (_t) => {
	const counter = new Uint32Array([1, 2, 3, 4]);
	const key = new Uint32Array([5, 6]);
	philox4x32.fill(counter, key, new Uint32Array(WORDS_PER_BLOCK * 2));
	assert.deepEqual(Array.from(counter), [1, 2, 3, 4]);
	assert.deepEqual(Array.from(key), [5, 6]);
});

test("Philox4x32 validates input arrays", (_t) => {
	assert.throws(
		() =>
			philox4x32.generate(
				/** @type {never} */ ([0, 0, 0, 0]),
				new Uint32Array(2),
			),
		TypeError,
	);
	assert.throws(
		() => philox4x32.generate(new Uint32Array(3), new Uint32Array(2)),
		TypeError,
	);
	assert.throws(
		() => philox4x32.generate(new Uint32Array(4), new Uint32Array(3)),
		TypeError,
	);
	assert.throws(
		() =>
			philox4x32.generate(
				new Uint32Array(4),
				new Uint32Array(2),
				new Uint32Array(8),
			),
		TypeError,
	);
	assert.throws(
		() =>
			philox4x32.fill(
				new Uint32Array(4),
				new Uint32Array(2),
				/** @type {never} */ ([0, 0, 0, 0]),
			),
		TypeError,
	);
	assert.throws(
		() =>
			philox4x32.fill(
				new Uint32Array(4),
				new Uint32Array(2),
				new Uint32Array(5),
			),
		RangeError,
	);
});
