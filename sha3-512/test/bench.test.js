import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const BENCH_PATH = fileURLToPath(new URL("../bench/bench.js", import.meta.url));

/** Message sizes the bench is expected to report, one table row each. */
const EXPECTED_SIZES = [0, 64, 1024, 16384, 262144, 1048576, 10485760];

/**
 * @returns {Promise<{ code: number | null, stdout: string, stderr: string }>}
 */
function run_bench() {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [BENCH_PATH], {
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.on("error", reject);
		child.on("close", (code) => {
			resolve({ code, stdout, stderr });
		});
	});
}

test("bench prints a table header", async (_t) => {
	const result = await run_bench();

	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
	assert.match(result.stdout, /size\(B\)/);
	assert.match(result.stdout, /wasm MiB\/s/);
	assert.match(result.stdout, /node MiB\/s/);
	assert.match(result.stdout, /wasm\/node performance/);
});

test("bench prints one numeric row per message size", async (_t) => {
	const result = await run_bench();

	assert.equal(result.code, 0);
	for (const size of EXPECTED_SIZES) {
		// size, iters, then wasm ms/h-s/MiB-s, node ms/h-s/MiB-s, wasm/node perf (Nx).
		const row = new RegExp(
			`^\\s*${size}\\s+\\d+\\s+\\d+\\.\\d+\\s+\\d+\\s+\\d+\\.\\d+\\s+\\d+\\.\\d+\\s+\\d+\\s+\\d+\\.\\d+\\s+\\d+\\.\\d+x$`,
			"m",
		);
		assert.match(result.stdout, row);
	}
});
