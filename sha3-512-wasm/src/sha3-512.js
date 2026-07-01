const DATA_OFFSET = 392;
const STATE_BYTES = 200;
const RATE_BYTES = 72;
const DIGEST_BYTES = 64;
const SHA3_SUFFIX = 0x06;

/**
 * @typedef {{
 *   memory: WebAssembly.Memory,
 *   absorb: (m: number) => void,
 * }} Sha3_512Exports
 */

/**
 * @typedef {string | URL | Request | WebAssembly.Module} WasmSource
 */

/**
 * SHA3-512 hashing backed by a single WebAssembly instance.
 *
 * The sponge state lives directly in the instance's linear memory, so each
 * `Sha3_512` owns exactly one in-progress hash. Use it for one message at a
 * time: call {@link Sha3_512#reset} to start a new hash on the same instance, or
 * {@link Sha3_512#getState}/{@link Sha3_512#setState} to snapshot and resume
 * (e.g. to fork a shared prefix, sequentially). For hashes that must run
 * concurrently, create one `Sha3_512` per hash. Not re-entrant; intended for
 * single-threaded use, as JavaScript is.
 */
class Sha3_512 {
	/** @type {string} */
	algorithm = "sha3-512";

	/** @type {Sha3_512Exports | null} */
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
		this.#sponge = /** @type {Sha3_512Exports} */ (instance.exports);
		this.#memory = new Uint8Array(this.#sponge.memory.buffer);
		return this;
	}

	/**
	 * @returns {Sha3_512Exports}
	 */
	#ready() {
		if (!this.#sponge) {
			throw new Error("Sha3_512 WASM instance has not been initialized");
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
	 * @returns {Uint8Array}
	 */
	digest() {
		this.#ready();
		if (this.#finalDigest) {
			throw new Error("Digest already called");
		}
		const digest = this.#finalize();
		this.#finalDigest = digest;
		return new Uint8Array(digest);
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
	 * Restore a snapshot produced by {@link Sha3_512#getState}, replacing the
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
			throw new Error("Invalid SHA3-512 state snapshot");
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
	 * @returns {Uint8Array}
	 */
	#finalize() {
		const suffixIndex = this.#pendingLength;
		this.#pending.fill(0, suffixIndex);
		this.#pending[suffixIndex] =
			(this.#pending[suffixIndex] ?? 0) | SHA3_SUFFIX;
		const finalIndex = RATE_BYTES - 1;
		this.#pending[finalIndex] = (this.#pending[finalIndex] ?? 0) | 0x80;
		this.#absorb_blocks(this.#pending);
		this.#pendingLength = 0;

		return this.#memory.slice(0, DIGEST_BYTES);
	}
}

export { Sha3_512 };
