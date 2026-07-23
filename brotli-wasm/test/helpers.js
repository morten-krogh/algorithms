import { BrotliDecoder, BrotliEncoder } from "../src/brotli.js";

/**
 * @param {BrotliEncoder | BrotliDecoder} codec
 * @param {Uint8Array[]} chunks
 */
function drain(codec, chunks) {
	for (;;) {
		const view = codec.pull();
		if (!view) {
			return;
		}
		chunks.push(Uint8Array.from(view));
	}
}

/**
 * @param {Uint8Array[]} chunks
 * @returns {Uint8Array}
 */
function concatenate(chunks) {
	const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
	const result = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}
	return result;
}

/**
 * @param {BrotliEncoder | BrotliDecoder} codec
 * @param {Uint8Array} input
 * @param {readonly number[]} chunkSizes
 * @param {Uint8Array[]} output
 * @returns {number}
 */
function write_chunked(codec, input, chunkSizes, output) {
	let offset = 0;
	let chunkIndex = 0;
	while (offset < input.length && !codec.finished) {
		const requested = chunkSizes[chunkIndex % chunkSizes.length] ?? 65536;
		const end = Math.min(input.length, offset + requested);
		while (offset < end && !codec.finished) {
			offset += codec.write(input.subarray(offset, end));
			drain(codec, output);
		}
		chunkIndex++;
	}
	return offset;
}

/**
 * @param {WebAssembly.Module} module
 * @param {Uint8Array} input
 * @param {import("../src/brotli.js").BrotliEncoderOptions} [options]
 * @param {readonly number[]} [chunkSizes]
 * @returns {Promise<Uint8Array>}
 */
async function encode(
	module,
	input,
	options = {},
	chunkSizes = [1, 17, 4093, 65536],
) {
	const encoder = await new BrotliEncoder().initialize(module, options);
	/** @type {Uint8Array[]} */
	const chunks = [];
	const consumed = write_chunked(encoder, input, chunkSizes, chunks);
	if (consumed !== input.length) {
		throw new Error("Encoder did not consume all input");
	}
	while (!encoder.finish()) {
		drain(encoder, chunks);
	}
	drain(encoder, chunks);
	return concatenate(chunks);
}

/**
 * @param {WebAssembly.Module} module
 * @param {Uint8Array} input
 * @param {readonly number[]} [chunkSizes]
 * @returns {Promise<{ output: Uint8Array, consumed: number }>}
 */
async function decode(module, input, chunkSizes = [1, 7, 257, 65536]) {
	const decoder = await new BrotliDecoder().initialize(module);
	/** @type {Uint8Array[]} */
	const chunks = [];
	const consumed = write_chunked(decoder, input, chunkSizes, chunks);
	while (!decoder.finish()) {
		drain(decoder, chunks);
	}
	drain(decoder, chunks);
	return { output: concatenate(chunks), consumed };
}

export { concatenate, decode, drain, encode, write_chunked };
