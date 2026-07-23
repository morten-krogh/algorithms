import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import {
	chmodSync,
	closeSync,
	existsSync,
	mkdtempSync,
	openSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";

const CLI_PATH = fileURLToPath(new URL("../bin/brotli.js", import.meta.url));
const EMPTY = Buffer.alloc(0);
const INPUT = Buffer.from(
	"Streaming command-line Brotli should remain binary safe. ".repeat(4096),
);

/**
 * @param {string[]} arguments_
 * @param {Uint8Array} [input]
 * @param {string} [cwd]
 * @returns {{
 *   code: number | null,
 *   stdout: Buffer,
 *   stderr: string,
 * }}
 */
function run_cli(arguments_, input = EMPTY, cwd = process.cwd()) {
	const directory = mkdtempSync(join(tmpdir(), "brotli-wasm-cli-capture-"));
	const inputPath = join(directory, "input");
	const outputPath = join(directory, "output");
	const errorPath = join(directory, "error");
	writeFileSync(inputPath, input);
	const inputFd = openSync(inputPath, "r");
	const outputFd = openSync(outputPath, "w");
	const errorFd = openSync(errorPath, "w");
	const child = spawnSync(process.execPath, [CLI_PATH, ...arguments_], {
		cwd,
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

/**
 * @param {string} name
 * @returns {string}
 */
function temporary_directory(name) {
	return mkdtempSync(join(tmpdir(), `brotli-wasm-${name}-`));
}

test("CLI compresses stdin with attached and equals options", () => {
	const result = run_cli(
		["--quality=6", "--lgwin", "0", "--mode=text", "-c"],
		INPUT,
	);
	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
	assert(brotliDecompressSync(result.stdout).equals(INPUT));
});

test("CLI decompresses binary stdin", () => {
	const compressed = brotliCompressSync(INPUT, {
		params: {
			[constants.BROTLI_PARAM_QUALITY]: 11,
			[constants.BROTLI_PARAM_LGWIN]: 24,
		},
	});
	const result = run_cli(["--decompress"], compressed);
	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
	assert(result.stdout.equals(INPUT));
});

test("CLI reports help, version, invalid arguments, and unsupported features", () => {
	const help = run_cli(["--help"]);
	assert.equal(help.code, 0);
	assert.equal(help.stderr, "");
	assert.match(help.stdout.toString(), /^Usage: brotli\.js/);
	assert.match(help.stdout.toString(), /-9kf is the same as -9 -k -f/);

	const version = run_cli(["--version"]);
	assert.equal(version.code, 0);
	assert.equal(version.stderr, "");
	assert.match(version.stdout.toString(), /^brotli\.js 1\.0\.0\n$/);

	const invalid = run_cli(["--quality=12"]);
	assert.equal(invalid.code, 1);
	assert.equal(invalid.stdout.length, 0);
	assert.match(
		invalid.stderr,
		/--quality must be an integer from 0 through 11/,
	);
	assert.match(invalid.stderr, /Try 'brotli\.js --help'/);

	const unsupported = run_cli(["--dictionary=words"]);
	assert.equal(unsupported.code, 1);
	assert.match(unsupported.stderr, /--dictionary is not supported/);

	const conflict = run_cli(["--stdout", "--output=result"]);
	assert.equal(conflict.code, 1);
	assert.match(
		conflict.stderr,
		/--stdout and --output cannot be used together/,
	);
});

test("CLI handles default file names, clustered flags, and force", () => {
	const directory = temporary_directory("files");
	try {
		const sourcePath = join(directory, "sample");
		const compressedPath = `${sourcePath}.br`;
		writeFileSync(sourcePath, INPUT);

		const first = run_cli(["-4k", "sample"], EMPTY, directory);
		assert.equal(first.code, 0, first.stderr);
		assert.equal(first.stdout.length, 0);
		assert(existsSync(sourcePath));
		assert(brotliDecompressSync(readFileSync(compressedPath)).equals(INPUT));

		const originalOutput = readFileSync(compressedPath);
		const refused = run_cli(["-4", "sample"], EMPTY, directory);
		assert.equal(refused.code, 1);
		assert.match(refused.stderr, /already exists; use --force/);
		assert(readFileSync(compressedPath).equals(originalOutput));

		const forced = run_cli(["-9kf", "sample"], EMPTY, directory);
		assert.equal(forced.code, 0, forced.stderr);
		assert(existsSync(sourcePath));
		assert(brotliDecompressSync(readFileSync(compressedPath)).equals(INPUT));

		const named = run_cli(["-d", "-orestored", "sample.br"], EMPTY, directory);
		assert.equal(named.code, 0, named.stderr);
		assert(readFileSync(join(directory, "restored")).equals(INPUT));

		rmSync(sourcePath);
		const decompressed = run_cli(["-d", "sample.br"], EMPTY, directory);
		assert.equal(decompressed.code, 0, decompressed.stderr);
		assert(readFileSync(sourcePath).equals(INPUT));
		assert(existsSync(compressedPath));
	} finally {
		rmSync(directory, { recursive: true });
	}
});

test("CLI supports multiple files, custom suffixes, and -- filenames", () => {
	const directory = temporary_directory("multiple");
	try {
		const first = Buffer.from("first input ".repeat(512));
		const second = Buffer.from("second input ".repeat(512));
		writeFileSync(join(directory, "first"), first);
		writeFileSync(join(directory, "second"), second);
		writeFileSync(join(directory, "-named"), first);

		const compressed = run_cli(
			["-q0", "--suffix=.brotli", "first", "second"],
			EMPTY,
			directory,
		);
		assert.equal(compressed.code, 0, compressed.stderr);
		assert(
			brotliDecompressSync(
				readFileSync(join(directory, "first.brotli")),
			).equals(first),
		);
		assert(
			brotliDecompressSync(
				readFileSync(join(directory, "second.brotli")),
			).equals(second),
		);

		rmSync(join(directory, "first"));
		rmSync(join(directory, "second"));
		const decompressed = run_cli(
			["-d", "-S.brotli", "first.brotli", "second.brotli"],
			EMPTY,
			directory,
		);
		assert.equal(decompressed.code, 0, decompressed.stderr);
		assert(readFileSync(join(directory, "first")).equals(first));
		assert(readFileSync(join(directory, "second")).equals(second));

		const dashed = run_cli(["-0", "--", "-named"], EMPTY, directory);
		assert.equal(dashed.code, 0, dashed.stderr);
		assert(
			brotliDecompressSync(readFileSync(join(directory, "-named.br"))).equals(
				first,
			),
		);
	} finally {
		rmSync(directory, { recursive: true });
	}
});

test("CLI removes sources only after useful output is committed", () => {
	const directory = temporary_directory("removal");
	try {
		const removable = join(directory, "removable");
		writeFileSync(removable, INPUT);
		const removed = run_cli(["-0j", "removable"], EMPTY, directory);
		assert.equal(removed.code, 0, removed.stderr);
		assert(!existsSync(removable));
		assert(existsSync(`${removable}.br`));

		const tiny = join(directory, "tiny");
		writeFileSync(tiny, Uint8Array.of(1, 2, 3, 4));
		const squashed = run_cli(["-0sj", "tiny"], EMPTY, directory);
		assert.equal(squashed.code, 0, squashed.stderr);
		assert(existsSync(tiny));
		assert(!existsSync(`${tiny}.br`));
	} finally {
		rmSync(directory, { recursive: true });
	}
});

test("CLI copies file attributes unless -n is used", () => {
	const directory = temporary_directory("attributes");
	try {
		const copied = join(directory, "copied");
		const ordinary = join(directory, "ordinary");
		const timestamp = new Date("2020-01-02T03:04:05.000Z");
		writeFileSync(copied, INPUT);
		writeFileSync(ordinary, INPUT);
		chmodSync(copied, 0o640);
		chmodSync(ordinary, 0o640);
		utimesSync(copied, timestamp, timestamp);
		utimesSync(ordinary, timestamp, timestamp);

		const copiedResult = run_cli(["-0", "copied"], EMPTY, directory);
		assert.equal(copiedResult.code, 0, copiedResult.stderr);
		const copiedStats = statSync(`${copied}.br`);
		assert.equal(copiedStats.mode & 0o777, 0o640);
		assert(Math.abs(copiedStats.mtimeMs - timestamp.getTime()) < 1000);

		const ordinaryResult = run_cli(["-0n", "ordinary"], EMPTY, directory);
		assert.equal(ordinaryResult.code, 0, ordinaryResult.stderr);
		const ordinaryStats = statSync(`${ordinary}.br`);
		assert.equal(ordinaryStats.mode & 0o777, 0o666 & ~process.umask());
		assert(Math.abs(ordinaryStats.mtimeMs - timestamp.getTime()) >= 1000);
	} finally {
		rmSync(directory, { recursive: true });
	}
});

test("CLI tests integrity and preserves existing output after decode failure", () => {
	const directory = temporary_directory("integrity");
	try {
		const compressed = brotliCompressSync(INPUT);
		writeFileSync(join(directory, "good.br"), compressed);
		writeFileSync(
			join(directory, "corrupt.br"),
			Uint8Array.of(0xff, 0xff, 0xff, 0xff),
		);

		const integrity = run_cli(["-tv", "good.br"], EMPTY, directory);
		assert.equal(integrity.code, 0, integrity.stderr);
		assert.equal(integrity.stdout.length, 0);
		assert.match(integrity.stderr, /^good\.br: OK\n$/);
		assert(!existsSync(join(directory, "good")));

		const destination = join(directory, "restored");
		const sentinel = Buffer.from("existing output must survive");
		writeFileSync(destination, sentinel);
		const corrupt = run_cli(
			["--decompress", "--force", "--output=restored", "corrupt.br"],
			EMPTY,
			directory,
		);
		assert.equal(corrupt.code, 1);
		assert.equal(corrupt.stdout.length, 0);
		assert.match(corrupt.stderr, /Brotli decoding failed/);
		assert(readFileSync(destination).equals(sentinel));
		assert(
			!readdirSync(directory).some((name) => name.includes(".brotli-wasm-")),
		);
	} finally {
		rmSync(directory, { recursive: true });
	}
});
