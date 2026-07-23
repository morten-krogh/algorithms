const STATUS_ERROR = 0;
const STATUS_NEEDS_INPUT = 1;
const STATUS_HAS_OUTPUT = 2;
const STATUS_FLUSHED = 3;
const STATUS_FINISHED = 4;

const OPERATION_PROCESS = 0;
const OPERATION_FLUSH = 1;
const OPERATION_FINISH = 2;

const CONTROL_CONSUMED = 1;
const CONTROL_OUTPUT_PTR = 2;
const CONTROL_OUTPUT_LENGTH = 3;
const CONTROL_ERROR = 4;
const CONTROL_INPUT_PTR = 5;
const CONTROL_INPUT_CAPACITY = 6;

const MODE_CODES = Object.freeze({
	generic: 0,
	text: 1,
	font: 2,
});

const DECODER_ERRORS = new Map([
	[-1, "exuberant meta-block length"],
	[-2, "reserved bit is set"],
	[-3, "exuberant metadata length"],
	[-4, "invalid simple Huffman alphabet"],
	[-5, "duplicate simple Huffman symbol"],
	[-6, "invalid code-length Huffman space"],
	[-7, "invalid Huffman space"],
	[-8, "invalid context-map repeat"],
	[-9, "invalid literal block length"],
	[-10, "invalid command or distance block length"],
	[-11, "invalid dictionary transform"],
	[-12, "invalid static dictionary reference"],
	[-13, "invalid window bits"],
	[-14, "invalid stream padding"],
	[-15, "non-zero final padding"],
	[-16, "invalid backward distance"],
	[-17, "invalid block switch"],
	[-18, "invalid compound dictionary"],
	[-19, "required dictionary is not set"],
	[-20, "invalid decoder arguments"],
	[-21, "could not allocate context modes"],
	[-22, "could not allocate Huffman tree groups"],
	[-25, "could not allocate context map"],
	[-26, "could not allocate ring buffer"],
	[-27, "could not grow ring buffer"],
	[-30, "could not allocate block-type trees"],
	[-31, "unreachable decoder state"],
	[-100, "truncated input"],
	[-101, "invalid codec state"],
	[-102, "WebAssembly memory exhausted"],
	[-103, "invalid codec parameter"],
]);

/**
 * @typedef {{
 *   memory: WebAssembly.Memory,
 *   control_ptr: () => number,
 *   encoder_init: (
 *     quality: number,
 *     lgwin: number,
 *     mode: number,
 *     lgblock: number,
 *     sizeHint: number,
 *     flags: number,
 *   ) => number,
 *   encoder_process: (operation: number, inputLength: number) => number,
 *   encoder_reset: () => number,
 *   decoder_init: () => number,
 *   decoder_process: (endOfInput: number, inputLength: number) => number,
 *   decoder_reset: () => number,
 * }} BrotliExports
 */

/** @typedef {string | URL | Request | WebAssembly.Module} WasmSource */
/** @typedef {"generic" | "text" | "font"} BrotliMode */

/**
 * @typedef {{
 *   quality?: number,
 *   lgwin?: number,
 *   mode?: BrotliMode,
 *   lgblock?: number,
 *   sizeHint?: number,
 *   disableLiteralContextModeling?: boolean,
 * }} BrotliEncoderOptions
 */

/**
 * @param {number} value
 * @param {number} minimum
 * @param {number} maximum
 * @param {string} name
 */
function require_integer_in_range(value, minimum, maximum, name) {
	if (!Number.isInteger(value) || value < minimum || value > maximum) {
		throw new RangeError(
			`The "${name}" option must be an integer from ${minimum} to ${maximum}`,
		);
	}
}

/**
 * @param {WasmSource} source
 * @returns {Promise<WebAssembly.Instance>}
 */
async function instantiate(source) {
	return source instanceof WebAssembly.Module
		? await WebAssembly.instantiate(source)
		: (await WebAssembly.instantiateStreaming(fetch(source))).instance;
}

class CodecState {
	/** @type {"encoder" | "decoder"} */
	#kind;

	/** @type {BrotliExports | null} */
	#exports = null;

	/** @type {Uint8Array} */
	#memory = new Uint8Array();

	/** @type {Int32Array} */
	#control = new Int32Array();

	/** @type {number} */
	#controlOffset = 0;

	/** @type {number} */
	#status = STATUS_NEEDS_INPUT;

	/** @type {number} */
	#lastOperation = OPERATION_PROCESS;

	/** @type {boolean} */
	#outputDelivered = false;

	/** @type {boolean} */
	#finished = false;

	/** @type {boolean} */
	#flushComplete = false;

	/**
	 * @param {"encoder" | "decoder"} kind
	 */
	constructor(kind) {
		this.#kind = kind;
	}

	/**
	 * @param {WebAssembly.Instance} instance
	 * @param {readonly number[]} initArguments
	 */
	initialize(instance, initArguments) {
		this.#exports = /** @type {BrotliExports} */ (instance.exports);
		if (
			!(this.#exports.memory instanceof WebAssembly.Memory) ||
			typeof this.#exports.control_ptr !== "function"
		) {
			throw new TypeError("Invalid Brotli WebAssembly module");
		}
		this.#controlOffset = this.#exports.control_ptr();
		this.#refresh_views();
		const status =
			this.#kind === "encoder"
				? this.#exports.encoder_init(
						initArguments[0] ?? 4,
						initArguments[1] ?? 22,
						initArguments[2] ?? 0,
						initArguments[3] ?? 0,
						initArguments[4] ?? 0,
						initArguments[5] ?? 0,
					)
				: this.#exports.decoder_init();
		this.#refresh_views();
		this.#accept_status(status);
		this.#lastOperation = OPERATION_PROCESS;
		this.#outputDelivered = false;
		this.#finished = false;
		this.#flushComplete = false;
	}

	/**
	 * @returns {BrotliExports}
	 */
	#ready() {
		if (!this.#exports) {
			const name = this.#kind === "encoder" ? "BrotliEncoder" : "BrotliDecoder";
			throw new Error(`${name} WASM instance has not been initialized`);
		}
		return this.#exports;
	}

	#refresh_views() {
		const exports = this.#ready();
		this.#memory = new Uint8Array(exports.memory.buffer);
		this.#control = new Int32Array(
			exports.memory.buffer,
			this.#controlOffset,
			8,
		);
	}

	/**
	 * @param {number} status
	 */
	#accept_status(status) {
		this.#status = status;
		if (status === STATUS_ERROR) {
			const errorCode = this.#control[CONTROL_ERROR] ?? -101;
			const detail =
				DECODER_ERRORS.get(errorCode) ?? `codec error ${errorCode}`;
			const action = this.#kind === "encoder" ? "encoding" : "decoding";
			throw new Error(`Brotli ${action} failed: ${detail}`);
		}
		if (
			status !== STATUS_NEEDS_INPUT &&
			status !== STATUS_HAS_OUTPUT &&
			status !== STATUS_FLUSHED &&
			status !== STATUS_FINISHED
		) {
			throw new Error(`Brotli returned invalid status ${status}`);
		}
		if (status === STATUS_FINISHED) {
			this.#finished = true;
		}
		if (status === STATUS_FLUSHED) {
			this.#flushComplete = true;
		}
		if (
			status === STATUS_HAS_OUTPUT &&
			(this.#control[CONTROL_OUTPUT_LENGTH] ?? 0) <= 0
		) {
			throw new Error("Brotli returned an empty output segment");
		}
		this.#outputDelivered = false;
	}

	/**
	 * @param {number} operation
	 * @param {number} inputLength
	 * @returns {number}
	 */
	#invoke(operation, inputLength) {
		const exports = this.#ready();
		const status =
			this.#kind === "encoder"
				? exports.encoder_process(operation, inputLength)
				: exports.decoder_process(operation, inputLength);
		this.#refresh_views();
		this.#accept_status(status);
		return status;
	}

	#require_drained() {
		if (this.#status === STATUS_HAS_OUTPUT) {
			throw new Error("Brotli output must be drained with pull() first");
		}
	}

	/**
	 * @param {Uint8Array} data
	 * @returns {number}
	 */
	write(data) {
		this.#ready();
		if (!(data instanceof Uint8Array)) {
			throw new TypeError('The "data" argument must be a Uint8Array');
		}
		if (this.#finished) {
			throw new Error("Brotli stream has already finished");
		}
		this.#require_drained();
		if (data.length === 0) {
			return 0;
		}
		this.#flushComplete = false;
		this.#lastOperation = OPERATION_PROCESS;
		const capacity = this.#control[CONTROL_INPUT_CAPACITY] ?? 0;
		const inputLength = Math.min(data.length, capacity);
		const inputPointer = this.#control[CONTROL_INPUT_PTR] ?? 0;
		if (
			capacity <= 0 ||
			inputPointer < 0 ||
			inputPointer + inputLength > this.#memory.length
		) {
			throw new Error("Invalid Brotli input transfer buffer");
		}
		this.#memory.set(data.subarray(0, inputLength), inputPointer);
		this.#invoke(OPERATION_PROCESS, inputLength);
		const consumed = this.#control[CONTROL_CONSUMED] ?? 0;
		if (consumed < 0 || consumed > inputLength) {
			throw new Error("Brotli returned an invalid consumed-byte count");
		}
		if (
			consumed === 0 &&
			this.#status !== STATUS_HAS_OUTPUT &&
			!this.#finished
		) {
			throw new Error("Brotli codec made no progress");
		}
		return consumed;
	}

	/**
	 * @returns {Uint8Array | null}
	 */
	pull() {
		this.#ready();
		if (this.#status !== STATUS_HAS_OUTPUT) {
			return null;
		}
		if (this.#outputDelivered) {
			this.#invoke(this.#lastOperation, 0);
			if (this.#status !== STATUS_HAS_OUTPUT) {
				return null;
			}
		}
		const outputPointer = this.#control[CONTROL_OUTPUT_PTR] ?? 0;
		const outputLength = this.#control[CONTROL_OUTPUT_LENGTH] ?? 0;
		if (
			outputPointer < 0 ||
			outputLength <= 0 ||
			outputPointer + outputLength > this.#memory.length
		) {
			throw new Error("Invalid Brotli output transfer buffer");
		}
		this.#outputDelivered = true;
		return this.#memory.subarray(outputPointer, outputPointer + outputLength);
	}

	/**
	 * @returns {boolean}
	 */
	flush() {
		if (this.#kind !== "encoder") {
			throw new Error("Only BrotliEncoder supports flush()");
		}
		this.#ready();
		if (this.#finished) {
			throw new Error("Brotli stream has already finished");
		}
		this.#require_drained();
		if (this.#flushComplete) {
			this.#flushComplete = false;
			this.#status = STATUS_NEEDS_INPUT;
			this.#lastOperation = OPERATION_PROCESS;
			return true;
		}
		this.#lastOperation = OPERATION_FLUSH;
		this.#invoke(OPERATION_FLUSH, 0);
		if (this.#flushComplete) {
			this.#flushComplete = false;
			this.#status = STATUS_NEEDS_INPUT;
			this.#lastOperation = OPERATION_PROCESS;
			return true;
		}
		return false;
	}

	/**
	 * @returns {boolean}
	 */
	finish() {
		this.#ready();
		if (this.#finished) {
			return true;
		}
		this.#require_drained();
		this.#lastOperation = this.#kind === "encoder" ? OPERATION_FINISH : 1;
		this.#invoke(this.#lastOperation, 0);
		return this.#finished;
	}

	reset() {
		const exports = this.#ready();
		const status =
			this.#kind === "encoder"
				? exports.encoder_reset()
				: exports.decoder_reset();
		this.#refresh_views();
		this.#accept_status(status);
		this.#lastOperation = OPERATION_PROCESS;
		this.#outputDelivered = false;
		this.#finished = false;
		this.#flushComplete = false;
	}

	/** @returns {boolean} */
	get finished() {
		this.#ready();
		return this.#finished;
	}
}

/**
 * Streaming RFC 7932 Brotli encoder.
 *
 * `write()` reports how much input was consumed. Drain every output view with
 * `pull()` before submitting more input. A pulled view aliases WebAssembly
 * memory and is valid only until the next method call on this instance.
 */
class BrotliEncoder {
	/** @type {string} */
	algorithm = "brotli";

	/** @type {CodecState} */
	#codec = new CodecState("encoder");

	/**
	 * @param {WasmSource} wasmSource
	 * @param {BrotliEncoderOptions} [options]
	 * @returns {Promise<this>}
	 */
	async initialize(wasmSource, options = {}) {
		const quality = options.quality ?? 4;
		const lgwin = options.lgwin ?? 22;
		const mode = options.mode ?? "generic";
		const lgblock = options.lgblock ?? 0;
		const sizeHint = options.sizeHint ?? 0;
		const disableLiteralContextModeling =
			options.disableLiteralContextModeling ?? false;

		require_integer_in_range(quality, 0, 11, "quality");
		require_integer_in_range(lgwin, 10, 24, "lgwin");
		if (!(mode in MODE_CODES)) {
			throw new RangeError(
				'The "mode" option must be "generic", "text", or "font"',
			);
		}
		if (lgblock !== 0) {
			require_integer_in_range(lgblock, 16, 24, "lgblock");
		}
		require_integer_in_range(sizeHint, 0, 0xffffffff, "sizeHint");
		if (typeof disableLiteralContextModeling !== "boolean") {
			throw new TypeError(
				'The "disableLiteralContextModeling" option must be a boolean',
			);
		}

		const instance = await instantiate(wasmSource);
		this.#codec.initialize(instance, [
			quality,
			lgwin,
			MODE_CODES[mode],
			lgblock,
			sizeHint,
			disableLiteralContextModeling ? 1 : 0,
		]);
		return this;
	}

	/** @param {Uint8Array} data @returns {number} */
	write(data) {
		return this.#codec.write(data);
	}

	/** @returns {Uint8Array | null} */
	pull() {
		return this.#codec.pull();
	}

	/** @returns {boolean} */
	flush() {
		return this.#codec.flush();
	}

	/** @returns {boolean} */
	finish() {
		return this.#codec.finish();
	}

	/** @returns {this} */
	reset() {
		this.#codec.reset();
		return this;
	}

	/** @returns {boolean} */
	get finished() {
		return this.#codec.finished;
	}
}

/**
 * Streaming RFC 7932 Brotli decoder.
 *
 * Completion may consume only a prefix of the last input chunk; the returned
 * count lets callers pass the trailing bytes to the next protocol consumer.
 */
class BrotliDecoder {
	/** @type {string} */
	algorithm = "brotli";

	/** @type {CodecState} */
	#codec = new CodecState("decoder");

	/**
	 * @param {WasmSource} wasmSource
	 * @returns {Promise<this>}
	 */
	async initialize(wasmSource) {
		const instance = await instantiate(wasmSource);
		this.#codec.initialize(instance, []);
		return this;
	}

	/** @param {Uint8Array} data @returns {number} */
	write(data) {
		return this.#codec.write(data);
	}

	/** @returns {Uint8Array | null} */
	pull() {
		return this.#codec.pull();
	}

	/** @returns {boolean} */
	finish() {
		return this.#codec.finish();
	}

	/** @returns {this} */
	reset() {
		this.#codec.reset();
		return this;
	}

	/** @returns {boolean} */
	get finished() {
		return this.#codec.finished;
	}
}

export { BrotliDecoder, BrotliEncoder };
