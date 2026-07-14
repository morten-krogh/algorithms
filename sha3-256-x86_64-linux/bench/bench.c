#define _POSIX_C_SOURCE 199309L

#include "../src/sha3-256.h"

#include <gcrypt.h>
#include <openssl/evp.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

static const size_t digest_bytes = SHA3_256_DIGEST_BYTES;
static const double mib = 1024.0 * 1024.0;

struct run {
	size_t size;
	int iterations;
};

static const struct run runs[] = {
	{0, 200000},
	{64, 200000},
	{1024, 50000},
	{16384, 10000},
	{262144, 1000},
	{1048576, 300},
	{10485760, 30},
};

struct column {
	const char *header;
	int width;
};

static const struct column columns[] = {
	{"size(B)", 9},
	{"iters", 8},
	{"asm(ms)", 10},
	{"asm h/s", 10},
	{"asm MiB/s", 11},
	{"OpenSSL(ms)", 12},
	{"OpenSSL h/s", 13},
	{"OpenSSL MiB/s", 15},
	{"gcrypt(ms)", 11},
	{"gcrypt h/s", 12},
	{"gcrypt MiB/s", 14},
	{"asm/OpenSSL", 12},
	{"asm/gcrypt", 11},
};

enum { column_count = sizeof(columns) / sizeof(columns[0]) };

struct metrics {
	double milliseconds;
	double hashes_per_second;
	double mib_per_second;
};

struct timing {
	/* Time for the full iteration count at the fastest repetition's rate. */
	double milliseconds;
	/* (slowest - fastest) / fastest across the repetitions. */
	double spread;
};

struct buffers {
	sha3_256_ctx context;
	uint8_t *message;
	size_t size;
	uint8_t digest[SHA3_256_DIGEST_BYTES];
};

static double now_milliseconds(void) {
	struct timespec ts;
	clock_gettime(CLOCK_MONOTONIC, &ts);
	return (double)ts.tv_sec * 1000.0 + (double)ts.tv_nsec / 1.0e6;
}

/*
 * The warmup runs until the core has sustained load long enough to reach
 * its maximum frequency; a fixed iteration count is too short for cheap
 * bodies. Reporting the fastest of five equal repetitions discards
 * scheduling and frequency-ramp noise, which only ever slows a run down.
 */
static struct timing time_hash(int iterations, void (*body)(struct buffers *),
	struct buffers *buffers) {
	const int repetitions = 5;
	int per_repetition = iterations / repetitions;
	if (per_repetition < 1) {
		per_repetition = 1;
	}
	double warmup_start = now_milliseconds();
	while (now_milliseconds() - warmup_start < 200.0) {
		body(buffers);
	}
	double fastest = 0.0;
	double slowest = 0.0;
	for (int repetition = 0; repetition < repetitions; ++repetition) {
		double start = now_milliseconds();
		for (int iteration = 0; iteration < per_repetition; ++iteration) {
			body(buffers);
		}
		double elapsed = now_milliseconds() - start;
		if (repetition == 0 || elapsed < fastest) {
			fastest = elapsed;
		}
		if (elapsed > slowest) {
			slowest = elapsed;
		}
	}
	struct timing timing = {
		fastest * (double)iterations / (double)per_repetition,
		(slowest - fastest) / fastest,
	};
	return timing;
}

static struct metrics metrics_for(double milliseconds, const struct run *run) {
	double seconds = milliseconds / 1000.0;
	if (seconds <= 0.0) {
		seconds = 1.0e-300;
	}
	struct metrics metrics = {
		milliseconds,
		(double)run->iterations / seconds,
		((double)run->size * (double)run->iterations / mib) / seconds,
	};
	return metrics;
}

static EVP_MD *openssl_algorithm;
static EVP_MD_CTX *openssl_context;
static gcry_md_hd_t gcrypt_handle;

__attribute__((noinline))
static void assembly_hash(struct buffers *buffers) {
	sha3_256_init(&buffers->context);
	sha3_256_update(&buffers->context, buffers->message, buffers->size);
	sha3_256_digest(&buffers->context, buffers->digest);
}

__attribute__((noinline))
static void openssl_hash(struct buffers *buffers) {
	unsigned int output_length = 0;
	if (EVP_DigestInit_ex2(openssl_context, openssl_algorithm, NULL) != 1 ||
		EVP_DigestUpdate(openssl_context, buffers->message,
			buffers->size) != 1 ||
		EVP_DigestFinal_ex(openssl_context, buffers->digest,
			&output_length) != 1 ||
		output_length != digest_bytes) {
		fprintf(stderr, "OpenSSL SHA3-256 failed\n");
		exit(EXIT_FAILURE);
	}
}

__attribute__((noinline))
static void gcrypt_hash(struct buffers *buffers) {
	gcry_md_reset(gcrypt_handle);
	gcry_md_write(gcrypt_handle, buffers->message, buffers->size);
	memcpy(buffers->digest, gcry_md_read(gcrypt_handle, GCRY_MD_SHA3_256),
		digest_bytes);
}

static void pad(const char *value, int width) {
	printf("%*s", width, value);
}

static void print_row(const char *cells[column_count]) {
	for (int index = 0; index < column_count; ++index) {
		if (index != 0) {
			printf("  ");
		}
		pad(cells[index], columns[index].width);
	}
	printf("\n");
}

static void format_metrics(const struct metrics *metrics,
	char cells[3][32]) {
	snprintf(cells[0], 32, "%.2f", metrics->milliseconds);
	snprintf(cells[1], 32, "%.0f", metrics->hashes_per_second);
	snprintf(cells[2], 32, "%.2f", metrics->mib_per_second);
}

int main(void) {
	if (gcry_check_version(NULL) == NULL) {
		fprintf(stderr, "libgcrypt version check failed\n");
		return EXIT_FAILURE;
	}
	gcry_control(GCRYCTL_DISABLE_SECMEM, 0);
	gcry_control(GCRYCTL_INITIALIZATION_FINISHED, 0);
	if (gcry_md_open(&gcrypt_handle, GCRY_MD_SHA3_256, 0) != 0) {
		fprintf(stderr, "libgcrypt could not initialize SHA3-256\n");
		return EXIT_FAILURE;
	}
	openssl_algorithm = EVP_MD_fetch(NULL, "SHA3-256", NULL);
	openssl_context = EVP_MD_CTX_new();
	if (openssl_algorithm == NULL || openssl_context == NULL) {
		fprintf(stderr, "OpenSSL could not initialize SHA3-256\n");
		return EXIT_FAILURE;
	}

	double worst_spreads[3] = {0.0, 0.0, 0.0};
	const char *headers[column_count];
	for (int index = 0; index < column_count; ++index) {
		headers[index] = columns[index].header;
	}
	print_row(headers);

	for (size_t run_index = 0; run_index < sizeof(runs) / sizeof(runs[0]);
		++run_index) {
		const struct run *run = &runs[run_index];
		struct buffers buffers;
		buffers.size = run->size;
		buffers.message = malloc(run->size > 0 ? run->size : 1);
		if (buffers.message == NULL) {
			fprintf(stderr, "allocation failed at size %zu\n", run->size);
			return EXIT_FAILURE;
		}
		memset(buffers.message, 0xa3, run->size > 0 ? run->size : 1);

		uint8_t assembly_digest[SHA3_256_DIGEST_BYTES];
		uint8_t openssl_digest[SHA3_256_DIGEST_BYTES];
		assembly_hash(&buffers);
		memcpy(assembly_digest, buffers.digest, digest_bytes);
		openssl_hash(&buffers);
		memcpy(openssl_digest, buffers.digest, digest_bytes);
		gcrypt_hash(&buffers);
		if (memcmp(assembly_digest, openssl_digest, digest_bytes) != 0 ||
			memcmp(assembly_digest, buffers.digest, digest_bytes) != 0) {
			fprintf(stderr, "digest mismatch at size %zu\n", run->size);
			return EXIT_FAILURE;
		}

		struct timing timings[3];
		timings[0] = time_hash(run->iterations, assembly_hash, &buffers);
		timings[1] = time_hash(run->iterations, openssl_hash, &buffers);
		timings[2] = time_hash(run->iterations, gcrypt_hash, &buffers);
		for (int index = 0; index < 3; ++index) {
			if (timings[index].spread > worst_spreads[index]) {
				worst_spreads[index] = timings[index].spread;
			}
		}
		struct metrics assembly =
			metrics_for(timings[0].milliseconds, run);
		struct metrics openssl_metrics =
			metrics_for(timings[1].milliseconds, run);
		struct metrics gcrypt_metrics =
			metrics_for(timings[2].milliseconds, run);

		char size_cell[32];
		char iters_cell[32];
		char metric_cells[3][3][32];
		char ratio_cells[2][32];
		snprintf(size_cell, sizeof(size_cell), "%zu", run->size);
		snprintf(iters_cell, sizeof(iters_cell), "%d", run->iterations);
		format_metrics(&assembly, metric_cells[0]);
		format_metrics(&openssl_metrics, metric_cells[1]);
		format_metrics(&gcrypt_metrics, metric_cells[2]);
		snprintf(ratio_cells[0], 32, "%.2fx",
			openssl_metrics.milliseconds / assembly.milliseconds);
		snprintf(ratio_cells[1], 32, "%.2fx",
			gcrypt_metrics.milliseconds / assembly.milliseconds);

		const char *cells[column_count] = {
			size_cell, iters_cell,
			metric_cells[0][0], metric_cells[0][1], metric_cells[0][2],
			metric_cells[1][0], metric_cells[1][1], metric_cells[1][2],
			metric_cells[2][0], metric_cells[2][1], metric_cells[2][2],
			ratio_cells[0], ratio_cells[1],
		};
		print_row(cells);
		free(buffers.message);
	}

	printf("worst repetition spread: asm %.1f%%, OpenSSL %.1f%%, "
		"gcrypt %.1f%%\n",
		worst_spreads[0] * 100.0, worst_spreads[1] * 100.0,
		worst_spreads[2] * 100.0);

	gcry_md_close(gcrypt_handle);
	EVP_MD_CTX_free(openssl_context);
	EVP_MD_free(openssl_algorithm);
	return EXIT_SUCCESS;
}
