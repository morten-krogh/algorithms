import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

const CLI_PATH = fileURLToPath(new URL("../bin/shake-256.js", import.meta.url));

const EMPTY_DIGEST_32 =
	"46b9dd2b0ba88d13233b3feb743eeb243fcd52ea62b81b82b50c27646ed5762f";
const ABC_DIGEST_32 =
	"483366601360a8771c6863080cc4114d8db44530f8f1e1ee4f94ea37e78b5739";
const USAGE = "Usage: shake-256 <output-bytes> < input\n";

/**
 * @param {string[]} args
 * @param {Uint8Array} input
 * @returns {Promise<{ code: number | null, stdout: string, stderr: string }>}
 */
function run_cli(args, input) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [CLI_PATH, ...args], {
			stdio: ["pipe", "pipe", "pipe"],
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
		child.stdin.end(input);
	});
}

test("empty stdin hashes to the empty-message output", async (_t) => {
	const result = await run_cli(["32"], new Uint8Array(0));

	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
	assert.equal(result.stdout, `${EMPTY_DIGEST_32}\n`);
});

test("abc via stdin matches the published vector", async (_t) => {
	const result = await run_cli(["32"], new TextEncoder().encode("abc"));

	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
	assert.equal(result.stdout, `${ABC_DIGEST_32}\n`);
});

test("binary stdin crossing the rate boundary matches node:crypto", async (_t) => {
	const input = Uint8Array.from({ length: 65537 }, (_, i) => (i * 31) & 0xff);
	const expected = createHash("shake256", { outputLength: 64 })
		.update(input)
		.digest("hex");

	const result = await run_cli(["64"], input);

	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
	assert.equal(result.stdout, `${expected}\n`);
});

test("zero output bytes prints an empty line", async (_t) => {
	const result = await run_cli(["0"], new TextEncoder().encode("abc"));

	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
	assert.equal(result.stdout, "\n");
});

test("missing or malformed output length is rejected", async (_t) => {
	for (const args of [[], ["abc"], ["-5"], ["07"], ["32", "extra"]]) {
		const result = await run_cli(args, new Uint8Array(0));

		assert.equal(result.code, 1, `args ${JSON.stringify(args)}`);
		assert.equal(result.stdout, "");
		assert.equal(result.stderr, USAGE);
	}
});
