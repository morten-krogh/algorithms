import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const DATA_OFFSET = 392;
const STATE_BYTES = 200;
const DIGEST_BYTES = 64;
const MEMORY_BYTES = 1024 * 1024;

const wasm_bytes = await readFile(new URL("../lib/sha3_512.wasm", import.meta.url));
const sha3_512_wasm_module = await WebAssembly.compile(wasm_bytes);

/**
 * @typedef {{
 *   memory: WebAssembly.Memory,
 *   absorb: (m: number) => void,
 * }} Sha3_512Exports
 */

/**
 * @returns {Promise<Sha3_512Exports>}
 */
async function instantiate_sha3_512() {
	const { exports } = await WebAssembly.instantiate(sha3_512_wasm_module);
	return /** @type {Sha3_512Exports} */ (exports);
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
async function run_sha3_512_padded(padded_input_hex) {
	const exports = await instantiate_sha3_512();
	const memory = new Uint8Array(exports.memory.buffer);
	const padded_input = bytes_from_hex(padded_input_hex);
	memory.fill(0, 0, STATE_BYTES);
	memory.set(padded_input, DATA_OFFSET);
	exports.absorb(padded_input.length);
	return memory.slice(0, DIGEST_BYTES);
}

/** @type {readonly { name: string, inputHex: string, expectedHex: string }[]} */
const SHA3_512_CASES = Object.freeze([
	{
		name: "empty padded input",
		inputHex: `06${"00".repeat(70)}80`,
		expectedHex:
			"a69f73cca23a9ac5c8b567dc185a756e97c982164fe25859e0d1dcc1475c80" +
			"a615b2123af1f5f94c11e3e9402c3ac558f500199d95b6d3e301758586281dcd26",
	},
	{
		name: "abc padded input",
		inputHex: `61626306${"00".repeat(67)}80`,
		expectedHex:
			"b751850b1a57168a5693cd924b6b096e08f621827444f70d884f5d0240d271" +
			"2e10e116e9192af3c91a7ec57647e3934057340b4cf408d5a56592f8274eec53f0",
	},
	{
		name: "rate minus one padding",
		inputHex: `${"33".repeat(71)}86`,
		expectedHex:
			"8306c0772ad8ae9606d33fb693bdd88c2abb4f287a3590038fb5c19cbc4ac00d" +
			"7dee1837f6c3f49d8b2d54916a3ef41094a458cd21e264c448ec0b5a4389f8bf",
	},
	{
		name: "exact rate padding",
		inputHex: `${"44".repeat(72)}06${"00".repeat(70)}80`,
		expectedHex:
			"1d806c7830d8b5e71f1f4ca14310ac4e8ae233e65fccdc55019ac87bc19455ed" +
			"4c7dbab1c9628ff939d7f46bbd8938936eb5da28016034cd19b49963d5ab636f",
	},
	{
		name: "200-byte padded input",
		inputHex: `${"a3".repeat(200)}06${"00".repeat(14)}80`,
		expectedHex:
			"e76dfad22084a8b1467fcf2ffa58361bec7628edf5f3fdc0e4805dc48caeeca8" +
			"1b7c13c30adf52a3659584739a2df46be589c51ca1a4a8416df6545a1ce8ba00",
	},
]);

test("SHA3-512 WASM memory is at least 1MiB", async (_t) => {
	const exports = await instantiate_sha3_512();
	assert(exports.memory.buffer.byteLength >= MEMORY_BYTES);
});

test("SHA3-512 WASM only exports absorb and memory", async (_t) => {
	const exports = await instantiate_sha3_512();
	assert.deepEqual(Object.keys(exports).sort(), ["absorb", "memory"]);
});

for (const sha3_512_case of SHA3_512_CASES) {
	test(`SHA3-512 WASM ${sha3_512_case.name}`, async (_t) => {
		const output = await run_sha3_512_padded(sha3_512_case.inputHex);
		assert.equal(hex_from_bytes(output), sha3_512_case.expectedHex);
	});
}

test("SHA3-512 WASM traps on nonmultiple input", async (_t) => {
	const exports = await instantiate_sha3_512();
	assert.throws(() => exports.absorb(1), WebAssembly.RuntimeError);
});

test("SHA3-512 WASM traps on absorb overflow", async (_t) => {
	const exports = await instantiate_sha3_512();
	assert.throws(
		() => exports.absorb(MEMORY_BYTES - DATA_OFFSET + 1),
		WebAssembly.RuntimeError,
	);
});
