# SHA3-512

An implementation of the SHA3-512 (512-bit) hash function using the Keccak sponge construction.
The hash function is specified in the NIST document FIPS 202, a copy of which is placed in the file
`assets/NIST.FIPS.202.pdf`.

The Keccak-p[1600] permutation is hand-written in WebAssembly (`src/sha3-512.wat`) and wrapped by a
small, dependency-free JavaScript module (`src/sha3-512.js`). The code runs in the browser and in Node 
or any other JS engine with WebAssembly.

# Directory structure

## src

The manually written sources: `sha3-512.wat` is the WebAssembly text for the sponge (it exports `memory` and
`absorb`), and `sha3-512.js` is the `Sha3_512` wrapper class.

## lib

The build output. Users of this module import these two files.

```
lib/sha3-512.js
lib/sha3-512.wasm
```

`lib/sha3-512.js` is copied from `src/sha3-512.js` and `lib/sha3-512.wasm` is generated from
`src/sha3-512.wat` using wat2wasm. Regenerate them with `npm run build` (which needs `wat2wasm`, provided by the
`wabt` dev dependency).

## bin

`sha3-512.js` — a small command-line tool that prints the hex digest of its argument.

## bench

`bench.js` — a throughput benchmark that compares this WebAssembly implementation against Node's
native `node:crypto` SHA3-512 across a range of message sizes.

## html

`sha3-512.html` — a self-contained browser demo: type into a textarea and see the digest update live.

`npm run server` starts a static server (port 9876) and opens the bundled demo at
`/html/sha3-512.html`.

## test

The test suites, run with `node --test`:

- `sha3-512.test.js` — the `Sha3_512` JS API.
- `sha3-512.wasm.test.js` — the raw WebAssembly module.
- `bench.test.js` — smoke-tests the benchmark output.

# Build

```sh
npm install   # once, to get wabt (wat2wasm), http-server, etc.
npm run build # src/sha3-512.wat -> lib/sha3-512.wasm, and copies src/sha3-512.js -> lib/sha3-512.js
```

# Usage

## Node or other JS engine

Import `Sha3_512` from `lib/sha3-512.js`, initialize it with the compiled module, then
`update(...)` with `Uint8Array` chunks and call `digest()`:

```js
import { readFile } from "node:fs/promises";
import { Sha3_512 } from "./lib/sha3-512.js";

const wasm = await WebAssembly.compile(
	await readFile(new URL("./lib/sha3-512.wasm", import.meta.url)),
);
const sha3 = await new Sha3_512().initialize(wasm);

const digest = sha3.update(new TextEncoder().encode("abc")).digest();
console.log(Buffer.from(digest).toString("hex"));
// b751850b1a57168a5693cd924b6b096e08f621827444f70d884f5d0240d2712e10e116e9192af3c91a7ec57647e3934057340b4cf408d5a56592f8274eec53f0
```

`initialize()` also accepts a URL/`Request`/string (including a `data:` URL); when given anything
other than a `WebAssembly.Module` it uses `WebAssembly.instantiateStreaming(fetch(source))`.

## Browser

Serve the two `lib/` files as static files, making sure the `.wasm` is served with the MIME type
`application/wasm`. Import `sha3-512.js` as an ES module and pass the wasm URL to `initialize()`:

```js
import { Sha3_512 } from "./sha3-512.js";

// The URL where your server serves the wasm file.
const url = "/sha3-512.wasm";
const sha3 = await new Sha3_512().initialize(url);

const digest = sha3.update(new TextEncoder().encode("abc")).digest();
console.log(
	Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join(""),
);
```

## Command line

```sh
node bin/sha3-512.js abc        # or: npx sha3-512 abc
# b751850b...ec53f0
```

Usage: `sha3-512 <message>` — prints the lowercase hex digest of the single message argument.

## Benchmark

```sh
node bench/bench.js
```

Prints a table comparing this implementation with `node:crypto` over several message sizes
(columns: `size(B)`, `iters`, `wasm(ms)`, `wasm h/s`, `wasm MiB/s`, `node(ms)`, `node h/s`,
`node MiB/s`, `speedup`). Each row is also cross-checked for digest equality before timing.

# API

The module's only export is the `Sha3_512` class. One instance owns one in-progress hash; use it for
one message at a time and call `reset()` to start another, or `getState()`/`setState()` to snapshot
and resume.

- `algorithm` — the string `"sha3-512"`.

- `initialize(source) => Promise<this>` — load the WebAssembly. `source` is a `WebAssembly.Module`
  (instantiated directly) or a `string | URL | Request` fetched and streamed. Must be awaited before
  any other method.

- `update(data) => this` — absorb `data` (a `Uint8Array`; a Node `Buffer` works as a subclass).
  Chainable, and may be called repeatedly with arbitrary chunk boundaries. Throws `TypeError` if
  `data` is not a `Uint8Array`, and throws if called after `digest()`.

- `digest() => Uint8Array` — finalize and return the 64-byte (512-bit) digest as a fresh
  `Uint8Array`. May be called only once per message (throws on a second call); call `reset()` to
  hash again.

- `reset() => this` — clear the sponge so the same instance can hash a new message.

- `getState() => Uint8Array` — snapshot the in-progress hash (sponge state plus any buffered partial
  block) as an opaque, restorable byte array.

- `setState(snapshot) => this` — restore a snapshot from `getState()`, replacing the current
  in-progress hash. Snapshots are portable to another initialized instance, which lets you fork a
  shared prefix and continue it in different directions (sequentially). Throws `TypeError` /
  `Error("Invalid SHA3-512 state snapshot")` on malformed input.

All methods throw if the instance has not been initialized.

## Example

Incremental hashing, plus forking a shared prefix with `getState`/`setState`:

```js
import { readFile } from "node:fs/promises";
import { Sha3_512 } from "./lib/sha3-512.js";

const wasm = await WebAssembly.compile(
	await readFile(new URL("./lib/sha3-512.wasm", import.meta.url)),
);
const sha3 = await new Sha3_512().initialize(wasm);
const enc = new TextEncoder();
const hex = (bytes) =>
	Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

// Incremental: update() in chunks, then digest().
const abc = sha3.reset().update(enc.encode("a")).update(enc.encode("bc")).digest();
console.log(hex(abc)); // b751850b...ec53f0

// Fork a shared prefix "a" into "ab" and "ac".
const hash = sha3.reset().update(enc.encode("a"));
const afterA = hash.getState();
console.log(hex(hash.update(enc.encode("b")).digest())); // hash of "ab"
hash.setState(afterA);
console.log(hex(hash.update(enc.encode("c")).digest())); // hash of "ac"
```

# Scripts

- `npm run build` — compile `src/` into `lib/`.
- `npm test` — run the test suites (`node --test`).
- `npm run server` — serve the package and open the browser demo (port 9876).
- `npm run tsgo` — type-check the JS via JSDoc (`@typescript/native-preview`).
- `npm run biome` — lint/format check (Biome).
