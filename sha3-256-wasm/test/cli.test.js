import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

const CLI_PATH = fileURLToPath(new URL("../bin/sha3-256.js", import.meta.url));

const EMPTY_DIGEST =
	"a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a";
const ABC_DIGEST =
	"3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532";

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

test("empty stdin hashes to the empty-message digest", async (_t) => {
	const result = await run_cli([], new Uint8Array(0));

	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
	assert.equal(result.stdout, `${EMPTY_DIGEST}\n`);
});

test("abc via stdin matches the published vector", async (_t) => {
	const result = await run_cli([], new TextEncoder().encode("abc"));

	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
	assert.equal(result.stdout, `${ABC_DIGEST}\n`);
});

test("binary stdin crossing the rate boundary matches node:crypto", async (_t) => {
	const input = Uint8Array.from({ length: 65537 }, (_, i) => (i * 31) & 0xff);
	const expected = createHash("sha3-256").update(input).digest("hex");

	const result = await run_cli([], input);

	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
	assert.equal(result.stdout, `${expected}\n`);
});

test("operands are rejected with a usage error", async (_t) => {
	const result = await run_cli(["abc"], new Uint8Array(0));

	assert.equal(result.code, 1);
	assert.equal(result.stdout, "");
	assert.equal(result.stderr, "Usage: sha3-256 < input\n");
});
