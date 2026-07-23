import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import {
	closeSync,
	mkdtempSync,
	openSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";

const CLI_PATH = fileURLToPath(new URL("../bin/brotli.js", import.meta.url));
const INPUT = Buffer.from(
	"Streaming command-line Brotli should remain binary safe. ".repeat(4096),
);

/**
 * @param {string[]} arguments_
 * @param {Uint8Array} input
 * @returns {{
 *   code: number | null,
 *   stdout: Buffer,
 *   stderr: string,
 * }}
 */
function run_cli(arguments_, input) {
	const directory = mkdtempSync(join(tmpdir(), "brotli-wasm-cli-"));
	const inputPath = join(directory, "input");
	const outputPath = join(directory, "output");
	const errorPath = join(directory, "error");
	writeFileSync(inputPath, input);
	const inputFd = openSync(inputPath, "r");
	const outputFd = openSync(outputPath, "w");
	const errorFd = openSync(errorPath, "w");
	const child = spawnSync(process.execPath, [CLI_PATH, ...arguments_], {
		stdio: [inputFd, outputFd, errorFd],
	});
	closeSync(inputFd);
	closeSync(outputFd);
	closeSync(errorFd);
	const result = {
		code: child.status,
		stdout: readFileSync(outputPath),
		stderr: readFileSync(errorPath, "utf8"),
	};
	rmSync(directory, { recursive: true });
	return result;
}

test("CLI compresses stdin with selectable quality", async () => {
	const result = await run_cli(["--quality", "6", "--mode", "text"], INPUT);
	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
	assert(brotliDecompressSync(result.stdout).equals(INPUT));
});

test("CLI decompresses binary stdin", async () => {
	const compressed = brotliCompressSync(INPUT, {
		params: {
			[constants.BROTLI_PARAM_QUALITY]: 11,
			[constants.BROTLI_PARAM_LGWIN]: 24,
		},
	});
	const result = await run_cli(["--decompress"], compressed);
	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
	assert(result.stdout.equals(INPUT));
});

test("CLI reports invalid arguments and corrupt input", async () => {
	const invalid = await run_cli(["--quality", "12"], new Uint8Array());
	assert.equal(invalid.code, 1);
	assert.equal(invalid.stdout.length, 0);
	assert.match(invalid.stderr, /^Usage: brotli-wasm/);

	const corrupt = await run_cli(
		["--decompress"],
		Uint8Array.of(0xff, 0xff, 0xff, 0xff),
	);
	assert.equal(corrupt.code, 1);
	assert.equal(corrupt.stdout.length, 0);
	assert.match(corrupt.stderr, /Brotli decoding failed/);
});
