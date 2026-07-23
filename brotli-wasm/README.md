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

The following run used Node 22.22.2 on an AMD EPYC 9575F KVM guest:

```text
Adaptive timing uses at least 100 ms per result.
Compression (MiB/s; ratios use WAT owned output)
  corpus   q    size(B)    wat stream    wat owned    node owned    rust owned   owned/node   owned/rust  wat bytes  node bytes  rust bytes
    tiny   0         64         13.17        11.41         16.25           n/a        0.70x          n/a         68          68         n/a
    tiny   4         64          9.44         8.56          8.47          1.39        1.01x        6.17x         64          64          64
    tiny   6         64          7.92         7.64          6.69          0.46        1.14x       16.69x         65          65          65
    tiny  11         64          0.25         0.25          0.22          0.02        1.14x       10.41x         68          68          68
    text   0     262144       4174.91      3630.10      13752.08           n/a        0.26x          n/a        660         208         n/a
    text   4     262144       8184.68      7622.90       2491.80        101.63        3.06x       75.01x        106         106         106
    text   6     262144       7717.85      7247.39       2377.17        112.94        3.05x       64.17x        100         100         100
    text  11     262144         39.25        32.87         45.98         19.07        0.71x        1.72x         97          97          97
     wat   0     262144       1286.15      1202.43       2348.55           n/a        0.51x          n/a      26235       25684         n/a
     wat   4     262144        258.59       297.64        326.56         43.97        0.91x        6.77x      18011       18011       18053
     wat   6     262144        127.65       126.10        140.21         36.43        0.90x        3.46x      14992       14992       14993
     wat  11     262144          0.72         0.73          0.81          0.53        0.89x        1.36x      12057       12057       12026
  binary   0    1048576       3898.89      2350.45       3575.24           n/a        0.66x          n/a    1048625     1048581         n/a
  binary   4    1048576        849.14       783.13        825.72        125.36        0.95x        6.25x    1048581     1048581     1048581
  binary   6    1048576        240.29       248.49        498.00        115.22        0.50x        2.16x    1048581     1048581     1048581
  binary  11    1048576          2.03         3.50          4.64          2.75        0.75x        1.27x    1048581     1048581     1048581

Decompression (MiB/s; ratios use WAT owned output)
  corpus   q    size(B)    wat stream    wat owned    node owned    rust owned   owned/node   owned/rust
    tiny   0         64        124.43        87.30         26.20         11.22        3.33x        7.78x
    tiny   4         64         33.49        33.72         20.31          7.98        1.66x        4.22x
    tiny   6         64         36.78        34.36         15.54          7.73        2.21x        4.44x
    tiny  11         64        108.52        83.36         27.92         17.33        2.99x        4.81x
    text   0     262144       3297.72      2190.17       2547.18        700.28        0.86x        3.13x
    text   4     262144       1863.65      1568.75       1939.42       1078.89        0.81x        1.45x
    text   6     262144       1830.70      1534.48       1883.96       1139.60        0.81x        1.35x
    text  11     262144       1914.86      1618.90       1840.40       1124.00        0.88x        1.44x
     wat   0     262144       1455.94      1220.47       1655.48        384.84        0.74x        3.17x
     wat   4     262144       1968.36      1577.18       1935.63        703.83        0.81x        2.24x
     wat   6     262144       2477.82      1829.40       2348.41        788.38        0.78x        2.32x
     wat  11     262144       2783.99      1749.66       2265.13        722.36        0.77x        2.42x
  binary   0    1048576      16295.19      4965.28       5102.34        671.77        0.97x        7.39x
  binary   4    1048576      18537.41      5150.98       5219.60        622.88        0.99x        8.27x
  binary   6    1048576      15585.71      5798.09       4883.80        571.28        1.19x       10.15x
  binary  11    1048576      21186.55      5812.86       5556.46        677.56        1.05x        8.58x
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
