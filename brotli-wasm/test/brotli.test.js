import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";
import { BrotliDecoder, BrotliEncoder } from "../src/brotli.js";
import {
	concatenate,
	decode,
	drain,
	encode,
	write_chunked,
} from "./helpers.js";

const wasmBytes = await readFile(
	new URL("../lib/brotli.wasm", import.meta.url),
);
const wasmModule = await WebAssembly.compile(wasmBytes);

const textEncoder = new TextEncoder();
const TEXT = textEncoder.encode(
	"WebAssembly makes a good target for a compact streaming Brotli codec. ".repeat(
		800,
	),
);
const BINARY = Uint8Array.from(
	{ length: 131_113 },
	(_, index) => (index * 31 + (index >> 3)) & 0xff,
);

/**
 * @param {Uint8Array} actual
 * @param {Uint8Array} expected
 */
function assert_bytes_equal(actual, expected) {
	assert(Buffer.from(actual).equals(Buffer.from(expected)));
}

test("driver is browser-neutral and only exports the two codec classes", async () => {
	const source = await readFile(
		new URL("../src/brotli.js", import.meta.url),
		"utf8",
	);
	assert(!source.includes("node:"));
	assert(!/\bBuffer\b/.test(source));
	const fresh = await import(`../src/brotli.js?exports=${Date.now()}`);
	assert.deepEqual(Object.keys(fresh).sort(), [
		"BrotliDecoder",
		"BrotliEncoder",
	]);
});

test("methods reject use before initialization", () => {
	const encoder = new BrotliEncoder();
	const decoder = new BrotliDecoder();
	assert.throws(() => encoder.write(new Uint8Array()), /not been initialized/);
	assert.throws(() => encoder.pull(), /not been initialized/);
	assert.throws(() => encoder.flush(), /not been initialized/);
	assert.throws(() => encoder.finish(), /not been initialized/);
	assert.throws(() => encoder.reset(), /not been initialized/);
	assert.throws(() => decoder.write(new Uint8Array()), /not been initialized/);
	assert.throws(() => decoder.finish(), /not been initialized/);
});

test("classes expose the Brotli algorithm name", () => {
	assert.equal(new BrotliEncoder().algorithm, "brotli");
	assert.equal(new BrotliDecoder().algorithm, "brotli");
});

test("initialize accepts a streamed data URL", async () => {
	const url = `data:application/wasm;base64,${Buffer.from(wasmBytes).toString(
		"base64",
	)}`;
	const encoded = await encode(
		await WebAssembly.compile(wasmBytes),
		textEncoder.encode("abc"),
	);
	const decoder = await new BrotliDecoder().initialize(url);
	/** @type {Uint8Array[]} */
	const output = [];
	assert.equal(decoder.write(encoded), encoded.length);
	drain(decoder, output);
	assert(decoder.finish());
	assert.equal(new TextDecoder().decode(concatenate(output)), "abc");
});

for (const quality of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
	test(`quality ${quality} output is accepted by Node`, async () => {
		const compressed = await encode(wasmModule, TEXT, {
			quality,
			sizeHint: TEXT.length,
		});
		assert_bytes_equal(brotliDecompressSync(compressed), TEXT);
	});

	test(`decoder accepts Node quality ${quality} output`, async () => {
		const compressed = brotliCompressSync(TEXT, {
			params: {
				[constants.BROTLI_PARAM_QUALITY]: quality,
				[constants.BROTLI_PARAM_SIZE_HINT]: TEXT.length,
			},
		});
		const result = await decode(wasmModule, compressed);
		assert.equal(result.consumed, compressed.length);
		assert_bytes_equal(result.output, TEXT);
	});
}

test("fast encoder input capacity follows the bounded size hint", async () => {
	const cases = [
		{ quality: 0, sizeHint: 64, inputLength: 100_000, consumed: 65_536 },
		{ quality: 0, sizeHint: 0, inputLength: 300_000, consumed: 262_144 },
		{
			quality: 0,
			sizeHint: 2_000_000,
			inputLength: 1_200_000,
			consumed: 1_048_576,
		},
		{
			quality: 1,
			sizeHint: 300_000,
			inputLength: 400_000,
			consumed: 65_536,
		},
		{
			quality: 4,
			sizeHint: 300_000,
			inputLength: 400_000,
			consumed: 65_536,
		},
	];
	for (const { quality, sizeHint, inputLength, consumed } of cases) {
		const encoder = await new BrotliEncoder().initialize(wasmModule, {
			quality,
			sizeHint,
		});
		assert.equal(encoder.write(new Uint8Array(inputLength)), consumed);
	}
});

test("quality 0 uses one hinted transfer for medium inputs", async () => {
	const input = new Uint8Array(262_144);
	const seed = textEncoder.encode(
		"WebAssembly Brotli compression combines LZ77, Huffman coding, context " +
			"modeling, and a static dictionary for web content. ",
	);
	for (let offset = 0; offset < input.length; offset += seed.length) {
		input.set(seed.subarray(0, input.length - offset), offset);
	}
	const compressed = await encode(
		wasmModule,
		input,
		{
			quality: 0,
			sizeHint: input.length,
		},
		[input.length],
	);
	assert(compressed.length < 300);
	assert_bytes_equal(brotliDecompressSync(compressed), input);
});

for (const mode of ["generic", "text", "font"]) {
	for (const lgwin of [10, 16, 22, 24]) {
		test(`${mode} mode with lgwin ${lgwin} interoperates`, async () => {
			const compressed = await encode(wasmModule, BINARY, {
				quality: 4,
				lgwin,
				mode: /** @type {"generic" | "text" | "font"} */ (mode),
				sizeHint: BINARY.length,
			});
			assert_bytes_equal(brotliDecompressSync(compressed), BINARY);

			const nodeCompressed = brotliCompressSync(BINARY, {
				params: {
					[constants.BROTLI_PARAM_QUALITY]: 6,
					[constants.BROTLI_PARAM_LGWIN]: lgwin,
					[constants.BROTLI_PARAM_MODE]:
						mode === "generic"
							? constants.BROTLI_MODE_GENERIC
							: mode === "text"
								? constants.BROTLI_MODE_TEXT
								: constants.BROTLI_MODE_FONT,
				},
			});
			const decoded = await decode(wasmModule, nodeCompressed);
			assert_bytes_equal(decoded.output, BINARY);
		});
	}
}

test("decoder handles a static-dictionary and transform-heavy stream", async () => {
	const compressed = Buffer.from("1b2400f825000a1861f2095bd0b1332400", "hex");
	const decoded = await decode(wasmModule, compressed, [1]);
	assert.equal(
		new TextDecoder().decode(decoded.output),
		"compression dictionary transformation",
	);
});

test("decoder passes representative official Brotli 1.2.0 corpus vectors", async () => {
	const quickFox = "The quick brown fox jumps over the lazy dog";
	const backward = new Uint8Array(65_792);
	backward.fill(0x58, 256, 65_536);
	const vectors = [
		{
			compressed: "06",
			expected: new Uint8Array(),
		},
		{
			compressed:
				"0b158054686520717569636b2062726f776e20666f78206a756d7073206f" +
				"76657220746865206c617a7920646f6703",
			expected: textEncoder.encode(quickFox),
		},
		{
			compressed:
				"5bffaf02c022795cfb5a8c423bf42555195a9299b135c8199e9e0a7b4b90" +
				"b93c98c80940f3e6d94de46d651b2787135fa6e930967b3c15d8531c",
			expected: textEncoder.encode(quickFox.repeat(4096)),
		},
		{
			compressed: "5bffff036002201e0b28f77e00",
			expected: new Uint8Array(262_144),
		},
		{
			compressed: "5bff0001400a00ab167bac00484e73ed019203",
			expected: backward,
		},
	];
	for (const vector of vectors) {
		const decoded = await decode(
			wasmModule,
			Buffer.from(vector.compressed, "hex"),
			[1, 7, 65_536],
		);
		assert_bytes_equal(decoded.output, vector.expected);
	}
});

test("empty, Buffer, incompressible, and transfer-boundary inputs round trip", async () => {
	const cases = [
		new Uint8Array(),
		Buffer.from([1, 2, 3, 4]),
		Uint8Array.from({ length: 65_537 }, (_, index) => (index * 73) & 0xff),
		BINARY,
	];
	for (const input of cases) {
		const compressed = await encode(
			wasmModule,
			input,
			{ quality: 6 },
			[1, 65_535, 2],
		);
		const decoded = await decode(wasmModule, compressed, [1, 65_536]);
		assert_bytes_equal(decoded.output, input);
	}
});

test("encoder and decoder cross the maximum RFC sliding-window boundary", async () => {
	const input = Uint8Array.from(
		{ length: 16 * 1024 * 1024 + 257 },
		(_, index) => (index * 13 + (index >> 17)) & 0xff,
	);
	const wasmCompressed = await encode(
		wasmModule,
		input,
		{ quality: 1, lgwin: 24, sizeHint: input.length },
		[65_536],
	);
	assert_bytes_equal(brotliDecompressSync(wasmCompressed), input);

	const nodeCompressed = brotliCompressSync(input, {
		params: {
			[constants.BROTLI_PARAM_QUALITY]: 1,
			[constants.BROTLI_PARAM_LGWIN]: 24,
			[constants.BROTLI_PARAM_SIZE_HINT]: input.length,
		},
	});
	const wasmDecoded = await decode(wasmModule, nodeCompressed, [65_536]);
	assert_bytes_equal(wasmDecoded.output, input);
});

test("SIMD match extension preserves mismatches and ring-buffer wraps", async () => {
	const input = new Uint8Array(32_768);
	const seed = Uint8Array.from(
		{ length: 768 },
		(_, index) => (index * 73 + (index >> 3)) & 0xff,
	);
	for (
		let offset = 0, block = 0;
		offset < input.length;
		offset += seed.length
	) {
		input.set(seed.subarray(0, input.length - offset), offset);
		const mismatch = offset + 64 + (block & 15);
		if (mismatch < input.length) {
			input[mismatch] = (input[mismatch] ?? 0) ^ 0x5a;
		}
		block++;
	}

	const expectedHashes = new Map([
		[4, "a74a847a6528b3a15ba2c126d86609ce282dc8c9db9dd03fabcecc52b03cb759"],
		[6, "dda48df8e84df1e90bcd0b8bd8923d0ff6ef6c4519ef759a7232eae9f7b429e9"],
		[11, "601e20d92b9c3213ca975f02869fae2d2ae2a8aec98a3831666ec8b30ad0050e"],
	]);
	for (const [quality, expectedHash] of expectedHashes) {
		const compressed = await encode(
			wasmModule,
			input,
			{ quality, lgwin: 10, sizeHint: input.length },
			[37, 1021, 65_536],
		);
		assert.equal(
			createHash("sha256").update(compressed).digest("hex"),
			expectedHash,
		);
		assert_bytes_equal(brotliDecompressSync(compressed), input);
	}
});

test("flush preserves history and produces one valid stream", async () => {
	const encoder = await new BrotliEncoder().initialize(wasmModule, {
		quality: 4,
	});
	/** @type {Uint8Array[]} */
	const output = [];
	let offset = write_chunked(encoder, TEXT.subarray(0, 10_000), [37], output);
	assert.equal(offset, 10_000);
	while (!encoder.flush()) {
		drain(encoder, output);
	}
	drain(encoder, output);
	offset = write_chunked(encoder, TEXT.subarray(10_000), [4093], output);
	assert.equal(offset, TEXT.length - 10_000);
	while (!encoder.finish()) {
		drain(encoder, output);
	}
	drain(encoder, output);
	assert_bytes_equal(brotliDecompressSync(concatenate(output)), TEXT);
});

test("reset reuses encoder and decoder instances", async () => {
	const encoder = await new BrotliEncoder().initialize(wasmModule, {
		quality: 5,
	});
	const decoder = await new BrotliDecoder().initialize(wasmModule);

	for (const input of [textEncoder.encode("first"), TEXT, BINARY]) {
		/** @type {Uint8Array[]} */
		const compressedParts = [];
		const encodedBytes = write_chunked(encoder, input, [257], compressedParts);
		assert.equal(encodedBytes, input.length);
		while (!encoder.finish()) {
			drain(encoder, compressedParts);
		}
		drain(encoder, compressedParts);

		/** @type {Uint8Array[]} */
		const decodedParts = [];
		const compressed = concatenate(compressedParts);
		const decodedBytes = write_chunked(decoder, compressed, [13], decodedParts);
		assert.equal(decodedBytes, compressed.length);
		while (!decoder.finish()) {
			drain(decoder, decodedParts);
		}
		drain(decoder, decodedParts);
		assert_bytes_equal(concatenate(decodedParts), input);

		encoder.reset();
		decoder.reset();
	}
});

test("decoder leaves trailing bytes unconsumed", async () => {
	const compressed = brotliCompressSync(TEXT);
	const trailing = Uint8Array.of(0xde, 0xad, 0xbe, 0xef);
	const combined = new Uint8Array(compressed.length + trailing.length);
	combined.set(compressed);
	combined.set(trailing, compressed.length);

	const decoder = await new BrotliDecoder().initialize(wasmModule);
	/** @type {Uint8Array[]} */
	const output = [];
	let offset = 0;
	while (!decoder.finished) {
		offset += decoder.write(combined.subarray(offset));
		drain(decoder, output);
	}
	assert.equal(offset, compressed.length);
	assert_bytes_equal(combined.subarray(offset), trailing);
	assert_bytes_equal(concatenate(output), TEXT);
});

test("invalid and truncated streams fail without trapping", async () => {
	const corrupted = Uint8Array.from(brotliCompressSync(TEXT));
	const corruptIndex = Math.floor(corrupted.length / 2);
	corrupted[corruptIndex] = (corrupted[corruptIndex] ?? 0) ^ 0xff;
	await assert.rejects(
		() => decode(wasmModule, corrupted),
		/Brotli decoding failed/,
	);

	const truncated = brotliCompressSync(TEXT).subarray(0, -1);
	await assert.rejects(() => decode(wasmModule, truncated), /truncated input/);
});

test("argument, option, and lifecycle errors are explicit", async () => {
	const badOptions = [
		{ quality: -1 },
		{ quality: 12 },
		{ lgwin: 9 },
		{ lgwin: 25 },
		{ lgblock: 15 },
		{ sizeHint: -1 },
		{ mode: /** @type {never} */ ("binary") },
		{ disableLiteralContextModeling: /** @type {never} */ (1) },
	];
	for (const options of badOptions) {
		await assert.rejects(
			() => new BrotliEncoder().initialize(wasmModule, options),
			/option/,
		);
	}

	const encoder = await new BrotliEncoder().initialize(wasmModule);
	assert.throws(() => encoder.write(/** @type {never} */ ("text")), TypeError);
	assert.throws(
		() =>
			encoder.write(/** @type {never} */ (new DataView(new ArrayBuffer(4)))),
		TypeError,
	);

	const consumed = encoder.write(BINARY);
	assert(consumed > 0);
	assert(consumed <= 65_536);
	while (encoder.pull()) {
		// Drain process output.
	}
	encoder.reset();
	assert.equal(encoder.finish(), false);
	assert.throws(() => encoder.finish(), /drained/);
	while (!encoder.finished) {
		while (encoder.pull()) {
			// Drain final output.
		}
		encoder.finish();
	}
	assert.throws(() => encoder.write(TEXT), /already finished/);
	assert.throws(() => encoder.flush(), /already finished/);
});
