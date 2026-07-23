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

## brotli-wasm

RFC 7932 Brotli compression and decompression in one self-contained WebAssembly
text module, with a dependency-free streaming JavaScript driver. It supports
encoder qualities 0–11, all standard windows and modes, the complete decoder,
flush/reset, a binary CLI, and a browser demo. See
[brotli-wasm/](brotli-wasm/) for the API, benchmark, and implementation notes.

The benchmark compares both directions against Node's native Brotli and a
Rust/WASM implementation. On the AMD EPYC 9575F test host, this implementation
encoded the bulk corpora 2.8–13.0× as fast as the Rust/WASM reference at
qualities 4 and 6 when both return owned output, while reaching 0.54–1.27×
Node's native speed. Owned-output decoding measured 1.3–10.6× the Rust/WASM
reference and 0.81–1.16× Node.


## sha3-256-wasm

SHA3-256 implemented as a hand-written WebAssembly Keccak-p[1600] permutation with a
dependency-free JavaScript wrapper. See [sha3-256-wasm/](sha3-256-wasm/) for the package.

### Benchmark

`node bench/bench.js` compares this WebAssembly implementation against Node's native
`node:crypto` SHA3-256 and the [hash-wasm](https://www.npmjs.com/package/hash-wasm) library
over a range of message sizes. The run below was measured on an **Apple M1 Max**
(`sha3-256-wasm/node` and `sha3-256-wasm/hash-wasm` = reference time / sha3-256-wasm time, so
above 1.0 means this WebAssembly implementation is faster):

```
  size(B)     iters   sha3-256-wasm(ms)   sha3-256-wasm h/s   sha3-256-wasm MiB/s    node(ms)     node h/s   node MiB/s   hash-wasm(ms)   hash-wasm h/s   hash-wasm MiB/s   sha3-256-wasm/node   sha3-256-wasm/hash-wasm
        0    200000               73.45             2723009                  0.00      182.63      1095127         0.00           80.78         2475890              0.00                2.49x                     1.10x
       64    200000               80.98             2469827                150.75      178.60      1119791        68.35           95.33         2098078            128.06                2.21x                     1.18x
     1024     50000               99.30              503520                491.72       98.20       509170       497.24          113.92          438904            428.62                0.99x                     1.15x
    16384     10000              261.91               38180                596.57      188.61        53021       828.45          310.68           32188            502.94                0.72x                     1.19x
   262144      1000              418.38                2390                597.55      289.98         3448       862.12          495.47            2018            504.58                0.69x                     1.18x
  1048576       300              503.79                 595                595.49      347.27          864       863.87          593.14             506            505.78                0.69x                     1.18x
 10485760        30              502.25                  60                597.32      346.39           87       866.08          592.40              51            506.41                0.69x                     1.18x
```

For small messages the WebAssembly implementation wins (roughly 2×) because it avoids per-call
object allocation; for large messages Node's native OpenSSL SHA3-256 pulls ahead, leaving the
WebAssembly implementation at about 0.7×. hash-wasm's hand-tuned SHA-3 trails this
implementation at every size (1.1–1.2×).

## sha3-512-wasm

SHA3-512 implemented as a hand-written WebAssembly Keccak-p[1600] permutation with a
dependency-free JavaScript wrapper. See [sha3-512-wasm/](sha3-512-wasm/) for the package and its README.

### Benchmark

`node bench/bench.js` compares this WebAssembly implementation against Node's native
`node:crypto` SHA3-512 and the [hash-wasm](https://www.npmjs.com/package/hash-wasm) library
over a range of message sizes. The run below was measured on an **Apple M1 Max**
(`sha3-512-wasm/node` and `sha3-512-wasm/hash-wasm` = reference time / sha3-512-wasm time, so
above 1.0 means this WebAssembly implementation is faster):

```
  size(B)     iters   sha3-512-wasm(ms)   sha3-512-wasm h/s   sha3-512-wasm MiB/s    node(ms)     node h/s   node MiB/s   hash-wasm(ms)   hash-wasm h/s   hash-wasm MiB/s   sha3-512-wasm/node   sha3-512-wasm/hash-wasm
        0    200000               72.20             2770246                  0.00      180.89      1105624         0.00           77.74         2572725              0.00                2.51x                     1.08x
       64    200000               79.20             2525094                154.12      177.21      1128603        68.88           91.15         2194249            133.93                2.24x                     1.15x
     1024     50000              174.76              286099                279.39      148.93       335735       327.87          199.70          250381            244.51                0.85x                     1.14x
    16384     10000              488.08               20488                320.13      344.43        29033       453.65          577.72           17310            270.46                0.71x                     1.18x
   262144      1000              787.36                1270                317.52      545.10         1835       458.63          928.67            1077            269.20                0.69x                     1.18x
  1048576       300              941.71                 319                318.57      651.04          461       460.80         1118.13             268            268.30                0.69x                     1.19x
 10485760        30              940.88                  32                318.85      650.19           46       461.40         1126.55              27            266.30                0.69x                     1.20x
```

For small messages the WebAssembly implementation wins (roughly 2×) because it avoids per-call
object allocation; for large messages Node's native OpenSSL SHA3-512 pulls ahead, leaving the
WebAssembly implementation at about 0.7×. hash-wasm's hand-tuned SHA-3 trails this
implementation at every size (1.1–1.2×).

## shake-256-wasm

SHAKE256 (the SHA-3 extendable-output function) implemented as a hand-written WebAssembly
Keccak-p[1600] permutation with a dependency-free JavaScript wrapper. See
[shake-256-wasm/](shake-256-wasm/) for the package.

### Benchmark

`node bench/bench.js` compares this WebAssembly implementation against Node's native
`node:crypto` SHAKE256 over a range of message sizes, squeezing a 32-byte output per call. The
run below was measured on an **Apple M1 Max** (`shake-256-wasm/node` = node time / shake-256-wasm time,
so above 1.0 means the WebAssembly implementation is faster):

```
  size(B)     iters   shake-256-wasm(ms)   shake-256-wasm h/s   shake-256-wasm MiB/s    node(ms)     node h/s   node MiB/s   shake-256-wasm/node
        0    200000               118.80              1683562                   0.00      183.56      1089563         0.00                 1.55x
       64    200000               127.32              1570821                  95.88      183.29      1091183        66.60                 1.44x
     1024     50000               114.22               437744                 427.48       98.94       505347       493.50                 0.87x
    16384     10000               272.42                36707                 573.55      189.62        52738       824.03                 0.70x
   262144      1000               429.66                 2327                 581.85      290.15         3446       861.62                 0.68x
  1048576       300               519.61                  577                 577.36      347.53          863       863.23                 0.67x
 10485760        30               515.25                   58                 582.24      346.09           87       866.82                 0.67x
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
(`philox-4x32-wasm/js` = JS time / philox-4x32-wasm time, so above 1.0 means the WebAssembly
implementation is faster):

```
   blocks     iters   philox-4x32-wasm(ms)   philox-4x32-wasm blocks/s   philox-4x32-wasm MiB/s      js(ms)   js blocks/s    js MiB/s   philox-4x32-wasm/js
        1    200000                  12.07                    16574012                   252.90       30.53       6550058       99.95                 2.53x
       16     50000                  11.05                    72421680                  1105.07       97.72       8186834      124.92                 8.85x
     1024      1000                  11.33                    90403126                  1379.44      122.76       8341536      127.28                10.84x
    16384       100                  17.84                    91856375                  1401.62      237.23       6906306      105.38                13.30x
   262144        10                  29.19                    89793280                  1370.14      383.32       6838713      104.35                13.13x
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
  size(B)     iters   sha3-256-arm64-macos(ms)   sha3-256-arm64-macos h/s   sha3-256-arm64-macos MiB/s   CryptoKit(ms)  CryptoKit h/s   CryptoKit MiB/s   OpenSSL(ms)    OpenSSL h/s    OpenSSL MiB/s   sha3-256-arm64-macos/CryptoKit   sha3-256-arm64-macos/OpenSSL
        0    200000                      29.98                    6670419                         0.00           87.90        2275210              0.00         44.73        4471231             0.00                            2.93x                          1.49x
       64    200000                      31.75                    6299998                       384.52           88.01        2272464            138.70         45.85        4361793           266.22                            2.77x                          1.44x
     1024     50000                      59.20                     844636                       824.84           78.58         636264            621.35         63.35         789245           770.75                            1.33x                          1.07x
    16384     10000                     178.66                      55973                       874.58          198.00          50505            789.14        180.83          55300           864.06                            1.11x                          1.01x
   262144      1000                     285.27                       3505                       876.35          312.19           3203            800.80        286.72           3488           871.93                            1.09x                          1.01x
  1048576       300                     341.40                        879                       878.75          375.42            799            799.10        344.43            871           870.99                            1.10x                          1.01x
 10485760        30                     342.25                         88                       876.54          374.59             80            800.87        344.53             87           870.76                            1.09x                          1.01x
worst repetition spread: sha3-256-arm64-macos 2.5%, CryptoKit 3.0%, OpenSSL 3.2%
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
  size(B)     iters   sha3-256-x86_64-linux(ms)   sha3-256-x86_64-linux h/s   sha3-256-x86_64-linux MiB/s   OpenSSL(ms)    OpenSSL h/s    OpenSSL MiB/s   gcrypt(ms)    gcrypt h/s    gcrypt MiB/s   sha3-256-x86_64-linux/OpenSSL   sha3-256-x86_64-linux/gcrypt
        0    200000                       38.55                     5187564                          0.00         79.59        2512968             0.00        43.89       4556926            0.00                           2.06x                          1.14x
       64    200000                       41.12                     4863426                        296.84         53.08        3768064           229.98        46.73       4279651          261.21                           1.29x                          1.14x
     1024     50000                       75.52                      662038                        646.52         88.10         567524           554.22        72.62        688483          672.35                           1.17x                          0.96x
    16384     10000                      215.95                       46306                        723.53        275.20          36337           567.76       215.82         46335          723.98                           1.27x                          1.00x
   262144      1000                      344.36                        2904                        725.98        420.48           2378           594.56       346.01          2890          722.53                           1.22x                          1.00x
  1048576       300                      407.46                         736                        736.27        523.89            573           572.63       411.01           730          729.90                           1.29x                          1.01x
 10485760        30                      416.25                          72                        720.71        496.64             60           604.06       418.38            72          717.05                           1.19x                          1.01x
worst repetition spread: sha3-256-x86_64-linux 9.5%, OpenSSL 30.5%, gcrypt 16.7%
```
