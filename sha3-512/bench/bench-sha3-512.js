#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { Sha3_512 } from "./sha3_512.js";

const MESSAGE_BYTE = 0xa3;
const MIB = 1024 * 1024;
const DEFAULT_WARMUP_ITERATIONS = 1;
const ALGORITHM = "sha3-512";

const USAGE =
	"Usage: node src_wasm/bench-sha3-512.js --message-size <bytes> --iterations <count> [--warmup-iterations <count>]";

/**
 * @typedef {{
 *   messageSize: number,
 *   iterations: number,
 *   warmupIterations: number,
 * }} BenchOptions
 */

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function hex_from_bytes(bytes) {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

/**
 * @param {string} message
 * @returns {never}
 */
function usage_error(message) {
	console.error(`Error: ${message}`);
	console.error(USAGE);
	process.exit(1);
}

/**
 * @param {string[]} args
 * @returns {Map<string, string>}
 */
function parse_flags(args) {
	const flags = new Map();
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (!arg?.startsWith("--")) {
			usage_error(`Unexpected argument: ${arg ?? ""}`);
		}

		const equals_index = arg.indexOf("=");
		const name =
			equals_index === -1 ? arg.slice(2) : arg.slice(2, equals_index);
		const value =
			equals_index === -1 ? args[index + 1] : arg.slice(equals_index + 1);

		if (!name) {
			usage_error("Missing option name");
		}
		if (!["message-size", "iterations", "warmup-iterations"].includes(name)) {
			usage_error(`Unknown option: --${name}`);
		}
		if (flags.has(name)) {
			usage_error(`Duplicate option: --${name}`);
		}
		if (value === undefined || value.startsWith("--")) {
			usage_error(`Missing value for --${name}`);
		}

		flags.set(name, value);
		if (equals_index === -1) {
			index++;
		}
	}
	return flags;
}

/**
 * @param {string} name
 * @param {string | undefined} value
 * @param {{ allowZero: boolean }} options
 * @returns {number}
 */
function parse_integer_option(name, value, options) {
	if (value === undefined) {
		usage_error(`Missing required option --${name}`);
	}
	if (!/^(0|[1-9][0-9]*)$/.test(value)) {
		usage_error(`--${name} must be an integer`);
	}
	const number = Number(value);
	if (!Number.isSafeInteger(number)) {
		usage_error(`--${name} must be a safe integer`);
	}
	if (!options.allowZero && number === 0) {
		usage_error(`--${name} must be greater than zero`);
	}
	return number;
}

/**
 * @param {string[]} args
 * @returns {BenchOptions}
 */
function parse_args(args) {
	const flags = parse_flags(args);

	return {
		messageSize: parse_integer_option(
			"message-size",
			flags.get("message-size"),
			{ allowZero: true },
		),
		iterations: parse_integer_option("iterations", flags.get("iterations"), {
			allowZero: false,
		}),
		warmupIterations: flags.has("warmup-iterations")
			? parse_integer_option(
					"warmup-iterations",
					flags.get("warmup-iterations"),
					{ allowZero: true },
				)
			: DEFAULT_WARMUP_ITERATIONS,
	};
}

/**
 * @param {BenchOptions} options
 */
async function run_bench(options) {
	const wasm_bytes = await readFile(
		new URL("./sha3_512.wasm", import.meta.url),
	);
	const wasm_module = await WebAssembly.compile(wasm_bytes);
	const sha3 = await new Sha3_512().initialize(wasm_module);
	const message = new Uint8Array(options.messageSize).fill(MESSAGE_BYTE);

	/** @type {Uint8Array} */
	let digest = new Uint8Array();
	for (let iteration = 0; iteration < options.warmupIterations; iteration++) {
		sha3.reset().update(message).digest();
	}

	const start = performance.now();
	for (let iteration = 0; iteration < options.iterations; iteration++) {
		digest = sha3.reset().update(message).digest();
	}
	const elapsed_ms = performance.now() - start;
	const total_ms = elapsed_ms === 0 ? Number.EPSILON : elapsed_ms;
	const total_seconds = total_ms / 1000;
	const total_mib = (options.messageSize * options.iterations) / MIB;
	const hashes_per_second = options.iterations / total_seconds;
	const mib_per_second = total_mib / total_seconds;

	console.log(`algorithm: ${ALGORITHM}`);
	console.log(`message_size_bytes: ${options.messageSize}`);
	console.log(`iterations: ${options.iterations}`);
	console.log(`warmup_iterations: ${options.warmupIterations}`);
	console.log(`total_ms: ${total_ms.toFixed(3)}`);
	console.log(`hashes_per_second: ${hashes_per_second.toFixed(3)}`);
	console.log(`mib_per_second: ${mib_per_second.toFixed(3)}`);
	console.log(`digest_hex: ${hex_from_bytes(digest)}`);
}

await run_bench(parse_args(process.argv.slice(2)));
