import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

const CLI_PATH = fileURLToPath(new URL("../bin/sha3-512.js", import.meta.url));

const EMPTY_DIGEST =
	"a69f73cca23a9ac5c8b567dc185a756e97c982164fe25859e0d1dcc1475c80a615b2123af1f5f94c11e3e9402c3ac558f500199d95b6d3e301758586281dcd26";
const ABC_DIGEST =
	"b751850b1a57168a5693cd924b6b096e08f621827444f70d884f5d0240d2712e10e116e9192af3c91a7ec57647e3934057340b4cf408d5a56592f8274eec53f0";

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
	const expected = createHash("sha3-512").update(input).digest("hex");

	const result = await run_cli([], input);

	assert.equal(result.code, 0);
	assert.equal(result.stderr, "");
	assert.equal(result.stdout, `${expected}\n`);
});

test("operands are rejected with a usage error", async (_t) => {
	const result = await run_cli(["abc"], new Uint8Array(0));

	assert.equal(result.code, 1);
	assert.equal(result.stdout, "");
	assert.equal(result.stderr, "Usage: sha3-512 < input\n");
});
