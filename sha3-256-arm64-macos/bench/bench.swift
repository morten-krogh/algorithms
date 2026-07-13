import CryptoKit
import Foundation

private let digestBytes = Int(SHA3_256_DIGEST_BYTES)
private let mib = 1024.0 * 1024.0

private struct Run {
	let size: Int
	let iterations: Int
}

private let runs = [
	Run(size: 0, iterations: 200_000),
	Run(size: 64, iterations: 200_000),
	Run(size: 1_024, iterations: 50_000),
	Run(size: 16_384, iterations: 10_000),
	Run(size: 262_144, iterations: 1_000),
	Run(size: 1_048_576, iterations: 300),
	Run(size: 10_485_760, iterations: 30),
]

private let columns: [(header: String, width: Int)] = [
	("size(B)", 9),
	("iters", 8),
	("asm(ms)", 10),
	("asm h/s", 10),
	("asm MiB/s", 11),
	("CryptoKit(ms)", 14),
	("CryptoKit h/s", 13),
	("CryptoKit MiB/s", 16),
	("OpenSSL(ms)", 12),
	("OpenSSL h/s", 13),
	("OpenSSL MiB/s", 15),
	("asm/CryptoKit", 13),
	("asm/OpenSSL", 12),
]

private struct Metrics {
	let milliseconds: Double
	let hashesPerSecond: Double
	let mibPerSecond: Double
}

private func pad(_ value: String, to width: Int) -> String {
	if value.count >= width {
		return value
	}
	return String(repeating: " ", count: width - value.count) + value
}

private func row(_ cells: [String]) -> String {
	zip(cells, columns).map { pad($0.0, to: $0.1.width) }.joined(separator: "  ")
}

@inline(never)
private func time(iterations: Int, body: () -> Void) -> Double {
	for _ in 0..<min(1_000, iterations) {
		body()
	}
	let start = ContinuousClock.now
	for _ in 0..<iterations {
		body()
	}
	let duration = start.duration(to: ContinuousClock.now)
	let components = duration.components
	return Double(components.seconds) * 1_000.0
		+ Double(components.attoseconds) / 1.0e15
}

private func metrics(elapsedMilliseconds: Double, run: Run) -> Metrics {
	let seconds = max(elapsedMilliseconds / 1_000.0, Double.leastNonzeroMagnitude)
	return Metrics(
		milliseconds: elapsedMilliseconds,
		hashesPerSecond: Double(run.iterations) / seconds,
		mibPerSecond: (Double(run.size * run.iterations) / mib) / seconds
	)
}

private func format(_ metrics: Metrics) -> [String] {
	[
		String(format: "%.2f", metrics.milliseconds),
		String(format: "%.0f", metrics.hashesPerSecond),
		String(format: "%.2f", metrics.mibPerSecond),
	]
}

private final class Buffers {
	let context: UnsafeMutablePointer<sha3_256_ctx>
	let message: UnsafeMutablePointer<UInt8>
	let digest: UnsafeMutablePointer<UInt8>
	let messageSize: Int

	init(size: Int) {
		context = .allocate(capacity: 1)
		message = .allocate(capacity: max(size, 1))
		digest = .allocate(capacity: digestBytes)
		messageSize = size
		message.initialize(repeating: 0xa3, count: max(size, 1))
		digest.initialize(repeating: 0, count: digestBytes)
	}

	deinit {
		digest.deinitialize(count: digestBytes)
		digest.deallocate()
		message.deinitialize(count: max(messageSize, 1))
		message.deallocate()
		context.deallocate()
	}

	var rawMessage: UnsafeRawBufferPointer {
		UnsafeRawBufferPointer(start: message, count: messageSize)
	}

	func digestArray() -> [UInt8] {
		Array(UnsafeBufferPointer(start: digest, count: digestBytes))
	}
}

private final class OpenSSLHash {
	let algorithm: OpaquePointer
	let context: OpaquePointer

	init() {
		guard let algorithm = EVP_MD_fetch(nil, "SHA3-256", nil),
			let context = EVP_MD_CTX_new()
		else {
			fatalError("OpenSSL could not initialize SHA3-256")
		}
		self.algorithm = algorithm
		self.context = context
	}

	deinit {
		EVP_MD_CTX_free(context)
		EVP_MD_free(algorithm)
	}

	@inline(never)
	func hash(_ message: UnsafeRawBufferPointer, into output: UnsafeMutablePointer<UInt8>) {
		var outputLength: UInt32 = 0
		precondition(EVP_DigestInit_ex2(context, algorithm, nil) == 1)
		precondition(EVP_DigestUpdate(context, message.baseAddress, message.count) == 1)
		precondition(EVP_DigestFinal_ex(context, output, &outputLength) == 1)
		precondition(outputLength == digestBytes)
	}
}

@inline(never)
private func assemblyHash(_ buffers: Buffers) {
	sha3_256_init(buffers.context)
	sha3_256_update(buffers.context, buffers.rawMessage.baseAddress, buffers.messageSize)
	sha3_256_digest(buffers.context, buffers.digest)
}

@inline(never)
private func cryptoKitHash(_ buffers: Buffers) {
	var hash = SHA3_256()
	hash.update(bufferPointer: buffers.rawMessage)
	let digest = hash.finalize()
	digest.withUnsafeBytes { bytes in
		buffers.digest.update(from: bytes.bindMemory(to: UInt8.self).baseAddress!,
			count: digestBytes)
	}
}

@main
private struct Benchmark {
	static func main() {
		let openssl = OpenSSLHash()
		print(row(columns.map(\.header)))

		for run in runs {
			let buffers = Buffers(size: run.size)

			assemblyHash(buffers)
			let assemblyDigest = buffers.digestArray()
			cryptoKitHash(buffers)
			let cryptoKitDigest = buffers.digestArray()
			openssl.hash(buffers.rawMessage, into: buffers.digest)
			let opensslDigest = buffers.digestArray()
			guard assemblyDigest == cryptoKitDigest, assemblyDigest == opensslDigest else {
				fputs("digest mismatch at size \(run.size)\n", stderr)
				exit(EXIT_FAILURE)
			}

			let assembly = metrics(
				elapsedMilliseconds: time(iterations: run.iterations) {
					assemblyHash(buffers)
				},
				run: run
			)
			let cryptoKit = metrics(
				elapsedMilliseconds: time(iterations: run.iterations) {
					cryptoKitHash(buffers)
				},
				run: run
			)
			let opensslMetrics = metrics(
				elapsedMilliseconds: time(iterations: run.iterations) {
					openssl.hash(buffers.rawMessage, into: buffers.digest)
				},
				run: run
			)

			print(row(
				[String(run.size), String(run.iterations)]
					+ format(assembly)
					+ format(cryptoKit)
					+ format(opensslMetrics)
					+ [
						String(format: "%.2fx", cryptoKit.milliseconds / assembly.milliseconds),
						String(format: "%.2fx", opensslMetrics.milliseconds / assembly.milliseconds),
					]
			))
		}
	}
}
