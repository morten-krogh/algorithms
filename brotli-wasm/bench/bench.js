#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";
import { BrotliDecoder, BrotliEncoder } from "../lib/brotli.js";

const MIB = 1024 * 1024;
const quick = process.argv.includes("--quick");
const check = process.argv.includes("--check");

/**
 * @param {string} name
 * @returns {string | undefined}
 */
function argument_value(name) {
	const prefix = `--${name}=`;
	return process.argv
		.find((argument) => argument.startsWith(prefix))
		?.slice(prefix.length);
}

const selectedCorpus = argument_value("corpus");
const selectedQualityText = argument_value("quality");
const selectedQuality =
	selectedQualityText === undefined ? undefined : Number(selectedQualityText);
const selectedMillisecondsText = argument_value("minimum-ms");
const selectedMilliseconds =
	selectedMillisecondsText === undefined
		? undefined
		: Number(selectedMillisecondsText);
if (
	selectedQuality !== undefined &&
	(!Number.isInteger(selectedQuality) ||
		selectedQuality < 0 ||
		selectedQuality > 11)
) {
	throw new RangeError("--quality must be an integer from 0 through 11");
}
if (
	selectedMilliseconds !== undefined &&
	(!Number.isFinite(selectedMilliseconds) || selectedMilliseconds <= 0)
) {
	throw new RangeError("--minimum-ms must be a positive number");
}
const minimumMilliseconds = selectedMilliseconds ?? (quick ? 20 : 100);
const require = createRequire(import.meta.url);
/** @type {typeof import("rust-brotli-wasm")} */
const rustBrotli = require("rust-brotli-wasm");

const textEncoder = new TextEncoder();
const textSeed = textEncoder.encode(
	"WebAssembly Brotli compression combines LZ77, Huffman coding, context " +
		"modeling, and a static dictionary for web content. ",
);

/**
 * @param {number} length
 * @returns {Uint8Array}
 */
function repeated_text(length) {
	const result = new Uint8Array(length);
	for (let offset = 0; offset < length; offset += textSeed.length) {
		result.set(textSeed.subarray(0, length - offset), offset);
	}
	return result;
}

/**
 * @param {number} length
 * @returns {Uint8Array}
 */
function deterministic_binary(length) {
	const result = new Uint8Array(length);
	let state = 0x6d2b79f5;
	for (let index = 0; index < length; index++) {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		result[index] = state & 0xff;
	}
	return result;
}

const watSource = quick
	? null
	: await readFile(new URL("../src/brotli.wat", import.meta.url));
const allCorpora = quick
	? [{ name: "text", data: repeated_text(65_536) }]
	: [
			{ name: "tiny", data: repeated_text(64) },
			{ name: "text", data: repeated_text(262_144) },
			{
				name: "wat-prefix",
				data: /** @type {Uint8Array} */ (watSource).subarray(0, 262_144),
			},
			{ name: "binary", data: deterministic_binary(1_048_576) },
		];
const corpora =
	selectedCorpus === undefined
		? allCorpora
		: allCorpora.filter(({ name }) => name === selectedCorpus);
if (corpora.length === 0) {
	throw new RangeError(
		`--corpus must be one of ${allCorpora.map(({ name }) => name).join(", ")}`,
	);
}
const qualities =
	selectedQuality === undefined
		? quick
			? [4]
			: [0, 4, 6, 11]
		: [selectedQuality];

/**
 * @param {BrotliEncoder | BrotliDecoder} codec
 * @returns {{ bytes: number, checksum: number }}
 */
function drain(codec) {
	let bytes = 0;
	let checksum = 0;
	for (;;) {
		const output = codec.pull();
		if (!output) {
			return { bytes, checksum };
		}
		bytes += output.length;
		for (let index = 0; index < output.length; index += 4096) {
			checksum = (checksum + (output[index] ?? 0)) | 0;
		}
	}
}

/**
 * Copy all currently available output into owned chunks.
 *
 * @param {BrotliEncoder | BrotliDecoder} codec
 * @param {Uint8Array[]} chunks
 * @returns {number}
 */
function drain_owned(codec, chunks) {
	let bytes = 0;
	for (;;) {
		const output = codec.pull();
		if (!output) {
			return bytes;
		}
		const owned = Uint8Array.from(output);
		chunks.push(owned);
		bytes += owned.length;
	}
}

/**
 * @param {Uint8Array[]} chunks
 * @param {number} length
 * @returns {Uint8Array}
 */
function concatenate(chunks, length) {
	const only = chunks[0];
	if (chunks.length === 1 && only) {
		return only;
	}
	const output = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.length;
	}
	return output;
}

/**
 * @param {BrotliEncoder} encoder
 * @param {Uint8Array} input
 * @returns {{ bytes: number, checksum: number }}
 */
function run_encoder(encoder, input) {
	encoder.reset();
	let offset = 0;
	let bytes = 0;
	let checksum = 0;
	while (offset < input.length) {
		offset += encoder.write(input.subarray(offset));
		const result = drain(encoder);
		bytes += result.bytes;
		checksum ^= result.checksum;
	}
	while (!encoder.finish()) {
		const result = drain(encoder);
		bytes += result.bytes;
		checksum ^= result.checksum;
	}
	const result = drain(encoder);
	return {
		bytes: bytes + result.bytes,
		checksum: checksum ^ result.checksum,
	};
}

/**
 * One-shot equivalent that returns one newly allocated, independently owned
 * output array.
 *
 * @param {BrotliEncoder} encoder
 * @param {Uint8Array} input
 * @returns {Uint8Array}
 */
function run_encoder_owned(encoder, input) {
	encoder.reset();
	/** @type {Uint8Array[]} */
	const chunks = [];
	let offset = 0;
	let bytes = 0;
	while (offset < input.length) {
		offset += encoder.write(input.subarray(offset));
		bytes += drain_owned(encoder, chunks);
	}
	while (!encoder.finish()) {
		bytes += drain_owned(encoder, chunks);
	}
	bytes += drain_owned(encoder, chunks);
	return concatenate(chunks, bytes);
}

/**
 * @param {BrotliDecoder} decoder
 * @param {Uint8Array} input
 * @returns {{ bytes: number, checksum: number }}
 */
function run_decoder(decoder, input) {
	decoder.reset();
	let offset = 0;
	let bytes = 0;
	let checksum = 0;
	while (offset < input.length && !decoder.finished) {
		offset += decoder.write(input.subarray(offset));
		const result = drain(decoder);
		bytes += result.bytes;
		checksum ^= result.checksum;
	}
	while (!decoder.finish()) {
		const result = drain(decoder);
		bytes += result.bytes;
		checksum ^= result.checksum;
	}
	const result = drain(decoder);
	return {
		bytes: bytes + result.bytes,
		checksum: checksum ^ result.checksum,
	};
}

/**
 * One-shot equivalent that returns one newly allocated, independently owned
 * output array.
 *
 * @param {BrotliDecoder} decoder
 * @param {Uint8Array} input
 * @returns {Uint8Array}
 */
function run_decoder_owned(decoder, input) {
	decoder.reset();
	/** @type {Uint8Array[]} */
	const chunks = [];
	let offset = 0;
	let bytes = 0;
	while (offset < input.length && !decoder.finished) {
		offset += decoder.write(input.subarray(offset));
		bytes += drain_owned(decoder, chunks);
	}
	while (!decoder.finish()) {
		bytes += drain_owned(decoder, chunks);
	}
	bytes += drain_owned(decoder, chunks);
	return concatenate(chunks, bytes);
}

/**
 * @param {() => unknown} action
 * @returns {{ iterations: number, milliseconds: number }}
 */
function time(action) {
	const warmupStart = performance.now();
	const warmupMilliseconds = Math.min(
		100,
		Math.max(10, minimumMilliseconds / 2),
	);
	do {
		action();
	} while (performance.now() - warmupStart < warmupMilliseconds);
	let iterations = 1;
	for (;;) {
		const start = performance.now();
		for (let index = 0; index < iterations; index++) {
			action();
		}
		const milliseconds = Math.max(performance.now() - start, Number.EPSILON);
		if (milliseconds >= minimumMilliseconds || iterations >= 1_000_000) {
			return { iterations, milliseconds };
		}
		const scale = Math.min(
			100,
			Math.max(2, (minimumMilliseconds / milliseconds) * 1.1),
		);
		iterations = Math.min(1_000_000, Math.ceil(iterations * scale));
	}
}

/**
 * @param {number} bytes
 * @param {{ iterations: number, milliseconds: number }} timing
 * @returns {string}
 */
function throughput(bytes, timing) {
	return (
		(bytes * timing.iterations * 1000) /
		timing.milliseconds /
		MIB
	).toFixed(2);
}

/**
 * Return primary throughput divided by reference throughput.
 *
 * @param {{ iterations: number, milliseconds: number }} primary
 * @param {{ iterations: number, milliseconds: number }} reference
 * @returns {number}
 */
function relative_speed(primary, reference) {
	return (
		(primary.iterations * reference.milliseconds) /
		(primary.milliseconds * reference.iterations)
	);
}

const wasmBytes = await readFile(
	new URL("../lib/brotli.wasm", import.meta.url),
);
const wasmModule = await WebAssembly.compile(wasmBytes);

/** @type {ReadonlyArray<readonly [string, number]>} */
const compressionColumns = [
	["corpus", 10],
	["q", 2],
	["size(B)", 9],
	["wat stream", 12],
	["wat owned", 11],
	["node owned", 12],
	["rust owned", 12],
	["owned/node", 11],
	["owned/rust", 11],
	["wat output(B)", 13],
	["node bytes", 10],
	["rust bytes", 10],
];

/** @type {ReadonlyArray<readonly [string, number]>} */
const decompressionColumns = [
	["corpus", 10],
	["q", 2],
	["size(B)", 9],
	["wat stream", 12],
	["wat owned", 11],
	["node owned", 12],
	["rust owned", 12],
	["owned/node", 11],
	["owned/rust", 11],
];

/**
 * @param {ReadonlyArray<readonly [string, number]>} columns
 * @param {readonly string[]} cells
 * @returns {string}
 */
function row(columns, cells) {
	return cells
		.map((cell, index) => cell.padStart(columns[index]?.[1] ?? 0))
		.join("  ");
}

/** @type {string[][]} */
const compressionRows = [];
/** @type {string[][]} */
const decompressionRows = [];

for (const corpus of corpora) {
	for (const quality of qualities) {
		const options = { quality, sizeHint: corpus.data.length };
		const encoder = await new BrotliEncoder().initialize(wasmModule, options);
		const decoder = await new BrotliDecoder().initialize(wasmModule);
		const nodeOptions = {
			params: {
				[constants.BROTLI_PARAM_QUALITY]: quality,
				[constants.BROTLI_PARAM_SIZE_HINT]: corpus.data.length,
			},
		};

		const wasmCompressed = run_encoder_owned(encoder, corpus.data);
		const nodeCompressed = brotliCompressSync(corpus.data, nodeOptions);
		const rustCompressed =
			quality === 0 ? null : rustBrotli.compress(corpus.data, { quality });
		if (
			!Buffer.from(brotliDecompressSync(wasmCompressed)).equals(
				Buffer.from(corpus.data),
			)
		) {
			throw new Error("WASM encoder interoperability check failed");
		}
		if (run_decoder(decoder, nodeCompressed).bytes !== corpus.data.length) {
			throw new Error("WASM decoder interoperability check failed");
		}
		if (
			!Buffer.from(run_decoder_owned(decoder, nodeCompressed)).equals(
				Buffer.from(corpus.data),
			)
		) {
			throw new Error("WASM owned decoder interoperability check failed");
		}
		if (
			rustCompressed &&
			!Buffer.from(brotliDecompressSync(rustCompressed)).equals(
				Buffer.from(corpus.data),
			)
		) {
			throw new Error("Rust WASM encoder interoperability check failed");
		}
		if (
			!Buffer.from(rustBrotli.decompress(nodeCompressed)).equals(
				Buffer.from(corpus.data),
			)
		) {
			throw new Error("Rust WASM decoder interoperability check failed");
		}

		let sink = 0;
		const wasmStreamEncode = time(() => {
			const result = run_encoder(encoder, corpus.data);
			sink ^= result.bytes ^ result.checksum;
		});
		const wasmOwnedEncode = time(() => {
			const output = run_encoder_owned(encoder, corpus.data);
			sink ^= output.length ^ (output[0] ?? 0);
		});
		const nodeEncode = time(() => {
			const output = brotliCompressSync(corpus.data, nodeOptions);
			sink ^= output.length ^ (output[0] ?? 0);
		});
		const rustEncode =
			quality === 0
				? null
				: time(() => {
						const output = rustBrotli.compress(corpus.data, { quality });
						sink ^= output.length ^ (output[0] ?? 0);
					});
		const wasmStreamDecode = time(() => {
			const result = run_decoder(decoder, nodeCompressed);
			sink ^= result.bytes ^ result.checksum;
		});
		const wasmOwnedDecode = time(() => {
			const output = run_decoder_owned(decoder, nodeCompressed);
			sink ^= output.length ^ (output[0] ?? 0);
		});
		const nodeDecode = time(() => {
			const output = brotliDecompressSync(nodeCompressed);
			sink ^= output.length ^ (output[0] ?? 0);
		});
		const rustDecode = time(() => {
			const output = rustBrotli.decompress(nodeCompressed);
			sink ^= output.length ^ (output[0] ?? 0);
		});
		if (check && corpus.name === "text" && quality === 4) {
			if (!rustCompressed || rustEncode === null) {
				throw new Error("Rust WASM encoder benchmark did not run");
			}
			const encodeRatio = relative_speed(wasmOwnedEncode, rustEncode);
			const decodeRatio = relative_speed(wasmOwnedDecode, rustDecode);
			if (encodeRatio < 2) {
				throw new Error(
					`Owned encoder regression: expected at least 2.00x Rust WASM, got ${encodeRatio.toFixed(2)}x`,
				);
			}
			if (decodeRatio < 0.25) {
				throw new Error(
					`Owned decoder regression: expected at least 0.25x Rust WASM, got ${decodeRatio.toFixed(2)}x`,
				);
			}
			if (wasmCompressed.length > rustCompressed.length) {
				throw new Error(
					`Compression regression: ${wasmCompressed.length} bytes exceeds Rust WASM's ${rustCompressed.length}`,
				);
			}
		}
		if (sink === 0x7fffffff) {
			console.error("unreachable benchmark sink");
		}

		compressionRows.push([
			corpus.name,
			String(quality),
			String(corpus.data.length),
			throughput(corpus.data.length, wasmStreamEncode),
			throughput(corpus.data.length, wasmOwnedEncode),
			throughput(corpus.data.length, nodeEncode),
			rustEncode === null ? "n/a" : throughput(corpus.data.length, rustEncode),
			`${relative_speed(wasmOwnedEncode, nodeEncode).toFixed(2)}x`,
			rustEncode === null
				? "n/a"
				: `${relative_speed(wasmOwnedEncode, rustEncode).toFixed(2)}x`,
			String(wasmCompressed.length),
			String(nodeCompressed.length),
			rustCompressed ? String(rustCompressed.length) : "n/a",
		]);
		decompressionRows.push([
			corpus.name,
			String(quality),
			String(corpus.data.length),
			throughput(corpus.data.length, wasmStreamDecode),
			throughput(corpus.data.length, wasmOwnedDecode),
			throughput(corpus.data.length, nodeDecode),
			throughput(corpus.data.length, rustDecode),
			`${relative_speed(wasmOwnedDecode, nodeDecode).toFixed(2)}x`,
			`${relative_speed(wasmOwnedDecode, rustDecode).toFixed(2)}x`,
		]);
	}
}

console.log(
	`Adaptive timing uses at least ${minimumMilliseconds} ms per result.`,
);
console.log("Compression (MiB/s; ratios use WAT owned output)");
console.log(
	row(
		compressionColumns,
		compressionColumns.map(([header]) => header),
	),
);
for (const cells of compressionRows) {
	console.log(row(compressionColumns, cells));
}
console.log();
console.log("Decompression (MiB/s; ratios use WAT owned output)");
console.log(
	row(
		decompressionColumns,
		decompressionColumns.map(([header]) => header),
	),
);
for (const cells of decompressionRows) {
	console.log(row(decompressionColumns, cells));
}
if (check) {
	console.log("Performance regression checks passed.");
}
