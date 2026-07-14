#ifndef SHA3_256_X86_64_LINUX_H
#define SHA3_256_X86_64_LINUX_H

#include <stddef.h>
#include <stdint.h>

#define SHA3_256_CONTEXT_BYTES 344u
#define SHA3_256_DIGEST_BYTES 32u
#define SHA3_256_RATE_BYTES 136u

/*
 * Opaque streaming SHA3-256 context. The uint64_t representation gives the
 * handwritten assembly the eight-byte alignment required by its lane loads.
 */
typedef struct {
	uint64_t opaque[SHA3_256_CONTEXT_BYTES / sizeof(uint64_t)];
} sha3_256_ctx;

#ifdef __cplusplus
extern "C" {
#endif

void sha3_256_init(sha3_256_ctx *ctx);
void sha3_256_update(sha3_256_ctx *ctx, const void *data, size_t length);
void sha3_256_digest(sha3_256_ctx *ctx,
	uint8_t output[SHA3_256_DIGEST_BYTES]);

#ifdef __cplusplus
}
#endif

#endif
