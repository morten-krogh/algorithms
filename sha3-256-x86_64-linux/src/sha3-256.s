.equ STATE_BYTES, 200
.equ PENDING_OFFSET, 200
.equ PENDING_LENGTH_OFFSET, 336
.equ CONTEXT_BYTES, 344
.equ RATE_BYTES, 136

/*
 * One Keccak-f[1600] round. State lanes A[x,y] occupy the low quadword of
 * %xmm(x + 5*y); the upper bits hold garbage that every lane-wise operation
 * and vmovq store ignores. %xmm25-%xmm31 are scratch and %r9 points at the
 * current round-constant group; \rc is the byte offset of this round's
 * constant.
 *
 * vpternlogq $0x96 accumulates the Theta column parities three lanes at a
 * time. Because vpxorq and vprolq choose their destination freely, the
 * Theta correction and Rho rotation walk the Pi permutation cycle and land
 * every result directly in its canonical register, so Pi costs nothing.
 * Chi then runs in place per row with vpternlogq $0xD2 and two saved lanes.
 */
.macro KECCAK_ROUND rc
	/* Theta: C[0..4] in %xmm25-%xmm29. */
	vmovdqa64	%xmm0, %xmm25
	vpternlogq	$0x96, %xmm10, %xmm5, %xmm25
	vpternlogq	$0x96, %xmm20, %xmm15, %xmm25
	vmovdqa64	%xmm1, %xmm26
	vpternlogq	$0x96, %xmm11, %xmm6, %xmm26
	vpternlogq	$0x96, %xmm21, %xmm16, %xmm26
	vmovdqa64	%xmm2, %xmm27
	vpternlogq	$0x96, %xmm12, %xmm7, %xmm27
	vpternlogq	$0x96, %xmm22, %xmm17, %xmm27
	vmovdqa64	%xmm3, %xmm28
	vpternlogq	$0x96, %xmm13, %xmm8, %xmm28
	vpternlogq	$0x96, %xmm23, %xmm18, %xmm28
	vmovdqa64	%xmm4, %xmm29
	vpternlogq	$0x96, %xmm14, %xmm9, %xmm29
	vpternlogq	$0x96, %xmm24, %xmm19, %xmm29

	/* Theta: D[0..4] in %xmm30/%xmm27/%xmm28/%xmm31/%xmm25. */
	vprolq	$1, %xmm26, %xmm30
	vprolq	$1, %xmm29, %xmm31
	vpxorq	%xmm29, %xmm30, %xmm30	/* D[0] = C[4] ^ rol(C[1], 1) */
	vpxorq	%xmm27, %xmm31, %xmm31	/* D[3] = C[2] ^ rol(C[4], 1) */
	vprolq	$1, %xmm27, %xmm27
	vpxorq	%xmm25, %xmm27, %xmm27	/* D[1] = C[0] ^ rol(C[2], 1) */
	vprolq	$1, %xmm25, %xmm25
	vpxorq	%xmm28, %xmm25, %xmm25	/* D[4] = C[3] ^ rol(C[0], 1) */
	vprolq	$1, %xmm28, %xmm28
	vpxorq	%xmm26, %xmm28, %xmm28	/* D[2] = C[1] ^ rol(C[3], 1) */

	/* Fused Theta, Rho and Pi along the Pi cycle; %xmm26 saves A[1]. */
	vmovdqa64	%xmm1, %xmm26
	vpxorq	%xmm27, %xmm6, %xmm1
	vprolq	$44, %xmm1, %xmm1
	vpxorq	%xmm25, %xmm9, %xmm6
	vprolq	$20, %xmm6, %xmm6
	vpxorq	%xmm28, %xmm22, %xmm9
	vprolq	$61, %xmm9, %xmm9
	vpxorq	%xmm25, %xmm14, %xmm22
	vprolq	$39, %xmm22, %xmm22
	vpxorq	%xmm30, %xmm20, %xmm14
	vprolq	$18, %xmm14, %xmm14
	vpxorq	%xmm28, %xmm2, %xmm20
	vprolq	$62, %xmm20, %xmm20
	vpxorq	%xmm28, %xmm12, %xmm2
	vprolq	$43, %xmm2, %xmm2
	vpxorq	%xmm31, %xmm13, %xmm12
	vprolq	$25, %xmm12, %xmm12
	vpxorq	%xmm25, %xmm19, %xmm13
	vprolq	$8, %xmm13, %xmm13
	vpxorq	%xmm31, %xmm23, %xmm19
	vprolq	$56, %xmm19, %xmm19
	vpxorq	%xmm30, %xmm15, %xmm23
	vprolq	$41, %xmm23, %xmm23
	vpxorq	%xmm25, %xmm4, %xmm15
	vprolq	$27, %xmm15, %xmm15
	vpxorq	%xmm25, %xmm24, %xmm4
	vprolq	$14, %xmm4, %xmm4
	vpxorq	%xmm27, %xmm21, %xmm24
	vprolq	$2, %xmm24, %xmm24
	vpxorq	%xmm31, %xmm8, %xmm21
	vprolq	$55, %xmm21, %xmm21
	vpxorq	%xmm27, %xmm16, %xmm8
	vprolq	$45, %xmm8, %xmm8
	vpxorq	%xmm30, %xmm5, %xmm16
	vprolq	$36, %xmm16, %xmm16
	vpxorq	%xmm31, %xmm3, %xmm5
	vprolq	$28, %xmm5, %xmm5
	vpxorq	%xmm31, %xmm18, %xmm3
	vprolq	$21, %xmm3, %xmm3
	vpxorq	%xmm28, %xmm17, %xmm18
	vprolq	$15, %xmm18, %xmm18
	vpxorq	%xmm27, %xmm11, %xmm17
	vprolq	$10, %xmm17, %xmm17
	vpxorq	%xmm28, %xmm7, %xmm11
	vprolq	$6, %xmm11, %xmm11
	vpxorq	%xmm30, %xmm10, %xmm7
	vprolq	$3, %xmm7, %xmm7
	vpxorq	%xmm30, %xmm0, %xmm0
	vpxorq	%xmm27, %xmm26, %xmm10
	vprolq	$1, %xmm10, %xmm10

	/* Chi in place per row; %xmm25/%xmm26 save the first two lanes. */
	vmovdqa64	%xmm0, %xmm25
	vmovdqa64	%xmm1, %xmm26
	vpternlogq	$0xd2, %xmm2, %xmm1, %xmm0
	vpternlogq	$0xd2, %xmm3, %xmm2, %xmm1
	vpternlogq	$0xd2, %xmm4, %xmm3, %xmm2
	vpternlogq	$0xd2, %xmm25, %xmm4, %xmm3
	vpternlogq	$0xd2, %xmm26, %xmm25, %xmm4
	vmovdqa64	%xmm5, %xmm25
	vmovdqa64	%xmm6, %xmm26
	vpternlogq	$0xd2, %xmm7, %xmm6, %xmm5
	vpternlogq	$0xd2, %xmm8, %xmm7, %xmm6
	vpternlogq	$0xd2, %xmm9, %xmm8, %xmm7
	vpternlogq	$0xd2, %xmm25, %xmm9, %xmm8
	vpternlogq	$0xd2, %xmm26, %xmm25, %xmm9
	vmovdqa64	%xmm10, %xmm25
	vmovdqa64	%xmm11, %xmm26
	vpternlogq	$0xd2, %xmm12, %xmm11, %xmm10
	vpternlogq	$0xd2, %xmm13, %xmm12, %xmm11
	vpternlogq	$0xd2, %xmm14, %xmm13, %xmm12
	vpternlogq	$0xd2, %xmm25, %xmm14, %xmm13
	vpternlogq	$0xd2, %xmm26, %xmm25, %xmm14
	vmovdqa64	%xmm15, %xmm25
	vmovdqa64	%xmm16, %xmm26
	vpternlogq	$0xd2, %xmm17, %xmm16, %xmm15
	vpternlogq	$0xd2, %xmm18, %xmm17, %xmm16
	vpternlogq	$0xd2, %xmm19, %xmm18, %xmm17
	vpternlogq	$0xd2, %xmm25, %xmm19, %xmm18
	vpternlogq	$0xd2, %xmm26, %xmm25, %xmm19
	vmovdqa64	%xmm20, %xmm25
	vmovdqa64	%xmm21, %xmm26
	vpternlogq	$0xd2, %xmm22, %xmm21, %xmm20
	vpternlogq	$0xd2, %xmm23, %xmm22, %xmm21
	vpternlogq	$0xd2, %xmm24, %xmm23, %xmm22
	vpternlogq	$0xd2, %xmm25, %xmm24, %xmm23
	vpternlogq	$0xd2, %xmm26, %xmm25, %xmm24

	/* Iota. The eight-byte broadcast never over-reads the table. */
	vpxorq	\rc(%r9){1to2}, %xmm0, %xmm0
.endm

.text
.p2align 4
.globl sha3_256_init
.type sha3_256_init, @function
sha3_256_init:
	vpxor	%xmm0, %xmm0, %xmm0
	vmovdqu	%ymm0, (%rdi)
	vmovdqu	%ymm0, 32(%rdi)
	vmovdqu	%ymm0, 64(%rdi)
	vmovdqu	%ymm0, 96(%rdi)
	vmovdqu	%ymm0, 128(%rdi)
	vmovdqu	%ymm0, 160(%rdi)
	vmovdqu	%ymm0, 192(%rdi)
	vmovdqu	%ymm0, 224(%rdi)
	vmovdqu	%ymm0, 256(%rdi)
	vmovdqu	%ymm0, 288(%rdi)
	vmovdqu	%xmm0, 320(%rdi)
	movq	$0, PENDING_LENGTH_OFFSET(%rdi)
	vzeroupper
	ret
.size sha3_256_init, . - sha3_256_init

.p2align 4
.globl sha3_256_update
.type sha3_256_update, @function
sha3_256_update:
	test	%rdx, %rdx
	jz	.Lupdate_empty

	push	%rbx
	push	%r12
	push	%r13
	mov	%rsi, %rbx
	mov	%rdx, %r12
	mov	PENDING_LENGTH_OFFSET(%rdi), %r13
	test	%r13, %r13
	jz	.Lupdate_direct

	/* Complete the pending block first. */
	mov	$RATE_BYTES, %eax
	sub	%r13, %rax
	cmp	%r12, %rax
	cmova	%r12, %rax
	lea	PENDING_OFFSET(%rdi,%r13), %rcx
	mov	%rax, %r8
	cmp	$32, %r8
	jb	.Lupdate_pending_copy_16
.Lupdate_pending_copy_32:
	vmovdqu	(%rbx), %ymm0
	vmovdqu	%ymm0, (%rcx)
	add	$32, %rbx
	add	$32, %rcx
	sub	$32, %r8
	cmp	$32, %r8
	jae	.Lupdate_pending_copy_32
.Lupdate_pending_copy_16:
	cmp	$16, %r8
	jb	.Lupdate_pending_copy_bytes
	vmovdqu	(%rbx), %xmm0
	vmovdqu	%xmm0, (%rcx)
	add	$16, %rbx
	add	$16, %rcx
	sub	$16, %r8
.Lupdate_pending_copy_bytes:
	test	%r8, %r8
	jz	.Lupdate_pending_copied
	.p2align 4
.Lupdate_pending_copy_byte:
	movzbl	(%rbx), %r9d
	movb	%r9b, (%rcx)
	inc	%rbx
	inc	%rcx
	dec	%r8
	jnz	.Lupdate_pending_copy_byte
.Lupdate_pending_copied:
	sub	%rax, %r12
	add	%rax, %r13
	mov	%r13, PENDING_LENGTH_OFFSET(%rdi)
	cmp	$RATE_BYTES, %r13
	jne	.Lupdate_done

	lea	PENDING_OFFSET(%rdi), %rsi
	mov	$RATE_BYTES, %edx
	call	absorb_blocks
	movq	$0, PENDING_LENGTH_OFFSET(%rdi)
	test	%r12, %r12
	jz	.Lupdate_done

.Lupdate_direct:
	/* Absorb all complete input blocks directly, leaving only the remainder. */
	cmp	$RATE_BYTES, %r12
	jb	.Lupdate_tail
	mov	%r12, %rax
	xor	%edx, %edx
	mov	$RATE_BYTES, %ecx
	div	%rcx
	mov	%rdx, %r13
	sub	%r13, %r12
	mov	%rbx, %rsi
	mov	%r12, %rdx
	call	absorb_blocks
	add	%r12, %rbx
	mov	%r13, %r12

.Lupdate_tail:
	test	%r12, %r12
	jz	.Lupdate_done
	lea	PENDING_OFFSET(%rdi), %rcx
	mov	%r12, %r8
	cmp	$32, %r8
	jb	.Lupdate_tail_copy_16
.Lupdate_tail_copy_32:
	vmovdqu	(%rbx), %ymm0
	vmovdqu	%ymm0, (%rcx)
	add	$32, %rbx
	add	$32, %rcx
	sub	$32, %r8
	cmp	$32, %r8
	jae	.Lupdate_tail_copy_32
.Lupdate_tail_copy_16:
	cmp	$16, %r8
	jb	.Lupdate_tail_copy_bytes
	vmovdqu	(%rbx), %xmm0
	vmovdqu	%xmm0, (%rcx)
	add	$16, %rbx
	add	$16, %rcx
	sub	$16, %r8
.Lupdate_tail_copy_bytes:
	test	%r8, %r8
	jz	.Lupdate_tail_copied
	.p2align 4
.Lupdate_tail_copy_byte:
	movzbl	(%rbx), %r9d
	movb	%r9b, (%rcx)
	inc	%rbx
	inc	%rcx
	dec	%r8
	jnz	.Lupdate_tail_copy_byte
.Lupdate_tail_copied:
	mov	%r12, PENDING_LENGTH_OFFSET(%rdi)

.Lupdate_done:
	vzeroupper
	pop	%r13
	pop	%r12
	pop	%rbx
.Lupdate_empty:
	ret
.size sha3_256_update, . - sha3_256_update

.p2align 4
.globl sha3_256_digest
.type sha3_256_digest, @function
sha3_256_digest:
	push	%rbx
	mov	%rsi, %rbx

	mov	PENDING_LENGTH_OFFSET(%rdi), %rax
	lea	PENDING_OFFSET(%rdi,%rax), %rcx
	mov	$RATE_BYTES, %r8d
	sub	%rax, %r8
	vpxor	%xmm0, %xmm0, %xmm0
	cmp	$32, %r8
	jb	.Ldigest_zero_16
.Ldigest_zero_32:
	vmovdqu	%ymm0, (%rcx)
	add	$32, %rcx
	sub	$32, %r8
	cmp	$32, %r8
	jae	.Ldigest_zero_32
.Ldigest_zero_16:
	cmp	$16, %r8
	jb	.Ldigest_zero_bytes
	vmovdqu	%xmm0, (%rcx)
	add	$16, %rcx
	sub	$16, %r8
.Ldigest_zero_bytes:
	test	%r8, %r8
	jz	.Ldigest_padding_cleared
	.p2align 4
.Ldigest_zero_byte:
	movb	$0, (%rcx)
	inc	%rcx
	dec	%r8
	jnz	.Ldigest_zero_byte
.Ldigest_padding_cleared:
	movb	$0x06, PENDING_OFFSET(%rdi,%rax)
	orb	$0x80, PENDING_OFFSET + RATE_BYTES - 1(%rdi)

	lea	PENDING_OFFSET(%rdi), %rsi
	mov	$RATE_BYTES, %edx
	call	absorb_blocks
	movq	$0, PENDING_LENGTH_OFFSET(%rdi)
	vmovdqu	(%rdi), %ymm0
	vmovdqu	%ymm0, (%rbx)

	vzeroupper
	pop	%rbx
	ret
.size sha3_256_digest, . - sha3_256_digest

/*
 * Internal: absorb a positive multiple of 136 bytes.
 * %rdi = context/state (preserved), %rsi = input, %rdx = byte length.
 * Clobbers %rax, %rcx, %r8, %r9, %rsi, %rdx and all vector registers;
 * the SysV ABI has no callee-saved vector registers.
 */
.p2align 4
.type absorb_blocks, @function
absorb_blocks:
	vmovq	(%rdi), %xmm0
	vmovq	8(%rdi), %xmm1
	vmovq	16(%rdi), %xmm2
	vmovq	24(%rdi), %xmm3
	vmovq	32(%rdi), %xmm4
	vmovq	40(%rdi), %xmm5
	vmovq	48(%rdi), %xmm6
	vmovq	56(%rdi), %xmm7
	vmovq	64(%rdi), %xmm8
	vmovq	72(%rdi), %xmm9
	vmovq	80(%rdi), %xmm10
	vmovq	88(%rdi), %xmm11
	vmovq	96(%rdi), %xmm12
	vmovq	104(%rdi), %xmm13
	vmovq	112(%rdi), %xmm14
	vmovq	120(%rdi), %xmm15
	vmovq	128(%rdi), %xmm16
	vmovq	136(%rdi), %xmm17
	vmovq	144(%rdi), %xmm18
	vmovq	152(%rdi), %xmm19
	vmovq	160(%rdi), %xmm20
	vmovq	168(%rdi), %xmm21
	vmovq	176(%rdi), %xmm22
	vmovq	184(%rdi), %xmm23
	vmovq	192(%rdi), %xmm24
	lea	round_constants(%rip), %r8

.Labsorb_loop:
	/* The eight-byte broadcast XORs never read past the block. */
	vpxorq	(%rsi){1to2}, %xmm0, %xmm0
	vpxorq	8(%rsi){1to2}, %xmm1, %xmm1
	vpxorq	16(%rsi){1to2}, %xmm2, %xmm2
	vpxorq	24(%rsi){1to2}, %xmm3, %xmm3
	vpxorq	32(%rsi){1to2}, %xmm4, %xmm4
	vpxorq	40(%rsi){1to2}, %xmm5, %xmm5
	vpxorq	48(%rsi){1to2}, %xmm6, %xmm6
	vpxorq	56(%rsi){1to2}, %xmm7, %xmm7
	vpxorq	64(%rsi){1to2}, %xmm8, %xmm8
	vpxorq	72(%rsi){1to2}, %xmm9, %xmm9
	vpxorq	80(%rsi){1to2}, %xmm10, %xmm10
	vpxorq	88(%rsi){1to2}, %xmm11, %xmm11
	vpxorq	96(%rsi){1to2}, %xmm12, %xmm12
	vpxorq	104(%rsi){1to2}, %xmm13, %xmm13
	vpxorq	112(%rsi){1to2}, %xmm14, %xmm14
	vpxorq	120(%rsi){1to2}, %xmm15, %xmm15
	vpxorq	128(%rsi){1to2}, %xmm16, %xmm16
	add	$RATE_BYTES, %rsi
	sub	$RATE_BYTES, %rdx

	mov	%r8, %r9
	mov	$6, %ecx
.Lround_group_loop:
	KECCAK_ROUND 0
	KECCAK_ROUND 8
	KECCAK_ROUND 16
	KECCAK_ROUND 24
	add	$32, %r9
	dec	%ecx
	jnz	.Lround_group_loop

	test	%rdx, %rdx
	jnz	.Labsorb_loop

	vmovq	%xmm0, (%rdi)
	vmovq	%xmm1, 8(%rdi)
	vmovq	%xmm2, 16(%rdi)
	vmovq	%xmm3, 24(%rdi)
	vmovq	%xmm4, 32(%rdi)
	vmovq	%xmm5, 40(%rdi)
	vmovq	%xmm6, 48(%rdi)
	vmovq	%xmm7, 56(%rdi)
	vmovq	%xmm8, 64(%rdi)
	vmovq	%xmm9, 72(%rdi)
	vmovq	%xmm10, 80(%rdi)
	vmovq	%xmm11, 88(%rdi)
	vmovq	%xmm12, 96(%rdi)
	vmovq	%xmm13, 104(%rdi)
	vmovq	%xmm14, 112(%rdi)
	vmovq	%xmm15, 120(%rdi)
	vmovq	%xmm16, 128(%rdi)
	vmovq	%xmm17, 136(%rdi)
	vmovq	%xmm18, 144(%rdi)
	vmovq	%xmm19, 152(%rdi)
	vmovq	%xmm20, 160(%rdi)
	vmovq	%xmm21, 168(%rdi)
	vmovq	%xmm22, 176(%rdi)
	vmovq	%xmm23, 184(%rdi)
	vmovq	%xmm24, 192(%rdi)
	ret
.size absorb_blocks, . - absorb_blocks

.section .rodata
.p2align 3
round_constants:
	.quad 0x0000000000000001
	.quad 0x0000000000008082
	.quad 0x800000000000808a
	.quad 0x8000000080008000
	.quad 0x000000000000808b
	.quad 0x0000000080000001
	.quad 0x8000000080008081
	.quad 0x8000000000008009
	.quad 0x000000000000008a
	.quad 0x0000000000000088
	.quad 0x0000000080008009
	.quad 0x000000008000000a
	.quad 0x000000008000808b
	.quad 0x800000000000008b
	.quad 0x8000000000008089
	.quad 0x8000000000008003
	.quad 0x8000000000008002
	.quad 0x8000000000000080
	.quad 0x000000000000800a
	.quad 0x800000008000000a
	.quad 0x8000000080008081
	.quad 0x8000000000008080
	.quad 0x0000000080000001
	.quad 0x8000000080008008

.section .note.GNU-stack,"",@progbits
