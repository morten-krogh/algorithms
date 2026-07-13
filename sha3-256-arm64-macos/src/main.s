.arch armv8.2-a+sha3

.equ CLI_INPUT_BYTES, 65536

.text
.p2align 2
.globl _main
_main:
	stp	x29, x30, [sp, #-48]!
	mov	x29, sp
	stp	x19, x20, [sp, #16]
	stp	x21, x22, [sp, #32]

	cmp	w0, #1
	b.ne	Lmain_usage

	adrp	x19, Lcli_context@PAGE
	add	x19, x19, Lcli_context@PAGEOFF
	adrp	x20, Lcli_input@PAGE
	add	x20, x20, Lcli_input@PAGEOFF
	adrp	x21, Lcli_digest@PAGE
	add	x21, x21, Lcli_digest@PAGEOFF
	adrp	x22, Lcli_hex@PAGE
	add	x22, x22, Lcli_hex@PAGEOFF
	mov	x0, x19
	bl	_sha3_256_init

Lmain_read:
	mov	x0, #0
	mov	x1, x20
	mov	x2, #CLI_INPUT_BYTES
	bl	_read
	cmp	x0, #0
	b.gt	Lmain_update
	b.eq	Lmain_digest
	bl	___error
	ldr	w0, [x0]
	cmp	w0, #4                 /* EINTR */
	b.eq	Lmain_read
	b	Lmain_read_error

Lmain_update:
	mov	x2, x0
	mov	x0, x19
	mov	x1, x20
	bl	_sha3_256_update
	b	Lmain_read

Lmain_digest:
	mov	x0, x19
	mov	x1, x21
	bl	_sha3_256_digest

	adrp	x4, Lhex_digits@PAGE
	add	x4, x4, Lhex_digits@PAGEOFF
	mov	x1, x21
	mov	x2, x22
	mov	w3, #32
Lmain_hex_loop:
	ldrb	w5, [x1], #1
	lsr	w6, w5, #4
	and	w5, w5, #0x0f
	ldrb	w6, [x4, w6, uxtw]
	ldrb	w5, [x4, w5, uxtw]
	strb	w6, [x2], #1
	strb	w5, [x2], #1
	subs	w3, w3, #1
	b.ne	Lmain_hex_loop
	mov	w3, #10
	strb	w3, [x2]

	mov	x0, #1
	mov	x1, x22
	mov	x2, #65
	bl	Lwrite_all
	cbnz	w0, Lmain_write_error
	mov	w0, #0
	b	Lmain_return

Lmain_usage:
	mov	x0, #2
	adrp	x1, Lusage@PAGE
	add	x1, x1, Lusage@PAGEOFF
	mov	x2, #Lusage_length
	bl	Lwrite_all
	mov	w0, #1
	b	Lmain_return

Lmain_read_error:
	mov	x0, #2
	adrp	x1, Lread_error@PAGE
	add	x1, x1, Lread_error@PAGEOFF
	mov	x2, #Lread_error_length
	bl	Lwrite_all
	mov	w0, #1
	b	Lmain_return

Lmain_write_error:
	mov	x0, #2
	adrp	x1, Lwrite_error@PAGE
	add	x1, x1, Lwrite_error@PAGEOFF
	mov	x2, #Lwrite_error_length
	bl	_write                    /* Best effort: stdout already failed. */
	mov	w0, #1

Lmain_return:
	ldp	x21, x22, [sp, #32]
	ldp	x19, x20, [sp, #16]
	ldp	x29, x30, [sp], #48
	ret

/* Write exactly x2 bytes. Returns zero on success and one on failure. */
.p2align 2
Lwrite_all:
	stp	x29, x30, [sp, #-48]!
	mov	x29, sp
	stp	x19, x20, [sp, #16]
	str	x21, [sp, #32]
	mov	x19, x0
	mov	x20, x1
	mov	x21, x2
Lwrite_all_loop:
	cbz	x21, Lwrite_all_success
	mov	x0, x19
	mov	x1, x20
	mov	x2, x21
	bl	_write
	cmp	x0, #0
	b.gt	Lwrite_all_progress
	b.eq	Lwrite_all_failure
	bl	___error
	ldr	w0, [x0]
	cmp	w0, #4                 /* EINTR */
	b.eq	Lwrite_all_loop
	b	Lwrite_all_failure
Lwrite_all_progress:
	add	x20, x20, x0
	sub	x21, x21, x0
	b	Lwrite_all_loop
Lwrite_all_success:
	mov	w0, #0
	b	Lwrite_all_return
Lwrite_all_failure:
	mov	w0, #1
Lwrite_all_return:
	ldr	x21, [sp, #32]
	ldp	x19, x20, [sp, #16]
	ldp	x29, x30, [sp], #48
	ret

.section __TEXT,__const
Lhex_digits:
	.ascii "0123456789abcdef"
Lusage:
	.ascii "Usage: sha3-256 < input\n"
Lusage_end:
.equ Lusage_length, Lusage_end - Lusage
Lread_error:
	.ascii "sha3-256: failed to read stdin\n"
Lread_error_end:
.equ Lread_error_length, Lread_error_end - Lread_error
Lwrite_error:
	.ascii "sha3-256: failed to write digest\n"
Lwrite_error_end:
.equ Lwrite_error_length, Lwrite_error_end - Lwrite_error

.zerofill __DATA,__bss,Lcli_context,344,3
.zerofill __DATA,__bss,Lcli_input,CLI_INPUT_BYTES,4
.zerofill __DATA,__bss,Lcli_digest,32,4
.zerofill __DATA,__bss,Lcli_hex,65,4
