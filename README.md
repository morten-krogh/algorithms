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

## sha3-256-arm64-macos

SHA3-256 implemented in handwritten ARM64 assembly for macOS using the ARM SHA3 extension. It
provides a caller-owned streaming C API and an all-assembly command-line tool that hashes binary
stdin. See [sha3-256-arm64-macos/](sha3-256-arm64-macos/) for build, API, and usage details.

### Benchmark

`bin/bench` compares the assembly implementation against both CryptoKit and OpenSSL SHA3-256. The
run below was measured on an **Apple M1 Max**. Ratios are reference time / assembly time, so above
1.0 means the assembly implementation is faster:

```text
  size(B)     iters     asm(ms)     asm h/s    asm MiB/s   CryptoKit(ms)  CryptoKit h/s   CryptoKit MiB/s   OpenSSL(ms)    OpenSSL h/s    OpenSSL MiB/s  asm/CryptoKit   asm/OpenSSL
        0    200000       32.27     6197411         0.00           87.41        2288184              0.00         44.90        4453946             0.00          2.71x         1.39x
       64    200000       31.43     6362790       388.35           88.35        2263684            138.16         45.73        4373684           266.95          2.81x         1.45x
     1024     50000       59.57      839382       819.71           78.82         634369            619.50         63.53         787032           768.59          1.32x         1.07x
    16384     10000      179.26       55784       871.62          198.61          50349            786.71        181.46          55110           861.09          1.11x         1.01x
   262144      1000      285.22        3506       876.52          311.40           3211            802.83        287.46           3479           869.68          1.09x         1.01x
  1048576       300      342.35         876       876.31          374.75            801            800.54        345.77            868           867.62          1.09x         1.01x
 10485760        30      342.86          87       874.99          374.57             80            800.92        344.97             87           869.65          1.09x         1.01x
```

## sha3-256-x86_64-linux

SHA3-256 implemented in handwritten x86-64 assembly for Linux using AVX-512
(`vprolq` rotations and `vpternlogq` three-input logic; requires AVX-512F and
AVX-512VL). It provides a caller-owned streaming C API and an all-assembly
command-line tool that hashes binary stdin as a freestanding static binary using
raw Linux syscalls. See [sha3-256-x86_64-linux/](sha3-256-x86_64-linux/) for build,
API, and usage details.

### Benchmark

`bin/bench` compares the assembly implementation against both OpenSSL and libgcrypt
SHA3-256. The run below was measured on an **AMD EPYC 9575F** (Zen 5, KVM guest with
two vCPUs). Ratios are reference time / assembly time, so above 1.0 means the
assembly implementation is faster:

```text
  size(B)     iters     asm(ms)     asm h/s    asm MiB/s   OpenSSL(ms)    OpenSSL h/s    OpenSSL MiB/s   gcrypt(ms)    gcrypt h/s    gcrypt MiB/s   asm/OpenSSL   asm/gcrypt
        0    200000       38.55     5187564         0.00         79.59        2512968             0.00        43.89       4556926            0.00         2.06x        1.14x
       64    200000       41.12     4863426       296.84         53.08        3768064           229.98        46.73       4279651          261.21         1.29x        1.14x
     1024     50000       75.52      662038       646.52         88.10         567524           554.22        72.62        688483          672.35         1.17x        0.96x
    16384     10000      215.95       46306       723.53        275.20          36337           567.76       215.82         46335          723.98         1.27x        1.00x
   262144      1000      344.36        2904       725.98        420.48           2378           594.56       346.01          2890          722.53         1.22x        1.00x
  1048576       300      407.46         736       736.27        523.89            573           572.63       411.01           730          729.90         1.29x        1.01x
 10485760        30      416.25          72       720.71        496.64             60           604.06       418.38            72          717.05         1.19x        1.01x
worst repetition spread: asm 9.5%, OpenSSL 30.5%, gcrypt 16.7%
```

