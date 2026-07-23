# Brotli WebAssembly

A complete streaming implementation of the RFC 7932 Brotli format for modern
JavaScript runtimes. Compression, decompression, the built-in 122,784-byte
dictionary, and all quality-specific encoder paths are contained in one
WebAssembly text source, `src/brotli.wat`. A small dependency-free JavaScript
driver provides the browser and Node API.

The codec supports:

- Encoder quality levels 0 through 11.
- Generic, text, and font modes.
- Standard window sizes from 10 through 24 bits.
- Compressed, uncompressed, and metadata meta-blocks.
- All RFC 7932 Huffman, context-map, distance-cache, dictionary, and transform
  features.
- Streaming process, flush, finish, reset, and unused trailing input.

The WAT is derived from Google Brotli 1.2.0 and retains its MIT notice in
`THIRD_PARTY_NOTICES.md`. The published package has no runtime dependencies and
the WASM module has no imports.

## Requirements

The module uses WebAssembly SIMD and bulk-memory instructions. It targets
current Node, Chrome, Firefox, and Safari releases; there is no scalar fallback.
Only standard RFC 7932 streams are supported. Shared dictionaries, RFC 9841,
and large-window Brotli are outside the package scope.

## Build

```sh
npm install
npm run build
```

The build compiles `src/brotli.wat` with `wat2wasm` and copies the driver:

```text
src/brotli.wat  -> lib/brotli.wasm
src/brotli.js   -> lib/brotli.js
```

Other checks:

```sh
npm test
npm run tsgo
npm run biome
npm run bench
npm run bench:check
```

## Streaming API

The module exports `BrotliEncoder` and `BrotliDecoder`. Each object owns one
WASM instance and one active stream. Compile the module once and pass it to as
many codec objects as needed.

`write(data)` returns the number of input bytes consumed. After each write,
call `pull()` until it returns `null`, consuming or copying every output view
before the next method call:

```js
import { readFile } from "node:fs/promises";
import { BrotliEncoder } from "./lib/brotli.js";

const wasm = await WebAssembly.compile(
	await readFile(new URL("./lib/brotli.wasm", import.meta.url)),
);
const encoder = await new BrotliEncoder().initialize(wasm, {
	quality: 4,
	mode: "text",
	sizeHint: input.length,
});

const chunks = [];
let offset = 0;
while (offset < input.length) {
	offset += encoder.write(input.subarray(offset));
	for (;;) {
		const view = encoder.pull();
		if (!view) break;
		chunks.push(Uint8Array.from(view));
	}
}
while (!encoder.finish()) {
	for (;;) {
		const view = encoder.pull();
		if (!view) break;
		chunks.push(Uint8Array.from(view));
	}
}
for (;;) {
	const view = encoder.pull();
	if (!view) break;
	chunks.push(Uint8Array.from(view));
}
```

A view returned by `pull()` aliases WASM memory. It is valid only until the
next method call on that codec. This avoids mandatory output allocation and
copying; copy with `Uint8Array.from(view)` only when ownership is needed.

### `BrotliEncoder`

- `algorithm` — `"brotli"`.
- `initialize(source, options?) => Promise<this>` — instantiate from a
  `WebAssembly.Module` or fetchable string, URL, or Request.
- `write(data: Uint8Array) => number` — consume a prefix of the input.
- `pull() => Uint8Array | null` — return the next transient output view.
- `flush() => boolean` — preserve history but make all preceding input
  decodable. If it returns `false`, drain output and call it again.
- `finish() => boolean` — finalize the stream. If it returns `false`, drain
  output and call it again.
- `reset() => this` — discard the current stream and reuse the instance with
  the same options.
- `finished` — whether final output has been fully drained.

Encoder options:

| Option | Values | Default |
| --- | --- | --- |
| `quality` | Integer 0–11 | `4` |
| `lgwin` | Integer 10–24 | `22` |
| `mode` | `"generic"`, `"text"`, `"font"` | `"generic"` |
| `lgblock` | `0` for automatic, or 16–24 | `0` |
| `sizeHint` | uint32 expected input size | `0` |
| `disableLiteralContextModeling` | Boolean | `false` |

### `BrotliDecoder`

- `algorithm` — `"brotli"`.
- `initialize(source) => Promise<this>`.
- `write(data: Uint8Array) => number`.
- `pull() => Uint8Array | null`.
- `finish() => boolean` — signal end-of-input; throws for a truncated stream.
- `reset() => this`.
- `finished`.

The decoder does not overconsume input after the end of one Brotli stream. If
`write()` returns less than the supplied length and `finished` becomes true,
the remaining subarray belongs to the next protocol consumer.

## Browser

Serve `lib/brotli.js` and `lib/brotli.wasm`, with the WASM file using the
`application/wasm` MIME type:

```js
import { BrotliDecoder } from "/lib/brotli.js";

const decoder = await new BrotliDecoder().initialize("/lib/brotli.wasm");
```

Run `npm run server` to open the bundled interactive demo.

## Command line

The CLI accepts standard input or one or more file operands. With no file, or
with `-`, it reads binary standard input and writes binary standard output:

```sh
node bin/brotli.js -q6 < input.txt > input.txt.br
node bin/brotli.js -d < input.txt.br > restored.txt
```

For file operands, compression appends `.br` and decompression removes it.
Multiple files are processed separately. Sources are kept by default:

```sh
node bin/brotli.js -6 input.txt
node bin/brotli.js -d input.txt.br
node bin/brotli.js -0S.brotli first.txt second.txt
```

Quality 11 is the command-line default. Use `-0` through `-9`, `-q NUM`, or
`-Z` to select a level. The CLI also supports stdout (`-c`), integrity testing
(`-t`), a named output (`-o`), a custom suffix (`-S`), forced replacement
(`-f`), source removal/retention (`-j`/`-k`), non-expanding output (`-s`),
attribute copying control (`-n`), verbosity (`-v`), and window selection
(`-w 0|10..24`). `--mode=generic|text|font` remains available as an extension.
Long options accept both `--option value` and `--option=value`; simple short
options can be grouped, so `-9kf` means `-9 -k -f`. Run
`node bin/brotli.js --help` for the full list.

File output is written to a temporary sibling and moved into place only after
the stream succeeds. Existing destinations are preserved unless `-f` is used,
and sources are removed only after useful output is committed. Large-window
streams, comments, custom dictionaries, and concatenated-stream decoding are
not supported.

## Benchmark

`npm run bench` cross-checks both directions and compares the streaming WAT
implementation with Node's native Brotli and the Rust-based `brotli-wasm`
package. Throughput includes each JavaScript driver but excludes module
compilation. `wat stream` drains transient views without copying them. `wat
owned` copies every output chunk and concatenates them into one newly allocated
`Uint8Array`, matching the ownership semantics of the Node and Rust one-shot
APIs. Ratios use `wat owned`; above 1x means this implementation is faster.
Full runs use adaptive iteration counts with at least 100 ms of timed work per
result after a per-action warmup; quick regression checks use at least 20 ms.
For focused measurements, pass `--corpus=tiny|text|wat-prefix|binary`,
`--quality=0..11`, and/or `--minimum-ms=500`.

`size(B)` is the uncompressed corpus length, while `wat output(B)`, `node
bytes`, and `rust bytes` are compressed output lengths. `wat-prefix` is the
first 262,144 bytes of `src/brotli.wat`; `text` is a 262,144-byte repeated-text
fixture.

The Rust implementation does not expose quality 0, shown as `n/a`. `npm run
bench:check` runs a short q4 regression gate using owned output: encoding must
remain at least 2x the Rust/WASM reference, decoding at least 0.25x, and output
must be no larger.

The encoder's WAT-specific fast path extends contiguous ring-buffer matches in
128-byte SIMD batches. A 16-byte comparison plus bitmask/`ctz` identifies the
exact mismatch, while the original scalar loop handles short tails and
ring-buffer edges. On this host, focused before/after measurements improved
the repetitive-text q4 path from about 1,430 to 8,000 MiB/s and q6 from about
1,500 to 7,500 MiB/s. The mixed WAT-source q4 corpus remained near 300 MiB/s.

Quality 11 has additional SIMD paths for ASCII classification and exact
mismatch location in its H10 match finder. Its cost model also memoizes the
existing exact log₂ result for counts below 2,048, using one lazily allocated
16 KiB cache per q11 module instance. Together these changes raised
repetitive-text q11 streaming throughput from about 39–40 to 54 MiB/s without
changing the compressed bytes. Mixed WAT source and incompressible binary
throughput remained effectively unchanged.

Quality 0 dynamically sizes only the encoder input transfer buffer. An
accurate `sizeHint` selects between 64 KiB and 1 MiB; a missing hint uses
256 KiB. This lets its one-pass compressor see medium inputs as one block
without increasing allocations for small inputs or other quality levels.
Focused before/after measurements raised repetitive-text q0 streaming from
about 4,300 to 7,200 MiB/s, mixed WAT source from about 1,450 to 2,070 MiB/s,
and incompressible input from about 4,700 to 9,600 MiB/s. It also made the q0
output byte-identical to Node's one-shot result for all three bulk corpora.

The following run used Node 22.22.2 on an AMD EPYC 9575F KVM guest:

```text
Adaptive timing uses at least 100 ms per result.
Compression (MiB/s; ratios use WAT owned output)
    corpus   q    size(B)    wat stream    wat owned    node owned    rust owned   owned/node   owned/rust  wat output(B)  node bytes  rust bytes
      tiny   0         64         13.89        11.31         19.55           n/a        0.58x          n/a             68          68         n/a
      tiny   4         64          9.57         8.87          7.27          1.42        1.22x        6.22x             64          64          64
      tiny   6         64          7.18         7.92          6.80          0.45        1.17x       17.52x             65          65          65
      tiny  11         64          0.24         0.21          0.31          0.03        0.68x        8.00x             68          68          68
      text   0     262144       6899.83      7045.22      14126.35           n/a        0.50x          n/a            208         208         n/a
      text   4     262144       8464.22      8244.78       2521.55        104.62        3.27x       78.81x            106         106         106
      text   6     262144       8074.64      7823.34       2713.41        119.23        2.88x       65.62x            100         100         100
      text  11     262144         51.54        53.20         49.31         19.64        1.08x        2.71x             97          97          97
wat-prefix   0     262144       2142.20      1724.47       2175.81           n/a        0.79x          n/a          25684       25684         n/a
wat-prefix   4     262144        298.09       286.72        331.45         42.08        0.87x        6.81x          18011       18011       18053
wat-prefix   6     262144        125.03       120.89        156.22         38.65        0.77x        3.13x          14992       14992       14993
wat-prefix  11     262144          0.70         0.76          0.92          0.55        0.83x        1.38x          12057       12057       12026
    binary   0    1048576       9810.88      4433.43       3802.67           n/a        1.17x          n/a        1048581     1048581         n/a
    binary   4    1048576        968.96       907.17        976.23        148.97        0.93x        6.09x        1048581     1048581     1048581
    binary   6    1048576        454.39       428.94        490.41        137.93        0.87x        3.11x        1048581     1048581     1048581
    binary  11    1048576          3.21         3.57          4.10          2.90        0.87x        1.23x        1048581     1048581     1048581

Decompression (MiB/s; ratios use WAT owned output)
    corpus   q    size(B)    wat stream    wat owned    node owned    rust owned   owned/node   owned/rust
      tiny   0         64        118.73        89.32         28.57         15.61        3.13x        5.72x
      tiny   4         64         44.25        41.74         13.24          8.23        3.15x        5.07x
      tiny   6         64         41.05        37.98         20.63          8.46        1.84x        4.49x
      tiny  11         64        103.98        82.16         25.01         15.16        3.28x        5.42x
      text   0     262144       3706.49      2691.08       2894.14        713.21        0.93x        3.77x
      text   4     262144       1963.80      1676.20       1885.12       1188.48        0.89x        1.41x
      text   6     262144       1598.01      1539.39       1907.40       1186.22        0.81x        1.30x
      text  11     262144       1927.04      1472.53       1674.65       1101.15        0.88x        1.34x
wat-prefix   0     262144       1229.44      1145.12       1727.98        365.62        0.66x        3.13x
wat-prefix   4     262144       1828.07      1545.86       2195.70        663.06        0.70x        2.33x
wat-prefix   6     262144       2390.21      1943.18       2372.62        757.61        0.82x        2.56x
wat-prefix  11     262144       2749.15      2053.46       2068.86        840.76        0.99x        2.44x
    binary   0    1048576      20492.95      6152.16       5054.37        731.73        1.22x        8.41x
    binary   4    1048576      21382.15      7287.71       5494.68        717.56        1.33x       10.16x
    binary   6    1048576      22282.94      7195.51       6480.73        726.39        1.11x        9.91x
    binary  11    1048576      21049.07      5707.12       6377.80        680.84        0.89x        8.38x
```

Compression output is normally byte-identical to Google Brotli for equal
parameters, but byte identity is not part of the API contract. RFC
interoperability is.

## Format note

Brotli is a raw stream format and contains neither an uncompressed length nor
an integrity checksum. The decoder validates the stream structure and memory
bounds, but a semantically altered stream that remains syntactically valid
cannot always be detected.

## References

- RFC 7932: https://www.rfc-editor.org/rfc/rfc7932
- Google Brotli 1.2.0: https://github.com/google/brotli/tree/v1.2.0
