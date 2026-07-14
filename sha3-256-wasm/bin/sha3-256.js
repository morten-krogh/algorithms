#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { Sha3_256 } from "../lib/sha3-256.js";

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function hex_from_bytes(bytes) {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

if (process.argv.length > 2) {
	console.error("Usage: sha3-256 < input");
	process.exit(1);
}

const wasm_bytes = await readFile(
	new URL("../lib/sha3-256.wasm", import.meta.url),
);
const wasm_module = await WebAssembly.compile(wasm_bytes);
const sha3 = await new Sha3_256().initialize(wasm_module);
try {
	for await (const chunk of process.stdin) {
		sha3.update(chunk);
	}
} catch {
	console.error("sha3-256: failed to read stdin");
	process.exit(1);
}
console.log(hex_from_bytes(sha3.digest()));
