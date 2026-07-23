NASM ?= nasm
CC ?= gcc
AR ?= ar

CPPFLAGS := -Isrc
CFLAGS := -O3 -std=c11 -Wall -Wextra -Wpedantic -Werror
NASMFLAGS := -f elf64 -Isrc/ -w-other
STATIC_LDFLAGS := -nostdlib -static -no-pie -Wl,--build-id=none

BUILD_DIR := build
BIN_DIR := bin
CORE_OBJECT := $(BUILD_DIR)/brotli.o
LIBRARY := $(BUILD_DIR)/libbrotli_asm.a
CLI_OBJECT := $(BUILD_DIR)/main.o
CLI := $(BIN_DIR)/brotli
TEST_BINARY := $(BUILD_DIR)/brotli-test
BENCH_BINARY := $(BIN_DIR)/bench

.PHONY: all test bench clean

all: $(LIBRARY) $(CLI)

$(CORE_OBJECT): src/brotli.asm src/brotli_upstream.inc src/brotli.h | $(BUILD_DIR)
	$(NASM) $(NASMFLAGS) $< -o $@

$(LIBRARY): $(CORE_OBJECT)
	$(AR) rcs $@ $<

$(CLI_OBJECT): src/main.asm src/brotli.h | $(BUILD_DIR)
	$(NASM) $(NASMFLAGS) $< -o $@

$(CLI): $(CORE_OBJECT) $(CLI_OBJECT) | $(BIN_DIR)
	$(CC) $(STATIC_LDFLAGS) $^ -o $@

$(TEST_BINARY): test/brotli.test.c src/brotli.h $(CORE_OBJECT) | $(BUILD_DIR)
	$(CC) $(CPPFLAGS) $(CFLAGS) $< $(CORE_OBJECT) -ldl -o $@

test: $(TEST_BINARY) $(CLI)
	$(TEST_BINARY)
	sh test/cli.test.sh $(CLI)

$(BENCH_BINARY): bench/bench.c src/brotli.h $(CORE_OBJECT) | $(BIN_DIR)
	$(CC) $(CPPFLAGS) $(CFLAGS) $< $(CORE_OBJECT) -ldl -o $@

bench: $(BENCH_BINARY)
	$(BENCH_BINARY)

$(BUILD_DIR) $(BIN_DIR):
	mkdir -p $@

clean:
	rm -rf $(BUILD_DIR) $(BIN_DIR)
