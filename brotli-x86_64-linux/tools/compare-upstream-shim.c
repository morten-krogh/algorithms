/* Temporary development shim used to compare the imported NASM with the
   exact compiler objects from which it was generated. Not part of a build. */
#include "brotli.h"
#include "brotli/decode.h"
#include "brotli/encode.h"

#include <stdlib.h>

uint32_t brotli_asm_version(void) { return BROTLI_ASM_VERSION; }
int brotli_asm_cpu_supported(void) { return 1; }

brotli_asm_state *brotli_asm_encoder_create(
    const brotli_asm_options *o, brotli_asm_alloc_fn a, brotli_asm_free_fn f,
    void *p, int *e) {
  BrotliEncoderState *s = BrotliEncoderCreateInstance(a, f, p);
  if (e) *e = s ? 0 : -3;
  if (!s) return NULL;
  BrotliEncoderSetParameter(s, BROTLI_PARAM_QUALITY, o->quality);
  BrotliEncoderSetParameter(s, BROTLI_PARAM_LGWIN, o->lgwin);
  BrotliEncoderSetParameter(s, BROTLI_PARAM_MODE, o->mode);
  BrotliEncoderSetParameter(s, BROTLI_PARAM_SIZE_HINT, (uint32_t)o->size_hint);
  return (brotli_asm_state *)s;
}

brotli_asm_result brotli_asm_encoder_process(
    brotli_asm_state *v, unsigned op, const uint8_t **next_in,
    size_t *available_in, uint8_t **next_out, size_t *available_out) {
  BrotliEncoderState *s = (BrotliEncoderState *)v;
  if (!BrotliEncoderCompressStream(s, (BrotliEncoderOperation)op, available_in,
                                   next_in, available_out, next_out, NULL))
    return BROTLI_ASM_ERROR;
  if (BrotliEncoderIsFinished(s)) return BROTLI_ASM_FINISHED;
  return *available_out ? BROTLI_ASM_NEEDS_INPUT : BROTLI_ASM_NEEDS_OUTPUT;
}

void brotli_asm_encoder_destroy(brotli_asm_state *s) {
  BrotliEncoderDestroyInstance((BrotliEncoderState *)s);
}
int brotli_asm_encoder_reset(brotli_asm_state *s) {
  (void)s;
  return 1;
}
int brotli_asm_encoder_last_error(const brotli_asm_state *s) {
  (void)s;
  return 0;
}

brotli_asm_state *brotli_asm_decoder_create(
    const brotli_asm_options *o, brotli_asm_alloc_fn a, brotli_asm_free_fn f,
    void *p, int *e) {
  (void)o;
  BrotliDecoderState *s = BrotliDecoderCreateInstance(a, f, p);
  if (e) *e = s ? 0 : -3;
  return (brotli_asm_state *)s;
}

brotli_asm_result brotli_asm_decoder_process(
    brotli_asm_state *v, const uint8_t **next_in, size_t *available_in,
    uint8_t **next_out, size_t *available_out) {
  BrotliDecoderResult r = BrotliDecoderDecompressStream(
      (BrotliDecoderState *)v, available_in, next_in, available_out, next_out,
      NULL);
  return r == BROTLI_DECODER_RESULT_SUCCESS
             ? BROTLI_ASM_FINISHED
             : r == BROTLI_DECODER_RESULT_NEEDS_MORE_INPUT
                   ? BROTLI_ASM_NEEDS_INPUT
                   : r == BROTLI_DECODER_RESULT_NEEDS_MORE_OUTPUT
                         ? BROTLI_ASM_NEEDS_OUTPUT
                         : BROTLI_ASM_ERROR;
}

void brotli_asm_decoder_destroy(brotli_asm_state *s) {
  BrotliDecoderDestroyInstance((BrotliDecoderState *)s);
}
int brotli_asm_decoder_reset(brotli_asm_state *s) {
  (void)s;
  return 1;
}
int brotli_asm_decoder_last_error(const brotli_asm_state *s) {
  (void)s;
  return 0;
}
