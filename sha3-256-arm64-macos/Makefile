CC := xcrun clang
SWIFTC := xcrun swiftc
PKG_CONFIG ?= pkg-config

ARCH_FLAGS := -arch arm64 -mmacosx-version-min=11.0
CFLAGS := -O3 -std=c11 -Wall -Wextra -Wpedantic -Werror $(ARCH_FLAGS)
ASFLAGS := $(ARCH_FLAGS)
LDFLAGS := $(ARCH_FLAGS) -Wl,-dead_strip

BUILD_DIR := build
BIN_DIR := bin
CORE_OBJECT := $(BUILD_DIR)/sha3-256.o
CLI_OBJECT := $(BUILD_DIR)/main.o
CLI := $(BIN_DIR)/sha3-256
TEST_BINARY := $(BUILD_DIR)/sha3-256-test
BENCH_BINARY := $(BIN_DIR)/bench

.PHONY: all test bench clean

all: $(CLI)

$(CLI): $(CORE_OBJECT) $(CLI_OBJECT) | $(BIN_DIR)
	$(CC) $(LDFLAGS) $^ -o $@

$(CORE_OBJECT): src/sha3-256.s src/sha3-256.h | $(BUILD_DIR)
	$(CC) $(ASFLAGS) -c $< -o $@

$(CLI_OBJECT): src/main.s src/sha3-256.h | $(BUILD_DIR)
	$(CC) $(ASFLAGS) -c $< -o $@

$(BUILD_DIR) $(BIN_DIR):
	mkdir -p $@

test: all $(TEST_BINARY)
	$(TEST_BINARY)
	sh test/cli.test.sh $(CLI)

$(TEST_BINARY): test/sha3-256.test.c src/sha3-256.h $(CORE_OBJECT) | $(BUILD_DIR)
	$(CC) $(CFLAGS) test/sha3-256.test.c $(CORE_OBJECT) -o $@

bench: $(BENCH_BINARY)

$(BENCH_BINARY): bench/bench.swift bench/bridge.h src/sha3-256.h $(CORE_OBJECT) | $(BIN_DIR)
	$(SWIFTC) -O -parse-as-library -target arm64-apple-macos26.0 \
		-module-cache-path $(BUILD_DIR)/module-cache \
		-import-objc-header bench/bridge.h \
		$(shell $(PKG_CONFIG) --cflags libcrypto) \
		bench/bench.swift $(CORE_OBJECT) \
		$(shell $(PKG_CONFIG) --libs libcrypto) -o $@

clean:
	rm -rf $(BUILD_DIR) $(BIN_DIR)
