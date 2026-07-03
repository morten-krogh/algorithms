const MAX_WASM_BLOCKS = 4096;
const WORDS_PER_BLOCK = 4;

/**
 * @typedef {{
 *   memory: WebAssembly.Memory,
 *   fill: (
 *     blocks: number,
 *     c0: number,
 *     c1: number,
 *     c2: number,
 *     c3: number,
 *     k0: number,
 *     k1: number,
 *   ) => void,
 * }} Philox4x32Exports
 */

/**
 * @typedef {string | URL | Request | WebAssembly.Module} WasmSource
 */

/**
 * Philox4x32-10 backed by a single WebAssembly instance.
 *
 * Philox is a counter-based generator: output is a pure function of a
 * 128-bit counter and a 64-bit key. This wrapper is stateless; `fill` locally
 * increments the supplied counter across output blocks without mutating the
 * caller's counter or key arrays.
 */
class Philox4x32 {
	/** @type {string} */
	algorithm = "philox-4x32";

	/** @type {Philox4x32Exports | null} */
	#philox = null;

	/** @type {Uint32Array} */
	#memory = new Uint32Array();

	/**
	 * @param {WasmSource} wasm_source
	 * @returns {Promise<this>}
	 */
	async initialize(wasm_source) {
		const instance =
			wasm_source instanceof WebAssembly.Module
				? await WebAssembly.instantiate(wasm_source)
				: (await WebAssembly.instantiateStreaming(fetch(wasm_source))).instance;
		this.#philox = /** @type {Philox4x32Exports} */ (instance.exports);
		this.#memory = new Uint32Array(this.#philox.memory.buffer);
		return this;
	}

	/**
	 * @returns {Philox4x32Exports}
	 */
	#ready() {
		if (!this.#philox) {
			throw new Error("Philox4x32 WASM instance has not been initialized");
		}
		return this.#philox;
	}

	/**
	 * Generate one Philox4x32 block.
	 * @param {Uint32Array} counter four 32-bit counter words
	 * @param {Uint32Array} key two 32-bit key words
	 * @param {Uint32Array} [output] optional four-word destination
	 * @returns {Uint32Array}
	 */
	generate(counter, key, output = new Uint32Array(WORDS_PER_BLOCK)) {
		if (!(output instanceof Uint32Array) || output.length !== WORDS_PER_BLOCK) {
			throw new TypeError(
				'The "output" argument must be a four-word Uint32Array',
			);
		}
		return this.fill(counter, key, output);
	}

	/**
	 * Fill `output` with Philox4x32 blocks.
	 * @param {Uint32Array} counter four 32-bit counter words
	 * @param {Uint32Array} key two 32-bit key words
	 * @param {Uint32Array} output destination length, in words, must be divisible by four
	 * @returns {Uint32Array}
	 */
	fill(counter, key, output) {
		const philox = this.#ready();
		validate_words(counter, "counter", WORDS_PER_BLOCK);
		validate_words(key, "key", 2);
		if (!(output instanceof Uint32Array)) {
			throw new TypeError('The "output" argument must be a Uint32Array');
		}
		if (output.length % WORDS_PER_BLOCK !== 0) {
			throw new RangeError(
				'The "output" length must be divisible by four words',
			);
		}

		let c0 = counter[0] ?? 0;
		let c1 = counter[1] ?? 0;
		let c2 = counter[2] ?? 0;
		let c3 = counter[3] ?? 0;
		const k0 = key[0] ?? 0;
		const k1 = key[1] ?? 0;
		let blocks_remaining = output.length / WORDS_PER_BLOCK;
		let output_offset = 0;

		while (blocks_remaining !== 0) {
			const blocks = Math.min(blocks_remaining, MAX_WASM_BLOCKS);
			philox.fill(blocks, c0, c1, c2, c3, k0, k1);
			output.set(
				this.#memory.subarray(0, blocks * WORDS_PER_BLOCK),
				output_offset,
			);
			output_offset += blocks * WORDS_PER_BLOCK;
			blocks_remaining -= blocks;

			const next_c0 = (c0 + blocks) >>> 0;
			if (next_c0 < c0) {
				c1 = (c1 + 1) >>> 0;
				if (c1 === 0) {
					c2 = (c2 + 1) >>> 0;
					if (c2 === 0) {
						c3 = (c3 + 1) >>> 0;
					}
				}
			}
			c0 = next_c0;
		}

		return output;
	}
}

/**
 * @param {Uint32Array} value
 * @param {string} name
 * @param {number} length
 */
function validate_words(value, name, length) {
	if (!(value instanceof Uint32Array) || value.length !== length) {
		throw new TypeError(
			`The "${name}" argument must be a ${length}-word Uint32Array`,
		);
	}
}

export { Philox4x32 };
