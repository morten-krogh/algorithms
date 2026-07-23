#!/usr/bin/env node

import { createReadStream } from "node:fs";
import {
	chmod,
	lstat,
	open,
	readFile,
	rename,
	rm,
	stat,
	unlink,
	utimes,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { finished } from "node:stream/promises";
import { BrotliDecoder, BrotliEncoder } from "../lib/brotli.js";

const PROGRAM = basename(process.argv[1] ?? "brotli.js");
const TEMPORARY_TAG = "brotli-wasm";
const DEFAULT_SUFFIX = ".br";
const DEFAULT_QUALITY = 11;
const DEFAULT_LGWIN = 22;
const MAX_SIZE_HINT = 0xffffffff;

const HELP = `Usage: ${PROGRAM} [OPTION]... [FILE]...
Compress or decompress FILEs with RFC 7932 Brotli.
With no FILE, or when FILE is -, read standard input.

Options:
  -#                          compression level (0-9)
  -c, --stdout                write on standard output
  -d, --decompress            decompress
  -f, --force                 force output file overwrite
  -h, --help                  display this help and exit
  -j, --rm                    remove source file after success
  -s, --squash                remove output if it is not smaller than input
  -k, --keep                  keep source file (default)
  -n, --no-copy-stat          do not copy source file attributes
  -o FILE, --output=FILE      output file (only with one input)
  -q NUM, --quality=NUM       compression level (0-11)
  -t, --test                  test compressed file integrity
  -v, --verbose               report processed files on standard error
  -w NUM, --lgwin=NUM         LZ77 window bits (0 or 10-24; 0 uses 22)
  -S SUF, --suffix=SUF        output file suffix (default: ".br")
  -V, --version               display version and exit
  -Z, --best                  use best compression level (11, default)
      --mode=MODE             compression mode: generic, text, or font

Simple short options may be coalesced: -9kf is the same as -9 -k -f.
File inputs produce sibling files by default; source files are kept.`;

class UsageError extends Error {}

/**
 * @typedef {"generic" | "text" | "font"} BrotliMode
 * @typedef {"help" | "version" | null} InformationAction
 * @typedef {{
 *   decompress: boolean,
 *   test: boolean,
 *   stdout: boolean,
 *   force: boolean,
 *   removeSource: boolean,
 *   squash: boolean,
 *   copyStat: boolean,
 *   verbose: boolean,
 *   quality: number,
 *   lgwin: number,
 *   mode: BrotliMode,
 *   suffix: string,
 *   output: string | null,
 *   inputs: string[],
 *   informationAction: InformationAction,
 * }} CliOptions
 * @typedef {{
 *   input: string,
 *   output: string | null,
 * }} Job
 */

/**
 * @param {string} message
 * @returns {never}
 */
function usage_error(message) {
	throw new UsageError(message);
}

/**
 * @param {string} name
 * @param {string} text
 * @param {number} minimum
 * @param {number} maximum
 * @returns {number}
 */
function integer_option(name, text, minimum, maximum) {
	if (text.length === 0) {
		usage_error(`${name} requires a value`);
	}
	const value = Number(text);
	if (!Number.isInteger(value) || value < minimum || value > maximum) {
		usage_error(
			`${name} must be an integer from ${minimum} through ${maximum}`,
		);
	}
	return value;
}

/**
 * @param {string} name
 * @param {string | undefined} inlineValue
 * @param {string[]} arguments_
 * @param {number} index
 * @returns {{ value: string, index: number }}
 */
function long_value(name, inlineValue, arguments_, index) {
	if (inlineValue !== undefined) {
		if (inlineValue.length === 0) {
			usage_error(`${name} requires a value`);
		}
		return { value: inlineValue, index };
	}
	const nextIndex = index + 1;
	const value = arguments_[nextIndex];
	if (value === undefined) {
		usage_error(`${name} requires a value`);
	}
	return { value, index: nextIndex };
}

/**
 * @param {string} name
 * @param {string | undefined} inlineValue
 */
function reject_long_value(name, inlineValue) {
	if (inlineValue !== undefined) {
		usage_error(`${name} does not take a value`);
	}
}

/**
 * @param {CliOptions} options
 * @param {string} name
 * @param {string} value
 */
function set_value_option(options, name, value) {
	switch (name) {
		case "quality":
			options.quality = integer_option("--quality", value, 0, 11);
			return;
		case "lgwin": {
			const lgwin = integer_option("--lgwin", value, 0, 24);
			if (lgwin !== 0 && lgwin < 10) {
				usage_error("--lgwin must be 0 or an integer from 10 through 24");
			}
			options.lgwin = lgwin === 0 ? DEFAULT_LGWIN : lgwin;
			return;
		}
		case "mode":
			if (value !== "generic" && value !== "text" && value !== "font") {
				usage_error("--mode must be generic, text, or font");
			}
			options.mode = value;
			return;
		case "output":
			if (value.length === 0) {
				usage_error("--output requires a non-empty file name");
			}
			options.output = value;
			return;
		case "suffix":
			if (value.length === 0) {
				usage_error("--suffix requires a non-empty value");
			}
			options.suffix = value;
			return;
		default:
			usage_error(`internal argument parser error for --${name}`);
	}
}

/**
 * @param {string[]} arguments_
 * @returns {CliOptions}
 */
function parse_arguments(arguments_) {
	/** @type {CliOptions} */
	const options = {
		decompress: false,
		test: false,
		stdout: false,
		force: false,
		removeSource: false,
		squash: false,
		copyStat: true,
		verbose: false,
		quality: DEFAULT_QUALITY,
		lgwin: DEFAULT_LGWIN,
		mode: "generic",
		suffix: DEFAULT_SUFFIX,
		output: null,
		inputs: [],
		informationAction: null,
	};

	for (let index = 0; index < arguments_.length; index++) {
		const argument = arguments_[index];
		if (argument === undefined) {
			continue;
		}
		if (argument === "--") {
			options.inputs.push(...arguments_.slice(index + 1));
			break;
		}
		if (argument === "-" || !argument.startsWith("-")) {
			options.inputs.push(argument);
			continue;
		}
		if (argument.startsWith("--")) {
			const separator = argument.indexOf("=");
			const name = separator === -1 ? argument : argument.slice(0, separator);
			const inlineValue =
				separator === -1 ? undefined : argument.slice(separator + 1);
			switch (name) {
				case "--stdout":
					reject_long_value(name, inlineValue);
					options.stdout = true;
					break;
				case "--decompress":
					reject_long_value(name, inlineValue);
					options.decompress = true;
					break;
				case "--force":
					reject_long_value(name, inlineValue);
					options.force = true;
					break;
				case "--help":
					reject_long_value(name, inlineValue);
					options.informationAction = "help";
					break;
				case "--rm":
					reject_long_value(name, inlineValue);
					options.removeSource = true;
					break;
				case "--squash":
					reject_long_value(name, inlineValue);
					options.squash = true;
					break;
				case "--keep":
					reject_long_value(name, inlineValue);
					options.removeSource = false;
					break;
				case "--no-copy-stat":
					reject_long_value(name, inlineValue);
					options.copyStat = false;
					break;
				case "--test":
					reject_long_value(name, inlineValue);
					options.test = true;
					options.decompress = true;
					break;
				case "--verbose":
					reject_long_value(name, inlineValue);
					options.verbose = true;
					break;
				case "--version":
					reject_long_value(name, inlineValue);
					options.informationAction = "version";
					break;
				case "--best":
					reject_long_value(name, inlineValue);
					options.quality = 11;
					break;
				case "--quality":
					{
						const result = long_value(name, inlineValue, arguments_, index);
						set_value_option(options, "quality", result.value);
						index = result.index;
					}
					break;
				case "--lgwin":
					{
						const result = long_value(name, inlineValue, arguments_, index);
						set_value_option(options, "lgwin", result.value);
						index = result.index;
					}
					break;
				case "--mode":
					{
						const result = long_value(name, inlineValue, arguments_, index);
						set_value_option(options, "mode", result.value);
						index = result.index;
					}
					break;
				case "--output":
					{
						const result = long_value(name, inlineValue, arguments_, index);
						set_value_option(options, "output", result.value);
						index = result.index;
					}
					break;
				case "--suffix":
					{
						const result = long_value(name, inlineValue, arguments_, index);
						set_value_option(options, "suffix", result.value);
						index = result.index;
					}
					break;
				case "--large_window":
				case "--large-window":
				case "--comment":
				case "--dictionary":
				case "--concatenated":
					return usage_error(`${name} is not supported by this RFC 7932 codec`);
				default:
					return usage_error(`unknown option ${name}`);
			}
			continue;
		}

		if (/^-[0-9]{2,}$/.test(argument)) {
			usage_error(
				`${argument} is not a level shortcut; use --quality=${argument.slice(1)}`,
			);
		}
		for (let shortIndex = 1; shortIndex < argument.length; shortIndex++) {
			const option = argument[shortIndex];
			if (option === undefined) {
				continue;
			}
			if (option >= "0" && option <= "9") {
				options.quality = Number(option);
				continue;
			}
			switch (option) {
				case "c":
					options.stdout = true;
					break;
				case "d":
					options.decompress = true;
					break;
				case "f":
					options.force = true;
					break;
				case "h":
					options.informationAction = "help";
					break;
				case "j":
					options.removeSource = true;
					break;
				case "s":
					options.squash = true;
					break;
				case "k":
					options.removeSource = false;
					break;
				case "n":
					options.copyStat = false;
					break;
				case "t":
					options.test = true;
					options.decompress = true;
					break;
				case "v":
					options.verbose = true;
					break;
				case "V":
					options.informationAction = "version";
					break;
				case "Z":
					options.quality = 11;
					break;
				case "q":
				case "w":
				case "o":
				case "S": {
					let value = argument.slice(shortIndex + 1);
					if (value.length === 0) {
						index++;
						value = arguments_[index] ?? "";
					}
					const names = {
						q: "quality",
						w: "lgwin",
						o: "output",
						S: "suffix",
					};
					const name = names[option];
					if (value.length === 0 || name === undefined) {
						usage_error(`-${option} requires a value`);
					}
					set_value_option(options, name, value);
					shortIndex = argument.length;
					break;
				}
				case "C":
				case "D":
				case "K":
					return usage_error(
						`-${option} is not supported by this RFC 7932 codec`,
					);
				default:
					return usage_error(`unknown option -${option}`);
			}
		}
	}
	return options;
}

/**
 * @param {CliOptions} options
 * @returns {Job[]}
 */
function build_jobs(options) {
	const inputs = options.inputs.length === 0 ? ["-"] : options.inputs;
	if (options.stdout && options.output !== null) {
		usage_error("--stdout and --output cannot be used together");
	}
	if (options.output !== null && inputs.length !== 1) {
		usage_error("--output requires exactly one input");
	}
	if (inputs.length > 1 && inputs.includes("-")) {
		usage_error("standard input cannot be combined with other inputs");
	}
	if (options.stdout && inputs.length > 1) {
		usage_error("--stdout supports only one input");
	}
	if (options.test) {
		if (options.stdout || options.output !== null) {
			usage_error("--test does not produce output");
		}
		if (options.removeSource || options.squash) {
			usage_error("--test cannot remove source or output files");
		}
	}
	if (options.squash && options.decompress) {
		usage_error("--squash is only valid while compressing");
	}

	/** @type {Job[]} */
	const jobs = [];
	for (const input of inputs) {
		/** @type {string | null} */
		let output = null;
		if (!options.test) {
			if (options.stdout) {
				output = "-";
			} else if (options.output !== null) {
				output = options.output;
			} else if (input === "-") {
				output = "-";
			} else if (options.decompress) {
				if (!input.endsWith(options.suffix)) {
					usage_error(
						`${input} does not end with the ${JSON.stringify(options.suffix)} suffix`,
					);
				}
				output = input.slice(0, -options.suffix.length);
				if (output.length === 0) {
					usage_error(`cannot derive an output name from ${input}`);
				}
			} else {
				output = `${input}${options.suffix}`;
			}
		}
		jobs.push({ input, output });
	}

	const inputPaths = new Set(
		jobs
			.filter(({ input }) => input !== "-")
			.map(({ input }) => resolve(input)),
	);
	const outputPaths = new Set();
	for (const job of jobs) {
		if (job.output === null || job.output === "-") {
			continue;
		}
		const outputPath = resolve(job.output);
		if (job.input !== "-" && outputPath === resolve(job.input)) {
			usage_error(`${job.input} cannot be both input and output`);
		}
		if (inputPaths.has(outputPath)) {
			usage_error(`${job.output} is also an input file`);
		}
		if (outputPaths.has(outputPath)) {
			usage_error(`${job.output} would be written more than once`);
		}
		outputPaths.add(outputPath);
	}
	if (
		options.squash &&
		jobs.some(({ output }) => output === null || output === "-")
	) {
		usage_error("--squash requires a file output");
	}
	return jobs;
}

/**
 * @param {unknown} error
 * @returns {string | undefined}
 */
function error_code(error) {
	if (typeof error !== "object" || error === null || !("code" in error)) {
		return undefined;
	}
	const code = error.code;
	return typeof code === "string" ? code : undefined;
}

/**
 * @param {string} path
 * @returns {Promise<boolean>}
 */
async function path_exists(path) {
	try {
		await lstat(path);
		return true;
	} catch (error) {
		if (error_code(error) === "ENOENT") {
			return false;
		}
		throw error;
	}
}

/**
 * @param {Job[]} jobs
 * @param {boolean} force
 */
async function preflight_outputs(jobs, force) {
	if (force) {
		return;
	}
	for (const { output } of jobs) {
		if (output !== null && output !== "-" && (await path_exists(output))) {
			usage_error(`output file ${output} already exists; use --force`);
		}
	}
}

/**
 * @param {BrotliEncoder | BrotliDecoder} codec
 * @param {import("node:stream").Writable | null} output
 * @returns {Promise<number>}
 */
async function drain_output(codec, output) {
	let bytes = 0;
	for (;;) {
		const view = codec.pull();
		if (!view) {
			return bytes;
		}
		bytes += view.length;
		if (output !== null) {
			const owned = Buffer.from(view);
			if (!output.write(owned)) {
				if (output.errored) {
					throw output.errored;
				}
				await new Promise((resolveDrain, rejectDrain) => {
					const cleanup = () => {
						output.off("drain", handleDrain);
						output.off("error", handleError);
					};
					const handleDrain = () => {
						cleanup();
						resolveDrain(undefined);
					};
					/** @param {Error} error */
					const handleError = (error) => {
						cleanup();
						rejectDrain(error);
					};
					output.once("drain", handleDrain);
					output.once("error", handleError);
					if (output.errored) {
						handleError(output.errored);
					}
				});
			}
		}
	}
}

/**
 * @param {BrotliEncoder | BrotliDecoder} codec
 * @param {AsyncIterable<Uint8Array>} input
 * @param {import("node:stream").Writable | null} output
 * @returns {Promise<{ inputBytes: number, outputBytes: number }>}
 */
async function transform(codec, input, output) {
	let inputBytes = 0;
	let outputBytes = 0;
	for await (const chunk of input) {
		if (codec.finished) {
			throw new Error("trailing data after Brotli stream");
		}
		inputBytes += chunk.length;
		let offset = 0;
		while (offset < chunk.length) {
			const consumed = codec.write(chunk.subarray(offset));
			offset += consumed;
			outputBytes += await drain_output(codec, output);
			if (codec.finished && offset !== chunk.length) {
				throw new Error("trailing data after Brotli stream");
			}
		}
	}
	while (!codec.finish()) {
		outputBytes += await drain_output(codec, output);
	}
	outputBytes += await drain_output(codec, output);
	return { inputBytes, outputBytes };
}

let temporaryCounter = 0;

/**
 * @param {string} outputPath
 * @returns {Promise<{
 *   path: string,
 *   stream: import("node:fs").WriteStream,
 * }>}
 */
async function temporary_output(outputPath) {
	const directory = dirname(outputPath);
	const name = basename(outputPath);
	for (let attempt = 0; attempt < 100; attempt++) {
		temporaryCounter++;
		const temporaryPath = join(
			directory,
			`.${name}.${TEMPORARY_TAG}-${process.pid}-${temporaryCounter}.tmp`,
		);
		try {
			const handle = await open(temporaryPath, "wx", 0o666);
			return {
				path: temporaryPath,
				stream: handle.createWriteStream(),
			};
		} catch (error) {
			if (error_code(error) !== "EEXIST") {
				throw error;
			}
		}
	}
	throw new Error(`could not create a temporary file for ${outputPath}`);
}

/**
 * @param {import("node:stream").Writable} stream
 * @param {Promise<void>} completion
 */
async function close_output(stream, completion) {
	stream.end();
	await completion;
}

/**
 * @param {import("node:stream").Writable} stream
 * @param {Promise<void>} completion
 */
async function abandon_output(stream, completion) {
	if (!stream.destroyed) {
		stream.destroy();
	}
	try {
		await completion;
	} catch {
		// The original processing error is more useful.
	}
}

/**
 * @param {Job} job
 * @param {CliOptions} options
 * @param {WebAssembly.Module} wasmModule
 */
async function process_job(job, options, wasmModule) {
	/** @type {import("node:fs").Stats | null} */
	let inputStats = null;
	/** @type {AsyncIterable<Uint8Array>} */
	let input = process.stdin;
	if (job.input !== "-") {
		inputStats = await stat(job.input);
		input = createReadStream(job.input);
	}
	const sizeHint =
		inputStats?.isFile() &&
		Number.isSafeInteger(inputStats.size) &&
		inputStats.size <= MAX_SIZE_HINT
			? inputStats.size
			: 0;
	const codec = options.decompress
		? await new BrotliDecoder().initialize(wasmModule)
		: await new BrotliEncoder().initialize(wasmModule, {
				quality: options.quality,
				lgwin: options.lgwin,
				mode: options.mode,
				sizeHint,
			});

	/** @type {import("node:stream").Writable | null} */
	let output = null;
	/** @type {string | null} */
	let temporaryPath = null;
	/** @type {Promise<void> | null} */
	let outputCompletion = null;
	let fileOutput = false;
	if (job.output === "-") {
		output = process.stdout;
	} else if (job.output !== null) {
		const temporary = await temporary_output(job.output);
		temporaryPath = temporary.path;
		output = temporary.stream;
		outputCompletion = finished(output);
		void outputCompletion.catch(() => {});
		fileOutput = true;
	}

	let result;
	try {
		result = await transform(codec, input, output);
		if (fileOutput && output !== null && outputCompletion !== null) {
			await close_output(output, outputCompletion);
		}
	} catch (error) {
		if (fileOutput && output !== null && outputCompletion !== null) {
			await abandon_output(output, outputCompletion);
		}
		if (temporaryPath !== null) {
			await rm(temporaryPath, { force: true });
		}
		throw error;
	}

	let squashed = false;
	if (job.output !== null && job.output !== "-" && temporaryPath !== null) {
		try {
			if (options.copyStat && inputStats !== null) {
				await chmod(temporaryPath, inputStats.mode);
				await utimes(temporaryPath, inputStats.atime, inputStats.mtime);
			}
			if (options.squash && result.outputBytes >= result.inputBytes) {
				await rm(temporaryPath, { force: true });
				temporaryPath = null;
				if (options.force) {
					await rm(job.output, { force: true });
				}
				squashed = true;
			} else {
				if (options.force) {
					await rm(job.output, { force: true });
				} else if (await path_exists(job.output)) {
					usage_error(`output file ${job.output} already exists; use --force`);
				}
				await rename(temporaryPath, job.output);
				temporaryPath = null;
			}
		} finally {
			if (temporaryPath !== null) {
				await rm(temporaryPath, { force: true });
			}
		}
	}

	if (options.removeSource && job.input !== "-" && !options.test && !squashed) {
		await unlink(job.input);
	}
	if (options.verbose) {
		if (options.test) {
			console.error(`${job.input}: OK`);
		} else if (squashed) {
			console.error(
				`${job.input}: output removed (${result.outputBytes} >= ${result.inputBytes} bytes)`,
			);
		} else {
			console.error(
				`${job.input} -> ${job.output} (${result.inputBytes} -> ${result.outputBytes} bytes)`,
			);
		}
	}
}

async function package_version() {
	const text = await readFile(
		new URL("../package.json", import.meta.url),
		"utf8",
	);
	const metadata = /** @type {{ version?: unknown }} */ (JSON.parse(text));
	if (typeof metadata.version !== "string") {
		throw new Error("package version is missing");
	}
	return metadata.version;
}

async function main() {
	const options = parse_arguments(process.argv.slice(2));
	if (options.informationAction === "help") {
		console.log(HELP);
		return;
	}
	if (options.informationAction === "version") {
		console.log(`${PROGRAM} ${await package_version()}`);
		return;
	}
	const jobs = build_jobs(options);
	await preflight_outputs(jobs, options.force);
	const wasmBytes = await readFile(
		new URL("../lib/brotli.wasm", import.meta.url),
	);
	const wasmModule = await WebAssembly.compile(wasmBytes);
	for (const job of jobs) {
		await process_job(job, options, wasmModule);
	}
}

try {
	await main();
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`${PROGRAM}: ${message}`);
	if (error instanceof UsageError) {
		console.error(`Try '${PROGRAM} --help' for more information.`);
	}
	process.exitCode = 1;
}
