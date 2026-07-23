import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const wasmBytes = await readFile(
	new URL("../lib/brotli.wasm", import.meta.url),
);
const wasmModule = await WebAssembly.compile(wasmBytes);

test("raw module validates, has no imports, and exposes only the codec ABI", () => {
	assert(WebAssembly.validate(wasmBytes));
	assert.deepEqual(WebAssembly.Module.imports(wasmModule), []);
	assert.deepEqual(
		WebAssembly.Module.exports(wasmModule)
			.map((entry) => entry.name)
			.sort(),
		[
			"control_ptr",
			"decoder_init",
			"decoder_process",
			"decoder_reset",
			"encoder_init",
			"encoder_process",
			"encoder_reset",
			"memory",
		],
	);
});

test("raw control block advertises aligned 64 KiB transfer buffers", async () => {
	const { exports } = await WebAssembly.instantiate(wasmModule);
	const codec = /** @type {{
	 * memory: WebAssembly.Memory,
	 * control_ptr: () => number,
	 * encoder_init: (...args: number[]) => number,
	 * }} */ (exports);
	assert.equal(codec.encoder_init(4, 22, 0, 0, 0, 0), 1);
	const control = new Int32Array(codec.memory.buffer, codec.control_ptr(), 8);
	assert.equal(control[0], 1);
	assert.equal(control[6], 65_536);
	assert.equal((control[5] ?? 1) & 15, 0);
	assert(
		(control[5] ?? 0) + (control[6] ?? 0) <= codec.memory.buffer.byteLength,
	);
});

test("raw ABI rejects invalid parameters and oversized input", async () => {
	const { exports } = await WebAssembly.instantiate(wasmModule);
	const codec = /** @type {{
	 * memory: WebAssembly.Memory,
	 * control_ptr: () => number,
	 * encoder_init: (...args: number[]) => number,
	 * encoder_process: (operation: number, inputLength: number) => number,
	 * decoder_init: () => number,
	 * decoder_process: (end: number, inputLength: number) => number,
	 * }} */ (exports);
	assert.equal(codec.encoder_init(12, 22, 0, 0, 0, 0), 0);
	let control = new Int32Array(codec.memory.buffer, codec.control_ptr(), 8);
	assert.equal(control[4], -103);

	assert.equal(codec.encoder_init(4, 22, 0, 0, 0, 0), 1);
	assert.equal(codec.encoder_process(0, 65_537), 0);
	control = new Int32Array(codec.memory.buffer, codec.control_ptr(), 8);
	assert.equal(control[4], -101);

	assert.equal(codec.decoder_init(), 1);
	assert.equal(codec.decoder_process(0, 65_537), 0);
	control = new Int32Array(codec.memory.buffer, codec.control_ptr(), 8);
	assert.equal(control[4], -101);
});
