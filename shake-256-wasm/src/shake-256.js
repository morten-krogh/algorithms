const DATA_OFFSET = 392;
const STATE_BYTES = 200;
const RATE_BYTES = 136;
const SHAKE_SUFFIX = 0x1f;

/**
 * @typedef {{
 *   memory: WebAssembly.Memory,
 *   absorb: (m: number) => void,
 *   squeeze: (num_blocks: number) => void,
 * }} Shake256Exports
 */

/**
 * @typedef {string | URL | Request | WebAssembly.Module} WasmSource
 */

/**
 * SHAKE256 extendable-output function (XOF) backed by a single WebAssembly
 * instance.
 *
 * The sponge state lives directly in the instance's linear memory, so each
 * `Shake256` owns exactly one in-progress hash. Use it for one message at a
 * time: call {@link Shake256#reset} to start a new hash on the same instance, or
 * {@link Shake256#getState}/{@link Shake256#setState} to snapshot and resume
 * (e.g. to fork a shared prefix, sequentially). For hashes that must run
 * concurrently, create one `Shake256` per hash. Not re-entrant; intended for
 * single-threaded use, as JavaScript is.
 */
class Shake256 {
	/** @type {string} */
	algorithm = "shake-256";

	/** @type {Shake256Exports | null} */
	#sponge = null;

	/** @type {Uint8Array} */
	#memory = new Uint8Array();

	/** @type {Uint8Array} */
	#pending = new Uint8Array(RATE_BYTES);

	/** @type {number} */
	#pendingLength = 0;

	/** @type {Uint8Array | null} */
	#finalDigest = null;

	/**
	 * @param {WasmSource} wasm_source
	 * @returns {Promise<this>}
	 */
	async initialize(wasm_source) {
		const instance =
			wasm_source instanceof WebAssembly.Module
				? await WebAssembly.instantiate(wasm_source)
				: (await WebAssembly.instantiateStreaming(fetch(wasm_source))).instance;
		this.#sponge = /** @type {Shake256Exports} */ (instance.exports);
		this.#memory = new Uint8Array(this.#sponge.memory.buffer);
		return this;
	}

	/**
	 * @returns {Shake256Exports}
	 */
	#ready() {
		if (!this.#sponge) {
			throw new Error("Shake256 WASM instance has not been initialized");
		}
		return this.#sponge;
	}

	/**
	 * @param {Uint8Array} data
	 * @returns {this}
	 */
	update(data) {
		this.#ready();
		if (this.#finalDigest) {
			throw new Error(
				"Hash update failed because digest() has already been called",
			);
		}
		if (!(data instanceof Uint8Array)) {
			throw new TypeError('The "data" argument must be a Uint8Array');
		}
		this.#update_bytes(data);
		return this;
	}

	/**
	 * Finalize and squeeze `outputLength` bytes of output. SHAKE256 is an XOF, so
	 * the caller chooses how many bytes to produce.
	 * @param {number} outputLength
	 * @returns {Uint8Array}
	 */
	digest(outputLength) {
		this.#ready();
		if (this.#finalDigest) {
			throw new Error("Digest already called");
		}
		if (!Number.isSafeInteger(outputLength) || outputLength < 0) {
			throw new TypeError(
				'The "outputLength" argument must be a non-negative integer',
			);
		}
		const digest = this.#squeeze(outputLength);
		this.#finalDigest = digest;
		return digest;
	}

	/**
	 * Clear the sponge state so the same instance can hash a new message.
	 * @returns {this}
	 */
	reset() {
		this.#ready();
		this.#memory.fill(0, 0, STATE_BYTES);
		this.#pendingLength = 0;
		this.#finalDigest = null;
		return this;
	}

	/**
	 * Snapshot the in-progress hash (sponge state plus any buffered partial
	 * block) as an opaque, restorable byte array.
	 * @returns {Uint8Array}
	 */
	getState() {
		this.#ready();
		const snapshot = new Uint8Array(STATE_BYTES + 1 + this.#pendingLength);
		snapshot.set(this.#memory.subarray(0, STATE_BYTES), 0);
		snapshot[STATE_BYTES] = this.#pendingLength;
		snapshot.set(
			this.#pending.subarray(0, this.#pendingLength),
			STATE_BYTES + 1,
		);
		return snapshot;
	}

	/**
	 * Restore a snapshot produced by {@link Shake256#getState}, replacing the
	 * current in-progress hash.
	 * @param {Uint8Array} snapshot
	 * @returns {this}
	 */
	setState(snapshot) {
		this.#ready();
		if (
			!(snapshot instanceof Uint8Array) ||
			snapshot.length < STATE_BYTES + 1
		) {
			throw new TypeError('The "snapshot" argument must be a state Uint8Array');
		}
		const pendingLength = snapshot[STATE_BYTES] ?? 0;
		if (
			pendingLength >= RATE_BYTES ||
			snapshot.length !== STATE_BYTES + 1 + pendingLength
		) {
			throw new Error("Invalid SHAKE-256 state snapshot");
		}
		this.#memory.set(snapshot.subarray(0, STATE_BYTES), 0);
		this.#pending.fill(0);
		this.#pending.set(snapshot.subarray(STATE_BYTES + 1));
		this.#pendingLength = pendingLength;
		this.#finalDigest = null;
		return this;
	}

	/**
	 * @param {Uint8Array} bytes
	 */
	#update_bytes(bytes) {
		if (bytes.length === 0) {
			return;
		}

		let offset = 0;
		if (this.#pendingLength !== 0) {
			const take = Math.min(RATE_BYTES - this.#pendingLength, bytes.length);
			this.#pending.set(bytes.subarray(0, take), this.#pendingLength);
			this.#pendingLength += take;
			offset += take;
			if (this.#pendingLength === RATE_BYTES) {
				this.#absorb_blocks(this.#pending);
				this.#pendingLength = 0;
			}
		}

		const fullBlockLength =
			bytes.length - offset - ((bytes.length - offset) % RATE_BYTES);
		if (fullBlockLength !== 0) {
			this.#absorb_blocks(bytes.subarray(offset, offset + fullBlockLength));
			offset += fullBlockLength;
		}

		const remaining = bytes.length - offset;
		if (remaining !== 0) {
			this.#pending.set(bytes.subarray(offset), 0);
			this.#pendingLength = remaining;
		}
	}

	/**
	 * Absorb whole rate blocks. The sponge state stays resident in linear memory
	 * across calls, so there is no per-call state copy in or out.
	 * @param {Uint8Array} bytes
	 */
	#absorb_blocks(bytes) {
		const sponge = this.#ready();
		const memory = this.#memory;
		const maxBytes =
			Math.floor((memory.length - DATA_OFFSET) / RATE_BYTES) * RATE_BYTES;
		for (let offset = 0; offset < bytes.length; offset += maxBytes) {
			const chunk = bytes.subarray(offset, offset + maxBytes);
			memory.set(chunk, DATA_OFFSET);
			sponge.absorb(chunk.length);
		}
	}

	/**
	 * Pad with the SHAKE domain suffix (0x1f … 0x80), absorb the final block, then
	 * squeeze `outputLength` bytes. The wasm `squeeze(num_blocks)` writes whole
	 * rate blocks to DATA_OFFSET and advances the sponge, so this loops only when
	 * the output exceeds what fits in linear memory in one call (~1 MiB).
	 * @param {number} outputLength
	 * @returns {Uint8Array}
	 */
	#squeeze(outputLength) {
		const suffixIndex = this.#pendingLength;
		this.#pending.fill(0, suffixIndex);
		this.#pending[suffixIndex] =
			(this.#pending[suffixIndex] ?? 0) | SHAKE_SUFFIX;
		const finalIndex = RATE_BYTES - 1;
		this.#pending[finalIndex] = (this.#pending[finalIndex] ?? 0) | 0x80;
		this.#absorb_blocks(this.#pending);
		this.#pendingLength = 0;

		const sponge = this.#ready();
		const memory = this.#memory;
		const capBlocks = Math.floor((memory.length - DATA_OFFSET) / RATE_BYTES);
		const out = new Uint8Array(outputLength);
		let written = 0;
		let remainingBlocks = Math.ceil(outputLength / RATE_BYTES);
		while (remainingBlocks > 0) {
			const blocks = Math.min(capBlocks, remainingBlocks);
			sponge.squeeze(blocks);
			const take = Math.min(blocks * RATE_BYTES, outputLength - written);
			out.set(memory.subarray(DATA_OFFSET, DATA_OFFSET + take), written);
			written += take;
			remainingBlocks -= blocks;
		}
		return out;
	}
}

export { Shake256 };
