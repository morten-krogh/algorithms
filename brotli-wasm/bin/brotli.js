#!/usr/bin/env node

import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { BrotliDecoder, BrotliEncoder } from "../lib/brotli.js";

const USAGE =
	"Usage: brotli-wasm [--decompress] [--quality 0..11] " +
	"[--lgwin 10..24] [--mode generic|text|font] < input > output";

let decompress = false;
let quality = 4;
let lgwin = 22;
/** @type {"generic" | "text" | "font"} */
let mode = "generic";

for (let index = 2; index < process.argv.length; index++) {
	const argument = process.argv[index];
	if (argument === "-d" || argument === "--decompress") {
		decompress = true;
		continue;
	}
	if (argument === "-q" || argument === "--quality") {
		const value = process.argv[++index];
		quality = Number(value);
		if (!Number.isInteger(quality) || quality < 0 || quality > 11) {
			console.error(USAGE);
			process.exit(1);
		}
		continue;
	}
	if (argument === "--lgwin") {
		const value = process.argv[++index];
		lgwin = Number(value);
		if (!Number.isInteger(lgwin) || lgwin < 10 || lgwin > 24) {
			console.error(USAGE);
			process.exit(1);
		}
		continue;
	}
	if (argument === "--mode") {
		const value = process.argv[++index];
		if (value !== "generic" && value !== "text" && value !== "font") {
			console.error(USAGE);
			process.exit(1);
		}
		mode = value;
		continue;
	}
	if (argument === "-h" || argument === "--help") {
		console.log(USAGE);
		process.exit(0);
	}
	console.error(USAGE);
	process.exit(1);
}

const wasmBytes = await readFile(
	new URL("../lib/brotli.wasm", import.meta.url),
);
const wasmModule = await WebAssembly.compile(wasmBytes);
const codec = decompress
	? await new BrotliDecoder().initialize(wasmModule)
	: await new BrotliEncoder().initialize(wasmModule, {
			quality,
			lgwin,
			mode,
		});

/**
 * Copy transient WASM views to stdout while respecting stream backpressure.
 */
async function drain_output() {
	for (;;) {
		const view = codec.pull();
		if (!view) {
			return;
		}
		const owned = Buffer.from(view);
		if (!process.stdout.write(owned)) {
			await once(process.stdout, "drain");
		}
	}
}

try {
	for await (const chunk of process.stdin) {
		let offset = 0;
		while (offset < chunk.length) {
			const consumed = codec.write(chunk.subarray(offset));
			offset += consumed;
			await drain_output();
			if (codec.finished && offset !== chunk.length) {
				throw new Error("trailing data after Brotli stream");
			}
		}
	}
	while (!codec.finish()) {
		await drain_output();
	}
	await drain_output();
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`brotli-wasm: ${message}`);
	process.exit(1);
}
