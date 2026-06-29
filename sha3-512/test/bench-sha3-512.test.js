import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const BENCH_PATH = fileURLToPath(
	new URL("./bench-sha3-512.js", import.meta.url),
);
const SHA3_512_A3X4 =
	"c05d20aecc937fb4468311dea1bfdbbbcab84eda55785aaefc82e01393cc24466" +
	"2cb02bcc9a0953f1caad7d4e84400bc9e65d36c9a0e954be1262c862ab60a51";

/**
 * @param {readonly string[]} args
 * @returns {Promise<{ code: number | null, stdout: string, stderr: string }>}
 */
function run_bench(args) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [BENCH_PATH, ...args], {
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

test("bench-sha3-512.js runs a small SHA3-512 benchmark", async (_t) => {
	const result = await run_bench(["--message-size", "4", "--iterations", "2"]);

	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
	assert.match(result.stdout, /^algorithm: sha3-512$/m);
	assert.match(result.stdout, /^message_size_bytes: 4$/m);
	assert.match(result.stdout, /^iterations: 2$/m);
	assert.match(result.stdout, /^warmup_iterations: 1$/m);
	assert.match(result.stdout, /^total_ms: [0-9]+\.[0-9]{3}$/m);
	assert.match(result.stdout, /^hashes_per_second: [0-9]+\.[0-9]{3}$/m);
	assert.match(result.stdout, /^mib_per_second: [0-9]+\.[0-9]{3}$/m);
	assert.match(
		result.stdout,
		new RegExp(`^digest_hex: ${SHA3_512_A3X4}$`, "m"),
	);
});

test("bench-sha3-512.js supports equals-form arguments", async (_t) => {
	const result = await run_bench([
		"--message-size=0",
		"--iterations=1",
		"--warmup-iterations=0",
	]);

	assert.equal(result.code, 0);
	assert.match(result.stdout, /^algorithm: sha3-512$/m);
	assert.match(result.stdout, /^message_size_bytes: 0$/m);
	assert.match(result.stdout, /^iterations: 1$/m);
	assert.match(result.stdout, /^warmup_iterations: 0$/m);
	assert.match(result.stdout, /^digest_hex: [0-9a-f]+$/m);
});

test("bench-sha3-512.js rejects unknown options", async (_t) => {
	const result = await run_bench([
		"--algorithm",
		"sha3-512",
		"--message-size",
		"4",
		"--iterations",
		"1",
	]);

	assert.equal(result.code, 1);
	assert.match(result.stderr, /Unknown option: --algorithm/);
	assert.match(result.stderr, /Usage:/);
});

test("bench-sha3-512.js rejects missing required arguments", async (_t) => {
	const result = await run_bench(["--message-size", "4"]);

	assert.equal(result.code, 1);
	assert.match(result.stderr, /Missing required option --iterations/);
	assert.match(result.stderr, /Usage:/);
});

test("bench-sha3-512.js rejects negative message sizes", async (_t) => {
	const result = await run_bench(["--message-size", "-1", "--iterations", "1"]);

	assert.equal(result.code, 1);
	assert.match(result.stderr, /--message-size must be an integer/);
	assert.match(result.stderr, /Usage:/);
});

test("bench-sha3-512.js rejects zero iterations", async (_t) => {
	const result = await run_bench(["--message-size", "4", "--iterations", "0"]);

	assert.equal(result.code, 1);
	assert.match(result.stderr, /--iterations must be greater than zero/);
	assert.match(result.stderr, /Usage:/);
});

test("bench-sha3-512.js rejects negative warmup iterations", async (_t) => {
	const result = await run_bench([
		"--message-size",
		"4",
		"--iterations",
		"1",
		"--warmup-iterations",
		"-1",
	]);

	assert.equal(result.code, 1);
	assert.match(result.stderr, /--warmup-iterations must be an integer/);
	assert.match(result.stderr, /Usage:/);
});
