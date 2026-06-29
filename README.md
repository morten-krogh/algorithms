This goal of this repository is hold a collection of implementations of 
interesting and useful algorithms implemented in "native" languages by collaboration
between humans and AI agents.

# Native languages

A thesis of this repository is high performance is best obtained in platform native languages
such as assembly languages including webassembly. The code in this repository is not compiled.
It is written directly in the native language.

# AI assistance

The code is typically written by "pair" programming between a human and an AI.
Writing in native languages is tedious and there is a huge advantage in having
AI agents contribute.  Part of the reason to be for this repository is to test
the idea that AI is suited for native programming and that, with the help of AI,
it is actually possible to implement more code directly in native languages 
rather than the standard higher level languages.

# Performance and codes size.

The implementations in this repository strive to be highly performant with
small code sizes. Often less code and higher performance goes hand in hand.
In cases where there is a genuine trade-off between the two, a balance must be
found.

# Installation in downstream projects

The implementations contain as few implementation files as possible and do not
rely on third-party dependencies unless they must. The number of implementation
files is typically one or two. Those files can then just be dumped into
downstream code by consumers. The implementations in this repository typically
have additional test files and example files to illustrate usage.

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

## Shake-256


A collection of high performance, or otherwise interesting, algorithms



