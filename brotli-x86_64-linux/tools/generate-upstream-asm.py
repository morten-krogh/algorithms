#!/usr/bin/env python3
"""Regenerate the NASM Brotli core from Google Brotli 1.2.0.

The generated file is checked in; neither this script nor a C compiler is
needed to build the released library and CLI. GCC's symbolic Intel assembly
is converted directly to NASM where possible; ObjConv remains available as a
diagnostic fallback. This script gives translation-unit-local ELF symbols
unique names and combines the units into one include file.
"""

from __future__ import annotations

import argparse
import ast
import base64
import os
import re
import subprocess
import tempfile
from pathlib import Path


EXPECTED_COMMIT = "028fb5a23661f123017c060daa546b55cf4bde29"
LOCAL_TOKEN = re.compile(r"[A-Za-z0-9_.$?]")
MATCH_LENGTH_SOURCES = {
    Path("enc/backward_references.c"),
    Path("enc/backward_references_hq.c"),
    Path("enc/compress_fragment.c"),
    Path("enc/compress_fragment_two_pass.c"),
}
DEFAULT_HOT_SOURCES = ["enc/backward_references_hq.c"]


def run(*arguments: str, cwd: Path | None = None) -> str:
    return subprocess.run(
        arguments,
        cwd=cwd,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    ).stdout


def safe_tag(relative: Path) -> str:
    return re.sub(r"[^A-Za-z0-9_]", "_", str(relative.with_suffix("")))


def replace_symbol(text: str, old: str, new: str) -> str:
    pattern = re.compile(
        rf"(?<!{LOCAL_TOKEN.pattern}){re.escape(old)}(?!{LOCAL_TOKEN.pattern})"
    )
    return pattern.sub(new, text)


def local_symbols(obj: Path) -> list[str]:
    symbols: list[str] = []
    for line in run("nm", "-a", "--defined-only", "--format=posix", str(obj)).splitlines():
        fields = line.split()
        if len(fields) < 2 or not fields[1].islower():
            continue
        name = fields[0]
        if (
            name.startswith(".text")
            or name.startswith(".data")
            or name.startswith(".bss")
            or name.startswith(".rodata")
            or name.endswith(".c")
        ):
            continue
        symbols.append(name)
    return sorted(set(symbols), key=lambda symbol: (-len(symbol), symbol))


def clean_objconv(text: str, obj: Path, tag: str) -> str:
    for index, symbol in enumerate(local_symbols(obj)):
        replacement = f"L_{tag}_sym_{index}"
        text = replace_symbol(text, symbol, replacement)

    text = re.sub(r"\?_([0-9]+)", rf"L_{tag}_anon_\1", text)
    text = re.sub(
        r"Unnamed_([0-9]+)_([0-9A-F]+)",
        rf"L_{tag}_section_\1_\2",
        text,
    )
    # ObjConv expresses relocations against an unnamed section symbol as
    # "section-base + original byte offset". NASM may relax nearby branches,
    # so retaining that arithmetic can land in the middle of an instruction.
    # Turn each offset into a real label at the disassembler's address marker.
    text = re.sub(
        rf"L_{tag}_anon_(0*1)\+([0-9A-F]+)H",
        rf"L_{tag}_section_1_\2",
        text,
    )
    text = re.sub(
        rf"L_{tag}_section_([0-9]+)_0\+([0-9A-F]+)H",
        rf"L_{tag}_section_\1_\2",
        text,
    )
    section_references = set(
        re.findall(rf"\bL_{tag}_section_([0-9]+)_([0-9A-F]+)\b", text)
    )
    section_definitions = set(
        re.findall(
            rf"^L_{tag}_section_([0-9]+)_([0-9A-F]+):",
            text,
            flags=re.MULTILINE,
        )
    )
    section_boundaries = section_references - section_definitions
    normalized_boundaries = {
        (section, offset.lstrip("0") or "0"): offset
        for section, offset in section_boundaries
    }

    output: list[str] = []
    skipping_note = False
    labeled_sections: set[str] = set()
    inserted_boundaries: set[tuple[str, str]] = set()
    current_section = ""
    for raw_line in text.splitlines():
        if raw_line.startswith("extern "):
            continue
        if raw_line.startswith("global "):
            continue
        if raw_line.startswith("default rel"):
            continue
        if raw_line.startswith("SECTION "):
            skipping_note = ".note.gnu.property" in raw_line
            if skipping_note:
                continue
            declaration = re.match(
                r"SECTION\s+(\S+)\s+align=([0-9]+)", raw_line
            )
            if not declaration:
                raise RuntimeError(f"{obj}: unrecognized section: {raw_line}")
            name, alignment = declaration.groups()
            if name.startswith(".text"):
                attributes = "progbits alloc exec nowrite"
            elif name == ".bss":
                attributes = "nobits alloc noexec write"
            elif name.startswith(".data"):
                attributes = "progbits alloc noexec write"
            else:
                attributes = "progbits alloc noexec nowrite"
            output.append(
                f"SECTION {name} {attributes} align={alignment}"
                f" ;{raw_line.split(';', 1)[1]}"
            )
            match = re.search(r"section number ([0-9]+)", raw_line)
            if match and match.group(1) not in labeled_sections:
                section_number = match.group(1)
                output.append(f"L_{tag}_section_{section_number}_0:")
                labeled_sections.add(section_number)
            if match:
                current_section = match.group(1)
            continue
        if skipping_note:
            continue
        address = re.search(r";\s*([0-9A-F]+)\s+_", raw_line)
        if address:
            boundary = (current_section, address.group(1).lstrip("0") or "0")
            if (
                boundary in normalized_boundaries
                and boundary not in inserted_boundaries
            ):
                offset = normalized_boundaries[boundary]
                output.append(
                    f"L_{tag}_section_{current_section}_{offset}:"
                )
                inserted_boundaries.add(boundary)
        line = re.sub(r"\s*;.*$", "", raw_line).rstrip()
        if line:
            output.append(line)

    cleaned = "\n".join(output) + "\n"
    # ObjConv 2.16 occasionally retains the vector-width memory qualifier for
    # scalar FMA operands, and mislabels the 16-bit vpextrw destination.
    cleaned = re.sub(
        r"((?:vfmadd|vfmsub|vfnmadd|vfnmsub)[0-9]+sd\s+"
        r"[^,\n]+,\s*[^,\n]+,\s*)oword(\s*\[)",
        r"\1qword\2",
        cleaned,
    )
    cleaned = re.sub(r"(\bvpextrw\s+)byte(\s*\[)", r"\1word\2", cleaned)
    byte_target = (
        r"(?:(?:[abcd]l|[sd]il|r(?:[89]|1[0-5])b)|byte\s*\[[^\]\n]+\])"
    )
    cleaned = re.sub(
        rf"(\b(?:and|or|xor|cmp)\s+{byte_target}\s*,\s*)0FFFFFF([0-9A-F]{{2}})H",
        r"\g<1>0\2H",
        cleaned,
    )
    references = set(re.findall(rf"\bL_{tag}_anon_([0-9]+)\b", cleaned))
    definitions = set(
        re.findall(rf"^L_{tag}_anon_([0-9]+):", cleaned, flags=re.MULTILINE)
    )
    missing = references - definitions
    if missing:
        if len(missing) != 1 or int(next(iter(missing))) != 1:
            raise RuntimeError(f"{obj}: unresolved local labels: {sorted(missing)}")
        cleaned = re.sub(
            r"(SECTION \.text[^\n]*\n)",
            rf"\1L_{tag}_anon_{next(iter(missing))}:\n",
            cleaned,
            count=1,
        )
    section_references = set(
        re.findall(rf"\bL_{tag}_section_([0-9]+)_([0-9A-F]+)\b", cleaned)
    )
    section_definitions = set(
        re.findall(
            rf"^L_{tag}_section_([0-9]+)_([0-9A-F]+):",
            cleaned,
            flags=re.MULTILINE,
        )
    )
    unresolved_sections = section_references - section_definitions
    if unresolved_sections:
        raise RuntimeError(
            f"{obj}: unresolved section boundaries: {sorted(unresolved_sections)}"
        )
    return cleaned


def gcc_asm_to_nasm(text: str, tag: str) -> str:
    globals_ = set(
        re.findall(r"^\s*\.globl\s+([A-Za-z_.$][A-Za-z0-9_.$]*)", text,
                   flags=re.MULTILINE)
    )
    definitions = set(
        re.findall(r"^([A-Za-z_.$][A-Za-z0-9_.$]*):", text,
                   flags=re.MULTILINE)
    )
    definitions.update(
        re.findall(
            r"^\s*\.set\s+([A-Za-z_.$][A-Za-z0-9_.$]*)\s*,",
            text,
            flags=re.MULTILINE,
        )
    )
    for index, symbol in enumerate(
        sorted(definitions - globals_, key=lambda value: (-len(value), value))
    ):
        text = replace_symbol(text, symbol, f"L_{tag}_gcc_{index}")

    output: list[str] = []
    skipping_note = False
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("#"):
            continue
        if line == ".text":
            skipping_note = False
            output.append("SECTION .text progbits alloc exec nowrite align=16")
            continue
        if line == ".data":
            skipping_note = False
            output.append("SECTION .data progbits alloc noexec write align=16")
            continue
        if line == ".bss":
            skipping_note = False
            output.append("SECTION .bss nobits alloc noexec write align=16")
            continue
        if line == ".rodata":
            skipping_note = False
            output.append(
                "SECTION .rodata progbits alloc noexec nowrite align=16"
            )
            continue
        if line.startswith(".section"):
            match = re.match(r"\.section\s+([^,\s]+)", line)
            if not match:
                raise RuntimeError(f"unrecognized GCC section: {line}")
            name = match.group(1)
            skipping_note = name == ".note.GNU-stack"
            if skipping_note:
                continue
            if name.startswith(".text"):
                attributes = "progbits alloc exec nowrite"
            elif name == ".bss":
                attributes = "nobits alloc noexec write"
            elif name.startswith(".data"):
                attributes = "progbits alloc noexec write"
            else:
                attributes = "progbits alloc noexec nowrite"
            output.append(f"SECTION {name} {attributes}")
            continue
        if skipping_note:
            continue
        if line.startswith(
            (".file", ".intel_syntax", ".globl", ".hidden", ".type",
             ".size", ".ident")
        ):
            continue
        if line.startswith(".p2align"):
            power = int(line.split()[1].split(",", 1)[0], 0)
            output.append(f"ALIGN {1 << power}")
            continue
        if line.startswith(".align"):
            output.append(f"ALIGN {int(line.split()[1].split(',', 1)[0], 0)}")
            continue
        directive_map = {
            ".quad": "dq",
            ".long": "dd",
            ".value": "dw",
            ".byte": "db",
        }
        directive = line.split(None, 1)[0]
        if directive in directive_map:
            argument = line.split(None, 1)[1]
            output.append(f"        {directive_map[directive]} {argument}")
            continue
        if directive in (".string", ".ascii"):
            literal = line.split(None, 1)[1]
            value = ast.literal_eval(literal).encode("latin1")
            if directive == ".string":
                value += b"\0"
            output.append(
                "        db " + ", ".join(f"0{byte:02X}H" for byte in value)
            )
            continue
        if directive == ".base64":
            value = base64.b64decode(ast.literal_eval(line.split(None, 1)[1]))
            output.append(
                "        db " + ", ".join(f"0{byte:02X}H" for byte in value)
            )
            continue
        if directive == ".zero":
            output.append(f"        times {line.split(None, 1)[1]} db 0")
            continue
        if directive == ".set":
            name, value = (
                part.strip() for part in line.split(None, 1)[1].split(",", 1)
            )
            output.append(f"{name} equ {value}")
            continue
        if line.startswith("."):
            raise RuntimeError(f"unsupported GCC directive: {line}")

        line = re.sub(
            r"\[QWORD PTR ([A-Za-z_.$][A-Za-z0-9_.$]*)\[([^\]]+)\]\]",
            r"qword [\1+\2]",
            line,
        )
        line = re.sub(
            r"\[QWORD PTR (\[[^\]]+\])\]",
            r"qword \1",
            line,
        )
        line = re.sub(
            r"\b(QWORD|DWORD|WORD|BYTE) PTR "
            r"([A-Za-z_.$][A-Za-z0-9_.$]*)\[([^\]]+)\]",
            lambda match: (
                f"{match.group(1).lower()} "
                f"[{match.group(2)}+{match.group(3)}]"
            ),
            line,
        )
        size_names = {
            "ZMMWORD": "zword",
            "YMMWORD": "yword",
            "XMMWORD": "oword",
            "QWORD": "qword",
            "DWORD": "dword",
            "WORD": "word",
            "BYTE": "byte",
        }
        for gas_name, nasm_name in size_names.items():
            line = re.sub(rf"\b{gas_name} PTR\s+", f"{nasm_name} ", line)
        line = re.sub(
            r"\b([A-Za-z_.$][A-Za-z0-9_.$]*)\[rip([+-][0-9]+)?\]",
            lambda match: (
                f"[rel {match.group(1)}{match.group(2) or ''}]"
            ),
            line,
        )
        line = re.sub(
            r"\b([A-Za-z_.$][A-Za-z0-9_.$]*)\[([^\]]+)\]",
            r"[\1+\2]",
            line,
        )
        line = re.sub(
            r"\[([A-Za-z_.$][A-Za-z0-9_.$]*)\+rip([+-][0-9]+)?\]",
            lambda match: f"[rel {match.group(1)}{match.group(2) or ''}]",
            line,
        )
        line = line.replace("OFFSET FLAT:", "")
        line = re.sub(r"^movabs\b", "mov", line)
        line = re.sub(r"^((?:sh[rl]|sa[rl])\s+[^,]+)$", r"\1, 1", line)
        output.append(line)
    return "\n".join(output) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("upstream", type=Path)
    parser.add_argument("objconv", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--optimization",
        default="-O2",
        choices=("-O2", "-O3"),
        help="GCC optimization level (default: -O2)",
    )
    parser.add_argument(
        "--march",
        default="x86-64",
        help="GCC instruction-set target (default: x86-64)",
    )
    parser.add_argument(
        "--mtune",
        default="generic",
        help="GCC scheduling target (default: generic)",
    )
    parser.add_argument(
        "--symbolic-all",
        action="store_true",
        help="convert GCC symbolic Intel assembly for every translation unit",
    )
    parser.add_argument(
        "--profile-dir",
        type=Path,
        help="consume GCC profile data whose files are named after source tags",
    )
    parser.add_argument(
        "--hot-source",
        action="append",
        default=list(DEFAULT_HOT_SOURCES),
        help=(
            "c/-relative source to compile with the hot-source target flags "
            "(default: enc/backward_references_hq.c)"
        ),
    )
    parser.add_argument(
        "--no-hot-sources",
        action="store_const",
        const=[],
        dest="hot_source",
        help="disable the release HQ O3 translation",
    )
    parser.add_argument(
        "--hot-optimization",
        default="-O3",
        choices=("-O2", "-O3"),
        help="optimization level for --hot-source units (default: -O3)",
    )
    parser.add_argument(
        "--hot-march",
        default="x86-64",
        help="instruction target for --hot-source units (default: x86-64)",
    )
    parser.add_argument(
        "--hot-mtune",
        default="generic",
        help="scheduling target for --hot-source units (default: generic)",
    )
    parser.add_argument(
        "--hot-extra-flag",
        action="append",
        default=[],
        help="additional GCC flag for --hot-source units",
    )
    parser.add_argument(
        "--avx512-match-length",
        type=Path,
        default=Path(__file__).with_name("avx512-find-match-length.h"),
        help="matching-prefix override header (defaults to the AVX-512 helper)",
    )
    parser.add_argument(
        "--no-avx512-match-length",
        action="store_const",
        const=None,
        dest="avx512_match_length",
        help="regenerate with upstream's scalar matching-prefix helper",
    )
    args = parser.parse_args()

    upstream = args.upstream.resolve()
    objconv = args.objconv.resolve()
    output = args.output.resolve()
    commit = run("git", "rev-parse", "HEAD", cwd=upstream).strip()
    if commit != EXPECTED_COMMIT:
        raise SystemExit(
            f"expected Google Brotli 1.2.0 commit {EXPECTED_COMMIT}, got {commit}"
        )

    sources = sorted((upstream / "c/common").glob("*.c"))
    sources += sorted((upstream / "c/dec").glob("*.c"))
    sources += sorted((upstream / "c/enc").glob("*.c"))

    with tempfile.TemporaryDirectory(prefix="brotli-nasm-") as temporary:
        build = Path(temporary)
        chunks = [
            "; Generated from Google Brotli 1.2.0 (MIT).",
            f"; Upstream commit: {EXPECTED_COMMIT}",
            "; Regenerate with tools/generate-upstream-asm.py; do not edit by hand.",
            "",
        ]
        for source in sources:
            relative = source.relative_to(upstream / "c")
            tag = safe_tag(relative)
            obj = build / f"{tag}.o"
            asm = build / f"{tag}.asm"
            is_hot_source = str(relative) in args.hot_source
            optimization = (
                args.hot_optimization if is_hot_source else args.optimization
            )
            march = args.hot_march if is_hot_source else args.march
            mtune = args.hot_mtune if is_hot_source else args.mtune
            compiler_arguments = [
                "gcc",
                "-I",
                str(upstream / "c/include"),
                "-I",
                str(upstream),
                optimization,
                "-DNDEBUG",
                f"-march={march}",
                f"-mtune={mtune}",
                "-fno-semantic-interposition",
                "-fno-stack-protector",
                "-fno-asynchronous-unwind-tables",
                "-fno-unwind-tables",
                "-fno-pic",
            ]
            if is_hot_source:
                compiler_arguments += args.hot_extra_flag
            if args.profile_dir is not None:
                compiler_arguments += [
                    f"-fprofile-use={args.profile_dir.resolve()}",
                    "-fprofile-correction",
                ]
            if (
                args.avx512_match_length is not None
                and relative in MATCH_LENGTH_SOURCES
            ):
                compiler_arguments += [
                    "-include",
                    str(args.avx512_match_length.resolve()),
                ]
            if (
                args.symbolic_all
                or is_hot_source
                or relative == Path("dec/decode.c")
            ):
                run(
                    *compiler_arguments,
                    "-S",
                    "-masm=intel",
                    str(source),
                    "-o",
                    str(asm),
                )
                chunks.append(f"; ---- c/{relative} (GCC symbolic NASM) ----")
                generated = gcc_asm_to_nasm(asm.read_text(), tag)
                if relative == Path("enc/utf8_util.c"):
                    generated = replace_symbol(
                        generated,
                        "BrotliIsMostlyUTF8",
                        "BrotliIsMostlyUTF8Scalar",
                    )
                chunks.append(generated)
                continue
            run(
                *compiler_arguments,
                "-c",
                str(source),
                "-o",
                str(obj),
            )
            run(str(objconv), "-fnasm", str(obj), str(asm))
            chunks.append(f"; ---- c/{relative} ----")
            generated = clean_objconv(asm.read_text(), obj, tag)
            if relative == Path("enc/utf8_util.c"):
                generated = replace_symbol(
                    generated,
                    "BrotliIsMostlyUTF8",
                    "BrotliIsMostlyUTF8Scalar",
                )
            chunks.append(generated)

        output.parent.mkdir(parents=True, exist_ok=True)
        temporary_output = output.with_suffix(output.suffix + ".tmp")
        temporary_output.write_text("\n".join(chunks))
        os.replace(temporary_output, output)


if __name__ == "__main__":
    main()
