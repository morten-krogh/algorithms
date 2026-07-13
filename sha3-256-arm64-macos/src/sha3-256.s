.arch armv8.2-a+sha3

.equ STATE_BYTES, 200
.equ PENDING_OFFSET, 200
.equ PENDING_LENGTH_OFFSET, 336
.equ CONTEXT_BYTES, 344
.equ RATE_BYTES, 136

/*
 * One Keccak-f[1600] round. State lanes A[x,y] occupy v(x + 5*y), one
 * 64-bit lane per vector register. v25-v31 are scratch and x9 points at
 * the next round constant.
 *
 * The Theta corrections stay in v29-v31/v27-v28. XAR then applies each
 * correction and its Rho rotation together. The destinations form a
 * temporary Pi-permuted register layout which Chi consumes directly and
 * writes back to the canonical v0-v24 layout. This removes the separate
 * 25-instruction Theta application and the Rho/Pi copy cycle.
 */
.macro KECCAK_ROUND
	/* Theta: C[0..4] in v25-v29, then D[0..4] in v29-v31/v27-v28. */
	eor3	v25.16b, v20.16b, v15.16b, v10.16b
	eor3	v26.16b, v21.16b, v16.16b, v11.16b
	eor3	v27.16b, v22.16b, v17.16b, v12.16b
	eor3	v28.16b, v23.16b, v18.16b, v13.16b
	eor3	v29.16b, v24.16b, v19.16b, v14.16b
	eor3	v25.16b, v25.16b, v5.16b, v0.16b
	eor3	v26.16b, v26.16b, v6.16b, v1.16b
	eor3	v27.16b, v27.16b, v7.16b, v2.16b
	eor3	v28.16b, v28.16b, v8.16b, v3.16b
	eor3	v29.16b, v29.16b, v9.16b, v4.16b
	rax1	v30.2d, v25.2d, v27.2d	/* D[1] */
	rax1	v31.2d, v26.2d, v28.2d	/* D[2] */
	rax1	v27.2d, v27.2d, v29.2d	/* D[3] */
	rax1	v28.2d, v28.2d, v25.2d	/* D[4] */
	rax1	v29.2d, v29.2d, v26.2d	/* D[0] */

	/* Fused Theta, Rho and Pi. */
	xar	v25.2d, v1.2d, v30.2d, #63
	xar	v1.2d, v6.2d, v30.2d, #20
	xar	v6.2d, v9.2d, v28.2d, #44
	xar	v9.2d, v22.2d, v31.2d, #3
	xar	v22.2d, v14.2d, v28.2d, #25
	xar	v14.2d, v20.2d, v29.2d, #46
	xar	v26.2d, v2.2d, v31.2d, #2
	xar	v2.2d, v12.2d, v31.2d, #21
	xar	v12.2d, v13.2d, v27.2d, #39
	xar	v13.2d, v19.2d, v28.2d, #56
	xar	v19.2d, v23.2d, v27.2d, #8
	xar	v23.2d, v15.2d, v29.2d, #23
	xar	v15.2d, v4.2d, v28.2d, #37
	xar	v28.2d, v24.2d, v28.2d, #50
	xar	v24.2d, v21.2d, v30.2d, #62
	xar	v8.2d, v8.2d, v27.2d, #9
	xar	v4.2d, v16.2d, v30.2d, #19
	xar	v16.2d, v5.2d, v29.2d, #28
	xar	v5.2d, v3.2d, v27.2d, #36
	eor	v0.16b, v0.16b, v29.16b
	xar	v27.2d, v18.2d, v27.2d, #43
	xar	v3.2d, v17.2d, v31.2d, #49
	xar	v30.2d, v11.2d, v30.2d, #54
	xar	v31.2d, v7.2d, v31.2d, #58
	xar	v29.2d, v10.2d, v29.2d, #61

	/* Chi consumes the temporary Pi layout and restores v0-v24. */
	bcax	v20.16b, v26.16b, v22.16b, v8.16b
	bcax	v21.16b, v8.16b, v23.16b, v22.16b
	bcax	v22.16b, v22.16b, v24.16b, v23.16b
	bcax	v23.16b, v23.16b, v26.16b, v24.16b
	bcax	v24.16b, v24.16b, v8.16b, v26.16b
	ldr	d26, [x9], #8

	bcax	v17.16b, v30.16b, v19.16b, v3.16b
	bcax	v18.16b, v3.16b, v15.16b, v19.16b
	bcax	v19.16b, v19.16b, v16.16b, v15.16b
	bcax	v15.16b, v15.16b, v30.16b, v16.16b
	bcax	v16.16b, v16.16b, v3.16b, v30.16b

	bcax	v10.16b, v25.16b, v12.16b, v31.16b
	bcax	v11.16b, v31.16b, v13.16b, v12.16b
	bcax	v12.16b, v12.16b, v14.16b, v13.16b
	bcax	v13.16b, v13.16b, v25.16b, v14.16b
	bcax	v14.16b, v14.16b, v31.16b, v25.16b

	bcax	v7.16b, v29.16b, v9.16b, v4.16b
	bcax	v8.16b, v4.16b, v5.16b, v9.16b
	bcax	v9.16b, v9.16b, v6.16b, v5.16b
	bcax	v5.16b, v5.16b, v29.16b, v6.16b
	bcax	v6.16b, v6.16b, v4.16b, v29.16b

	bcax	v3.16b, v27.16b, v0.16b, v28.16b
	bcax	v4.16b, v28.16b, v1.16b, v0.16b
	bcax	v0.16b, v0.16b, v2.16b, v1.16b
	bcax	v1.16b, v1.16b, v27.16b, v2.16b
	bcax	v2.16b, v2.16b, v28.16b, v27.16b

	/* Iota. Loading d26 clears the unused upper half. */
	eor	v0.16b, v0.16b, v26.16b
.endm

.text
.p2align 2
.globl _sha3_256_init
_sha3_256_init:
	movi	v0.2d, #0
	mov	w1, #10
Linit_loop:
	stp	q0, q0, [x0], #32
	subs	w1, w1, #1
	b.ne	Linit_loop
	str	q0, [x0], #16
	str	xzr, [x0]
	ret

.p2align 2
.globl _sha3_256_update
_sha3_256_update:
	cbz	x2, Lupdate_empty

	stp	x29, x30, [sp, #-48]!
	mov	x29, sp
	stp	x19, x20, [sp, #16]
	stp	x21, x22, [sp, #32]

	mov	x19, x0
	mov	x20, x1
	mov	x21, x2
	ldr	x22, [x19, #PENDING_LENGTH_OFFSET]
	cbz	x22, Lupdate_direct

	/* Complete the pending block first. */
	mov	x3, #RATE_BYTES
	sub	x3, x3, x22
	cmp	x21, x3
	csel	x3, x21, x3, lo
	add	x4, x19, #PENDING_OFFSET
	add	x4, x4, x22
	mov	x5, x3
	cmp	x5, #32
	b.lo	Lupdate_pending_copy_16
Lupdate_pending_copy_32:
	ldp	q0, q1, [x20], #32
	stp	q0, q1, [x4], #32
	sub	x5, x5, #32
	cmp	x5, #32
	b.hs	Lupdate_pending_copy_32
Lupdate_pending_copy_16:
	cmp	x5, #16
	b.lo	Lupdate_pending_copy_bytes
	ldr	q0, [x20], #16
	str	q0, [x4], #16
	sub	x5, x5, #16
Lupdate_pending_copy_bytes:
	cbz	x5, Lupdate_pending_copied
	.p2align 2
Lupdate_pending_copy_byte:
	ldrb	w6, [x20], #1
	strb	w6, [x4], #1
	subs	x5, x5, #1
	b.ne	Lupdate_pending_copy_byte
Lupdate_pending_copied:
	sub	x21, x21, x3
	add	x22, x22, x3
	str	x22, [x19, #PENDING_LENGTH_OFFSET]
	cmp	x22, #RATE_BYTES
	b.ne	Lupdate_done

	mov	x0, x19
	add	x1, x19, #PENDING_OFFSET
	mov	x2, #RATE_BYTES
	bl	Labsorb_blocks
	mov	x22, #0
	str	x22, [x19, #PENDING_LENGTH_OFFSET]
	cbz	x21, Lupdate_done

Lupdate_direct:
	/* Absorb all complete input blocks directly, leaving only the remainder. */
	cmp	x21, #RATE_BYTES
	b.lo	Lupdate_tail
	mov	x3, #RATE_BYTES
	udiv	x4, x21, x3
	msub	x5, x4, x3, x21
	sub	x22, x21, x5
	cbz	x22, Lupdate_tail
	mov	x0, x19
	mov	x1, x20
	mov	x2, x22
	bl	Labsorb_blocks
	add	x20, x20, x22
	mov	x21, x5

Lupdate_tail:
	cbz	x21, Lupdate_done
	add	x4, x19, #PENDING_OFFSET
	mov	x5, x21
	cmp	x5, #32
	b.lo	Lupdate_tail_copy_16
Lupdate_tail_copy_32:
	ldp	q0, q1, [x20], #32
	stp	q0, q1, [x4], #32
	sub	x5, x5, #32
	cmp	x5, #32
	b.hs	Lupdate_tail_copy_32
Lupdate_tail_copy_16:
	cmp	x5, #16
	b.lo	Lupdate_tail_copy_bytes
	ldr	q0, [x20], #16
	str	q0, [x4], #16
	sub	x5, x5, #16
Lupdate_tail_copy_bytes:
	cbz	x5, Lupdate_tail_copied
	.p2align 2
Lupdate_tail_copy_byte:
	ldrb	w6, [x20], #1
	strb	w6, [x4], #1
	subs	x5, x5, #1
	b.ne	Lupdate_tail_copy_byte
Lupdate_tail_copied:
	str	x21, [x19, #PENDING_LENGTH_OFFSET]

Lupdate_done:
	ldp	x21, x22, [sp, #32]
	ldp	x19, x20, [sp, #16]
	ldp	x29, x30, [sp], #48
Lupdate_empty:
	ret

.p2align 2
.globl _sha3_256_digest
_sha3_256_digest:
	stp	x29, x30, [sp, #-32]!
	mov	x29, sp
	stp	x19, x20, [sp, #16]
	mov	x19, x0
	mov	x20, x1

	add	x1, x19, #PENDING_OFFSET
	ldr	x3, [x19, #PENDING_LENGTH_OFFSET]
	add	x4, x1, x3
	mov	x5, #RATE_BYTES
	sub	x5, x5, x3
	movi	v0.2d, #0
	cmp	x5, #32
	b.lo	Ldigest_zero_16
Ldigest_zero_32:
	stp	q0, q0, [x4], #32
	sub	x5, x5, #32
	cmp	x5, #32
	b.hs	Ldigest_zero_32
Ldigest_zero_16:
	cmp	x5, #16
	b.lo	Ldigest_zero_bytes
	str	q0, [x4], #16
	sub	x5, x5, #16
Ldigest_zero_bytes:
	cbz	x5, Ldigest_padding_cleared
	.p2align 2
Ldigest_zero_byte:
	strb	wzr, [x4], #1
	subs	x5, x5, #1
	b.ne	Ldigest_zero_byte
Ldigest_padding_cleared:
	mov	w5, #0x06
	strb	w5, [x1, x3]
	ldrb	w5, [x1, #(RATE_BYTES - 1)]
	orr	w5, w5, #0x80
	strb	w5, [x1, #(RATE_BYTES - 1)]

	mov	x0, x19
	mov	x2, #RATE_BYTES
	bl	Labsorb_blocks
	str	xzr, [x19, #PENDING_LENGTH_OFFSET]
	ldp	q0, q1, [x19]
	stp	q0, q1, [x20]

	ldp	x19, x20, [sp, #16]
	ldp	x29, x30, [sp], #32
	ret

/*
 * Internal: absorb a positive multiple of 136 bytes.
 * x0 = context/state, x1 = input, x2 = byte length.
 * Preserves d8-d15 per the ABI; other SIMD and caller-saved integer
 * registers are scratch.
 */
.p2align 4
Labsorb_blocks:
	stp	d8, d9, [sp, #-64]!
	stp	d10, d11, [sp, #16]
	stp	d12, d13, [sp, #32]
	stp	d14, d15, [sp, #48]
	ldp	d0, d1, [x0, #0]
	ldp	d2, d3, [x0, #16]
	ldp	d4, d5, [x0, #32]
	ldp	d6, d7, [x0, #48]
	ldp	d8, d9, [x0, #64]
	ldp	d10, d11, [x0, #80]
	ldp	d12, d13, [x0, #96]
	ldp	d14, d15, [x0, #112]
	ldp	d16, d17, [x0, #128]
	ldp	d18, d19, [x0, #144]
	ldp	d20, d21, [x0, #160]
	ldp	d22, d23, [x0, #176]
	ldr	d24, [x0, #192]

Labsorb_loop:
	ldp	d25, d26, [x1], #16
	eor	v0.16b, v0.16b, v25.16b
	eor	v1.16b, v1.16b, v26.16b
	ldp	d25, d26, [x1], #16
	eor	v2.16b, v2.16b, v25.16b
	eor	v3.16b, v3.16b, v26.16b
	ldp	d25, d26, [x1], #16
	eor	v4.16b, v4.16b, v25.16b
	eor	v5.16b, v5.16b, v26.16b
	ldp	d25, d26, [x1], #16
	eor	v6.16b, v6.16b, v25.16b
	eor	v7.16b, v7.16b, v26.16b
	ldp	d25, d26, [x1], #16
	eor	v8.16b, v8.16b, v25.16b
	eor	v9.16b, v9.16b, v26.16b
	ldp	d25, d26, [x1], #16
	eor	v10.16b, v10.16b, v25.16b
	eor	v11.16b, v11.16b, v26.16b
	ldp	d25, d26, [x1], #16
	eor	v12.16b, v12.16b, v25.16b
	eor	v13.16b, v13.16b, v26.16b
	ldp	d25, d26, [x1], #16
	eor	v14.16b, v14.16b, v25.16b
	eor	v15.16b, v15.16b, v26.16b
	ldr	d25, [x1], #8
	eor	v16.16b, v16.16b, v25.16b

	adrp	x9, Lround_constants@PAGE
	add	x9, x9, Lround_constants@PAGEOFF
	mov	w10, #6
Lround_group_loop:
	KECCAK_ROUND
	KECCAK_ROUND
	KECCAK_ROUND
	KECCAK_ROUND
	subs	w10, w10, #1
	b.ne	Lround_group_loop

	subs	x2, x2, #RATE_BYTES
	b.ne	Labsorb_loop

	stp	d0, d1, [x0, #0]
	stp	d2, d3, [x0, #16]
	stp	d4, d5, [x0, #32]
	stp	d6, d7, [x0, #48]
	stp	d8, d9, [x0, #64]
	stp	d10, d11, [x0, #80]
	stp	d12, d13, [x0, #96]
	stp	d14, d15, [x0, #112]
	stp	d16, d17, [x0, #128]
	stp	d18, d19, [x0, #144]
	stp	d20, d21, [x0, #160]
	stp	d22, d23, [x0, #176]
	str	d24, [x0, #192]
	ldp	d14, d15, [sp, #48]
	ldp	d12, d13, [sp, #32]
	ldp	d10, d11, [sp, #16]
	ldp	d8, d9, [sp], #64
	ret

.section __TEXT,__const
.p2align 3
Lround_constants:
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
