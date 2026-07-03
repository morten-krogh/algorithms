import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const PRNG_PATH = fileURLToPath(
	new URL("../bin/philox-4x32-prng.js", import.meta.url),
);

/**
 * @param {readonly string[]} args
 * @returns {Promise<{ code: number | null, stdout: Buffer, stderr: string }>}
 */
function run_prng(args) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [PRNG_PATH, ...args], {
			stdio: ["ignore", "pipe", "pipe"],
		});

		/** @type {Buffer[]} */
		const stdout_chunks = [];
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			stdout_chunks.push(chunk);
		});
		child.stderr.setEncoding("utf8");
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.on("error", reject);
		child.on("close", (code) => {
			resolve({ code, stdout: Buffer.concat(stdout_chunks), stderr });
		});
	});
}

test("philox-4x32-prng writes hex for the requested number of bytes", async (_t) => {
	const result = await run_prng(["17", "0", "0", "0", "0", "0", "0"]);

	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
	assert.equal(result.stdout.length, 34);
	assert.equal(
		result.stdout.toString("utf8"),
		"d5e827668dc569e14cac57bcd8db009ba4",
	);
});

test("philox-4x32-prng supports outputs larger than one WASM page", async (_t) => {
	const result = await run_prng(["65537", "0", "0", "0", "0", "0", "0"]);

	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
	assert.equal(result.stdout.length, 65537 * 2);
	assert.equal(
		result.stdout.subarray(0, 32).toString("utf8"),
		"d5e827668dc569e14cac57bcd8db009b",
	);
});

test("philox-4x32-prng rejects invalid arguments", async (_t) => {
	const result = await run_prng(["16", "0", "0", "0", "0", "0"]);

	assert.equal(result.code, 1);
	assert.equal(result.stdout.length, 0);
	assert.match(result.stderr, /Usage: philox-4x32-prng/);
});
