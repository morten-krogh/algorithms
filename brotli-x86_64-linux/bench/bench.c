#define _GNU_SOURCE
#include "brotli.h"

#include <dlfcn.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

typedef void *(*reference_encoder_create_fn)(brotli_asm_alloc_fn,
                                             brotli_asm_free_fn, void *);
typedef int (*reference_encoder_set_fn)(void *, int, uint32_t);
typedef int (*reference_encoder_process_fn)(
    void *, int, size_t *, const uint8_t **, size_t *, uint8_t **, size_t *);
typedef int (*reference_encoder_finished_fn)(void *);
typedef void (*reference_encoder_destroy_fn)(void *);
typedef void *(*reference_decoder_create_fn)(brotli_asm_alloc_fn,
                                             brotli_asm_free_fn, void *);
typedef int (*reference_decoder_process_fn)(
    void *, size_t *, const uint8_t **, size_t *, uint8_t **, size_t *);
typedef void (*reference_decoder_destroy_fn)(void *);

typedef struct {
  const uint8_t *input;
  size_t input_size;
  uint8_t *compressed;
  size_t compressed_capacity;
  size_t compressed_size;
  uint8_t *decoded;
  unsigned quality;
  reference_encoder_create_fn reference_encoder_create;
  reference_encoder_set_fn reference_encoder_set;
  reference_encoder_process_fn reference_encoder_process;
  reference_encoder_finished_fn reference_encoder_finished;
  reference_encoder_destroy_fn reference_encoder_destroy;
  reference_decoder_create_fn reference_decoder_create;
  reference_decoder_process_fn reference_decoder_process;
  reference_decoder_destroy_fn reference_decoder_destroy;
} context;

static volatile uint64_t checksum;

static void *allocate(void *opaque, size_t size) {
  (void)opaque;
  return malloc(size);
}

static void release(void *opaque, void *address) {
  (void)opaque;
  free(address);
}

static double now_seconds(void) {
  struct timespec value;
  if (clock_gettime(CLOCK_MONOTONIC, &value) != 0) abort();
  return (double)value.tv_sec + (double)value.tv_nsec * 1e-9;
}

static int asm_encode(context *ctx) {
  brotli_asm_options options = {0};
  options.quality = ctx->quality;
  options.lgwin = 22;
  options.mode = BROTLI_ASM_MODE_GENERIC;
  options.size_hint = ctx->input_size;
  int error = 0;
  brotli_asm_state *state =
      brotli_asm_encoder_create(&options, allocate, release, NULL, &error);
  if (state == NULL) return 0;
  const uint8_t *next_in = ctx->input;
  size_t available_in = ctx->input_size;
  uint8_t *next_out = ctx->compressed;
  size_t available_out = ctx->compressed_capacity;
  for (;;) {
    brotli_asm_result result = brotli_asm_encoder_process(
        state, BROTLI_ASM_OP_FINISH, &next_in, &available_in, &next_out,
        &available_out);
    if (result == BROTLI_ASM_FINISHED) break;
    if (result == BROTLI_ASM_ERROR || result == BROTLI_ASM_NEEDS_OUTPUT) {
      brotli_asm_encoder_destroy(state);
      return 0;
    }
  }
  ctx->compressed_size = ctx->compressed_capacity - available_out;
  checksum += ctx->compressed[ctx->compressed_size / 2] + ctx->compressed_size;
  brotli_asm_encoder_destroy(state);
  return 1;
}

static int reference_encode(context *ctx) {
  void *state =
      ctx->reference_encoder_create(allocate, release, NULL);
  if (state == NULL ||
      !ctx->reference_encoder_set(state, 1, ctx->quality) ||
      !ctx->reference_encoder_set(state, 3, 22) ||
      !ctx->reference_encoder_set(state, 0, 0) ||
      !ctx->reference_encoder_set(state, 2, (uint32_t)ctx->input_size)) {
    if (state != NULL) ctx->reference_encoder_destroy(state);
    return 0;
  }
  const uint8_t *next_in = ctx->input;
  size_t available_in = ctx->input_size;
  uint8_t *next_out = ctx->compressed;
  size_t available_out = ctx->compressed_capacity;
  size_t total_out = 0;
  int result = ctx->reference_encoder_process(
      state, 2, &available_in, &next_in, &available_out, &next_out,
      &total_out);
  if (!result || !ctx->reference_encoder_finished(state)) {
    ctx->reference_encoder_destroy(state);
    return 0;
  }
  ctx->compressed_size = ctx->compressed_capacity - available_out;
  checksum +=
      ctx->compressed[ctx->compressed_size / 2] + ctx->compressed_size;
  ctx->reference_encoder_destroy(state);
  return 1;
}

static int asm_decode(context *ctx) {
  int error = 0;
  brotli_asm_state *state =
      brotli_asm_decoder_create(NULL, allocate, release, NULL, &error);
  if (state == NULL) return 0;
  const uint8_t *next_in = ctx->compressed;
  size_t available_in = ctx->compressed_size;
  uint8_t *next_out = ctx->decoded;
  size_t available_out = ctx->input_size;
  brotli_asm_result result = brotli_asm_decoder_process(
      state, &next_in, &available_in, &next_out, &available_out);
  brotli_asm_decoder_destroy(state);
  if (result != BROTLI_ASM_FINISHED || available_in != 0 ||
      available_out != 0)
    return 0;
  checksum += ctx->decoded[ctx->input_size / 2];
  return 1;
}

static int reference_decode(context *ctx) {
  void *state =
      ctx->reference_decoder_create(allocate, release, NULL);
  if (state == NULL) return 0;
  const uint8_t *next_in = ctx->compressed;
  size_t available_in = ctx->compressed_size;
  uint8_t *next_out = ctx->decoded;
  size_t available_out = ctx->input_size;
  size_t total_out = 0;
  int result = ctx->reference_decoder_process(
      state, &available_in, &next_in, &available_out, &next_out, &total_out);
  ctx->reference_decoder_destroy(state);
  if (result != 1 || available_in != 0 || available_out != 0)
    return 0;
  checksum += ctx->decoded[ctx->input_size / 2];
  return 1;
}

typedef int (*operation)(context *);

static double best_time(operation function, context *ctx, unsigned iterations) {
  double best = 1e100;
  for (unsigned round = 0; round < 3; ++round) {
    double start = now_seconds();
    for (unsigned i = 0; i < iterations; ++i)
      if (!function(ctx)) return -1.0;
    double elapsed = now_seconds() - start;
    if (elapsed < best) best = elapsed;
  }
  return best;
}

static double mib_per_second(size_t bytes, unsigned iterations, double time) {
  return ((double)bytes * (double)iterations / 1048576.0) / time;
}

int main(int argc, char **argv) {
  int enforce = argc == 2 && strcmp(argv[1], "--check") == 0;
  if (argc > 2 || (argc == 2 && !enforce)) {
    fprintf(stderr, "Usage: %s [--check]\n", argv[0]);
    return 2;
  }
  if (!brotli_asm_cpu_supported()) {
    fputs("required CPU features are unavailable\n", stderr);
    return 1;
  }

  void *encoder_library =
      dlopen("libbrotlienc.so.1", RTLD_NOW | RTLD_LOCAL);
  void *decoder_library =
      dlopen("libbrotlidec.so.1", RTLD_NOW | RTLD_LOCAL);
  if (encoder_library == NULL || decoder_library == NULL) {
    fputs("Google Brotli 1.2.0 runtime libraries are required\n", stderr);
    return 1;
  }
#define LOAD_FUNCTION(target, library, symbol_name)                    \
  do {                                                                \
    void *symbol = dlsym((library), (symbol_name));                    \
    memcpy(&(target), &symbol, sizeof(target));                        \
    if ((target) == NULL) return 1;                                    \
  } while (0)
  reference_encoder_create_fn reference_encoder_create = NULL;
  reference_encoder_set_fn reference_encoder_set = NULL;
  reference_encoder_process_fn reference_encoder_process = NULL;
  reference_encoder_finished_fn reference_encoder_finished = NULL;
  reference_encoder_destroy_fn reference_encoder_destroy = NULL;
  reference_decoder_create_fn reference_decoder_create = NULL;
  reference_decoder_process_fn reference_decoder_process = NULL;
  reference_decoder_destroy_fn reference_decoder_destroy = NULL;
  LOAD_FUNCTION(reference_encoder_create, encoder_library,
                "BrotliEncoderCreateInstance");
  LOAD_FUNCTION(reference_encoder_set, encoder_library,
                "BrotliEncoderSetParameter");
  LOAD_FUNCTION(reference_encoder_process, encoder_library,
                "BrotliEncoderCompressStream");
  LOAD_FUNCTION(reference_encoder_finished, encoder_library,
                "BrotliEncoderIsFinished");
  LOAD_FUNCTION(reference_encoder_destroy, encoder_library,
                "BrotliEncoderDestroyInstance");
  LOAD_FUNCTION(reference_decoder_create, decoder_library,
                "BrotliDecoderCreateInstance");
  LOAD_FUNCTION(reference_decoder_process, decoder_library,
                "BrotliDecoderDecompressStream");
  LOAD_FUNCTION(reference_decoder_destroy, decoder_library,
                "BrotliDecoderDestroyInstance");
#undef LOAD_FUNCTION

  const size_t input_size = 2 * 1024 * 1024;
  uint8_t *input = malloc(input_size);
  uint8_t *compressed = malloc(input_size * 2 + 65536);
  uint8_t *decoded = malloc(input_size);
  if (input == NULL || compressed == NULL || decoded == NULL) return 1;
  uint32_t random = 0x9e3779b9u;
  const char text[] =
      "Brotli native assembly benchmark: repeated English, JSON-like keys, "
      "and sparse binary bytes exercise literals and backward references. ";
  for (size_t i = 0; i < input_size; ++i) {
    random ^= random << 13;
    random ^= random >> 17;
    random ^= random << 5;
    input[i] = (i % 113 < 101) ? (uint8_t)text[i % (sizeof(text) - 1)]
                               : (uint8_t)random;
  }

  context ctx = {
      .input = input,
      .input_size = input_size,
      .compressed = compressed,
      .compressed_capacity = input_size * 2 + 65536,
      .decoded = decoded,
      .reference_encoder_create = reference_encoder_create,
      .reference_encoder_set = reference_encoder_set,
      .reference_encoder_process = reference_encoder_process,
      .reference_encoder_finished = reference_encoder_finished,
      .reference_encoder_destroy = reference_encoder_destroy,
      .reference_decoder_create = reference_decoder_create,
      .reference_decoder_process = reference_decoder_process,
      .reference_decoder_destroy = reference_decoder_destroy,
  };
  const unsigned qualities[] = {0, 4, 6, 11};
  const unsigned iterations[] = {12, 5, 3, 1};
  double decode_asm_time = 0.0;
  double decode_reference_time = 0.0;
  int check_failed = 0;

  puts("dataset: 2.00 MiB mixed text/binary; streaming lifecycle on both");
  puts("sizes are asm/reference bytes");
  puts(" q   size asm/ref      encode MiB/s (asm ref ratio)"
       "      decode MiB/s (asm ref ratio)");
  for (size_t row = 0; row < sizeof(qualities) / sizeof(qualities[0]); ++row) {
    ctx.quality = qualities[row];
    if (!asm_encode(&ctx)) return 1;
    size_t asm_size = ctx.compressed_size;
    if (!reference_encode(&ctx)) return 1;
    size_t reference_size = ctx.compressed_size;

    double asm_encode_time =
        best_time(asm_encode, &ctx, iterations[row]);
    double reference_encode_time =
        best_time(reference_encode, &ctx, iterations[row]);
    /* Decode one identical reference stream for both implementations. */
    if (!reference_encode(&ctx)) return 1;
    double asm_decode_time =
        best_time(asm_decode, &ctx, iterations[row] * 4);
    double reference_decode_time =
        best_time(reference_decode, &ctx, iterations[row] * 4);
    if (asm_encode_time < 0 || reference_encode_time < 0 ||
        asm_decode_time < 0 || reference_decode_time < 0)
      return 1;

    double asm_encode_speed =
        mib_per_second(input_size, iterations[row], asm_encode_time);
    double reference_encode_speed =
        mib_per_second(input_size, iterations[row], reference_encode_time);
    double asm_decode_speed =
        mib_per_second(input_size, iterations[row] * 4, asm_decode_time);
    double reference_decode_speed = mib_per_second(
        input_size, iterations[row] * 4, reference_decode_time);
    double encode_ratio = asm_encode_speed / reference_encode_speed;
    double decode_ratio = asm_decode_speed / reference_decode_speed;
    printf("%2u  %7zu/%-7zu  %8.1f %8.1f %5.2fx"
           "        %8.1f %8.1f %5.2fx\n",
           qualities[row], asm_size, reference_size, asm_encode_speed,
           reference_encode_speed, encode_ratio, asm_decode_speed,
           reference_decode_speed, decode_ratio);

    if (qualities[row] != 11) {
      decode_asm_time += asm_decode_time / (double)(iterations[row] * 4);
      decode_reference_time +=
          reference_decode_time / (double)(iterations[row] * 4);
      if (encode_ratio < 1.05 || decode_ratio < 0.95) check_failed = 1;
    }
  }
  double aggregate_decode_ratio = decode_reference_time / decode_asm_time;
  printf("aggregate q0/q4/q6 decode ratio: %.2fx\n", aggregate_decode_ratio);
  if (aggregate_decode_ratio < 1.05) check_failed = 1;
  printf("checksum: %llu\n", (unsigned long long)checksum);

  free(decoded);
  free(compressed);
  free(input);
  dlclose(decoder_library);
  dlclose(encoder_library);
  if (enforce && check_failed) {
    fputs("performance gate failed\n", stderr);
    return 1;
  }
  return 0;
}
