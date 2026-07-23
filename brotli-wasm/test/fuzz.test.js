import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";
import { decode, encode } from "./helpers.js";

const wasmBytes = await readFile(
	new URL("../lib/brotli.wasm", import.meta.url),
);
const wasmModule = await WebAssembly.compile(wasmBytes);

let randomState = 0x243f6a88;

/** @returns {number} */
function random_u32() {
	randomState ^= randomState << 13;
	randomState ^= randomState >>> 17;
	randomState ^= randomState << 5;
	return randomState >>> 0;
}

test("deterministic differential fuzz matrix interoperates with Node", async () => {
	for (let iteration = 0; iteration < 64; iteration++) {
		const length = random_u32() % 8193;
		const input = new Uint8Array(length);
		for (let index = 0; index < input.length; index++) {
			input[index] = random_u32() & 0xff;
		}
		// Mix repeated runs into otherwise incompressible inputs.
		if (input.length > 64 && iteration % 3 === 0) {
			const run = 8 + (random_u32() % 57);
			const source = random_u32() % (input.length - run);
			const target = random_u32() % (input.length - run);
			input.copyWithin(target, source, source + run);
		}
		const quality = iteration % 12;
		const chunkSizes = [
			1 + (random_u32() % 31),
			1 + (random_u32() % 257),
			1 + (random_u32() % 4096),
		];

		const wasmCompressed = await encode(
			wasmModule,
			input,
			{ quality, sizeHint: input.length },
			chunkSizes,
		);
		assert(Buffer.from(brotliDecompressSync(wasmCompressed)).equals(input));

		const nodeCompressed = brotliCompressSync(input, {
			params: {
				[constants.BROTLI_PARAM_QUALITY]: quality,
				[constants.BROTLI_PARAM_SIZE_HINT]: input.length,
			},
		});
		const wasmDecoded = await decode(wasmModule, nodeCompressed, chunkSizes);
		assert(Buffer.from(wasmDecoded.output).equals(input));
	}
});
