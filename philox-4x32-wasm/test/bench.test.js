import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const BENCH_PATH = fileURLToPath(new URL("../bench/bench.js", import.meta.url));
const EXPECTED_BLOCKS = [1, 16, 1024, 16384, 262144];

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
	assert.match(result.stdout, /blocks/);
	assert.match(result.stdout, /wasm MiB\/s/);
	assert.match(result.stdout, /js MiB\/s/);
	assert.match(result.stdout, /wasm\/js performance/);
});

test("bench prints one numeric row per block count", async (_t) => {
	const result = await run_bench();

	assert.equal(result.code, 0);
	for (const blocks of EXPECTED_BLOCKS) {
		const row = new RegExp(
			`^\\s*${blocks}\\s+\\d+\\s+\\d+\\.\\d+\\s+\\d+\\s+\\d+\\.\\d+\\s+\\d+\\.\\d+\\s+\\d+\\s+\\d+\\.\\d+\\s+\\d+\\.\\d+x$`,
			"m",
		);
		assert.match(result.stdout, row);
	}
});
