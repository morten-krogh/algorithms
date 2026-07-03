This goal of this repository is hold a collection of highly performant implementations of 
interesting and useful algorithms implemented in native/assembly languages by a collaboration
between humans and AI agents.

# AI assistance in native/assembly languages

The code is typically written by pair programming between a human and an AI.
The main thesis of this repository is that modern AI agents make it feasible to
hand write assembly/webassembly code directly.  Writing in assembly languages is
obviously tedious for humans but in collaboration with AI agents, the task is
more managable.

# Performance and codes size.

The implementations in this repository strive to be highly performant with
small code sizes. Often a smaller code base and higher performance goes hand in hand.
In cases where there is a genuine trade-off between the two, a balance is
found.

# Usage in downstream projects

The implementations contain as few library as possible and do not
rely on third-party dependencies unless they really have to. The number of 
library files is typically one or two and can just be dumped into
downstream code by consumers. The repository has additional test files 
and example files to illustrate usage.

# API

The APIs of the implementations are minimal and do not contain convenience
wrappers.  The convenience wrappers can be written in downstream projects or
other repositories.  The APIs must be easy to understand whereas the
implementations can be seen as black boxes.

# Contributors

Right now the owner of this repository (Morten Krogh) is the only contributor.
Anyone who wants to join in any capacity is more than welcome to join.
Feel free to open issues or PRs.


# Algorithms

Below follows a description of the currently implemented algorithms.
Each algorithm get its own subdirectory.


## sha3-256-wasm

SHA3-256 implemented as a hand-written WebAssembly Keccak-p[1600] permutation with a
dependency-free JavaScript wrapper. See [sha3-256-wasm/](sha3-256-wasm/) for the package.

### Benchmark

`node bench/bench.js` compares this WebAssembly implementation against Node's native
`node:crypto` SHA3-256 over a range of message sizes. The run below was measured on an
**Apple M1 Max** (`wasm/node performance` = node time / wasm time, so above 1.0 means the
WebAssembly implementation is faster):

```
  size(B)     iters    wasm(ms)    wasm h/s   wasm MiB/s    node(ms)     node h/s   node MiB/s  wasm/node performance
        0    200000       73.69     2714145         0.00      182.06      1098551         0.00                  2.47x
       64    200000       79.43     2518035       153.69      175.97      1136528        69.37                  2.22x
     1024     50000       98.81      506000       494.14       95.59       523043       510.78                  0.97x
    16384     10000      259.91       38475       601.16      186.84        53521       836.27                  0.72x
   262144      1000      415.10        2409       602.26      287.64         3477       869.13                  0.69x
  1048576       300      498.40         602       601.93      343.45          873       873.50                  0.69x
 10485760        30      498.78          60       601.46      346.24           87       866.44                  0.69x
```

For small messages the WebAssembly implementation wins (roughly 2×) because it avoids per-call
object allocation; for large messages Node's native OpenSSL SHA3-256 pulls ahead, leaving the
WebAssembly implementation at about 0.7×.

## sha3-512-wasm

SHA3-512 implemented as a hand-written WebAssembly Keccak-p[1600] permutation with a
dependency-free JavaScript wrapper. See [sha3-512-wasm/](sha3-512-wasm/) for the package and its README.

### Benchmark

`node bench/bench.js` compares this WebAssembly implementation against Node's native
`node:crypto` SHA3-512 over a range of message sizes. The run below was measured on an
**Apple M1 Max** (`wasm/node performance` = node time / wasm time, so above 1.0 means the
WebAssembly implementation is faster):

```
  size(B)     iters    wasm(ms)    wasm h/s   wasm MiB/s    node(ms)     node h/s   node MiB/s  wasm/node performance
        0    200000       71.38     2801897         0.00      174.01      1149356         0.00                  2.44x
       64    200000       78.90     2534933       154.72      171.23      1168007        71.29                  2.17x
     1024     50000      173.11      288826       282.06      146.48       341348       333.35                  0.85x
    16384     10000      483.08       20701       323.45      343.43        29118       454.96                  0.71x
   262144      1000      779.01        1284       320.92      538.30         1858       464.43                  0.69x
  1048576       300      933.82         321       321.26      644.69          465       465.34                  0.69x
 10485760        30      933.36         32       321.42      644.30           47       465.62                  0.69x
```

For small messages the WebAssembly implementation wins (roughly 2×) because it avoids per-call
object allocation; for large messages Node's native OpenSSL SHA3-512 pulls ahead, leaving the
WebAssembly implementation at about 0.7×.

## shake-256-wasm

SHAKE256 (the SHA-3 extendable-output function) implemented as a hand-written WebAssembly
Keccak-p[1600] permutation with a dependency-free JavaScript wrapper. See
[shake-256-wasm/](shake-256-wasm/) for the package.

### Benchmark

`node bench/bench.js` compares this WebAssembly implementation against Node's native
`node:crypto` SHAKE256 over a range of message sizes, squeezing a 32-byte output per call. The
run below was measured on an **Apple M1 Max** (`wasm/node performance` = node time / wasm time,
so above 1.0 means the WebAssembly implementation is faster):

```
  size(B)     iters    wasm(ms)    wasm h/s   wasm MiB/s    node(ms)     node h/s   node MiB/s  wasm/node performance
        0    200000      116.33     1719301         0.00      172.90      1156750         0.00                  1.49x
       64    200000      122.50     1632664        99.65      172.20      1161433        70.89                  1.41x
     1024     50000      112.41      444794       434.37       94.41       529619       517.21                  0.84x
    16384     10000      267.23       37421       584.71      186.20        53705       839.15                  0.70x
   262144      1000      423.79        2360       589.92      287.37         3480       869.95                  0.68x
  1048576       300      508.76         590       589.67      343.18          874       874.19                  0.67x
 10485760        30      508.01         59       590.54      343.93           87       872.28                  0.68x
```

For small messages the WebAssembly implementation wins (roughly 1.4×) because it avoids per-call
object allocation; for large messages Node's native OpenSSL SHAKE256 pulls ahead, leaving the
WebAssembly implementation at about 0.7×.

## philox-4x32-wasm

Philox4x32-10 implemented as a hand-written WebAssembly counter-based random number generator with
a dependency-free JavaScript wrapper. See [philox-4x32-wasm/](philox-4x32-wasm/) for the package.

### Benchmark

`node bench/bench.js` compares this WebAssembly implementation against a pure JavaScript
Philox4x32-10 reference over a range of output block counts. The run below was measured locally
(`wasm/js performance` = JS time / wasm time, so above 1.0 means the WebAssembly implementation is
faster):

```
   blocks     iters    wasm(ms)  wasm blocks/s   wasm MiB/s      js(ms)   js blocks/s    js MiB/s  wasm/js performance
        1    200000       12.15       16460116       251.16       30.79       6494754       99.10                2.53x
       16     50000       11.55       69275819      1057.07       97.64       8193608      125.02                8.45x
     1024      1000       11.29       90735562      1384.51      121.39       8435647      128.72               10.76x
    16384       100       17.81       91997353      1403.77      236.93       6915072      105.52               13.30x
   262144        10       29.06       90216771      1376.60      384.47       6818252      104.04               13.23x
```

The WebAssembly implementation is faster across the benchmark range, with the largest gains on bulk
generation because the wrapper chunks output through the raw one-page WAT module.
