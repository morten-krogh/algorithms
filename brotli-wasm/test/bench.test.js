import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	closeSync,
	mkdtempSync,
	openSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const BENCH_PATH = fileURLToPath(new URL("../bench/bench.js", import.meta.url));

test("quick benchmark prints validated encoder and decoder metrics", async () => {
	const directory = mkdtempSync(join(tmpdir(), "brotli-wasm-bench-"));
	const outputPath = join(directory, "output");
	const errorPath = join(directory, "error");
	const outputFd = openSync(outputPath, "w");
	const errorFd = openSync(errorPath, "w");
	const child = spawnSync(
		process.execPath,
		[BENCH_PATH, "--quick", "--check"],
		{
			stdio: ["ignore", outputFd, errorFd],
		},
	);
	closeSync(outputFd);
	closeSync(errorFd);
	const result = {
		code: child.status,
		stdout: readFileSync(outputPath, "utf8"),
		stderr: readFileSync(errorPath, "utf8"),
	};
	rmSync(directory, { recursive: true });
	assert.deepEqual(result, {
		code: 0,
		stdout: result.stdout,
		stderr: "",
	});
	assert.match(
		result.stdout,
		/Compression \(MiB\/s; ratios use WAT owned output\)/,
	);
	assert.match(
		result.stdout,
		/Decompression \(MiB\/s; ratios use WAT owned output\)/,
	);
	assert.match(result.stdout, /wat stream/);
	assert.match(result.stdout, /wat owned/);
	assert.match(result.stdout, /node owned/);
	assert.match(result.stdout, /rust owned/);
	assert.match(
		result.stdout,
		/Adaptive timing uses at least 20 ms per result\./,
	);
	assert.match(result.stdout, /Performance regression checks passed\./);
	assert.match(
		result.stdout,
		/^\s*text\s+4\s+65536(?:\s+\d+\.\d+){4}(?:\s+\d+\.\d+x){2}(?:\s+\d+){3}$/m,
	);
	assert.match(
		result.stdout,
		/^\s*text\s+4\s+65536(?:\s+\d+\.\d+){4}(?:\s+\d+\.\d+x){2}$/m,
	);
});
