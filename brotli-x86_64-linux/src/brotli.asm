; RFC 7932 Brotli for x86-64 Linux.
; Handwritten ABI, allocator boundary, CPU gate and AVX-512 runtime support
; around an assembly translation of Google Brotli 1.2.0.

bits 64
default rel

%define WRAP_CORE       0
%define WRAP_ALLOC      8
%define WRAP_FREE       16
%define WRAP_OPAQUE     24
%define WRAP_ERROR      32
%define WRAP_KIND       36
%define WRAP_OPTIONS    40
%define WRAP_SIZE       128

%define OPT_QUALITY     0
%define OPT_LGWIN       4
%define OPT_MODE        8
%define OPT_LGBLOCK     12
%define OPT_SIZE_HINT   16
%define OPT_FLAGS       24

; BrotliEncoderParameter values from Google Brotli 1.2.0.
%define PARAM_MODE      0
%define PARAM_QUALITY   1
%define PARAM_LGWIN     2
%define PARAM_LGBLOCK   3
%define PARAM_SIZE_HINT 5

%define ASM_ERROR       0
%define ASM_NEEDS_INPUT 1
%define ASM_NEEDS_OUTPUT 2
%define ASM_FLUSHED     3
%define ASM_FINISHED    4

%define ERR_BAD_ARGUMENT -1
%define ERR_UNSUPPORTED_CPU -2
%define ERR_ALLOCATION -3
%define ERR_CODEC -4
%define ERR_OPTION -5

section .text align=64

global brotli_asm_version:function
global brotli_asm_cpu_supported:function
global brotli_asm_encoder_create:function
global brotli_asm_encoder_process:function
global brotli_asm_encoder_reset:function
global brotli_asm_encoder_last_error:function
global brotli_asm_encoder_destroy:function
global brotli_asm_decoder_create:function
global brotli_asm_decoder_process:function
global brotli_asm_decoder_reset:function
global brotli_asm_decoder_last_error:function
global brotli_asm_decoder_destroy:function

brotli_asm_version:
        mov     eax, 00010000H
        ret

; Requires AVX-512F/BW/DQ/VL/CD, AVX2, BMI1/2, LZCNT and POPCNT, with the
; complete ZMM/opmask state enabled by the operating system.
brotli_asm_cpu_supported:
        push    rbx
        mov     eax, 1
        cpuid
        mov     eax, ecx
        and     eax, (1 << 23) | (1 << 27) | (1 << 28)
        cmp     eax, (1 << 23) | (1 << 27) | (1 << 28)
        jne     .unsupported
        xor     ecx, ecx
        xgetbv
        and     eax, 0E6H
        cmp     eax, 0E6H
        jne     .unsupported
        mov     eax, 7
        xor     ecx, ecx
        cpuid
        mov     eax, ebx
        mov     edx, (1 << 3) | (1 << 5) | (1 << 8) | (1 << 16)
        or      edx, (1 << 17) | (1 << 28) | (1 << 30) | (1 << 31)
        and     eax, edx
        cmp     eax, edx
        jne     .unsupported
        mov     eax, 80000000H
        cpuid
        cmp     eax, 80000001H
        jb      .unsupported
        mov     eax, 80000001H
        cpuid
        bt      ecx, 5
        jnc     .unsupported
        mov     eax, 1
        pop     rbx
        ret
.unsupported:
        xor     eax, eax
        pop     rbx
        ret

; Long-prefix continuation used by the encoder hash chains. Callers have
; already proved the first 16 bytes equal, so 64-byte comparisons are
; profitable here without bloating their immediate-mismatch paths.
; rdi=s1, rsi=s2, rdx=limit; returns the equal prefix length in rax.
BrotliFindMatchLengthAVX512:
        xor     eax, eax
.chunks:
        cmp     rdx, 64
        jb      .words
        vmovdqu8 zmm0, [rdi]
        vpcmpeqb k1, zmm0, [rsi]
        kmovq   rcx, k1
        cmp     rcx, -1
        jne     .chunk_mismatch
        add     rdi, 64
        add     rsi, 64
        add     rax, 64
        sub     rdx, 64
        jmp     .chunks
.chunk_mismatch:
        not     rcx
        tzcnt   rcx, rcx
        add     rax, rcx
        vzeroupper
        ret
.words:
        cmp     rdx, 8
        jb      .bytes
        mov     rcx, [rdi]
        xor     rcx, [rsi]
        jnz     .word_mismatch
        add     rdi, 8
        add     rsi, 8
        add     rax, 8
        sub     rdx, 8
        jmp     .words
.word_mismatch:
        tzcnt   rcx, rcx
        shr     rcx, 3
        add     rax, rcx
        vzeroupper
        ret
.bytes:
        test    rdx, rdx
        jz      .done
.byte_loop:
        movzx   ecx, byte [rdi]
        cmp     cl, [rsi]
        jne     .done
        inc     rdi
        inc     rsi
        inc     rax
        dec     rdx
        jnz     .byte_loop
.done:
        vzeroupper
        ret

; Internal freestanding runtime.  The codec is always given explicit
; allocator callbacks, so the default allocation entry points fail closed.
%ifdef BROTLI_EXTERNAL_RUNTIME
extern malloc
extern calloc
extern free
extern exit
extern memcpy
extern memmove
extern memset
extern log2
%else
malloc:
calloc:
        xor     eax, eax
        ret

free:
        ret

exit:
        ud2

memcpy:
        mov     rax, rdi
        cmp     rdx, 2048
        jae     .erms
        cmp     rdx, 16
        ja      .over16
        cmp     edx, 8
        jae     .copy8
        cmp     edx, 4
        jae     .copy4
        cmp     edx, 2
        jae     .copy2
        test    edx, edx
        jz      .done_scalar
        mov     cl, [rsi]
        mov     [rdi], cl
.done_scalar:
        ret
.copy2:
        mov     cx, [rsi]
        mov     r8w, [rsi+rdx-2]
        mov     [rdi], cx
        mov     [rdi+rdx-2], r8w
        ret
.copy4:
        mov     ecx, [rsi]
        mov     r8d, [rsi+rdx-4]
        mov     [rdi], ecx
        mov     [rdi+rdx-4], r8d
        ret
.copy8:
        mov     rcx, [rsi]
        mov     r8, [rsi+rdx-8]
        mov     [rdi], rcx
        mov     [rdi+rdx-8], r8
        ret
.over16:
        cmp     rdx, 32
        ja      .over32
        movdqu  xmm0, [rsi]
        movdqu  xmm1, [rsi+rdx-16]
        movdqu  [rdi], xmm0
        movdqu  [rdi+rdx-16], xmm1
        ret
.over32:
        cmp     rdx, 64
        ja      .over64
        vmovdqu ymm0, [rsi]
        vmovdqu ymm1, [rsi+rdx-32]
        vmovdqu [rdi], ymm0
        vmovdqu [rdi+rdx-32], ymm1
        vzeroupper
        ret
.over64:
        cmp     rdx, 256
        jb      .chunks
.loop256:
        vmovdqu64 zmm0, [rsi]
        vmovdqu64 zmm1, [rsi+64]
        vmovdqu64 zmm2, [rsi+128]
        vmovdqu64 zmm3, [rsi+192]
        vmovdqu64 [rdi], zmm0
        vmovdqu64 [rdi+64], zmm1
        vmovdqu64 [rdi+128], zmm2
        vmovdqu64 [rdi+192], zmm3
        add     rsi, 256
        add     rdi, 256
        sub     rdx, 256
        cmp     rdx, 256
        jae     .loop256
.chunks:
        cmp     rdx, 64
        jb      .tail
.loop64:
        vmovdqu64 zmm0, [rsi]
        vmovdqu64 [rdi], zmm0
        add     rsi, 64
        add     rdi, 64
        sub     rdx, 64
        cmp     rdx, 64
        jae     .loop64
.tail:
        test    edx, edx
        jz      .done
        mov     rcx, -1
        bzhi    rcx, rcx, rdx
        kmovq   k1, rcx
        vmovdqu8 zmm0{k1}{z}, [rsi]
        vmovdqu8 [rdi]{k1}, zmm0
.done:
        vzeroupper
        ret
.erms:
        mov     rcx, rdx
        rep movsb
        ret

memmove:
        mov     rax, rdi
        cmp     rdi, rsi
        jbe     memcpy
        lea     rcx, [rsi+rdx]
        cmp     rdi, rcx
        jae     memcpy
        cmp     rdx, 64
        jb      .tail
.backward:
        sub     rdx, 64
        vmovdqu64 zmm0, [rsi+rdx]
        vmovdqu64 [rdi+rdx], zmm0
        cmp     rdx, 64
        jae     .backward
.tail:
        test    edx, edx
        jz      .done
        mov     rcx, -1
        bzhi    rcx, rcx, rdx
        kmovq   k1, rcx
        vmovdqu8 zmm0{k1}{z}, [rsi]
        vmovdqu8 [rdi]{k1}, zmm0
.done:
        vzeroupper
        ret

memset:
        mov     r8, rdi
        cmp     rdx, 2048
        jae     .erms
        movzx   eax, sil
        mov     rcx, 0101010101010101H
        imul    rax, rcx
        cmp     rdx, 16
        ja      .over16
        cmp     edx, 8
        jae     .fill8
        cmp     edx, 4
        jae     .fill4
        cmp     edx, 2
        jae     .fill2
        test    edx, edx
        jz      .done_scalar
        mov     [rdi], al
.done_scalar:
        mov     rax, r8
        ret
.fill2:
        mov     [rdi], ax
        mov     [rdi+rdx-2], ax
        mov     rax, r8
        ret
.fill4:
        mov     [rdi], eax
        mov     [rdi+rdx-4], eax
        mov     rax, r8
        ret
.fill8:
        mov     [rdi], rax
        mov     [rdi+rdx-8], rax
        mov     rax, r8
        ret
.over16:
        vmovq   xmm0, rax
        vpbroadcastq xmm0, xmm0
        cmp     rdx, 32
        ja      .over32
        vmovdqu [rdi], xmm0
        vmovdqu [rdi+rdx-16], xmm0
        mov     rax, r8
        ret
.over32:
        vinserti128 ymm0, ymm0, xmm0, 1
        cmp     rdx, 64
        ja      .over64
        vmovdqu [rdi], ymm0
        vmovdqu [rdi+rdx-32], ymm0
        vzeroupper
        mov     rax, r8
        ret
.over64:
        vinserti64x4 zmm0, zmm0, ymm0, 1
        cmp     rdx, 256
        jb      .chunks
.loop256:
        vmovdqu64 [rdi], zmm0
        vmovdqu64 [rdi+64], zmm0
        vmovdqu64 [rdi+128], zmm0
        vmovdqu64 [rdi+192], zmm0
        add     rdi, 256
        sub     rdx, 256
        cmp     rdx, 256
        jae     .loop256
.chunks:
        cmp     rdx, 64
        jb      .tail
.loop64:
        vmovdqu64 [rdi], zmm0
        add     rdi, 64
        sub     rdx, 64
        cmp     rdx, 64
        jae     .loop64
.tail:
        test    edx, edx
        jz      .done
        mov     rcx, -1
        bzhi    rcx, rcx, rdx
        kmovq   k1, rcx
        vmovdqu8 [rdi]{k1}, zmm0
.done:
        vzeroupper
        mov     rax, r8
        ret
.erms:
        mov     eax, esi
        mov     rcx, rdx
        rep stosb
        mov     rax, r8
        ret

log2:
        ; Encoder cost models only call this with positive, exactly
        ; representable integers. Reduce x = 2**e * m, m in [1, 2), and
        ; evaluate log2(m) through the rapidly converging atanh series:
        ;   2/ln(2) * (y + y^3/3 + ...), y = (m - 1) / (m + 1).
        ; Seven FMA terms bound the approximation error below 1.5e-9 while
        ; avoiding the high-latency x87 FYL2X instruction.
        vgetexpsd xmm1, xmm0, xmm0
        vgetmantsd xmm2, xmm0, xmm0, 0
        vmovsd  xmm3, [rel brotli_log2_one]
        vsubsd  xmm4, xmm2, xmm3
        vaddsd  xmm2, xmm2, xmm3
        vdivsd  xmm4, xmm4, xmm2
        vmulsd  xmm3, xmm4, xmm4
        vmovsd  xmm2, [rel brotli_log2_c15]
        vfmadd213sd xmm2, xmm3, [rel brotli_log2_c13]
        vfmadd213sd xmm2, xmm3, [rel brotli_log2_c11]
        vfmadd213sd xmm2, xmm3, [rel brotli_log2_c9]
        vfmadd213sd xmm2, xmm3, [rel brotli_log2_c7]
        vfmadd213sd xmm2, xmm3, [rel brotli_log2_c5]
        vfmadd213sd xmm2, xmm3, [rel brotli_log2_c3]
        vfmadd213sd xmm2, xmm3, [rel brotli_log2_one]
        vmulsd  xmm2, xmm2, xmm4
        vmovsd  xmm5, [rel brotli_log2_two_over_ln2]
        vfmadd213sd xmm2, xmm5, xmm1
        vmovapd xmm0, xmm2
        ret

section .rodata align=64
brotli_log2_one:          dq 03FF0000000000000H
brotli_log2_two_over_ln2: dq 040071547652B82FEH
brotli_log2_c3:           dq 03FD5555555555555H
brotli_log2_c5:           dq 03FC999999999999AH
brotli_log2_c7:           dq 03FC2492492492492H
brotli_log2_c9:           dq 03FBC71C71C71C71CH
brotli_log2_c11:          dq 03FB745D1745D1746H
brotli_log2_c13:          dq 03FB3B13B13B13B14H
brotli_log2_c15:          dq 03FB1111111111111H
section .text align=64
%endif

; Fast path for the q10/q11 UTF-8 heuristic. Pure nonzero ASCII is the common
; text case; prove it 64 bytes at a time, then retain upstream's scalar parser
; for wrapping input, NULs, high bytes, and genuine multibyte UTF-8.
; rdi=data, rsi=pos, rdx=mask, rcx=length, xmm0=min_fraction.
BrotliIsMostlyUTF8:
        cmp     rcx, 64
        jb      .scalar
        mov     r8, rsi
        and     r8, rdx
        lea     r9, [rdx+1]
        mov     r10, r8
        add     r10, rcx
        jc      .scalar
        cmp     r10, r9
        ja      .scalar
        lea     r11, [rdi+r8]
        mov     rax, rcx
        vpxord  zmm31, zmm31, zmm31
.chunks:
        cmp     rax, 64
        jb      .tail
        vmovdqu8 zmm30, [r11]
        vpcmpb  k1, zmm30, zmm31, 6
        kmovq   r10, k1
        cmp     r10, -1
        jne     .scalar_vector
        add     r11, 64
        sub     rax, 64
        jmp     .chunks
.tail:
        test    rax, rax
        jz      .ascii
.tail_loop:
        movzx   r10d, byte [r11]
        test    r10b, r10b
        jz      .scalar_vector
        test    r10b, 80H
        jnz     .scalar_vector
        inc     r11
        dec     rax
        jnz     .tail_loop
.ascii:
        vcvtsi2sd xmm1, xmm1, rcx
        vmulsd  xmm0, xmm0, xmm1
        vcomisd xmm1, xmm0
        seta    al
        movzx   eax, al
        vzeroupper
        ret
.scalar_vector:
        vzeroupper
.scalar:
        jmp     BrotliIsMostlyUTF8Scalar

; rdi = wrapper. Returns eax=1 and stores a new encoder core, or eax=0.
encoder_init_core:
        push    rbx
        mov     rbx, rdi
        sub     rsp, 16
        mov     rdi, [rbx+WRAP_ALLOC]
        mov     rsi, [rbx+WRAP_FREE]
        mov     rdx, [rbx+WRAP_OPAQUE]
        call    BrotliEncoderCreateInstance
        test    rax, rax
        jz      .failed
        mov     [rbx+WRAP_CORE], rax

        mov     rdi, rax
        mov     esi, PARAM_QUALITY
        mov     edx, [rbx+WRAP_OPTIONS+OPT_QUALITY]
        call    BrotliEncoderSetParameter
        test    eax, eax
        jz      .option_failed
        mov     rdi, [rbx+WRAP_CORE]
        mov     esi, PARAM_MODE
        mov     edx, [rbx+WRAP_OPTIONS+OPT_MODE]
        call    BrotliEncoderSetParameter
        test    eax, eax
        jz      .option_failed
        mov     rdi, [rbx+WRAP_CORE]
        mov     esi, PARAM_LGWIN
        mov     edx, [rbx+WRAP_OPTIONS+OPT_LGWIN]
        call    BrotliEncoderSetParameter
        test    eax, eax
        jz      .option_failed
        mov     rdi, [rbx+WRAP_CORE]
        mov     esi, PARAM_SIZE_HINT
        mov     edx, [rbx+WRAP_OPTIONS+OPT_SIZE_HINT]
        call    BrotliEncoderSetParameter
        test    eax, eax
        jz      .option_failed
        mov     edx, [rbx+WRAP_OPTIONS+OPT_LGBLOCK]
        test    edx, edx
        jz      .success
        mov     rdi, [rbx+WRAP_CORE]
        mov     esi, PARAM_LGBLOCK
        call    BrotliEncoderSetParameter
        test    eax, eax
        jz      .option_failed
.success:
        mov     dword [rbx+WRAP_ERROR], 0
        mov     eax, 1
        add     rsp, 16
        pop     rbx
        ret
.option_failed:
        mov     dword [rbx+WRAP_ERROR], ERR_OPTION
        mov     rdi, [rbx+WRAP_CORE]
        call    BrotliEncoderDestroyInstance
        mov     qword [rbx+WRAP_CORE], 0
.failed:
        xor     eax, eax
        add     rsp, 16
        pop     rbx
        ret

; rdi = wrapper. Returns eax=1 and stores a new decoder core, or eax=0.
decoder_init_core:
        push    rbx
        mov     rbx, rdi
        sub     rsp, 16
        mov     rdi, [rbx+WRAP_ALLOC]
        mov     rsi, [rbx+WRAP_FREE]
        mov     rdx, [rbx+WRAP_OPAQUE]
        call    BrotliDecoderCreateInstance
        test    rax, rax
        jz      .failed
        mov     [rbx+WRAP_CORE], rax
        mov     edx, [rbx+WRAP_OPTIONS+OPT_FLAGS]
        and     edx, 1
        jz      .success
        mov     rdi, rax
        xor     esi, esi
        call    BrotliDecoderSetParameter
        test    eax, eax
        jz      .option_failed
.success:
        mov     dword [rbx+WRAP_ERROR], 0
        mov     eax, 1
        add     rsp, 16
        pop     rbx
        ret
.option_failed:
        mov     dword [rbx+WRAP_ERROR], ERR_OPTION
        mov     rdi, [rbx+WRAP_CORE]
        call    BrotliDecoderDestroyInstance
        mov     qword [rbx+WRAP_CORE], 0
.failed:
        xor     eax, eax
        add     rsp, 16
        pop     rbx
        ret

; Shared create prologue.
; r12=options, r13=alloc, r14=free, r15=opaque, rbx=error, eax=kind.
create_wrapper:
        sub     rsp, 8
        mov     [rsp], eax
        test    rbx, rbx
        jz      .no_error_store
        mov     dword [rbx], 0
.no_error_store:
        test    r13, r13
        jz      .bad_argument
        test    r14, r14
        jz      .bad_argument
        call    brotli_asm_cpu_supported
        mov     edx, eax
        test    edx, edx
        jz      .unsupported
        mov     rdi, r15
        mov     esi, WRAP_SIZE
        call    r13
        test    rax, rax
        jz      .allocation
        push    rax
        sub     rsp, 8
        mov     rdi, rax
        xor     esi, esi
        mov     edx, WRAP_SIZE
        call    memset
        add     rsp, 8
        pop     rax
        mov     [rax+WRAP_ALLOC], r13
        mov     [rax+WRAP_FREE], r14
        mov     [rax+WRAP_OPAQUE], r15
        mov     edx, [rsp]
        mov     [rax+WRAP_KIND], edx
        test    r12, r12
        jz      .defaults
        vmovdqu ymm0, [r12]
        vmovdqu [rax+WRAP_OPTIONS], ymm0
        vzeroupper
        add     rsp, 8
        ret
.defaults:
        mov     dword [rax+WRAP_OPTIONS+OPT_QUALITY], 11
        mov     dword [rax+WRAP_OPTIONS+OPT_LGWIN], 22
        mov     dword [rax+WRAP_OPTIONS+OPT_MODE], 0
        add     rsp, 8
        ret
.bad_argument:
        mov     edx, ERR_BAD_ARGUMENT
        jmp     .store_failure
.unsupported:
        mov     edx, ERR_UNSUPPORTED_CPU
        jmp     .store_failure
.allocation:
        mov     edx, ERR_ALLOCATION
.store_failure:
        test    rbx, rbx
        jz      .return_null
        mov     [rbx], edx
.return_null:
        xor     eax, eax
        add     rsp, 8
        ret

brotli_asm_encoder_create:
        push    rbp
        mov     rbp, rsp
        push    rbx
        push    r12
        push    r13
        push    r14
        push    r15
        sub     rsp, 24
        mov     r12, rdi
        mov     r13, rsi
        mov     r14, rdx
        mov     r15, rcx
        mov     rbx, r8
        test    r12, r12
        jz      .options_valid
        cmp     dword [r12+OPT_QUALITY], 11
        ja      .invalid_option
        cmp     dword [r12+OPT_MODE], 2
        ja      .invalid_option
.options_valid:
        mov     eax, 1
        call    create_wrapper
        test    rax, rax
        jz      .done
        mov     r12, rax
        mov     rdi, rax
        call    encoder_init_core
        test    eax, eax
        jnz     .success
        mov     edx, [r12+WRAP_ERROR]
        test    edx, edx
        jnz     .have_error
        mov     edx, ERR_ALLOCATION
.have_error:
        test    rbx, rbx
        jz      .release
        mov     [rbx], edx
.release:
        mov     rdi, [r12+WRAP_OPAQUE]
        mov     rsi, r12
        call    qword [r12+WRAP_FREE]
        xor     eax, eax
        jmp     .done
.success:
        mov     rax, r12
        jmp     .done
.invalid_option:
        test    rbx, rbx
        jz      .invalid_no_store
        mov     dword [rbx], ERR_OPTION
.invalid_no_store:
        xor     eax, eax
.done:
        lea     rsp, [rbp-40]
        pop     r15
        pop     r14
        pop     r13
        pop     r12
        pop     rbx
        pop     rbp
        ret

brotli_asm_decoder_create:
        push    rbp
        mov     rbp, rsp
        push    rbx
        push    r12
        push    r13
        push    r14
        push    r15
        sub     rsp, 24
        mov     r12, rdi
        mov     r13, rsi
        mov     r14, rdx
        mov     r15, rcx
        mov     rbx, r8
        mov     eax, 2
        call    create_wrapper
        test    rax, rax
        jz      .done
        mov     r12, rax
        mov     rdi, rax
        call    decoder_init_core
        test    eax, eax
        jnz     .success
        mov     edx, [r12+WRAP_ERROR]
        test    edx, edx
        jnz     .have_error
        mov     edx, ERR_ALLOCATION
.have_error:
        test    rbx, rbx
        jz      .release
        mov     [rbx], edx
.release:
        mov     rdi, [r12+WRAP_OPAQUE]
        mov     rsi, r12
        call    qword [r12+WRAP_FREE]
        xor     eax, eax
        jmp     .done
.success:
        mov     rax, r12
.done:
        lea     rsp, [rbp-40]
        pop     r15
        pop     r14
        pop     r13
        pop     r12
        pop     rbx
        pop     rbp
        ret

brotli_asm_encoder_process:
        test    rdi, rdi
        jz      .bad
        cmp     esi, 2
        ja      .bad_state
        test    rdx, rdx
        jz      .bad_state
        test    rcx, rcx
        jz      .bad_state
        test    r8, r8
        jz      .bad_state
        test    r9, r9
        jz      .bad_state
        push    rbx
        push    r12
        push    r13
        push    r14
        push    r15
        sub     rsp, 16
        mov     rbx, rdi
        mov     r12d, esi
        mov     r13, rdx
        mov     r14, rcx
        mov     r15, r8
        mov     [rsp+8], r9
        mov     rdi, [rbx+WRAP_CORE]
        mov     esi, r12d
        mov     rdx, r14
        mov     rcx, r13
        mov     r8, [rsp+8]
        mov     r9, r15
        mov     qword [rsp], 0
        call    BrotliEncoderCompressStream
        test    eax, eax
        jz      .codec_error
        mov     rdi, [rbx+WRAP_CORE]
        call    BrotliEncoderIsFinished
        test    eax, eax
        jnz     .finished
        cmp     r12d, 1
        jne     .flow
        mov     rdi, [rbx+WRAP_CORE]
        call    BrotliEncoderHasMoreOutput
        test    eax, eax
        jnz     .flow
        cmp     qword [r14], 0
        je      .flushed
.flow:
        mov     rax, [rsp+8]
        cmp     qword [rax], 0
        je      .needs_output
        mov     eax, ASM_NEEDS_INPUT
        jmp     .return
.codec_error:
        mov     dword [rbx+WRAP_ERROR], ERR_CODEC
        xor     eax, eax
        jmp     .return
.finished:
        mov     eax, ASM_FINISHED
        jmp     .return
.flushed:
        mov     eax, ASM_FLUSHED
        jmp     .return
.needs_output:
        mov     eax, ASM_NEEDS_OUTPUT
.return:
        add     rsp, 16
        pop     r15
        pop     r14
        pop     r13
        pop     r12
        pop     rbx
        ret
.bad_state:
        mov     dword [rdi+WRAP_ERROR], ERR_BAD_ARGUMENT
.bad:
        xor     eax, eax
        ret

brotli_asm_decoder_process:
        test    rdi, rdi
        jz      .bad
        test    rsi, rsi
        jz      .bad_state
        test    rdx, rdx
        jz      .bad_state
        test    rcx, rcx
        jz      .bad_state
        test    r8, r8
        jz      .bad_state
        push    rbx
        push    r12
        push    r13
        push    r14
        push    r15
        sub     rsp, 16
        mov     rbx, rdi
        mov     r12, rsi
        mov     r13, rdx
        mov     r14, rcx
        mov     r15, r8
        mov     rdi, [rbx+WRAP_CORE]
        mov     rsi, r13
        mov     rdx, r12
        mov     rcx, r15
        mov     r8, r14
        xor     r9d, r9d
        call    BrotliDecoderDecompressStream
        cmp     eax, 1
        je      .finished
        cmp     eax, 2
        je      .needs_input
        cmp     eax, 3
        je      .needs_output
        mov     rdi, [rbx+WRAP_CORE]
        call    BrotliDecoderGetErrorCode
        mov     [rbx+WRAP_ERROR], eax
        xor     eax, eax
        jmp     .return
.finished:
        mov     eax, ASM_FINISHED
        jmp     .return
.needs_input:
        mov     eax, ASM_NEEDS_INPUT
        jmp     .return
.needs_output:
        mov     eax, ASM_NEEDS_OUTPUT
.return:
        add     rsp, 16
        pop     r15
        pop     r14
        pop     r13
        pop     r12
        pop     rbx
        ret
.bad_state:
        mov     dword [rdi+WRAP_ERROR], ERR_BAD_ARGUMENT
.bad:
        xor     eax, eax
        ret

brotli_asm_encoder_reset:
        test    rdi, rdi
        jz      .bad
        push    rbx
        mov     rbx, rdi
        sub     rsp, 16
        mov     rdi, [rbx+WRAP_CORE]
        call    BrotliEncoderDestroyInstance
        mov     qword [rbx+WRAP_CORE], 0
        mov     rdi, rbx
        call    encoder_init_core
        add     rsp, 16
        pop     rbx
        ret
.bad:
        xor     eax, eax
        ret

brotli_asm_decoder_reset:
        test    rdi, rdi
        jz      .bad
        push    rbx
        mov     rbx, rdi
        sub     rsp, 16
        mov     rdi, [rbx+WRAP_CORE]
        call    BrotliDecoderDestroyInstance
        mov     qword [rbx+WRAP_CORE], 0
        mov     rdi, rbx
        call    decoder_init_core
        add     rsp, 16
        pop     rbx
        ret
.bad:
        xor     eax, eax
        ret

brotli_asm_encoder_last_error:
brotli_asm_decoder_last_error:
        test    rdi, rdi
        jz      .bad
        mov     eax, [rdi+WRAP_ERROR]
        ret
.bad:
        mov     eax, ERR_BAD_ARGUMENT
        ret

brotli_asm_encoder_destroy:
        test    rdi, rdi
        jz      .done
        push    rbx
        mov     rbx, rdi
        sub     rsp, 16
        mov     rdi, [rbx+WRAP_CORE]
        test    rdi, rdi
        jz      .release
        call    BrotliEncoderDestroyInstance
.release:
        mov     rdi, [rbx+WRAP_OPAQUE]
        mov     rsi, rbx
        call    qword [rbx+WRAP_FREE]
        add     rsp, 16
        pop     rbx
.done:
        ret

brotli_asm_decoder_destroy:
        test    rdi, rdi
        jz      .done
        push    rbx
        mov     rbx, rdi
        sub     rsp, 16
        mov     rdi, [rbx+WRAP_CORE]
        test    rdi, rdi
        jz      .release
        call    BrotliDecoderDestroyInstance
.release:
        mov     rdi, [rbx+WRAP_OPAQUE]
        mov     rsi, rbx
        call    qword [rbx+WRAP_FREE]
        add     rsp, 16
        pop     rbx
.done:
        ret

%include "brotli_upstream.inc"

section .note.GNU-stack noalloc noexec nowrite progbits
