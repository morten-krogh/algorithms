#!/bin/sh
set -eu

bin=${1:-bin/sha3-256}
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/sha3-256-test.XXXXXX")
trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM

fail() {
	echo "CLI test failed: $1" >&2
	exit 1
}

expected_empty=a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a
expected_abc=3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532
expected_zeros=297bd2ebb1b908587cb433e50c1b422a17e4d3e8956e1cad3aa8ab16a2a4aafd

actual=$("$bin" </dev/null)
[ "$actual" = "$expected_empty" ] || fail "empty stdin digest"

actual=$(printf abc | "$bin")
[ "$actual" = "$expected_abc" ] || fail "abc digest"

dd if=/dev/zero of="$tmp_dir/zeros" bs=65537 count=1 2>/dev/null
actual=$("$bin" <"$tmp_dir/zeros")
[ "$actual" = "$expected_zeros" ] || fail "65537-byte binary digest"

printf abc | "$bin" >"$tmp_dir/output"
output_bytes=$(wc -c <"$tmp_dir/output" | tr -d ' ')
[ "$output_bytes" = 65 ] || fail "output must contain 64 hex bytes and newline"

if "$bin" extra >"$tmp_dir/extra.out" 2>"$tmp_dir/extra.err"; then
	fail "extra operand returned success"
fi
grep -Fx "Usage: sha3-256 < input" "$tmp_dir/extra.err" >/dev/null ||
	fail "usage diagnostic"

if "$bin" 0<&- >"$tmp_dir/read.out" 2>"$tmp_dir/read.err"; then
	fail "closed stdin returned success"
fi
grep -Fx "sha3-256: failed to read stdin" "$tmp_dir/read.err" >/dev/null ||
	fail "read diagnostic"

echo "SHA3-256 CLI tests passed"
