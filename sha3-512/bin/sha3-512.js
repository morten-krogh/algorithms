#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { Sha3_512 } from "../lib/sha3_512.js";

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function hex_from_bytes(bytes) {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

const [message, ...rest] = process.argv.slice(2);
if (message === undefined || rest.length > 0) {
	console.error("Usage: sha3-512 <message>");
	process.exit(1);
}

const wasm_bytes = await readFile(
	new URL("../lib/sha3_512.wasm", import.meta.url),
);
const wasm_module = await WebAssembly.compile(wasm_bytes);
const sha3 = await new Sha3_512().initialize(wasm_module);
const digest = sha3.update(new TextEncoder().encode(message)).digest();
console.log(hex_from_bytes(digest));
