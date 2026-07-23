#define _GNU_SOURCE
#include "brotli.h"

#include <dlfcn.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef int (*reference_compress_fn)(int, int, int, size_t, const uint8_t *,
                                     size_t *, uint8_t *);
typedef int (*reference_decompress_fn)(size_t, const uint8_t *, size_t *,
                                       uint8_t *);

static void fail(const char *message) {
  fprintf(stderr, "FAIL: %s\n", message);
  exit(1);
}

static void *allocate(void *opaque, size_t size) {
  (void)opaque;
  return malloc(size);
}

static void release(void *opaque, void *address) {
  (void)opaque;
  free(address);
}

static uint8_t *asm_compress_options(
    const uint8_t *input, size_t input_size,
    const brotli_asm_options *options, size_t *output_size) {
  int error = 0;
  brotli_asm_state *state =
      brotli_asm_encoder_create(options, allocate, release, NULL, &error);
  if (state == NULL) {
    fprintf(stderr, "encoder create error: %d\n", error);
    fail("encoder create");
  }

  size_t capacity = input_size + input_size / 4 + 65536;
  uint8_t *output = malloc(capacity);
  if (output == NULL) fail("output allocation");
  const uint8_t *next_in = input;
  size_t available_in = input_size;
  uint8_t *next_out = output;
  size_t available_out = capacity;
  for (;;) {
    brotli_asm_result result = brotli_asm_encoder_process(
        state, BROTLI_ASM_OP_FINISH, &next_in, &available_in, &next_out,
        &available_out);
    if (result == BROTLI_ASM_FINISHED) break;
    if (result == BROTLI_ASM_ERROR) {
      fprintf(stderr, "encoder process error: %d\n",
              brotli_asm_encoder_last_error(state));
      fail("encoder process");
    }
    if (result == BROTLI_ASM_NEEDS_OUTPUT) fail("encoder output too small");
  }
  *output_size = capacity - available_out;
  brotli_asm_encoder_destroy(state);
  return output;
}

static uint8_t *asm_compress(const uint8_t *input, size_t input_size,
                             unsigned quality, size_t *output_size) {
  brotli_asm_options options = {
      .quality = quality,
      .lgwin = 22,
      .mode = BROTLI_ASM_MODE_GENERIC,
      .size_hint = input_size,
  };
  return asm_compress_options(input, input_size, &options, output_size);
}

static void asm_decompress(const uint8_t *input, size_t input_size,
                           uint8_t *output, size_t output_size) {
  int error = 0;
  brotli_asm_state *state =
      brotli_asm_decoder_create(NULL, allocate, release, NULL, &error);
  if (state == NULL) {
    fprintf(stderr, "decoder create error: %d\n", error);
    fail("decoder create");
  }
  const uint8_t *next_in = input;
  size_t available_in = input_size;
  uint8_t *next_out = output;
  size_t available_out = output_size;
  brotli_asm_result result = brotli_asm_decoder_process(
      state, &next_in, &available_in, &next_out, &available_out);
  if (result != BROTLI_ASM_FINISHED || available_in != 0 ||
      available_out != 0) {
    fprintf(stderr,
            "decoder result=%d error=%d remaining input=%zu output=%zu\n",
            result, brotli_asm_decoder_last_error(state), available_in,
            available_out);
    fail("decoder process");
  }
  brotli_asm_decoder_destroy(state);
}

static void asm_decompress_chunked(const uint8_t *input, size_t input_size,
                                   uint8_t *output, size_t output_size) {
  int error = 0;
  brotli_asm_state *state =
      brotli_asm_decoder_create(NULL, allocate, release, NULL, &error);
  if (state == NULL) fail("chunked decoder create");
  const uint8_t *next_in = input;
  size_t available_in = input_size;
  size_t produced = 0;
  for (;;) {
    uint8_t *next_out = output + produced;
    size_t available_out =
        output_size - produced < 65536 ? output_size - produced : 65536;
    size_t offered = available_out;
    brotli_asm_result result = brotli_asm_decoder_process(
        state, &next_in, &available_in, &next_out, &available_out);
    produced += offered - available_out;
    if (result == BROTLI_ASM_FINISHED) break;
    if (result == BROTLI_ASM_ERROR || result == BROTLI_ASM_NEEDS_INPUT)
      fail("chunked decoder process");
  }
  if (produced != output_size || available_in != 0)
    fail("chunked decoder size");
  brotli_asm_decoder_destroy(state);
}

int main(void) {
  if (brotli_asm_version() != BROTLI_ASM_VERSION) fail("version");
  if (!brotli_asm_cpu_supported()) fail("CPU support detection");

  void *encoder_library =
      dlopen("libbrotlienc.so.1", RTLD_NOW | RTLD_LOCAL);
  void *decoder_library =
      dlopen("libbrotlidec.so.1", RTLD_NOW | RTLD_LOCAL);
  if (encoder_library == NULL || decoder_library == NULL)
    fail("reference libraries");
  reference_compress_fn reference_compress = NULL;
  reference_decompress_fn reference_decompress = NULL;
  void *compress_symbol =
      dlsym(encoder_library, "BrotliEncoderCompress");
  void *decompress_symbol =
      dlsym(decoder_library, "BrotliDecoderDecompress");
  memcpy(&reference_compress, &compress_symbol, sizeof(reference_compress));
  memcpy(&reference_decompress, &decompress_symbol,
         sizeof(reference_decompress));
  if (reference_compress == NULL || reference_decompress == NULL)
    fail("reference symbols");

  const size_t input_size = 65536;
  uint8_t *input = malloc(input_size);
  uint8_t *decoded = malloc(input_size);
  uint8_t *reference_output = malloc(input_size + 65536);
  if (input == NULL || decoded == NULL || reference_output == NULL)
    fail("test allocation");
  uint32_t random = 0x243f6a88u;
  for (size_t i = 0; i < input_size; ++i) {
    random ^= random << 13;
    random ^= random >> 17;
    random ^= random << 5;
    input[i] = (i % 97 < 80) ? (uint8_t)("Brotli assembly test data "[i % 26])
                             : (uint8_t)random;
  }

  for (unsigned quality = 0; quality <= 11; ++quality) {
    size_t compressed_size = 0;
    uint8_t *compressed =
        asm_compress(input, input_size, quality, &compressed_size);
    memset(decoded, 0, input_size);
    asm_decompress(compressed, compressed_size, decoded, input_size);
    if (memcmp(decoded, input, input_size) != 0) fail("assembly round-trip");

    size_t reference_decoded_size = input_size;
    if (reference_decompress(compressed_size, compressed,
                             &reference_decoded_size, decoded) != 1 ||
        reference_decoded_size != input_size ||
        memcmp(decoded, input, input_size) != 0)
      fail("reference decoder rejected assembly stream");

    size_t reference_size = input_size + 65536;
    if (!reference_compress((int)quality, 22, 0, input_size, input,
                            &reference_size, reference_output))
      fail("reference encoder");
    memset(decoded, 0, input_size);
    asm_decompress(reference_output, reference_size, decoded, input_size);
    if (memcmp(decoded, input, input_size) != 0)
      fail("assembly decoder rejected reference stream");
    free(compressed);
  }

  {
    brotli_asm_options parameter_options = {
        .quality = 4,
        .lgwin = 10,
        .mode = BROTLI_ASM_MODE_GENERIC,
        .lgblock = 16,
        .size_hint = input_size,
    };
    size_t parameter_stream_size = 0;
    uint8_t *parameter_stream =
        asm_compress_options(input, input_size, &parameter_options,
                             &parameter_stream_size);
    if (parameter_stream_size == 0 ||
        (parameter_stream[0] & 0x7Fu) != 0x21u)
      fail("encoder parameter mapping");
    free(parameter_stream);
  }

  const size_t large_size = 3500000;
  uint8_t *large = malloc(large_size);
  uint8_t *large_decoded = malloc(large_size);
  if (large == NULL || large_decoded == NULL) fail("large test allocation");
  for (size_t i = 0; i < large_size; ++i)
    large[i] = (uint8_t)("Streaming assembly Brotli data. "[i % 32]);
  size_t large_compressed_size = 0;
  uint8_t *large_compressed =
      asm_compress(large, large_size, 6, &large_compressed_size);
  asm_decompress(large_compressed, large_compressed_size, large_decoded,
                 large_size);
  if (memcmp(large, large_decoded, large_size) != 0)
    fail("large streaming round-trip");
  memset(large_decoded, 0, large_size);
  asm_decompress_chunked(large_compressed, large_compressed_size,
                         large_decoded, large_size);
  if (memcmp(large, large_decoded, large_size) != 0)
    fail("chunked large streaming round-trip");
  free(large_compressed);
  free(large_decoded);
  free(large);

  int error = 0;
  brotli_asm_state *decoder =
      brotli_asm_decoder_create(NULL, allocate, release, NULL, &error);
  if (decoder == NULL || !brotli_asm_decoder_reset(decoder))
    fail("decoder reset");
  brotli_asm_decoder_destroy(decoder);

  brotli_asm_options reset_options = {
      .quality = 4,
      .lgwin = 22,
      .mode = BROTLI_ASM_MODE_GENERIC,
  };
  brotli_asm_state *encoder = brotli_asm_encoder_create(
      &reset_options, allocate, release, NULL, &error);
  if (encoder == NULL || !brotli_asm_encoder_reset(encoder))
    fail("encoder reset");
  brotli_asm_encoder_destroy(encoder);

  reset_options.quality = 12;
  encoder = brotli_asm_encoder_create(&reset_options, allocate, release, NULL,
                                      &error);
  if (encoder != NULL || error != BROTLI_ASM_ERR_OPTION)
    fail("invalid encoder option");
  if (brotli_asm_decoder_create(NULL, NULL, release, NULL, &error) != NULL ||
      error != BROTLI_ASM_ERR_BAD_ARGUMENT)
    fail("invalid allocator pair");

  free(reference_output);
  free(decoded);
  free(input);
  dlclose(decoder_library);
  dlclose(encoder_library);
  puts("brotli assembly tests passed");
  return 0;
}
