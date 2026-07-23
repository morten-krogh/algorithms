#ifndef BROTLI_X86_64_LINUX_H
#define BROTLI_X86_64_LINUX_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define BROTLI_ASM_VERSION 0x00010000u

typedef void *(*brotli_asm_alloc_fn)(void *opaque, size_t size);
typedef void (*brotli_asm_free_fn)(void *opaque, void *address);

typedef struct brotli_asm_state brotli_asm_state;

typedef struct {
  uint32_t quality;
  uint32_t lgwin;
  uint32_t mode;
  uint32_t lgblock;
  uint64_t size_hint;
  uint32_t flags;
  uint32_t reserved;
} brotli_asm_options;

enum {
  BROTLI_ASM_MODE_GENERIC = 0,
  BROTLI_ASM_MODE_TEXT = 1,
  BROTLI_ASM_MODE_FONT = 2
};

enum {
  BROTLI_ASM_OP_PROCESS = 0,
  BROTLI_ASM_OP_FLUSH = 1,
  BROTLI_ASM_OP_FINISH = 2
};

typedef enum {
  BROTLI_ASM_ERROR = 0,
  BROTLI_ASM_NEEDS_INPUT = 1,
  BROTLI_ASM_NEEDS_OUTPUT = 2,
  BROTLI_ASM_FLUSHED = 3,
  BROTLI_ASM_FINISHED = 4
} brotli_asm_result;

enum {
  BROTLI_ASM_ERR_NONE = 0,
  BROTLI_ASM_ERR_BAD_ARGUMENT = -1,
  BROTLI_ASM_ERR_UNSUPPORTED_CPU = -2,
  BROTLI_ASM_ERR_ALLOCATION = -3,
  BROTLI_ASM_ERR_CODEC = -4,
  BROTLI_ASM_ERR_OPTION = -5
};

uint32_t brotli_asm_version(void);
int brotli_asm_cpu_supported(void);

brotli_asm_state *brotli_asm_encoder_create(
    const brotli_asm_options *options, brotli_asm_alloc_fn allocate,
    brotli_asm_free_fn release, void *opaque, int *error);
brotli_asm_result brotli_asm_encoder_process(
    brotli_asm_state *state, unsigned operation, const uint8_t **next_in,
    size_t *available_in, uint8_t **next_out, size_t *available_out);
int brotli_asm_encoder_reset(brotli_asm_state *state);
int brotli_asm_encoder_last_error(const brotli_asm_state *state);
void brotli_asm_encoder_destroy(brotli_asm_state *state);

brotli_asm_state *brotli_asm_decoder_create(
    const brotli_asm_options *options, brotli_asm_alloc_fn allocate,
    brotli_asm_free_fn release, void *opaque, int *error);
brotli_asm_result brotli_asm_decoder_process(
    brotli_asm_state *state, const uint8_t **next_in, size_t *available_in,
    uint8_t **next_out, size_t *available_out);
int brotli_asm_decoder_reset(brotli_asm_state *state);
int brotli_asm_decoder_last_error(const brotli_asm_state *state);
void brotli_asm_decoder_destroy(brotli_asm_state *state);

#ifdef __cplusplus
}
#endif

#endif
