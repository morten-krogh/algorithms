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


## Sha3-256



## Sha3-512

SHA3-512 implemented as a hand-written WebAssembly Keccak-p[1600] permutation with a
dependency-free JavaScript wrapper. See [sha3-512/](sha3-512/) for the package and its README.

### Benchmark

`node bench/bench.js` compares this WebAssembly implementation against Node's native
`node:crypto` SHA3-512 over a range of message sizes. The run below was measured on an
**Apple M1 Max** (`wasm/node performance` = node time / wasm time, so above 1.0 means the
WebAssembly implementation is faster):

```
  size(B)     iters    wasm(ms)    wasm h/s   wasm MiB/s    node(ms)     node h/s   node MiB/s  wasm/node performance
        0    200000       74.16     2696932         0.00      178.34      1121462         0.00                   2.4x
       64    200000       81.32     2459493       150.12      172.27      1160966        70.86                   2.1x
     1024     50000      177.91      281039       274.45      147.81       338266       330.34                   0.8x
    16384     10000      502.20       19912       311.13      348.52        28693       448.32                   0.7x
   262144      1000      808.16        1237       309.35      541.97         1845       461.28                   0.7x
  1048576       300      969.16         310       309.55      652.01          460       460.12                   0.7x
 10485760        30      970.76         31       309.04      647.68           46       463.19                   0.7x
```

For small messages the WebAssembly implementation wins (roughly 2×) because it avoids per-call
object allocation; for large messages Node's native OpenSSL SHA3-512 pulls ahead, leaving the
WebAssembly implementation at about 0.7×.

## Shake-256


A collection of high performance, or otherwise interesting, algorithms



