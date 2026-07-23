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

The CLI reads binary stdin and writes binary stdout. Compression is the
default:

```sh
node bin/brotli.js --quality 6 < input.txt > input.txt.br
node bin/brotli.js --decompress < input.txt.br > restored.txt
```

Options are `--decompress`, `--quality 0..11`, `--lgwin 10..24`, and
`--mode generic|text|font`.

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
For focused measurements, pass `--corpus=tiny|text|wat|binary`,
`--quality=0..11`, and/or `--minimum-ms=500`.

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

The following run used Node 22.22.2 on an AMD EPYC 9575F KVM guest:

```text
Adaptive timing uses at least 100 ms per result.
Compression (MiB/s; ratios use WAT owned output)
  corpus   q    size(B)    wat stream    wat owned    node owned    rust owned   owned/node   owned/rust  wat bytes  node bytes  rust bytes
    tiny   0         64         13.61        11.53         18.19           n/a        0.63x          n/a         68          68         n/a
    tiny   4         64          9.74         9.01          8.61          1.41        1.05x        6.39x         64          64          64
    tiny   6         64          8.58         7.78          7.47          0.48        1.04x       16.26x         65          65          65
    tiny  11         64          0.26         0.26          0.30          0.02        0.88x       10.52x         68          68          68
    text   0     262144       4198.70      3682.78      13905.65           n/a        0.26x          n/a        660         208         n/a
    text   4     262144       7778.35      8062.93       2641.07        101.50        3.05x       79.43x        106         106         106
    text   6     262144       7607.28      7245.92       2514.95        116.80        2.88x       62.04x        100         100         100
    text  11     262144         53.87        54.46         36.53         19.98        1.49x        2.73x         97          97          97
     wat   0     262144       1306.99      1431.53       2403.33           n/a        0.60x          n/a      26235       25684         n/a
     wat   4     262144        297.78       292.71        331.48         43.90        0.88x        6.67x      18011       18011       18053
     wat   6     262144        130.98       131.76        161.92         38.15        0.81x        3.45x      14992       14992       14993
     wat  11     262144          0.71         0.75          0.83          0.49        0.90x        1.51x      12057       12057       12026
  binary   0    1048576       4602.46      2684.19       5016.34           n/a        0.54x          n/a    1048625     1048581         n/a
  binary   4    1048576        983.48       892.26        669.46        141.99        1.33x        6.28x    1048581     1048581     1048581
  binary   6    1048576        445.55       404.26        615.82        142.41        0.66x        2.84x    1048581     1048581     1048581
  binary  11    1048576          3.79         3.76          4.68          2.97        0.80x        1.27x    1048581     1048581     1048581

Decompression (MiB/s; ratios use WAT owned output)
  corpus   q    size(B)    wat stream    wat owned    node owned    rust owned   owned/node   owned/rust
    tiny   0         64        121.74        89.91         32.18         17.00        2.79x        5.29x
    tiny   4         64         43.67        39.71         21.36          8.04        1.86x        4.94x
    tiny   6         64         39.06        38.15         14.03          7.68        2.72x        4.97x
    tiny  11         64         97.50        82.30         29.79         15.34        2.76x        5.37x
    text   0     262144       3654.14      2363.50       2938.07        644.35        0.80x        3.67x
    text   4     262144       1933.59      1608.32       1954.14       1135.00        0.82x        1.42x
    text   6     262144       1903.50      1577.76       1986.67       1135.45        0.79x        1.39x
    text  11     262144       1837.74      1612.93       1895.81       1133.99        0.85x        1.42x
     wat   0     262144       1462.53      1259.68       1767.97        415.78        0.71x        3.03x
     wat   4     262144       1872.94      1689.19       2313.29        733.37        0.73x        2.30x
     wat   6     262144       1873.52      1668.54       2712.89        809.22        0.62x        2.06x
     wat  11     262144       2647.64      2100.44       2523.89        937.08        0.83x        2.24x
  binary   0    1048576      20903.17      6344.58       5263.79        628.89        1.21x       10.09x
  binary   4    1048576      20528.65      6542.17       6965.98        655.36        0.94x        9.98x
  binary   6    1048576      20686.64      6098.03       6157.02        705.37        0.99x        8.65x
  binary  11    1048576      21267.26      6163.39       6312.26        568.85        0.98x       10.83x
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
