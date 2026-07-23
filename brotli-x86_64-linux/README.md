# Brotli for Linux x86-64

A complete RFC 7932 Brotli encoder and decoder whose release sources are
NASM assembly. It supports encoder qualities 0 through 11, generic/text/font
modes, standard 10–24 bit windows, streaming process/flush/finish, reset, and
strict single-stream decoding.

The public ABI, CPU feature gate, allocator boundary, freestanding runtime,
and Linux command-line driver are handwritten. The codec body and the
122,784-byte static dictionary are a checked-in assembly translation of
Google Brotli 1.2.0. `src/brotli.asm` is the single assembled core translation
unit and includes the generated NASM fragment `src/brotli_upstream.inc`; no C
source or Brotli library is used by a release build.

## Requirements

The codec targets x86-64-v4-class machines and has no scalar fallback. At
runtime it checks for AVX-512F/BW/DQ/VL/CD, AVX2, BMI1/2, LZCNT, POPCNT, and
operating-system support for ZMM/opmask state. This includes AMD Zen 4/5 and
appropriate Intel server processors.

Building requires GNU make, NASM 2.16 or newer, GCC (for linking), and `ar`.

```sh
make
make test
```

`make` produces:

- `bin/brotli` — a static, non-PIE Linux executable using raw syscalls and no
  libc or shared libraries.
- `build/libbrotli_asm.a` — the callback-allocated streaming library.

The tests use the installed Google Brotli shared libraries and Node.js only as
independent interoperability references; neither is a runtime dependency.

## Command line

With no file operand, or with `-`, the command reads standard input and writes
standard output:

```sh
bin/brotli -q6 < input.txt > input.txt.br
bin/brotli -d < input.txt.br > restored.txt
```

For named files, compression appends `.br` and decompression removes it.
Sources are kept by default:

```sh
bin/brotli -6 input.txt
bin/brotli -d input.txt.br
bin/brotli -0S.brotli first.txt second.txt
```

Quality 11 is the default. The CLI supports `-0` through `-9`, `-q`, `-Z`,
stdout (`-c`), decompression (`-d`), integrity testing (`-t`), named output
(`-o`), suffix selection (`-S`), forced replacement (`-f`), remove/keep
(`-j`/`-k`), non-expanding output (`-s`), metadata-copy control (`-n`),
verbosity (`-v`), window selection (`-w`), and
`--mode=generic|text|font`. Short flags may be grouped, so `-9kf` is
equivalent to `-9 -k -f`.

Named output is written to a temporary sibling and atomically renamed only
after successful completion. Existing output is preserved unless `-f` is
used, and a source is removed only after useful output has been committed.
Large-window streams, custom dictionaries, comments, and concatenated streams
are outside this implementation's command-line scope.

## C API

Include `src/brotli.h`. Every state receives caller-provided allocation and
release callbacks, so it works with libc, arenas, or an mmap-based runtime:

```c
brotli_asm_options options = {
    .quality = 6,
    .lgwin = 22,
    .mode = BROTLI_ASM_MODE_TEXT,
    .size_hint = input_size,
};
int error;
brotli_asm_state *state = brotli_asm_encoder_create(
    &options, allocate, release, opaque, &error);
```

Pass input/output pointer pairs to `brotli_asm_encoder_process` or
`brotli_asm_decoder_process` until they return `BROTLI_ASM_FINISHED`.
`BROTLI_ASM_NEEDS_INPUT` and `BROTLI_ASM_NEEDS_OUTPUT` identify which buffer
must be replenished. A decoder leaves bytes after the first complete stream
unconsumed. States may be discarded and reconstructed in place with the reset
functions.

The library has no mutable process-global state. Separate states can be used
concurrently; a single state must not be entered concurrently.

## Benchmark

```sh
make bench
bin/bench
bin/bench --check
bin/bench --target
```

The benchmark uses the same streaming create/process/destroy lifecycle and
the same compressed stream for this implementation and the installed Google
Brotli 1.2.0 reference. It verifies compressed sizes and reports encode and
decode MiB/s at q0, q4, q6, and q11. `--check` is the release regression gate:
each bulk q0/q4/q6 direction must retain at least 0.90x native throughput and
aggregate decoding at least 0.95x. `--target` retains the optimization goal:
q0/q4/q6 encoding and aggregate decoding must beat native by 5%, with no
individual decoder below 0.95x. q11 is reported separately because it is
intentionally much more expensive and measurement-sensitive.

On the AMD EPYC 9575F development host, sustained mixed-corpus throughput is
generally within a few percent of the distribution's native Brotli 1.2.0
library. O3 auto-vectorization was explicitly rejected after it slowed the
branch-heavy q4 decoder; the checked-in decoder preserves symbolic branch
labels and uses the faster measured O2 schedule. The handwritten runtime uses
exact-width scalar/SSE copies for small lengths and AVX-512 for bulk
copy/fill/move operations.

## Regeneration and provenance

The release build does not run a generator. To reproduce
`src/brotli_upstream.inc`, check out Google Brotli commit
`028fb5a23661f123017c060daa546b55cf4bde29` (v1.2.0), build ObjConv 2.16, and
run:

```sh
python3 tools/generate-upstream-asm.py \
  /path/to/brotli /path/to/objconv src/brotli_upstream.inc
```

The generator verifies the exact upstream commit, gives translation-unit-local
symbols unique names, preserves the decoder's symbolic control-flow labels,
and writes one deterministic include. Experimental GCC scheduling targets can
be selected with its documented command-line flags; release changes should be
accepted only after `make test` and the benchmark agree.

See `THIRD_PARTY_NOTICES.md` for the upstream MIT license and attribution.
