#!/usr/bin/env node

import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { Philox4x32 } from "../lib/philox-4x32.js";

const BYTES_PER_BLOCK = 16;
const WORDS_PER_BLOCK = 4;
const MAX_CHUNK_BYTES = 1024 * 1024;

/**
 * @param {string} value
 * @returns {number}
 */
function parse_uint32(value) {
	if (!/^(?:0x[0-9a-f]+|\d+)$/i.test(value)) {
		throw new Error(`Invalid uint32 value: ${value}`);
	}
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 0 || parsed > 0xffffffff) {
		throw new Error(`Value is outside uint32 range: ${value}`);
	}
	return parsed >>> 0;
}

/**
 * @param {string} value
 * @returns {number}
 */
function parse_byte_count(value) {
	if (!/^(?:0x[0-9a-f]+|\d+)$/i.test(value)) {
		throw new Error(`Invalid byte count: ${value}`);
	}
	const parsed = Number(value);
	if (
		!Number.isSafeInteger(parsed) ||
		parsed < 0 ||
		parsed > Number.MAX_SAFE_INTEGER
	) {
		throw new Error(`Byte count is outside the safe integer range: ${value}`);
	}
	return parsed;
}

/**
 * @param {Uint32Array} words
 * @param {number} byte_length
 * @returns {string}
 */
function words_to_little_endian_hex(words, byte_length) {
	const bytes = new Uint8Array(byte_length);
	const view = new DataView(bytes.buffer);
	let byte_offset = 0;
	for (const word of words) {
		const remaining = byte_length - byte_offset;
		if (remaining >= 4) {
			view.setUint32(byte_offset, word, true);
			byte_offset += 4;
			continue;
		}
		for (let byte_index = 0; byte_index < remaining; byte_index++) {
			bytes[byte_offset + byte_index] = (word >>> (byte_index * 8)) & 0xff;
		}
		break;
	}
	return Buffer.from(bytes).toString("hex");
}

/**
 * @param {Uint32Array} counter
 * @param {number} blocks
 */
function advance_counter(counter, blocks) {
	const next_c0 = (counter[0] ?? 0) + blocks;
	counter[0] = next_c0 >>> 0;
	if (next_c0 > 0xffffffff) {
		counter[1] = ((counter[1] ?? 0) + 1) >>> 0;
		if (counter[1] === 0) {
			counter[2] = ((counter[2] ?? 0) + 1) >>> 0;
			if (counter[2] === 0) {
				counter[3] = ((counter[3] ?? 0) + 1) >>> 0;
			}
		}
	}
}

/**
 * @param {string} text
 * @returns {Promise<void>}
 */
async function write_stdout(text) {
	if (!process.stdout.write(text)) {
		await once(process.stdout, "drain");
	}
}

const args = process.argv.slice(2);
if (args.length !== 7) {
	console.error(
		"Usage: philox-4x32-prng <bytes> <c0> <c1> <c2> <c3> <k0> <k1>",
	);
	process.exit(1);
}

let byte_count;
let words;
try {
	byte_count = parse_byte_count(args[0] ?? "");
	words = args.slice(1).map(parse_uint32);
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}

const wasm_bytes = await readFile(
	new URL("../lib/philox-4x32.wasm", import.meta.url),
);
const wasm_module = await WebAssembly.compile(wasm_bytes);
const philox = await new Philox4x32().initialize(wasm_module);
const counter = new Uint32Array(words.slice(0, 4));
const key = new Uint32Array(words.slice(4));

let bytes_remaining = byte_count;
while (bytes_remaining !== 0) {
	const chunk_bytes = Math.min(bytes_remaining, MAX_CHUNK_BYTES);
	const blocks = Math.ceil(chunk_bytes / BYTES_PER_BLOCK);
	const output = philox.fill(
		counter,
		key,
		new Uint32Array(blocks * WORDS_PER_BLOCK),
	);
	await write_stdout(words_to_little_endian_hex(output, chunk_bytes));
	advance_counter(counter, blocks);
	bytes_remaining -= chunk_bytes;
}
