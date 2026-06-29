#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { Shake256 } from "../lib/shake-256.js";

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function hex_from_bytes(bytes) {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

const [message, lengthArg, ...rest] = process.argv.slice(2);
if (
	message === undefined ||
	lengthArg === undefined ||
	rest.length > 0 ||
	!/^(0|[1-9][0-9]*)$/.test(lengthArg) ||
	!Number.isSafeInteger(Number(lengthArg))
) {
	console.error("Usage: shake-256 <message> <output-bytes>");
	process.exit(1);
}
const outputBytes = Number(lengthArg);

const wasm_bytes = await readFile(
	new URL("../lib/shake-256.wasm", import.meta.url),
);
const wasm_module = await WebAssembly.compile(wasm_bytes);
const shake = await new Shake256().initialize(wasm_module);
const digest = shake.update(new TextEncoder().encode(message)).digest(outputBytes);
console.log(hex_from_bytes(digest));
