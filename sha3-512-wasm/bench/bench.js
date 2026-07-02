#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { Sha3_512 } from "../lib/sha3-512.js";

const MESSAGE_BYTE = 0xa3;
const MIB = 1024 * 1024;

/**
 * Message sizes (in bytes) to benchmark, each with the number of timed
 * iterations to run. Smaller messages use more iterations so the measured
 * time stays meaningful.
 *
 * @type {ReadonlyArray<{ size: number, iterations: number }>}
 */
const RUNS = [
	{ size: 0, iterations: 200000 },
	{ size: 64, iterations: 200000 },
	{ size: 1024, iterations: 50000 },
	{ size: 16384, iterations: 10000 },
	{ size: 262144, iterations: 1000 },
	{ size: 1048576, iterations: 300 },
	{ size: 10485760, iterations: 30 },
];

/** Right-justified columns for the comparison table. */
const COLUMNS = [
	{ header: "size(B)", width: 9 },
	{ header: "iters", width: 8 },
	{ header: "wasm(ms)", width: 10 },
	{ header: "wasm h/s", width: 10 },
	{ header: "wasm MiB/s", width: 11 },
	{ header: "node(ms)", width: 10 },
	{ header: "node h/s", width: 11 },
	{ header: "node MiB/s", width: 11 },
	{ header: "wasm/node performance", width: 21 },
];

/**
 * @param {readonly string[]} cells
 * @returns {string}
 */
function format_row(cells) {
	return cells
		.map((cell, index) => cell.padStart(COLUMNS[index]?.width ?? 0))
		.join("  ");
}

/**
 * Times `iterations` calls to `hash_once`, after a warmup of the same shape.
 *
 * @param {() => unknown} hash_once
 * @param {number} iterations
 * @returns {number} elapsed milliseconds (floored at Number.EPSILON)
 */
function time_iterations(hash_once, iterations) {
	const warmup = Math.min(1000, iterations);
	for (let iteration = 0; iteration < warmup; iteration++) {
		hash_once();
	}

	const start = performance.now();
	for (let iteration = 0; iteration < iterations; iteration++) {
		hash_once();
	}
	const elapsed_ms = performance.now() - start;
	return elapsed_ms === 0 ? Number.EPSILON : elapsed_ms;
}

/**
 * Throughput metrics for a single (implementation, run) pair.
 *
 * @param {number} elapsed_ms
 * @param {{ size: number, iterations: number }} run
 * @returns {{ ms: string, hashes: string, mib: string, ms_value: number }}
 */
function metrics(elapsed_ms, run) {
	const seconds = elapsed_ms / 1000;
	const total_mib = (run.size * run.iterations) / MIB;
	return {
		ms: elapsed_ms.toFixed(2),
		hashes: (run.iterations / seconds).toFixed(0),
		mib: (total_mib / seconds).toFixed(2),
		ms_value: elapsed_ms,
	};
}

/**
 * @param {Sha3_512} sha3
 * @param {{ size: number, iterations: number }} run
 * @returns {string}
 */
function bench_row(sha3, run) {
	const message = new Uint8Array(run.size).fill(MESSAGE_BYTE);

	// Sanity check: both implementations must agree before we compare speeds.
	const wasm_digest = sha3.reset().update(message).digest();
	const node_digest = createHash("sha3-512").update(message).digest();
	if (!Buffer.from(wasm_digest).equals(node_digest)) {
		console.error(`digest mismatch at size ${run.size}`);
		process.exit(1);
	}

	const wasm = metrics(
		time_iterations(
			() => sha3.reset().update(message).digest(),
			run.iterations,
		),
		run,
	);
	const node = metrics(
		time_iterations(
			() => createHash("sha3-512").update(message).digest(),
			run.iterations,
		),
		run,
	);

	return format_row([
		String(run.size),
		String(run.iterations),
		wasm.ms,
		wasm.hashes,
		wasm.mib,
		node.ms,
		node.hashes,
		node.mib,
		`${(node.ms_value / wasm.ms_value).toFixed(1)}x`,
	]);
}

const wasm_bytes = await readFile(
	new URL("../lib/sha3-512.wasm", import.meta.url),
);
const wasm_module = await WebAssembly.compile(wasm_bytes);
const sha3 = await new Sha3_512().initialize(wasm_module);

console.log(format_row(COLUMNS.map((column) => column.header)));
for (const run of RUNS) {
	console.log(bench_row(sha3, run));
}
