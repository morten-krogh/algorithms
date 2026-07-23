; Freestanding Linux command-line driver for brotli.asm.

bits 64
default rel

%define SYS_read        0
%define SYS_write       1
%define SYS_close       3
%define SYS_fstat       5
%define SYS_mmap        9
%define SYS_munmap      11
%define SYS_getpid      39
%define SYS_exit        60
%define SYS_unlink      87
%define SYS_fchmod      91
%define SYS_rename      82
%define SYS_openat      257
%define SYS_futimens    280
%define SYS_renameat2   316

%define AT_FDCWD        -100
%define O_RDONLY        0000000H
%define O_WRONLY        0000001H
%define O_CREAT         0000040H
%define O_EXCL          0000080H
%define O_CLOEXEC       0080000H
%define PROT_RW         3
%define MAP_PRIVATE_ANON 022H
%define RENAME_NOREPLACE 1

%define BUFFER_SIZE     1048576
%define PATH_SIZE       4096
%define MAX_INPUTS      512

%define F_DECOMPRESS    0001H
%define F_TEST          0002H
%define F_STDOUT        0004H
%define F_FORCE         0008H
%define F_REMOVE        0010H
%define F_SQUASH        0020H
%define F_NO_COPY       0040H
%define F_VERBOSE       0080H

extern brotli_asm_cpu_supported
extern brotli_asm_encoder_create
extern brotli_asm_encoder_process
extern brotli_asm_encoder_destroy
extern brotli_asm_decoder_create
extern brotli_asm_decoder_process
extern brotli_asm_decoder_destroy

section .rodata align=16
dash:                   db "-", 0
default_suffix:         db ".br", 0
temporary_suffix:       db ".tmp.", 0
dot:                    db ".", 0
newline:                db 10

opt_stdout:             db "--stdout", 0
opt_decompress:         db "--decompress", 0
opt_force:              db "--force", 0
opt_help:               db "--help", 0
opt_rm:                 db "--rm", 0
opt_squash:             db "--squash", 0
opt_keep:               db "--keep", 0
opt_no_copy:            db "--no-copy-stat", 0
opt_test:               db "--test", 0
opt_verbose:            db "--verbose", 0
opt_version:            db "--version", 0
opt_best:               db "--best", 0
opt_quality:            db "--quality", 0
opt_lgwin:              db "--lgwin", 0
opt_output:             db "--output", 0
opt_suffix:             db "--suffix", 0
opt_mode:               db "--mode", 0
mode_generic:           db "generic", 0
mode_text:              db "text", 0
mode_font:              db "font", 0

help_text:
        db "Usage: brotli [OPTION]... [FILE]...", 10
        db "Compress or decompress FILEs with RFC 7932 Brotli.", 10
        db "With no FILE, or when FILE is -, read standard input.", 10, 10
        db "Options:", 10
        db "  -#                          compression level (0-9)", 10
        db "  -c, --stdout                write on standard output", 10
        db "  -d, --decompress            decompress", 10
        db "  -f, --force                 force output file overwrite", 10
        db "  -h, --help                  display this help and exit", 10
        db "  -j, --rm                    remove source file after success", 10
        db "  -s, --squash                remove output if not smaller than input", 10
        db "  -k, --keep                  keep source file (default)", 10
        db "  -n, --no-copy-stat          do not copy source file attributes", 10
        db "  -o FILE, --output=FILE      output file (only with one input)", 10
        db "  -q NUM, --quality=NUM       compression level (0-11)", 10
        db "  -t, --test                  test compressed file integrity", 10
        db "  -v, --verbose               report processed files", 10
        db "  -w NUM, --lgwin=NUM         LZ77 window bits (0 or 10-24)", 10
        db "                              0 chooses from the input size", 10
        db "  -S SUF, --suffix=SUF        output suffix (default: '.br')", 10
        db "  -V, --version               display version and exit", 10
        db "  -Z, --best                  use compression level 11 (default)", 10
        db "      --mode=MODE             generic, text, or font", 10, 10
        db "Simple short options may be coalesced: -9kf is -9 -k -f.", 10
help_text_end:

version_text:           db "brotli 1.0.0", 10
version_text_end:
error_prefix:           db "brotli: "
error_prefix_end:
try_help:               db 10, "Try 'brotli --help' for more information.", 10
try_help_end:
msg_unknown:            db "unknown or malformed option"
msg_unknown_end:
msg_value:              db "option requires a valid value"
msg_value_end:
msg_quality:            db "--quality must be an integer from 0 through 11"
msg_quality_end:
msg_lgwin:              db "--lgwin must be 0 or an integer from 10 through 24"
msg_lgwin_end:
msg_conflict:           db "conflicting command-line options"
msg_conflict_end:
msg_one_input:          db "--output requires exactly one input"
msg_one_input_end:
msg_stdin_multiple:     db "standard input cannot be combined with other inputs"
msg_stdin_multiple_end:
msg_suffix:             db "input file does not end with the configured suffix"
msg_suffix_end:
msg_exists:             db "output file already exists; use --force"
msg_exists_end:
msg_open_input:         db "could not open input file"
msg_open_input_end:
msg_open_output:        db "could not create output file"
msg_open_output_end:
msg_read:               db "input read failed"
msg_read_end:
msg_write:              db "output write failed"
msg_write_end:
msg_codec:              db "Brotli stream is invalid or codec operation failed"
msg_codec_end:
msg_trailing:           db "trailing data after Brotli stream"
msg_trailing_end:
msg_cpu:                db "required AVX-512/BMI CPU features are unavailable"
msg_cpu_end:
msg_memory:             db "memory allocation failed"
msg_memory_end:
msg_path:               db "file name is too long"
msg_path_end:
msg_commit:             db "could not commit output file"
msg_commit_end:
msg_output_input:       db "output file is also an input file"
msg_output_input_end:
msg_unsupported:        db "requested Brotli extension is not supported"
msg_unsupported_end:

section .bss align=64
flags:                  resd 1
information_action:     resd 1
input_count:            resd 1
quality:                resd 1
lgwin:                  resd 1
mode:                   resd 1
explicit_output:        resq 1
suffix_pointer:         resq 1
suffix_length:          resq 1
input_list:             resq MAX_INPUTS

codec_options:          resb 32
codec_error:            resd 1
codec_state:            resq 1
input_buffer:           resq 1
output_buffer:          resq 1
next_in:                resq 1
available_in:           resq 1
next_out:               resq 1
available_out:          resq 1
input_total:            resq 1
output_total:           resq 1
current_input:          resq 1
current_output:         resq 1
input_fd:               resd 1
output_fd:              resd 1
temporary_fd:           resd 1
file_output:            resd 1
temporary_active:       resd 1
job_squashed:           resd 1
temporary_counter:      resd 1
input_stat:             resb 256
output_path:            resb PATH_SIZE
temporary_path:         resb PATH_SIZE
number_buffer:          resb 32

section .text align=64
global _start:function

_start:
        mov     dword [quality], 11
        mov     dword [lgwin], 0
        mov     qword [suffix_pointer], default_suffix
        mov     qword [suffix_length], 3

        mov     r14, [rsp]
        lea     r15, [rsp+8]
        mov     r13d, 1
.argument_loop:
        cmp     r13, r14
        jae     .arguments_done
        mov     r12, [r15+r13*8]
        cmp     byte [r12], '-'
        jne     .add_input
        cmp     byte [r12+1], 0
        je      .add_input
        cmp     byte [r12+1], '-'
        jne     .short_options
        cmp     byte [r12+2], 0
        je      .add_remaining

        mov     rdi, r12
        mov     rsi, opt_stdout
        call    streq
        test    eax, eax
        jnz     .set_stdout
        mov     rdi, r12
        mov     rsi, opt_decompress
        call    streq
        test    eax, eax
        jnz     .set_decompress
        mov     rdi, r12
        mov     rsi, opt_force
        call    streq
        test    eax, eax
        jnz     .set_force
        mov     rdi, r12
        mov     rsi, opt_help
        call    streq
        test    eax, eax
        jnz     .set_help
        mov     rdi, r12
        mov     rsi, opt_rm
        call    streq
        test    eax, eax
        jnz     .set_remove
        mov     rdi, r12
        mov     rsi, opt_squash
        call    streq
        test    eax, eax
        jnz     .set_squash
        mov     rdi, r12
        mov     rsi, opt_keep
        call    streq
        test    eax, eax
        jnz     .set_keep
        mov     rdi, r12
        mov     rsi, opt_no_copy
        call    streq
        test    eax, eax
        jnz     .set_no_copy
        mov     rdi, r12
        mov     rsi, opt_test
        call    streq
        test    eax, eax
        jnz     .set_test
        mov     rdi, r12
        mov     rsi, opt_verbose
        call    streq
        test    eax, eax
        jnz     .set_verbose
        mov     rdi, r12
        mov     rsi, opt_version
        call    streq
        test    eax, eax
        jnz     .set_version
        mov     rdi, r12
        mov     rsi, opt_best
        call    streq
        test    eax, eax
        jnz     .set_best

        mov     rdi, r12
        mov     rsi, opt_quality
        call    option_value
        cmp     rax, -2
        jne     .long_quality
        mov     rdi, r12
        mov     rsi, opt_lgwin
        call    option_value
        cmp     rax, -2
        jne     .long_lgwin
        mov     rdi, r12
        mov     rsi, opt_output
        call    option_value
        cmp     rax, -2
        jne     .long_output
        mov     rdi, r12
        mov     rsi, opt_suffix
        call    option_value
        cmp     rax, -2
        jne     .long_suffix
        mov     rdi, r12
        mov     rsi, opt_mode
        call    option_value
        cmp     rax, -2
        jne     .long_mode

        ; Known upstream extensions are intentionally rejected.
        cmp     byte [r12+2], 'd'
        je      .unsupported
        cmp     byte [r12+2], 'c'
        je      .unsupported
        cmp     byte [r12+2], 'l'
        je      .unsupported
        jmp     .unknown

.long_quality:
        call    obtain_value
        test    rax, rax
        jz      .bad_value
        mov     rdi, rax
        xor     esi, esi
        mov     edx, 11
        call    parse_unsigned
        jc      .bad_quality
        mov     [quality], eax
        jmp     .next_argument
.long_lgwin:
        call    obtain_value
        test    rax, rax
        jz      .bad_value
        mov     rdi, rax
        xor     esi, esi
        mov     edx, 24
        call    parse_unsigned
        jc      .bad_lgwin
        test    eax, eax
        jz      .lgwin_default
        cmp     eax, 10
        jb      .bad_lgwin
        mov     [lgwin], eax
        jmp     .next_argument
.lgwin_default:
        mov     dword [lgwin], 0
        jmp     .next_argument
.long_output:
        call    obtain_value
        test    rax, rax
        jz      .bad_value
        mov     [explicit_output], rax
        jmp     .next_argument
.long_suffix:
        call    obtain_value
        test    rax, rax
        jz      .bad_value
        mov     [suffix_pointer], rax
        mov     rdi, rax
        call    strlen
        test    rax, rax
        jz      .bad_value
        mov     [suffix_length], rax
        jmp     .next_argument
.long_mode:
        call    obtain_value
        test    rax, rax
        jz      .bad_value
        mov     r12, rax
        mov     rdi, r12
        mov     rsi, mode_generic
        call    streq
        test    eax, eax
        jnz     .mode_zero
        mov     rdi, r12
        mov     rsi, mode_text
        call    streq
        test    eax, eax
        jnz     .mode_one
        mov     rdi, r12
        mov     rsi, mode_font
        call    streq
        test    eax, eax
        jnz     .mode_two
        jmp     .bad_value
.mode_zero:
        mov     dword [mode], 0
        jmp     .next_argument
.mode_one:
        mov     dword [mode], 1
        jmp     .next_argument
.mode_two:
        mov     dword [mode], 2
        jmp     .next_argument

.set_stdout:
        or      dword [flags], F_STDOUT
        jmp     .next_argument
.set_decompress:
        or      dword [flags], F_DECOMPRESS
        jmp     .next_argument
.set_force:
        or      dword [flags], F_FORCE
        jmp     .next_argument
.set_help:
        mov     dword [information_action], 1
        jmp     .next_argument
.set_remove:
        or      dword [flags], F_REMOVE
        jmp     .next_argument
.set_squash:
        or      dword [flags], F_SQUASH
        jmp     .next_argument
.set_keep:
        and     dword [flags], ~F_REMOVE
        jmp     .next_argument
.set_no_copy:
        or      dword [flags], F_NO_COPY
        jmp     .next_argument
.set_test:
        or      dword [flags], F_TEST | F_DECOMPRESS
        jmp     .next_argument
.set_verbose:
        or      dword [flags], F_VERBOSE
        jmp     .next_argument
.set_version:
        mov     dword [information_action], 2
        jmp     .next_argument
.set_best:
        mov     dword [quality], 11
        jmp     .next_argument

.short_options:
        lea     rbx, [r12+1]
        mov     al, [rbx]
        cmp     al, '0'
        jb      .short_loop
        cmp     al, '9'
        ja      .short_loop
        mov     al, [rbx+1]
        cmp     al, '0'
        jb      .short_loop
        cmp     al, '9'
        jbe     .unknown
.short_loop:
        movzx   eax, byte [rbx]
        test    al, al
        jz      .next_argument
        inc     rbx
        cmp     al, '0'
        jb      .short_letter
        cmp     al, '9'
        ja      .short_letter
        sub     eax, '0'
        mov     [quality], eax
        jmp     .short_loop
.short_letter:
        cmp     al, 'c'
        je      .short_stdout
        cmp     al, 'd'
        je      .short_decompress
        cmp     al, 'f'
        je      .short_force
        cmp     al, 'h'
        je      .short_help
        cmp     al, 'j'
        je      .short_remove
        cmp     al, 's'
        je      .short_squash
        cmp     al, 'k'
        je      .short_keep
        cmp     al, 'n'
        je      .short_no_copy
        cmp     al, 't'
        je      .short_test
        cmp     al, 'v'
        je      .short_verbose
        cmp     al, 'V'
        je      .short_version
        cmp     al, 'Z'
        je      .short_best
        cmp     al, 'q'
        je      .short_quality
        cmp     al, 'w'
        je      .short_lgwin
        cmp     al, 'o'
        je      .short_output
        cmp     al, 'S'
        je      .short_suffix
        cmp     al, 'C'
        je      .unsupported
        cmp     al, 'D'
        je      .unsupported
        cmp     al, 'K'
        je      .unsupported
        jmp     .unknown
.short_stdout:
        or      dword [flags], F_STDOUT
        jmp     .short_loop
.short_decompress:
        or      dword [flags], F_DECOMPRESS
        jmp     .short_loop
.short_force:
        or      dword [flags], F_FORCE
        jmp     .short_loop
.short_help:
        mov     dword [information_action], 1
        jmp     .short_loop
.short_remove:
        or      dword [flags], F_REMOVE
        jmp     .short_loop
.short_squash:
        or      dword [flags], F_SQUASH
        jmp     .short_loop
.short_keep:
        and     dword [flags], ~F_REMOVE
        jmp     .short_loop
.short_no_copy:
        or      dword [flags], F_NO_COPY
        jmp     .short_loop
.short_test:
        or      dword [flags], F_TEST | F_DECOMPRESS
        jmp     .short_loop
.short_verbose:
        or      dword [flags], F_VERBOSE
        jmp     .short_loop
.short_version:
        mov     dword [information_action], 2
        jmp     .short_loop
.short_best:
        mov     dword [quality], 11
        jmp     .short_loop
.short_quality:
        call    short_value
        test    rax, rax
        jz      .bad_value
        mov     rdi, rax
        xor     esi, esi
        mov     edx, 11
        call    parse_unsigned
        jc      .bad_quality
        mov     [quality], eax
        jmp     .next_argument
.short_lgwin:
        call    short_value
        test    rax, rax
        jz      .bad_value
        mov     rdi, rax
        xor     esi, esi
        mov     edx, 24
        call    parse_unsigned
        jc      .bad_lgwin
        test    eax, eax
        jz      .short_lgwin_default
        cmp     eax, 10
        jb      .bad_lgwin
        mov     [lgwin], eax
        jmp     .next_argument
.short_lgwin_default:
        mov     dword [lgwin], 0
        jmp     .next_argument
.short_output:
        call    short_value
        test    rax, rax
        jz      .bad_value
        mov     [explicit_output], rax
        jmp     .next_argument
.short_suffix:
        call    short_value
        test    rax, rax
        jz      .bad_value
        mov     [suffix_pointer], rax
        mov     rdi, rax
        call    strlen
        test    rax, rax
        jz      .bad_value
        mov     [suffix_length], rax
        jmp     .next_argument

.add_remaining:
        inc     r13
.remaining_loop:
        cmp     r13, r14
        jae     .arguments_done
        mov     r12, [r15+r13*8]
.add_input:
        mov     eax, [input_count]
        cmp     eax, MAX_INPUTS
        jae     .bad_value
        mov     [input_list+rax*8], r12
        inc     dword [input_count]
        inc     r13
        jmp     .argument_loop

.next_argument:
        inc     r13
        jmp     .argument_loop

.arguments_done:
        cmp     dword [information_action], 1
        je      show_help
        cmp     dword [information_action], 2
        je      show_version
        cmp     dword [input_count], 0
        jne     .have_input
        mov     qword [input_list], dash
        mov     dword [input_count], 1
.have_input:
        mov     eax, [flags]
        test    eax, F_STDOUT
        jz      .no_stdout_output_conflict
        cmp     qword [explicit_output], 0
        jne     .conflict
        cmp     dword [input_count], 1
        jne     .conflict
.no_stdout_output_conflict:
        cmp     qword [explicit_output], 0
        je      .output_count_ok
        cmp     dword [input_count], 1
        jne     .one_input
.output_count_ok:
        cmp     dword [input_count], 1
        jbe     .test_rules
        xor     ebx, ebx
.find_stdin:
        cmp     ebx, [input_count]
        jae     .test_rules
        mov     rdi, [input_list+rbx*8]
        mov     rsi, dash
        call    streq
        test    eax, eax
        jnz     .stdin_multiple
        inc     ebx
        jmp     .find_stdin
.test_rules:
        mov     eax, [flags]
        test    eax, F_TEST
        jz      .squash_rules
        test    eax, F_STDOUT | F_REMOVE | F_SQUASH
        jnz     .conflict
        cmp     qword [explicit_output], 0
        jne     .conflict
.squash_rules:
        mov     eax, [flags]
        test    eax, F_SQUASH
        jz      .cpu_check
        test    eax, F_DECOMPRESS
        jnz     .conflict
        cmp     dword [input_count], 1
        jne     .cpu_check
        mov     rdi, [input_list]
        mov     rsi, dash
        call    streq
        test    eax, eax
        jnz     .conflict

.cpu_check:
        call    brotli_asm_cpu_supported
        test    eax, eax
        jz      .bad_cpu
        xor     edi, edi
        mov     esi, BUFFER_SIZE
        call    cli_allocate
        test    rax, rax
        jz      .bad_memory
        mov     [input_buffer], rax
        xor     edi, edi
        mov     esi, BUFFER_SIZE
        call    cli_allocate
        test    rax, rax
        jz      .bad_memory
        mov     [output_buffer], rax

        xor     ebx, ebx
.job_loop:
        cmp     ebx, [input_count]
        jae     exit_success
        mov     rax, [input_list+rbx*8]
        mov     [current_input], rax
        call    prepare_job
        test    eax, eax
        jnz     exit_failure
        call    run_job
        test    eax, eax
        jnz     exit_failure
        inc     ebx
        jmp     .job_loop

.unsupported:
        mov     rdi, msg_unsupported
        mov     rsi, msg_unsupported_end-msg_unsupported
        jmp     usage_failure
.unknown:
        mov     rdi, msg_unknown
        mov     rsi, msg_unknown_end-msg_unknown
        jmp     usage_failure
.bad_value:
        mov     rdi, msg_value
        mov     rsi, msg_value_end-msg_value
        jmp     usage_failure
.bad_quality:
        mov     rdi, msg_quality
        mov     rsi, msg_quality_end-msg_quality
        jmp     usage_failure
.bad_lgwin:
        mov     rdi, msg_lgwin
        mov     rsi, msg_lgwin_end-msg_lgwin
        jmp     usage_failure
.conflict:
        mov     rdi, msg_conflict
        mov     rsi, msg_conflict_end-msg_conflict
        jmp     usage_failure
.one_input:
        mov     rdi, msg_one_input
        mov     rsi, msg_one_input_end-msg_one_input
        jmp     usage_failure
.stdin_multiple:
        mov     rdi, msg_stdin_multiple
        mov     rsi, msg_stdin_multiple_end-msg_stdin_multiple
        jmp     usage_failure
.bad_cpu:
        mov     rdi, msg_cpu
        mov     rsi, msg_cpu_end-msg_cpu
        jmp     fatal_failure
.bad_memory:
        mov     rdi, msg_memory
        mov     rsi, msg_memory_end-msg_memory
        jmp     fatal_failure

; option_value(arg, name): -2 mismatch, 0 exact name, pointer for name=value.
option_value:
        xor     ecx, ecx
.loop:
        mov     al, [rsi+rcx]
        test    al, al
        jz      .name_end
        cmp     al, [rdi+rcx]
        jne     .mismatch
        inc     rcx
        jmp     .loop
.name_end:
        mov     al, [rdi+rcx]
        test    al, al
        jz      .exact
        cmp     al, '='
        jne     .mismatch
        inc     rcx
        cmp     byte [rdi+rcx], 0
        je      .exact
        lea     rax, [rdi+rcx]
        ret
.exact:
        xor     eax, eax
        ret
.mismatch:
        mov     rax, -2
        ret

; Uses option_value result in rax and parser r13/r14/r15.
obtain_value:
        test    rax, rax
        jnz     .done
        inc     r13
        cmp     r13, r14
        jae     .missing
        mov     rax, [r15+r13*8]
        cmp     byte [rax], 0
        je      .missing
.done:
        ret
.missing:
        xor     eax, eax
        ret

; Uses short-cluster cursor rbx and parser r13/r14/r15.
short_value:
        cmp     byte [rbx], 0
        jne     .attached
        inc     r13
        cmp     r13, r14
        jae     .missing
        mov     rax, [r15+r13*8]
        cmp     byte [rax], 0
        je      .missing
        ret
.attached:
        mov     rax, rbx
        ret
.missing:
        xor     eax, eax
        ret

; parse_unsigned(text, minimum, maximum), CF indicates invalid.
parse_unsigned:
        xor     eax, eax
        xor     ecx, ecx
.loop:
        movzx   r8d, byte [rdi+rcx]
        test    r8b, r8b
        jz      .end
        sub     r8d, '0'
        cmp     r8d, 9
        ja      .bad
        imul    eax, eax, 10
        jo      .bad
        add     eax, r8d
        jc      .bad
        inc     ecx
        jmp     .loop
.end:
        test    ecx, ecx
        jz      .bad
        cmp     eax, esi
        jb      .bad
        cmp     eax, edx
        ja      .bad
        clc
        ret
.bad:
        stc
        ret

streq:
.loop:
        mov     al, [rdi]
        cmp     al, [rsi]
        jne     .no
        inc     rdi
        inc     rsi
        test    al, al
        jne     .loop
        mov     eax, 1
        ret
.no:
        xor     eax, eax
        ret

strlen:
        xor     eax, eax
.loop:
        cmp     byte [rdi+rax], 0
        je      .done
        inc     rax
        jmp     .loop
.done:
        ret

show_help:
        mov     edi, 1
        mov     rsi, help_text
        mov     edx, help_text_end-help_text
        call    write_all
        jmp     exit_success

show_version:
        mov     edi, 1
        mov     rsi, version_text
        mov     edx, version_text_end-version_text
        call    write_all
        jmp     exit_success

usage_failure:
        push    rdi
        push    rsi
        mov     edi, 2
        mov     rsi, error_prefix
        mov     edx, error_prefix_end-error_prefix
        call    write_all
        pop     rdx
        pop     rsi
        mov     edi, 2
        call    write_all
        mov     edi, 2
        mov     rsi, try_help
        mov     edx, try_help_end-try_help
        call    write_all
        jmp     exit_failure

fatal_failure:
        push    rdi
        push    rsi
        mov     edi, 2
        mov     rsi, error_prefix
        mov     edx, error_prefix_end-error_prefix
        call    write_all
        pop     rdx
        pop     rsi
        mov     edi, 2
        call    write_all
        mov     edi, 2
        mov     rsi, newline
        mov     edx, 1
        call    write_all
        jmp     exit_failure

; prepare_job derives the output name. Returns zero or reports an error.
prepare_job:
        mov     dword [file_output], 0
        mov     qword [current_output], 0
        mov     eax, [flags]
        test    eax, F_TEST
        jnz     .done
        test    eax, F_STDOUT
        jnz     .stdout
        cmp     qword [explicit_output], 0
        jne     .explicit
        mov     rdi, [current_input]
        mov     rsi, dash
        call    streq
        test    eax, eax
        jnz     .stdout
        mov     eax, [flags]
        test    eax, F_DECOMPRESS
        jnz     .derive_decompressed

        mov     rdi, output_path
        mov     rsi, [current_input]
        mov     edx, PATH_SIZE
        call    copy_string
        jc      .path_error
        mov     rdi, output_path
        mov     rsi, [suffix_pointer]
        mov     edx, PATH_SIZE
        call    append_string
        jc      .path_error
        mov     qword [current_output], output_path
        mov     dword [file_output], 1
        jmp     .validate_file
.derive_decompressed:
        mov     rdi, [current_input]
        call    strlen
        mov     rcx, [suffix_length]
        cmp     rax, rcx
        jbe     .suffix_error
        mov     r8, rax
        sub     r8, rcx
        mov     rsi, [suffix_pointer]
        mov     rdi, [current_input]
        add     rdi, r8
        xor     edx, edx
.suffix_compare:
        cmp     rdx, rcx
        jae     .suffix_ok
        mov     al, [rdi+rdx]
        cmp     al, [rsi+rdx]
        jne     .suffix_error
        inc     rdx
        jmp     .suffix_compare
.suffix_ok:
        cmp     r8, PATH_SIZE
        jae     .path_error
        mov     rsi, [current_input]
        mov     rdi, output_path
        mov     rcx, r8
        rep movsb
        mov     byte [rdi], 0
        mov     qword [current_output], output_path
        mov     dword [file_output], 1
        jmp     .validate_file
.explicit:
        mov     rax, [explicit_output]
        mov     [current_output], rax
        mov     dword [file_output], 1
        jmp     .validate_file
.validate_file:
        call    validate_file_output
        test    eax, eax
        jnz     .output_input_error
        xor     eax, eax
        ret
.stdout:
        mov     qword [current_output], dash
.done:
        xor     eax, eax
        ret
.suffix_error:
        mov     rdi, msg_suffix
        mov     rsi, msg_suffix_end-msg_suffix
        call    fatal_failure
.path_error:
        mov     rdi, msg_path
        mov     rsi, msg_path_end-msg_path
        call    fatal_failure
.output_input_error:
        mov     rdi, msg_output_input
        mov     rsi, msg_output_input_end-msg_output_input
        call    fatal_failure

validate_file_output:
        push    rbx
        xor     ebx, ebx
.loop:
        cmp     ebx, [input_count]
        jae     .valid
        mov     rdi, [current_output]
        mov     rsi, [input_list+rbx*8]
        call    streq
        test    eax, eax
        jnz     .invalid
        inc     ebx
        jmp     .loop
.valid:
        xor     eax, eax
        pop     rbx
        ret
.invalid:
        mov     eax, 1
        pop     rbx
        ret

; run_job opens files, streams the codec, and atomically commits output.
run_job:
        push    rbp
        mov     rbp, rsp
        push    rbx
        push    r12
        push    r13
        push    r14
        push    r15
        sub     rsp, 24
        mov     dword [temporary_active], 0
        mov     dword [job_squashed], 0
        mov     dword [input_fd], -1
        mov     dword [temporary_fd], -1
        mov     qword [input_total], 0
        mov     qword [output_total], 0

        mov     rdi, [current_input]
        mov     rsi, dash
        call    streq
        test    eax, eax
        jz      .open_input
        mov     dword [input_fd], 0
        jmp     .input_ready
.open_input:
        mov     eax, SYS_openat
        mov     edi, AT_FDCWD
        mov     rsi, [current_input]
        mov     edx, O_RDONLY | O_CLOEXEC
        xor     r10d, r10d
        syscall
        test    rax, rax
        js      .input_error
        mov     [input_fd], eax
        mov     edi, eax
        mov     eax, SYS_fstat
        mov     rsi, input_stat
        syscall
        test    rax, rax
        js      .input_error_close
.input_ready:
        mov     eax, [flags]
        test    eax, F_TEST
        jnz     .no_output
        cmp     dword [file_output], 0
        je      .stdout_output

        mov     eax, [flags]
        test    eax, F_FORCE
        jnz     .create_temporary
        mov     eax, SYS_openat
        mov     edi, AT_FDCWD
        mov     rsi, [current_output]
        mov     edx, O_RDONLY | O_CLOEXEC
        xor     r10d, r10d
        syscall
        test    rax, rax
        js      .create_temporary
        mov     edi, eax
        mov     eax, SYS_close
        syscall
        jmp     .exists_error

.create_temporary:
        call    make_temporary_name
        test    eax, eax
        jnz     .output_error
        mov     eax, SYS_openat
        mov     edi, AT_FDCWD
        mov     rsi, temporary_path
        mov     edx, O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC
        mov     r10d, 0666O
        syscall
        test    rax, rax
        js      .output_error
        mov     [temporary_fd], eax
        mov     [output_fd], eax
        mov     dword [temporary_active], 1
        jmp     .stream
.stdout_output:
        mov     dword [output_fd], 1
        jmp     .stream
.no_output:
        mov     dword [output_fd], -1

.stream:
        mov     eax, [quality]
        mov     [codec_options], eax
        mov     eax, [lgwin]
.select_window:
        test    eax, eax
        jnz     .store_window
        mov     eax, 24
        cmp     dword [input_fd], 0
        je      .store_window
        mov     edx, [input_stat+24]
        and     edx, 0170000O
        cmp     edx, 0100000O
        jne     .store_window
        mov     rdx, [input_stat+48]
        test    rdx, rdx
        js      .store_window
        mov     eax, 10
.window_loop:
        mov     ecx, eax
        mov     r8d, 1
        shl     r8, cl
        sub     r8, 16
        cmp     r8, rdx
        jae     .store_window
        inc     eax
        cmp     eax, 24
        jb      .window_loop
.store_window:
        mov     [codec_options+4], eax
        mov     eax, [mode]
        mov     [codec_options+8], eax
        mov     qword [codec_options+16], 0
        cmp     dword [input_fd], 0
        je      .create_codec
        mov     eax, [input_stat+24]
        and     eax, 0170000O
        cmp     eax, 0100000O
        jne     .create_codec
        mov     rax, [input_stat+48]
        test    rax, rax
        js      .create_codec
        mov     edx, 0FFFFFFFFH
        cmp     rax, rdx
        ja      .create_codec
        mov     [codec_options+16], rax
.create_codec:
        mov     eax, [flags]
        test    eax, F_DECOMPRESS
        jnz     .create_decoder
        mov     rdi, codec_options
        mov     rsi, cli_allocate
        mov     rdx, cli_release
        xor     ecx, ecx
        mov     r8, codec_error
        call    brotli_asm_encoder_create
        jmp     .created
.create_decoder:
        xor     edi, edi
        mov     rsi, cli_allocate
        mov     rdx, cli_release
        xor     ecx, ecx
        mov     r8, codec_error
        call    brotli_asm_decoder_create
.created:
        test    rax, rax
        jz      .codec_error
        mov     [codec_state], rax
        mov     eax, [flags]
        test    eax, F_DECOMPRESS
        jnz     .decode_loop
        call    encode_stream
        jmp     .stream_done
.decode_loop:
        call    decode_stream
.stream_done:
        test    eax, eax
        jnz     .codec_error_destroy
        mov     eax, [flags]
        test    eax, F_DECOMPRESS
        jnz     .destroy_decoder_success
        mov     rdi, [codec_state]
        call    brotli_asm_encoder_destroy
        jmp     .after_codec
.destroy_decoder_success:
        mov     rdi, [codec_state]
        call    brotli_asm_decoder_destroy
.after_codec:
        mov     dword [codec_state], 0
        cmp     dword [temporary_active], 0
        je      .after_commit

        mov     eax, [flags]
        test    eax, F_NO_COPY
        jnz     .close_temporary
        cmp     dword [input_fd], 0
        je      .close_temporary
        mov     eax, SYS_fchmod
        mov     edi, [temporary_fd]
        mov     esi, [input_stat+24]
        and     esi, 07777O
        syscall
        mov     eax, SYS_futimens
        mov     edi, [temporary_fd]
        lea     rsi, [input_stat+72]
        syscall
.close_temporary:
        mov     eax, SYS_close
        mov     edi, [temporary_fd]
        syscall
        mov     dword [temporary_fd], -1

        mov     eax, [flags]
        test    eax, F_SQUASH
        jz      .rename_output
        mov     rax, [output_total]
        cmp     rax, [input_total]
        jb      .rename_output
        mov     eax, SYS_unlink
        mov     rdi, temporary_path
        syscall
        mov     dword [temporary_active], 0
        mov     dword [job_squashed], 1
        jmp     .after_commit
.rename_output:
        mov     eax, [flags]
        test    eax, F_FORCE
        jz      .rename_no_replace
        mov     eax, SYS_rename
        mov     rdi, temporary_path
        mov     rsi, [current_output]
        syscall
        jmp     .rename_result
.rename_no_replace:
        mov     eax, SYS_renameat2
        mov     edi, AT_FDCWD
        mov     rsi, temporary_path
        mov     edx, AT_FDCWD
        mov     r10, [current_output]
        mov     r8d, RENAME_NOREPLACE
        syscall
.rename_result:
        test    rax, rax
        js      .commit_error
        mov     dword [temporary_active], 0

.after_commit:
        cmp     dword [input_fd], 0
        je      .remove_source
        mov     eax, SYS_close
        mov     edi, [input_fd]
        syscall
        mov     dword [input_fd], -1
.remove_source:
        mov     eax, [flags]
        test    eax, F_REMOVE
        jz      .verbose
        test    eax, F_TEST
        jnz     .verbose
        cmp     dword [job_squashed], 0
        jne     .verbose
        mov     rdi, [current_input]
        mov     rsi, dash
        call    streq
        test    eax, eax
        jnz     .verbose
        mov     eax, SYS_unlink
        mov     rdi, [current_input]
        syscall
.verbose:
        mov     eax, [flags]
        test    eax, F_VERBOSE
        jz      .success
        mov     edi, 2
        mov     rsi, [current_input]
        mov     rdi, rsi
        call    strlen
        mov     rdx, rax
        mov     edi, 2
        mov     rsi, [current_input]
        call    write_all
        mov     edi, 2
        mov     rsi, newline
        mov     edx, 1
        call    write_all
.success:
        xor     eax, eax
        jmp     .return

.codec_error_destroy:
        mov     eax, [flags]
        test    eax, F_DECOMPRESS
        jnz     .destroy_decoder_error
        mov     rdi, [codec_state]
        call    brotli_asm_encoder_destroy
        jmp     .codec_error
.destroy_decoder_error:
        mov     rdi, [codec_state]
        call    brotli_asm_decoder_destroy
.codec_error:
        mov     rdi, msg_codec
        mov     rsi, msg_codec_end-msg_codec
        jmp     .job_failure
.input_error_close:
        mov     eax, SYS_close
        mov     edi, [input_fd]
        syscall
.input_error:
        mov     rdi, msg_open_input
        mov     rsi, msg_open_input_end-msg_open_input
        jmp     .job_failure
.exists_error:
        mov     rdi, msg_exists
        mov     rsi, msg_exists_end-msg_exists
        jmp     .job_failure
.output_error:
        mov     rdi, msg_open_output
        mov     rsi, msg_open_output_end-msg_open_output
        jmp     .job_failure
.commit_error:
        mov     rdi, msg_commit
        mov     rsi, msg_commit_end-msg_commit
.job_failure:
        push    rdi
        push    rsi
        cmp     dword [temporary_fd], 0
        jl      .no_temp_close
        mov     eax, SYS_close
        mov     edi, [temporary_fd]
        syscall
.no_temp_close:
        cmp     dword [temporary_active], 0
        je      .no_temp_unlink
        mov     eax, SYS_unlink
        mov     rdi, temporary_path
        syscall
.no_temp_unlink:
        cmp     dword [input_fd], 0
        jle     .no_input_close
        mov     eax, SYS_close
        mov     edi, [input_fd]
        syscall
.no_input_close:
        pop     rsi
        pop     rdi
        push    rdi
        push    rsi
        mov     edi, 2
        mov     rsi, error_prefix
        mov     edx, error_prefix_end-error_prefix
        call    write_all
        pop     rdx
        pop     rsi
        mov     edi, 2
        call    write_all
        mov     edi, 2
        mov     rsi, newline
        mov     edx, 1
        call    write_all
        mov     eax, 1
.return:
        lea     rsp, [rbp-40]
        pop     r15
        pop     r14
        pop     r13
        pop     r12
        pop     rbx
        pop     rbp
        ret

encode_stream:
        push    rbx
.read:
        mov     eax, SYS_read
        mov     edi, [input_fd]
        mov     rsi, [input_buffer]
        mov     edx, BUFFER_SIZE
        syscall
        test    rax, rax
        js      .failure
        jz      .finish
        add     [input_total], rax
        mov     rcx, [input_buffer]
        mov     [next_in], rcx
        mov     [available_in], rax
.process:
        mov     rcx, [output_buffer]
        mov     [next_out], rcx
        mov     qword [available_out], BUFFER_SIZE
        mov     rdi, [codec_state]
        xor     esi, esi
        mov     rdx, next_in
        mov     rcx, available_in
        mov     r8, next_out
        mov     r9, available_out
        call    brotli_asm_encoder_process
        test    eax, eax
        jz      .failure
        mov     ebx, eax
        call    flush_output_buffer
        test    eax, eax
        jnz     .failure
        cmp     ebx, 2
        je      .process
        cmp     qword [available_in], 0
        jne     .process
        jmp     .read
.finish:
        mov     rcx, [input_buffer]
        mov     [next_in], rcx
        mov     qword [available_in], 0
.finish_loop:
        mov     rcx, [output_buffer]
        mov     [next_out], rcx
        mov     qword [available_out], BUFFER_SIZE
        mov     rdi, [codec_state]
        mov     esi, 2
        mov     rdx, next_in
        mov     rcx, available_in
        mov     r8, next_out
        mov     r9, available_out
        call    brotli_asm_encoder_process
        test    eax, eax
        jz      .failure
        mov     ebx, eax
        call    flush_output_buffer
        test    eax, eax
        jnz     .failure
        cmp     ebx, 4
        jne     .finish_loop
        xor     eax, eax
        pop     rbx
        ret
.failure:
        mov     eax, 1
        pop     rbx
        ret

decode_stream:
        push    rbx
.read:
        mov     eax, SYS_read
        mov     edi, [input_fd]
        mov     rsi, [input_buffer]
        mov     edx, BUFFER_SIZE
        syscall
        test    rax, rax
        js      .failure
        jz      .truncated
        add     [input_total], rax
        mov     rcx, [input_buffer]
        mov     [next_in], rcx
        mov     [available_in], rax
.process:
        mov     rcx, [output_buffer]
        mov     [next_out], rcx
        mov     qword [available_out], BUFFER_SIZE
        mov     rdi, [codec_state]
        mov     rsi, next_in
        mov     rdx, available_in
        mov     rcx, next_out
        mov     r8, available_out
        call    brotli_asm_decoder_process
        test    eax, eax
        jz      .failure
        mov     ebx, eax
        call    flush_output_buffer
        test    eax, eax
        jnz     .failure
        cmp     ebx, 4
        je      .finished
        cmp     ebx, 2
        je      .process
        cmp     qword [available_in], 0
        jne     .process
        jmp     .read
.finished:
        cmp     qword [available_in], 0
        jne     .trailing
        mov     eax, SYS_read
        mov     edi, [input_fd]
        mov     rsi, [input_buffer]
        mov     edx, 1
        syscall
        test    rax, rax
        js      .failure
        jnz     .trailing
        xor     eax, eax
        pop     rbx
        ret
.truncated:
.trailing:
.failure:
        mov     eax, 1
        pop     rbx
        ret

flush_output_buffer:
        mov     rdx, BUFFER_SIZE
        sub     rdx, [available_out]
        add     [output_total], rdx
        test    rdx, rdx
        jz      .success
        cmp     dword [output_fd], 0
        jl      .success
        mov     edi, [output_fd]
        mov     rsi, [output_buffer]
        call    write_all
        test    eax, eax
        jnz     .failure
.success:
        xor     eax, eax
        ret
.failure:
        mov     eax, 1
        ret

write_all:
        test    rdx, rdx
        jz      .success
.loop:
        mov     eax, SYS_write
        syscall
        test    rax, rax
        jle     .failure
        add     rsi, rax
        sub     rdx, rax
        jnz     .loop
.success:
        xor     eax, eax
        ret
.failure:
        mov     eax, 1
        ret

copy_string:
        xor     ecx, ecx
.loop:
        cmp     rcx, rdx
        jae     .too_long
        mov     al, [rsi+rcx]
        mov     [rdi+rcx], al
        inc     rcx
        test    al, al
        jne     .loop
        clc
        ret
.too_long:
        stc
        ret

append_string:
        push    rsi
        push    rdx
        call    strlen
        pop     rdx
        pop     rsi
        cmp     rax, rdx
        jae     .too_long
        add     rdi, rax
        sub     rdx, rax
        jmp     copy_string
.too_long:
        stc
        ret

make_temporary_name:
        mov     rdi, temporary_path
        mov     rsi, [current_output]
        mov     edx, PATH_SIZE
        call    copy_string
        jc      .bad
        mov     rdi, temporary_path
        mov     rsi, temporary_suffix
        mov     edx, PATH_SIZE
        call    append_string
        jc      .bad
        mov     eax, SYS_getpid
        syscall
        mov     rdi, temporary_path
        mov     rsi, rax
        mov     edx, PATH_SIZE
        call    append_number
        jc      .bad
        mov     rdi, temporary_path
        mov     rsi, dot
        mov     edx, PATH_SIZE
        call    append_string
        jc      .bad
        inc     dword [temporary_counter]
        mov     esi, [temporary_counter]
        mov     rdi, temporary_path
        mov     edx, PATH_SIZE
        call    append_number
        jc      .bad
        xor     eax, eax
        ret
.bad:
        mov     eax, 1
        ret

append_number:
        push    rbx
        push    r12
        mov     r12, rdi
        mov     rbx, rdx
        mov     rax, rsi
        lea     rdi, [number_buffer+31]
        mov     byte [rdi], 0
        mov     ecx, 10
.digits:
        xor     edx, edx
        div     rcx
        add     dl, '0'
        dec     rdi
        mov     [rdi], dl
        test    rax, rax
        jnz     .digits
        mov     rsi, rdi
        mov     rdi, r12
        mov     rdx, rbx
        call    append_string
        pop     r12
        pop     rbx
        ret

; mmap allocator callback; a 16-byte prefix records the unmap length.
cli_allocate:
        lea     rsi, [rsi+16]
        add     rsi, 4095
        and     rsi, -4096
        push    rsi
        mov     eax, SYS_mmap
        xor     edi, edi
        mov     rdx, PROT_RW
        mov     r10d, MAP_PRIVATE_ANON
        mov     r8, -1
        xor     r9d, r9d
        syscall
        pop     rdx
        test    rax, rax
        js      .failed
        mov     [rax], rdx
        add     rax, 16
        ret
.failed:
        xor     eax, eax
        ret

cli_release:
        test    rsi, rsi
        jz      .done
        lea     rdi, [rsi-16]
        mov     rsi, [rdi]
        mov     eax, SYS_munmap
        syscall
.done:
        ret

exit_success:
        xor     edi, edi
        jmp     exit_now
exit_failure:
        mov     edi, 1
exit_now:
        mov     eax, SYS_exit
        syscall
