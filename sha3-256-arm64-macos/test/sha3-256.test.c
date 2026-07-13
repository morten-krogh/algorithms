#include "../src/sha3-256.h"

#include <stdalign.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

_Static_assert(sizeof(sha3_256_ctx) == SHA3_256_CONTEXT_BYTES,
	"unexpected SHA3-256 context size");
_Static_assert(alignof(sha3_256_ctx) == alignof(uint64_t),
	"unexpected SHA3-256 context alignment");

static int failures = 0;

static void digest_hex(const uint8_t digest[SHA3_256_DIGEST_BYTES],
	char hex[SHA3_256_DIGEST_BYTES * 2 + 1]) {
	static const char digits[] = "0123456789abcdef";
	for (size_t index = 0; index < SHA3_256_DIGEST_BYTES; ++index) {
		hex[index * 2] = digits[digest[index] >> 4];
		hex[index * 2 + 1] = digits[digest[index] & 0x0f];
	}
	hex[SHA3_256_DIGEST_BYTES * 2] = '\0';
}

static void check_digest(const char *name, const uint8_t *input, size_t length,
	const char *expected) {
	sha3_256_ctx ctx;
	uint8_t digest[SHA3_256_DIGEST_BYTES];
	char actual[SHA3_256_DIGEST_BYTES * 2 + 1];
	sha3_256_init(&ctx);
	sha3_256_update(&ctx, NULL, 0);
	sha3_256_update(&ctx, input, length);
	sha3_256_digest(&ctx, digest);
	digest_hex(digest, actual);
	if (strcmp(actual, expected) != 0) {
		fprintf(stderr, "%s: expected %s, got %s\n", name, expected, actual);
		++failures;
	}
}

static void check_chunked(const char *name, const uint8_t *input, size_t length,
	const size_t *chunks, size_t chunk_count, const char *expected) {
	sha3_256_ctx ctx;
	uint8_t digest[SHA3_256_DIGEST_BYTES];
	char actual[SHA3_256_DIGEST_BYTES * 2 + 1];
	sha3_256_init(&ctx);
	sha3_256_update(&ctx, NULL, 0);
	for (size_t offset = 0, chunk_index = 0; offset < length; ++chunk_index) {
		size_t chunk = chunks[chunk_index % chunk_count];
		if (chunk > length - offset) {
			chunk = length - offset;
		}
		sha3_256_update(&ctx, input + offset, chunk);
		offset += chunk;
	}
	sha3_256_digest(&ctx, digest);
	digest_hex(digest, actual);
	if (strcmp(actual, expected) != 0) {
		fprintf(stderr, "%s: expected %s, got %s\n", name, expected, actual);
		++failures;
	}
}

static void check_context_isolation(void) {
	static const uint8_t a[] = {'a'};
	static const uint8_t b[] = {'b'};
	static const uint8_t c[] = {'c'};
	static const char expected_ab[] =
		"5c828b33397f4762922e39a60c35699d2550466a52dd15ed44da37eb0bdc61e6";
	static const char expected_ac[] =
		"c308c11c84bc9cdccc9832e3ef15fc2285bcfff0867949aa4bf03a203eee52d7";
	sha3_256_ctx left;
	sha3_256_ctx right;
	uint8_t digest[SHA3_256_DIGEST_BYTES];
	char actual[SHA3_256_DIGEST_BYTES * 2 + 1];

	sha3_256_init(&left);
	sha3_256_init(&right);
	sha3_256_update(&left, a, sizeof(a));
	sha3_256_update(&right, a, sizeof(a));
	sha3_256_update(&left, b, sizeof(b));
	sha3_256_update(&right, c, sizeof(c));
	sha3_256_digest(&left, digest);
	digest_hex(digest, actual);
	if (strcmp(actual, expected_ab) != 0) {
		fprintf(stderr, "interleaved ab: expected %s, got %s\n", expected_ab,
			actual);
		++failures;
	}
	sha3_256_digest(&right, digest);
	digest_hex(digest, actual);
	if (strcmp(actual, expected_ac) != 0) {
		fprintf(stderr, "interleaved ac: expected %s, got %s\n", expected_ac,
			actual);
		++failures;
	}
}

static void check_copy_boundaries(void) {
	static const size_t chunk_sizes[] = {
		1, 15, 16, 17, 31, 32, 33, 63, 64, 65, 127, 128, 135, 136, 137,
	};
	uint8_t input[400];
	uint8_t expected[SHA3_256_DIGEST_BYTES];
	uint8_t actual[SHA3_256_DIGEST_BYTES];
	sha3_256_ctx ctx;

	for (size_t index = 0; index < sizeof(input); ++index) {
		input[index] = (uint8_t)(index * 29U + 7U);
	}
	for (size_t length = 0; length <= sizeof(input); ++length) {
		sha3_256_init(&ctx);
		sha3_256_update(&ctx, input, length);
		sha3_256_digest(&ctx, expected);

		for (size_t chunk_index = 0;
			chunk_index < sizeof(chunk_sizes) / sizeof(chunk_sizes[0]);
			++chunk_index) {
			const size_t chunk_size = chunk_sizes[chunk_index];
			sha3_256_init(&ctx);
			for (size_t offset = 0; offset < length; offset += chunk_size) {
				size_t chunk = length - offset;
				if (chunk > chunk_size) {
					chunk = chunk_size;
				}
				sha3_256_update(&ctx, input + offset, chunk);
			}
			sha3_256_digest(&ctx, actual);
			if (memcmp(actual, expected, sizeof(actual)) != 0) {
				fprintf(stderr,
					"copy boundary mismatch: length %zu, chunk %zu\n",
					length, chunk_size);
				++failures;
				return;
			}
		}
	}
}

static void check_bounds_and_reinit(void) {
	static const char expected_abc[] =
		"3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532";
	static const char expected_empty[] =
		"a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a";
	struct {
		uint64_t before;
		sha3_256_ctx ctx;
		uint64_t after;
	} guarded = {UINT64_C(0x0123456789abcdef), {{0}},
		UINT64_C(0xfedcba9876543210)};
	uint8_t output[SHA3_256_DIGEST_BYTES + 2];
	char actual[SHA3_256_DIGEST_BYTES * 2 + 1];

	memset(&guarded.ctx, 0xa5, sizeof(guarded.ctx));
	sha3_256_init(&guarded.ctx);
	for (size_t index = 0; index < sizeof(guarded.ctx.opaque) /
			sizeof(guarded.ctx.opaque[0]); ++index) {
		if (guarded.ctx.opaque[index] != 0) {
			fprintf(stderr, "init did not clear context word %zu\n", index);
			++failures;
			break;
		}
	}
	memset(output, 0xa5, sizeof(output));
	sha3_256_update(&guarded.ctx, "abc", 3);
	sha3_256_digest(&guarded.ctx, output + 1);
	digest_hex(output + 1, actual);
	if (strcmp(actual, expected_abc) != 0 || output[0] != 0xa5 ||
		output[sizeof(output) - 1] != 0xa5) {
		fprintf(stderr, "guarded digest failed\n");
		++failures;
	}
	if (guarded.before != UINT64_C(0x0123456789abcdef) ||
		guarded.after != UINT64_C(0xfedcba9876543210)) {
		fprintf(stderr, "context write crossed its bounds\n");
		++failures;
	}

	sha3_256_init(&guarded.ctx);
	sha3_256_digest(&guarded.ctx, output + 1);
	digest_hex(output + 1, actual);
	if (strcmp(actual, expected_empty) != 0) {
		fprintf(stderr, "reinit: expected %s, got %s\n", expected_empty, actual);
		++failures;
	}
}

int main(void) {
	static const char empty_digest[] =
		"a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a";
	static const char abc_digest[] =
		"3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532";
	static const char rate_minus_one_digest[] =
		"f2975f130c63461ae4a013a39200a51a6ef351f1eb315dfac3a514eca4d71313";
	static const char exact_rate_digest[] =
		"83d50be7f820c7c739b4af781132703a1bc5f3b52b716cea9a09d555c79dfe18";
	static const char bytes_200_digest[] =
		"79f38adec5c20307a98ef76e8324afbfd46cfd81b22e3973c65fa1bd9de31787";
	static const char incrementing_digest[] =
		"27969a61a345750042b4e11d71534447a36c463f7e6dfdf66aea21a2f847dde4";
	static const size_t one_byte_chunks[] = {1};
	static const size_t mixed_chunks[] = {135, 1, 136, 137, 7, 4096, 3};
	uint8_t rate_minus_one[135];
	uint8_t exact_rate[136];
	uint8_t bytes_200[200];
	uint8_t incrementing[10000];

	memset(rate_minus_one, 0x33, sizeof(rate_minus_one));
	memset(exact_rate, 0x44, sizeof(exact_rate));
	memset(bytes_200, 0xa3, sizeof(bytes_200));
	for (size_t index = 0; index < sizeof(incrementing); ++index) {
		incrementing[index] = (uint8_t)index;
	}

	check_digest("empty", NULL, 0, empty_digest);
	check_digest("abc", (const uint8_t *)"abc", 3, abc_digest);
	check_digest("rate minus one", rate_minus_one, sizeof(rate_minus_one),
		rate_minus_one_digest);
	check_digest("exact rate", exact_rate, sizeof(exact_rate), exact_rate_digest);
	check_digest("200 bytes", bytes_200, sizeof(bytes_200), bytes_200_digest);
	check_digest("10000 incrementing", incrementing, sizeof(incrementing),
		incrementing_digest);
	check_chunked("abc one byte", (const uint8_t *)"abc", 3, one_byte_chunks,
		sizeof(one_byte_chunks) / sizeof(one_byte_chunks[0]), abc_digest);
	check_chunked("10000 mixed chunks", incrementing, sizeof(incrementing),
		mixed_chunks, sizeof(mixed_chunks) / sizeof(mixed_chunks[0]),
		incrementing_digest);
	check_context_isolation();
	check_copy_boundaries();
	check_bounds_and_reinit();

	if (failures != 0) {
		fprintf(stderr, "%d SHA3-256 API test(s) failed\n", failures);
		return EXIT_FAILURE;
	}
	puts("SHA3-256 API tests passed");
	return EXIT_SUCCESS;
}
