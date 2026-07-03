#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { Philox4x32 } from "../lib/philox-4x32.js";

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
 * @param {number} word
 * @returns {string}
 */
function hex_word(word) {
	return word.toString(16).padStart(8, "0");
}

const args = process.argv.slice(2);
if (args.length !== 6) {
	console.error("Usage: philox-4x32 <c0> <c1> <c2> <c3> <k0> <k1>");
	process.exit(1);
}

let words;
try {
	words = args.map(parse_uint32);
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}

const wasm_bytes = await readFile(
	new URL("../lib/philox-4x32.wasm", import.meta.url),
);
const wasm_module = await WebAssembly.compile(wasm_bytes);
const philox = await new Philox4x32().initialize(wasm_module);
const output = philox.generate(
	new Uint32Array(words.slice(0, 4)),
	new Uint32Array(words.slice(4)),
);

console.log(Array.from(output, hex_word).join(" "));
