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
result; quick regression checks use at least 20 ms.

The Rust implementation does not expose quality 0, shown as `n/a`. `npm run
bench:check` runs a short q4 regression gate using owned output: encoding must
remain at least 2x the Rust/WASM reference, decoding at least 0.25x, and output
must be no larger.

The following run used Node 22.22.2 on an AMD EPYC 9575F KVM guest:

```text
Adaptive timing uses at least 100 ms per result.
Compression (MiB/s; ratios use WAT owned output)
  corpus   q    size(B)    wat stream    wat owned    node owned    rust owned   owned/node   owned/rust  wat bytes  node bytes  rust bytes
    tiny   0         64         13.53        11.13         21.10           n/a        0.53x          n/a         68          68         n/a
    tiny   4         64          9.69         9.44          9.11          1.40        1.04x        6.72x         64          64          64
    tiny   6         64          7.50         7.80          6.98          0.47        1.12x       16.54x         65          65          65
    tiny  11         64          0.27         0.26          0.31          0.03        0.85x       10.04x         68          68          68
    text   0     262144       3931.94      3839.23      12184.14           n/a        0.32x          n/a        660         208         n/a
    text   4     262144       1436.65      1324.05       2449.84        101.62        0.54x       13.03x        106         106         106
    text   6     262144       1502.30      1447.86       2607.31        117.99        0.56x       12.27x        100         100         100
    text  11     262144         39.41        39.46         51.10         19.39        0.77x        2.03x         97          97          97
  binary   0    1048576       4714.21      2925.49       4116.43           n/a        0.71x          n/a    1048625     1048581         n/a
  binary   4    1048576        989.80       849.91        670.59        145.68        1.27x        5.83x    1048581     1048581     1048581
  binary   6    1048576        396.67       433.36        478.54        153.37        0.91x        2.83x    1048581     1048581     1048581
  binary  11    1048576          3.67         3.82          4.42          2.37        0.86x        1.61x    1048581     1048581     1048581

Decompression (MiB/s; ratios use WAT owned output)
  corpus   q    size(B)    wat stream    wat owned    node owned    rust owned   owned/node   owned/rust
    tiny   0         64        112.29        82.10         27.42         15.60        2.99x        5.26x
    tiny   4         64         43.23        40.13         21.30          8.29        1.88x        4.84x
    tiny   6         64         37.88        36.60         18.77          8.14        1.95x        4.49x
    tiny  11         64        110.59        84.17         15.28         16.25        5.51x        5.18x
    text   0     262144       3456.44      2360.36       2293.36        639.62        1.03x        3.69x
    text   4     262144       1935.30      1499.45       1854.17       1184.64        0.81x        1.27x
    text   6     262144       1861.88      1614.42       1758.84       1113.29        0.92x        1.45x
    text  11     262144       2010.61      1630.91       1746.75       1127.79        0.93x        1.45x
  binary   0    1048576      20209.04      6171.74       6060.99        690.57        1.02x        8.94x
  binary   4    1048576      19876.75      6563.41       5638.95        620.70        1.16x       10.57x
  binary   6    1048576      21962.88      5446.59       5705.48        687.83        0.95x        7.92x
  binary  11    1048576      21362.76      6843.14       6702.19        706.59        1.02x        9.68x
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
