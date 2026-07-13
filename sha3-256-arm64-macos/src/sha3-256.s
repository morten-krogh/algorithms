.arch armv8.2-a+sha3

.equ STATE_BYTES, 200
.equ PENDING_OFFSET, 200
.equ PENDING_LENGTH_OFFSET, 336
.equ CONTEXT_BYTES, 344
.equ RATE_BYTES, 136

/*
 * One Keccak-f[1600] round. State lanes A[x,y] occupy v(x + 5*y), one
 * 64-bit lane per vector register. v25-v30 are scratch; v31 is kept zero.
 * x9 points at the next round constant.
 */
.macro KECCAK_ROUND
	/* Theta: C[x] in v25-v29, then D[x] in v30. */
	eor3	v25.16b, v0.16b, v5.16b, v10.16b
	eor3	v25.16b, v25.16b, v15.16b, v20.16b
	eor3	v26.16b, v1.16b, v6.16b, v11.16b
	eor3	v26.16b, v26.16b, v16.16b, v21.16b
	eor3	v27.16b, v2.16b, v7.16b, v12.16b
	eor3	v27.16b, v27.16b, v17.16b, v22.16b
	eor3	v28.16b, v3.16b, v8.16b, v13.16b
	eor3	v28.16b, v28.16b, v18.16b, v23.16b
	eor3	v29.16b, v4.16b, v9.16b, v14.16b
	eor3	v29.16b, v29.16b, v19.16b, v24.16b

	rax1	v30.2d, v29.2d, v26.2d
	eor	v0.16b, v0.16b, v30.16b
	eor	v5.16b, v5.16b, v30.16b
	eor	v10.16b, v10.16b, v30.16b
	eor	v15.16b, v15.16b, v30.16b
	eor	v20.16b, v20.16b, v30.16b
	rax1	v30.2d, v25.2d, v27.2d
	eor	v1.16b, v1.16b, v30.16b
	eor	v6.16b, v6.16b, v30.16b
	eor	v11.16b, v11.16b, v30.16b
	eor	v16.16b, v16.16b, v30.16b
	eor	v21.16b, v21.16b, v30.16b
	rax1	v30.2d, v26.2d, v28.2d
	eor	v2.16b, v2.16b, v30.16b
	eor	v7.16b, v7.16b, v30.16b
	eor	v12.16b, v12.16b, v30.16b
	eor	v17.16b, v17.16b, v30.16b
	eor	v22.16b, v22.16b, v30.16b
	rax1	v30.2d, v27.2d, v29.2d
	eor	v3.16b, v3.16b, v30.16b
	eor	v8.16b, v8.16b, v30.16b
	eor	v13.16b, v13.16b, v30.16b
	eor	v18.16b, v18.16b, v30.16b
	eor	v23.16b, v23.16b, v30.16b
	rax1	v30.2d, v28.2d, v25.2d
	eor	v4.16b, v4.16b, v30.16b
	eor	v9.16b, v9.16b, v30.16b
	eor	v14.16b, v14.16b, v30.16b
	eor	v19.16b, v19.16b, v30.16b
	eor	v24.16b, v24.16b, v30.16b

	/* Rho and Pi: the 24 nonzero lanes form one in-place cycle. */
	mov	v25.16b, v1.16b
	mov	v26.16b, v10.16b
	xar	v10.2d, v31.2d, v25.2d, #63
	mov	v25.16b, v7.16b
	xar	v7.2d, v31.2d, v26.2d, #61
	mov	v26.16b, v11.16b
	xar	v11.2d, v31.2d, v25.2d, #58
	mov	v25.16b, v17.16b
	xar	v17.2d, v31.2d, v26.2d, #54
	mov	v26.16b, v18.16b
	xar	v18.2d, v31.2d, v25.2d, #49
	mov	v25.16b, v3.16b
	xar	v3.2d, v31.2d, v26.2d, #43
	mov	v26.16b, v5.16b
	xar	v5.2d, v31.2d, v25.2d, #36
	mov	v25.16b, v16.16b
	xar	v16.2d, v31.2d, v26.2d, #28
	mov	v26.16b, v8.16b
	xar	v8.2d, v31.2d, v25.2d, #19
	mov	v25.16b, v21.16b
	xar	v21.2d, v31.2d, v26.2d, #9
	mov	v26.16b, v24.16b
	xar	v24.2d, v31.2d, v25.2d, #62
	mov	v25.16b, v4.16b
	xar	v4.2d, v31.2d, v26.2d, #50
	mov	v26.16b, v15.16b
	xar	v15.2d, v31.2d, v25.2d, #37
	mov	v25.16b, v23.16b
	xar	v23.2d, v31.2d, v26.2d, #23
	mov	v26.16b, v19.16b
	xar	v19.2d, v31.2d, v25.2d, #8
	mov	v25.16b, v13.16b
	xar	v13.2d, v31.2d, v26.2d, #56
	mov	v26.16b, v12.16b
	xar	v12.2d, v31.2d, v25.2d, #39
	mov	v25.16b, v2.16b
	xar	v2.2d, v31.2d, v26.2d, #21
	mov	v26.16b, v20.16b
	xar	v20.2d, v31.2d, v25.2d, #2
	mov	v25.16b, v14.16b
	xar	v14.2d, v31.2d, v26.2d, #46
	mov	v26.16b, v22.16b
	xar	v22.2d, v31.2d, v25.2d, #25
	mov	v25.16b, v9.16b
	xar	v9.2d, v31.2d, v26.2d, #3
	mov	v26.16b, v6.16b
	xar	v6.2d, v31.2d, v25.2d, #44
	xar	v1.2d, v31.2d, v26.2d, #20

	/* Chi, one row at a time. */
	mov	v25.16b, v0.16b
	mov	v26.16b, v1.16b
	mov	v27.16b, v2.16b
	mov	v28.16b, v3.16b
	mov	v29.16b, v4.16b
	bcax	v0.16b, v25.16b, v27.16b, v26.16b
	bcax	v1.16b, v26.16b, v28.16b, v27.16b
	bcax	v2.16b, v27.16b, v29.16b, v28.16b
	bcax	v3.16b, v28.16b, v25.16b, v29.16b
	bcax	v4.16b, v29.16b, v26.16b, v25.16b

	mov	v25.16b, v5.16b
	mov	v26.16b, v6.16b
	mov	v27.16b, v7.16b
	mov	v28.16b, v8.16b
	mov	v29.16b, v9.16b
	bcax	v5.16b, v25.16b, v27.16b, v26.16b
	bcax	v6.16b, v26.16b, v28.16b, v27.16b
	bcax	v7.16b, v27.16b, v29.16b, v28.16b
	bcax	v8.16b, v28.16b, v25.16b, v29.16b
	bcax	v9.16b, v29.16b, v26.16b, v25.16b

	mov	v25.16b, v10.16b
	mov	v26.16b, v11.16b
	mov	v27.16b, v12.16b
	mov	v28.16b, v13.16b
	mov	v29.16b, v14.16b
	bcax	v10.16b, v25.16b, v27.16b, v26.16b
	bcax	v11.16b, v26.16b, v28.16b, v27.16b
	bcax	v12.16b, v27.16b, v29.16b, v28.16b
	bcax	v13.16b, v28.16b, v25.16b, v29.16b
	bcax	v14.16b, v29.16b, v26.16b, v25.16b

	mov	v25.16b, v15.16b
	mov	v26.16b, v16.16b
	mov	v27.16b, v17.16b
	mov	v28.16b, v18.16b
	mov	v29.16b, v19.16b
	bcax	v15.16b, v25.16b, v27.16b, v26.16b
	bcax	v16.16b, v26.16b, v28.16b, v27.16b
	bcax	v17.16b, v27.16b, v29.16b, v28.16b
	bcax	v18.16b, v28.16b, v25.16b, v29.16b
	bcax	v19.16b, v29.16b, v26.16b, v25.16b

	mov	v25.16b, v20.16b
	mov	v26.16b, v21.16b
	mov	v27.16b, v22.16b
	mov	v28.16b, v23.16b
	mov	v29.16b, v24.16b
	bcax	v20.16b, v25.16b, v27.16b, v26.16b
	bcax	v21.16b, v26.16b, v28.16b, v27.16b
	bcax	v22.16b, v27.16b, v29.16b, v28.16b
	bcax	v23.16b, v28.16b, v25.16b, v29.16b
	bcax	v24.16b, v29.16b, v26.16b, v25.16b

	/* Iota. Loading into d30 clears the unused upper half. */
	ldr	d30, [x9], #8
	eor	v0.16b, v0.16b, v30.16b
.endm

.text
.p2align 2
.globl _sha3_256_init
_sha3_256_init:
	mov	w1, #43
Linit_loop:
	str	xzr, [x0], #8
	subs	w1, w1, #1
	b.ne	Linit_loop
	ret

.p2align 2
.globl _sha3_256_update
_sha3_256_update:
	cbz	x2, Lupdate_empty

	stp	x29, x30, [sp, #-112]!
	mov	x29, sp
	stp	x19, x20, [sp, #16]
	stp	x21, x22, [sp, #32]
	stp	d8, d9, [sp, #48]
	stp	d10, d11, [sp, #64]
	stp	d12, d13, [sp, #80]
	stp	d14, d15, [sp, #96]

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
Lupdate_pending_copy:
	cbz	x5, Lupdate_pending_copied
	ldrb	w6, [x20], #1
	strb	w6, [x4], #1
	sub	x5, x5, #1
	b	Lupdate_pending_copy
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
Lupdate_tail_copy:
	ldrb	w6, [x20], #1
	strb	w6, [x4], #1
	subs	x5, x5, #1
	b.ne	Lupdate_tail_copy
	str	x21, [x19, #PENDING_LENGTH_OFFSET]

Lupdate_done:
	ldp	d14, d15, [sp, #96]
	ldp	d12, d13, [sp, #80]
	ldp	d10, d11, [sp, #64]
	ldp	d8, d9, [sp, #48]
	ldp	x21, x22, [sp, #32]
	ldp	x19, x20, [sp, #16]
	ldp	x29, x30, [sp], #112
Lupdate_empty:
	ret

.p2align 2
.globl _sha3_256_digest
_sha3_256_digest:
	stp	x29, x30, [sp, #-96]!
	mov	x29, sp
	stp	x19, x20, [sp, #16]
	stp	d8, d9, [sp, #32]
	stp	d10, d11, [sp, #48]
	stp	d12, d13, [sp, #64]
	stp	d14, d15, [sp, #80]
	mov	x19, x0
	mov	x20, x1

	add	x1, x19, #PENDING_OFFSET
	ldr	x3, [x19, #PENDING_LENGTH_OFFSET]
	add	x4, x1, x3
	mov	x5, #RATE_BYTES
	sub	x5, x5, x3
Ldigest_zero_padding:
	strb	wzr, [x4], #1
	subs	x5, x5, #1
	b.ne	Ldigest_zero_padding
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

	ldp	d14, d15, [sp, #80]
	ldp	d12, d13, [sp, #64]
	ldp	d10, d11, [sp, #48]
	ldp	d8, d9, [sp, #32]
	ldp	x19, x20, [sp, #16]
	ldp	x29, x30, [sp], #96
	ret

/*
 * Internal: absorb a positive multiple of 136 bytes.
 * x0 = context/state, x1 = input, x2 = byte length.
 * All SIMD registers and caller-saved integer registers are scratch.
 */
.p2align 4
Labsorb_blocks:
	ldr	d0, [x0, #0]
	ldr	d1, [x0, #8]
	ldr	d2, [x0, #16]
	ldr	d3, [x0, #24]
	ldr	d4, [x0, #32]
	ldr	d5, [x0, #40]
	ldr	d6, [x0, #48]
	ldr	d7, [x0, #56]
	ldr	d8, [x0, #64]
	ldr	d9, [x0, #72]
	ldr	d10, [x0, #80]
	ldr	d11, [x0, #88]
	ldr	d12, [x0, #96]
	ldr	d13, [x0, #104]
	ldr	d14, [x0, #112]
	ldr	d15, [x0, #120]
	ldr	d16, [x0, #128]
	ldr	d17, [x0, #136]
	ldr	d18, [x0, #144]
	ldr	d19, [x0, #152]
	ldr	d20, [x0, #160]
	ldr	d21, [x0, #168]
	ldr	d22, [x0, #176]
	ldr	d23, [x0, #184]
	ldr	d24, [x0, #192]
	movi	v31.2d, #0

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

	str	d0, [x0, #0]
	str	d1, [x0, #8]
	str	d2, [x0, #16]
	str	d3, [x0, #24]
	str	d4, [x0, #32]
	str	d5, [x0, #40]
	str	d6, [x0, #48]
	str	d7, [x0, #56]
	str	d8, [x0, #64]
	str	d9, [x0, #72]
	str	d10, [x0, #80]
	str	d11, [x0, #88]
	str	d12, [x0, #96]
	str	d13, [x0, #104]
	str	d14, [x0, #112]
	str	d15, [x0, #120]
	str	d16, [x0, #128]
	str	d17, [x0, #136]
	str	d18, [x0, #144]
	str	d19, [x0, #152]
	str	d20, [x0, #160]
	str	d21, [x0, #168]
	str	d22, [x0, #176]
	str	d23, [x0, #184]
	str	d24, [x0, #192]
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
