#!/bin/sh
set -eu

CLI=${1:-./bin/brotli}
CLI=$(realpath "$CLI")
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT HUP INT TERM

node - "$WORK/input" <<'NODE'
const fs = require("node:fs");
const path = process.argv[2];
const text = Buffer.from(
  "Streaming x86-64 assembly Brotli stays binary safe. ".repeat(70000),
);
fs.writeFileSync(path, text);
NODE

"$CLI" --quality=6 --lgwin 0 --mode=text -c \
  <"$WORK/input" >"$WORK/stdin.br"
"$CLI" --decompress <"$WORK/stdin.br" >"$WORK/stdin.out"
cmp "$WORK/input" "$WORK/stdin.out"

(
  cd "$WORK"
  "$CLI" -4k input
)
node - "$WORK/input" "$WORK/input.br" <<'NODE'
const fs = require("node:fs");
const zlib = require("node:zlib");
const input = fs.readFileSync(process.argv[2]);
const compressed = fs.readFileSync(process.argv[3]);
if (!zlib.brotliDecompressSync(compressed).equals(input)) process.exit(1);
NODE

if (cd "$WORK" && "$CLI" -4 input >out 2>error); then
  echo "expected existing-output refusal" >&2
  exit 1
fi
grep -q "already exists; use --force" "$WORK/error"
(cd "$WORK" && "$CLI" -9kf input)

rm "$WORK/input"
(cd "$WORK" && "$CLI" -d -orestored input.br)
cmp "$WORK/restored" "$WORK/stdin.out"

cp "$WORK/restored" "$WORK/first"
cp "$WORK/restored" "$WORK/second"
(
  cd "$WORK"
  "$CLI" -q0 --suffix=.brotli first second
  rm first second
  "$CLI" -d -S.brotli first.brotli second.brotli
)
cmp "$WORK/first" "$WORK/restored"
cmp "$WORK/second" "$WORK/restored"

printf tiny >"$WORK/tiny"
"$CLI" -q4 -w0 -c "$WORK/tiny" >"$WORK/window.br"
first_byte=$(od -An -tu1 -N1 "$WORK/window.br")
test $((first_byte & 127)) -eq 33
(cd "$WORK" && "$CLI" -0sj tiny)
test -f "$WORK/tiny"
test ! -e "$WORK/tiny.br"

cp "$WORK/restored" "$WORK/removable"
(cd "$WORK" && "$CLI" -0j removable)
test ! -e "$WORK/removable"
test -e "$WORK/removable.br"

(cd "$WORK" && "$CLI" -t input.br)
cp "$WORK/input.br" "$WORK/trailing.br"
printf x >>"$WORK/trailing.br"
if (cd "$WORK" && "$CLI" -t trailing.br >/dev/null 2>&1); then
  echo "expected trailing-data rejection" >&2
  exit 1
fi

"$CLI" --help | grep -q "^Usage: brotli"
test "$("$CLI" --version)" = "brotli 1.0.0"
if "$CLI" --quality=12 >/dev/null 2>"$WORK/error"; then
  exit 1
fi
grep -q "integer from 0 through 11" "$WORK/error"
if "$CLI" --dictionary=words >/dev/null 2>"$WORK/error"; then
  exit 1
fi
grep -q "not supported" "$WORK/error"
if "$CLI" -f -o "$WORK/restored" "$WORK/restored" >/dev/null 2>"$WORK/error"; then
  exit 1
fi
grep -q "also an input" "$WORK/error"

echo "brotli CLI tests passed"
