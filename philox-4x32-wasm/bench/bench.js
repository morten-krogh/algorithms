#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { Philox4x32 } from "../lib/philox-4x32.js";

const M0 = 0xd2511f53;
const M1 = 0xcd9e8d57;
const W0 = 0x9e3779b9;
const W1 = 0xbb67ae85;
const WORDS_PER_BLOCK = 4;
const MIB = 1024 * 1024;

/**
 * @type {ReadonlyArray<{ blocks: number, iterations: number }>}
 */
const RUNS = [
	{ blocks: 1, iterations: 200000 },
	{ blocks: 16, iterations: 50000 },
	{ blocks: 1024, iterations: 1000 },
	{ blocks: 16384, iterations: 100 },
	{ blocks: 262144, iterations: 10 },
];

const COLUMNS = [
	{ header: "blocks", width: 9 },
	{ header: "iters", width: 8 },
	{ header: "wasm(ms)", width: 10 },
	{ header: "wasm blocks/s", width: 13 },
	{ header: "wasm MiB/s", width: 11 },
	{ header: "js(ms)", width: 10 },
	{ header: "js blocks/s", width: 12 },
	{ header: "js MiB/s", width: 10 },
	{ header: "wasm/js performance", width: 19 },
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
 * @param {number} a
 * @param {number} b
 * @returns {[number, number]}
 */
function mulhilo(a, b) {
	const ah = a >>> 16;
	const al = a & 0xffff;
	const bh = b >>> 16;
	const bl = b & 0xffff;
	const lo = Math.imul(a, b) >>> 0;
	const mid =
		(Math.imul(al, bh) >>> 0) +
		(Math.imul(ah, bl) >>> 0) +
		((Math.imul(al, bl) >>> 0) >>> 16);
	const hi = ((Math.imul(ah, bh) >>> 0) + Math.floor(mid / 0x10000)) >>> 0;
	return [hi, lo];
}

/**
 * @param {Uint32Array} counter
 * @param {Uint32Array} key
 * @param {Uint32Array} output
 * @returns {Uint32Array}
 */
function philox4x32_fill_js(counter, key, output) {
	let c0 = counter[0] ?? 0;
	let c1 = counter[1] ?? 0;
	let c2 = counter[2] ?? 0;
	let c3 = counter[3] ?? 0;
	const k0 = key[0] ?? 0;
	const k1 = key[1] ?? 0;

	for (let offset = 0; offset < output.length; offset += WORDS_PER_BLOCK) {
		let x0 = c0;
		let x1 = c1;
		let x2 = c2;
		let x3 = c3;
		let key0 = k0;
		let key1 = k1;

		for (let round = 0; round < 10; round++) {
			const [hi0, lo0] = mulhilo(M0, x0);
			const [hi1, lo1] = mulhilo(M1, x2);
			const n0 = (hi1 ^ x1 ^ key0) >>> 0;
			const n1 = lo1;
			const n2 = (hi0 ^ x3 ^ key1) >>> 0;
			const n3 = lo0;
			x0 = n0;
			x1 = n1;
			x2 = n2;
			x3 = n3;
			key0 = (key0 + W0) >>> 0;
			key1 = (key1 + W1) >>> 0;
		}

		output[offset] = x0;
		output[offset + 1] = x1;
		output[offset + 2] = x2;
		output[offset + 3] = x3;

		c0 = (c0 + 1) >>> 0;
		if (c0 === 0) {
			c1 = (c1 + 1) >>> 0;
			if (c1 === 0) {
				c2 = (c2 + 1) >>> 0;
				if (c2 === 0) {
					c3 = (c3 + 1) >>> 0;
				}
			}
		}
	}
	return output;
}

/**
 * @param {Uint32Array} left
 * @param {Uint32Array} right
 * @returns {boolean}
 */
function equal_words(left, right) {
	if (left.length !== right.length) {
		return false;
	}
	for (let index = 0; index < left.length; index++) {
		if (left[index] !== right[index]) {
			return false;
		}
	}
	return true;
}

/**
 * @param {() => unknown} run_once
 * @param {number} iterations
 * @returns {number}
 */
function time_iterations(run_once, iterations) {
	const warmup = Math.min(100, iterations);
	for (let iteration = 0; iteration < warmup; iteration++) {
		run_once();
	}

	const start = performance.now();
	for (let iteration = 0; iteration < iterations; iteration++) {
		run_once();
	}
	const elapsed_ms = performance.now() - start;
	return elapsed_ms === 0 ? Number.EPSILON : elapsed_ms;
}

/**
 * @param {number} elapsed_ms
 * @param {{ blocks: number, iterations: number }} run
 * @returns {{ ms: string, blocks: string, mib: string, ms_value: number }}
 */
function metrics(elapsed_ms, run) {
	const seconds = elapsed_ms / 1000;
	const total_blocks = run.blocks * run.iterations;
	const total_mib = (total_blocks * WORDS_PER_BLOCK * 4) / MIB;
	return {
		ms: elapsed_ms.toFixed(2),
		blocks: (total_blocks / seconds).toFixed(0),
		mib: (total_mib / seconds).toFixed(2),
		ms_value: elapsed_ms,
	};
}

/**
 * @param {Philox4x32} philox
 * @param {{ blocks: number, iterations: number }} run
 * @returns {string}
 */
function bench_row(philox, run) {
	const counter = new Uint32Array([
		0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344,
	]);
	const key = new Uint32Array([0xa4093822, 0x299f31d0]);
	const wasm_output = new Uint32Array(run.blocks * WORDS_PER_BLOCK);
	const js_output = new Uint32Array(run.blocks * WORDS_PER_BLOCK);

	philox.fill(counter, key, wasm_output);
	philox4x32_fill_js(counter, key, js_output);
	if (!equal_words(wasm_output, js_output)) {
		console.error(`output mismatch at block count ${run.blocks}`);
		process.exit(1);
	}

	const wasm = metrics(
		time_iterations(
			() => philox.fill(counter, key, wasm_output),
			run.iterations,
		),
		run,
	);
	const js = metrics(
		time_iterations(
			() => philox4x32_fill_js(counter, key, js_output),
			run.iterations,
		),
		run,
	);

	return format_row([
		String(run.blocks),
		String(run.iterations),
		wasm.ms,
		wasm.blocks,
		wasm.mib,
		js.ms,
		js.blocks,
		js.mib,
		`${(js.ms_value / wasm.ms_value).toFixed(2)}x`,
	]);
}

const wasm_bytes = await readFile(
	new URL("../lib/philox-4x32.wasm", import.meta.url),
);
const wasm_module = await WebAssembly.compile(wasm_bytes);
const philox = await new Philox4x32().initialize(wasm_module);

console.log(format_row(COLUMNS.map((column) => column.header)));
for (const run of RUNS) {
	console.log(bench_row(philox, run));
}
