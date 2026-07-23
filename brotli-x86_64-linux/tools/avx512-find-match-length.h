/* Regeneration-only override for Brotli's matching-prefix scan.
   The release artifact contains only the resulting NASM instructions. */
#ifndef BROTLI_ENC_FIND_MATCH_LENGTH_H_
#define BROTLI_ENC_FIND_MATCH_LENGTH_H_

#include "c/common/platform.h"

extern size_t BrotliFindMatchLengthAVX512(
    const uint8_t* s1, const uint8_t* s2, size_t limit);

static BROTLI_INLINE size_t FindMatchLengthWithLimit(
    const uint8_t* s1, const uint8_t* s2, size_t limit) {
  const uint8_t* const start = s1;
  /* Hash hits in incompressible data usually diverge quickly. Avoid a call
     and 64-byte load unless two full words confirm that this is
     likely to be a useful match. Keeping the vector loop out of line also
     preserves the compact upstream hash-chain loops. */
  if (limit >= 80) {
    size_t offset;
    for (offset = 0; offset != 16; offset += 8) {
      const uint64_t difference =
          BROTLI_UNALIGNED_LOAD64LE(s1 + offset) ^
          BROTLI_UNALIGNED_LOAD64LE(s2 + offset);
      if (difference != 0) {
        return offset + ((size_t)BROTLI_TZCNT64(difference) >> 3);
      }
    }
    return 16 + BrotliFindMatchLengthAVX512(s1 + 16, s2 + 16, limit - 16);
  }
  while (limit >= 8) {
    const uint64_t difference =
        BROTLI_UNALIGNED_LOAD64LE(s1) ^ BROTLI_UNALIGNED_LOAD64LE(s2);
    if (difference != 0) {
      return (size_t)(s1 - start) +
             ((size_t)BROTLI_TZCNT64(difference) >> 3);
    }
    s1 += 8;
    s2 += 8;
    limit -= 8;
  }
  while (limit != 0 && *s1 == *s2) {
    ++s1;
    ++s2;
    --limit;
  }
  return (size_t)(s1 - start);
}

#endif
