# Philox4x32

An implementation of the Philox4x32-10 counter-based random number generator in WebAssembly.
Philox is part of the Random123 family: output is a deterministic function of a 128-bit counter
and a 64-bit key, so independent streams can be split by assigning distinct counter or key ranges.

The Philox4x32 round function is hand-written in WebAssembly (`src/philox-4x32.wat`) and wrapped by
a small, dependency-free JavaScript module (`src/philox-4x32.js`). The code runs in the browser and
in Node or any other JS engine with WebAssembly.

# Directory structure

## src

The manually written sources: `philox-4x32.wat` is the WebAssembly text for Philox4x32-10 (it
exports `memory` and `fill`), and `philox-4x32.js` is the `Philox4x32` wrapper class.

## lib

The build output. Users of this module import these two files.

```
lib/philox-4x32.js
lib/philox-4x32.wasm
```

`lib/philox-4x32.js` is copied from `src/philox-4x32.js` and `lib/philox-4x32.wasm` is generated
from `src/philox-4x32.wat` using wat2wasm. Regenerate them with `npm run build` (which needs
`wat2wasm`, provided by the `wabt` dev dependency).

## bin

`philox-4x32.js` — a small command-line tool that prints one four-word block for a counter and key.

`philox-4x32-prng.js` — a command-line tool that writes the hex encoding of any requested number of
Philox bytes to stdout, incrementing the counter once per 16-byte block.

## bench

`bench.js` — a throughput benchmark that compares this WebAssembly implementation against a pure
JavaScript Philox4x32-10 reference implementation across a range of output sizes.

## html

`philox-4x32.html` — a browser demo for generating a block from hex counter and key words.

`npm run server` starts a static server (port 9876) and opens the bundled demo at
`/html/philox-4x32.html`.

## test

The test suites, run with `node --test`:

- `philox-4x32.test.js` — the `Philox4x32` JS API.
- `philox-4x32.wasm.test.js` — the raw WebAssembly module.
- `bench.test.js` — smoke-tests the benchmark output.

# Build

```sh
npm install   # once, to get wabt (wat2wasm), http-server, etc.
npm run build # src/philox-4x32.wat -> lib/philox-4x32.wasm, and copies src/philox-4x32.js -> lib/philox-4x32.js
```

# Usage

## Node or other JS engine

Import `Philox4x32` from `lib/philox-4x32.js`, initialize it with the compiled module, then pass a
four-word `Uint32Array` counter and two-word `Uint32Array` key:

```js
import { readFile } from "node:fs/promises";
import { Philox4x32 } from "./lib/philox-4x32.js";

const wasm = await WebAssembly.compile(
	await readFile(new URL("./lib/philox-4x32.wasm", import.meta.url)),
);
const philox = await new Philox4x32().initialize(wasm);

const counter = new Uint32Array([0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344]);
const key = new Uint32Array([0xa4093822, 0x299f31d0]);
const block = philox.generate(counter, key);

console.log(block);
```

`initialize()` also accepts a URL/`Request`/string (including a `data:` URL); when given anything
other than a `WebAssembly.Module` it uses `WebAssembly.instantiateStreaming(fetch(source))`.

## Browser

Serve the two `lib/` files as static files, making sure the `.wasm` is served with the MIME type
`application/wasm`. Import `philox-4x32.js` as an ES module and pass the wasm URL to `initialize()`:

```js
import { Philox4x32 } from "./philox-4x32.js";

const philox = await new Philox4x32().initialize("/philox-4x32.wasm");
const block = philox.generate(
	new Uint32Array([0, 0, 0, 0]),
	new Uint32Array([0, 0]),
);

console.log(block);
```

## Command line

```sh
node bin/philox-4x32.js 0 0 0 0 0 0
# 6627e8d5 e169c58d bc57ac4c 9b00dbd8
```

Usage: `philox-4x32 <c0> <c1> <c2> <c3> <k0> <k1>` — accepts decimal or `0x` uint32 words and
prints the four output words as lowercase hex.

```sh
node bin/philox-4x32-prng.js 32 0 0 0 0 0 0
```

Usage: `philox-4x32-prng <bytes> <c0> <c1> <c2> <c3> <k0> <k1>` — accepts a byte count followed by
decimal or `0x` uint32 counter/key words, then writes exactly `bytes * 2` lowercase hex characters
to stdout.

## Benchmark

```sh
node bench/bench.js
```

Prints a table comparing this implementation with a pure JS reference over several output sizes.
Each row is cross-checked for output equality before timing.

# API

The module's only export is the `Philox4x32` class.

- `algorithm` — the string `"philox-4x32"`.

- `initialize(source) => Promise<this>` — load the WebAssembly. `source` is a `WebAssembly.Module`
  (instantiated directly) or a `string | URL | Request` fetched and streamed. Must be awaited before
  any other method.

- `generate(counter, key, output?) => Uint32Array` — generate one four-word block. `counter` must be
  a four-word `Uint32Array`, `key` must be a two-word `Uint32Array`, and optional `output` must be a
  four-word `Uint32Array`.

- `fill(counter, key, output) => Uint32Array` — fill `output` with sequential Philox4x32 blocks,
  starting at `counter` and incrementing the local 128-bit counter by one per block. `output.length`
  must be divisible by four words. The input counter and key are not mutated.

All methods throw if the instance has not been initialized.

# Scripts

- `npm run build` — compile `src/` into `lib/`.
- `npm test` — run the test suites (`node --test`).
- `npm run server` — serve the package and open the browser demo (port 9876).
- `npm run tsgo` — type-check the JS via JSDoc (`@typescript/native-preview`).
- `npm run biome` — lint/format check (Biome).

# References

- Random123 repository: https://github.com/DEShawResearch/random123
- Random123 Philox implementation: https://raw.githubusercontent.com/DEShawResearch/random123/main/include/Random123/philox.h
- Random123 known-answer vectors: https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors
