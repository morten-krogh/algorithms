.equ CLI_INPUT_BYTES, 65536
.equ CONTEXT_BYTES, 344
.equ DIGEST_BYTES, 32

.equ SYS_READ, 0
.equ SYS_WRITE, 1
.equ SYS_EXIT, 60
.equ EINTR, 4

/*
 * The kernel returns -errno directly in %rax and clobbers only %rcx and
 * %r11, so %rdi/%rsi/%rdx survive each syscall. %rsp is 16-byte aligned at
 * _start and nothing is pushed, so every call site stays aligned.
 */
.text
.p2align 4
.globl _start
_start:
	cmpq	$1, (%rsp)
	jne	.Lmain_usage

	lea	cli_context(%rip), %rdi
	call	sha3_256_init

.Lmain_read:
	mov	$SYS_READ, %eax
	xor	%edi, %edi
	lea	cli_input(%rip), %rsi
	mov	$CLI_INPUT_BYTES, %edx
	syscall
	test	%rax, %rax
	jg	.Lmain_update
	jz	.Lmain_digest
	cmp	$-EINTR, %rax
	je	.Lmain_read
	jmp	.Lmain_read_error

.Lmain_update:
	mov	%rax, %rdx
	lea	cli_context(%rip), %rdi
	lea	cli_input(%rip), %rsi
	call	sha3_256_update
	jmp	.Lmain_read

.Lmain_digest:
	lea	cli_context(%rip), %rdi
	lea	cli_digest(%rip), %rsi
	call	sha3_256_digest

	lea	hex_digits(%rip), %r8
	lea	cli_digest(%rip), %rsi
	lea	cli_hex(%rip), %rdi
	mov	$DIGEST_BYTES, %ecx
.Lmain_hex_loop:
	movzbl	(%rsi), %eax
	mov	%eax, %edx
	shr	$4, %eax
	and	$0x0f, %edx
	movzbl	(%r8,%rax), %eax
	movzbl	(%r8,%rdx), %edx
	movb	%al, (%rdi)
	movb	%dl, 1(%rdi)
	inc	%rsi
	add	$2, %rdi
	dec	%ecx
	jnz	.Lmain_hex_loop
	movb	$10, (%rdi)

	mov	$1, %edi
	lea	cli_hex(%rip), %rsi
	mov	$(DIGEST_BYTES * 2 + 1), %edx
	call	write_all
	test	%eax, %eax
	jnz	.Lmain_write_error
	xor	%edi, %edi
	jmp	.Lmain_exit

.Lmain_usage:
	mov	$2, %edi
	lea	usage(%rip), %rsi
	mov	$USAGE_LENGTH, %edx
	call	write_all
	mov	$1, %edi
	jmp	.Lmain_exit

.Lmain_read_error:
	mov	$2, %edi
	lea	read_error(%rip), %rsi
	mov	$READ_ERROR_LENGTH, %edx
	call	write_all
	mov	$1, %edi
	jmp	.Lmain_exit

.Lmain_write_error:
	mov	$SYS_WRITE, %eax          /* Best effort: stdout already failed. */
	mov	$2, %edi
	lea	write_error(%rip), %rsi
	mov	$WRITE_ERROR_LENGTH, %edx
	syscall
	mov	$1, %edi

.Lmain_exit:
	mov	$SYS_EXIT, %eax
	syscall

/*
 * Write exactly %rdx bytes from %rsi to fd %rdi.
 * Returns zero in %eax on success and one on failure.
 */
.p2align 4
write_all:
.Lwrite_all_loop:
	test	%rdx, %rdx
	jz	.Lwrite_all_success
	mov	$SYS_WRITE, %eax
	syscall
	test	%rax, %rax
	jg	.Lwrite_all_progress
	jz	.Lwrite_all_failure
	cmp	$-EINTR, %rax
	je	.Lwrite_all_loop
	jmp	.Lwrite_all_failure
.Lwrite_all_progress:
	add	%rax, %rsi
	sub	%rax, %rdx
	jmp	.Lwrite_all_loop
.Lwrite_all_success:
	xor	%eax, %eax
	ret
.Lwrite_all_failure:
	mov	$1, %eax
	ret

.section .rodata
hex_digits:
	.ascii "0123456789abcdef"
usage:
	.ascii "Usage: sha3-256 < input\n"
.equ USAGE_LENGTH, . - usage
read_error:
	.ascii "sha3-256: failed to read stdin\n"
.equ READ_ERROR_LENGTH, . - read_error
write_error:
	.ascii "sha3-256: failed to write digest\n"
.equ WRITE_ERROR_LENGTH, . - write_error

.bss
.p2align 3
cli_context:
	.skip CONTEXT_BYTES
.p2align 4
cli_input:
	.skip CLI_INPUT_BYTES
cli_digest:
	.skip DIGEST_BYTES
cli_hex:
	.skip DIGEST_BYTES * 2 + 1

.section .note.GNU-stack,"",@progbits
