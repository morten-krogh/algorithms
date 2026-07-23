#!/usr/bin/env python3
"""Regenerate the NASM Brotli core from Google Brotli 1.2.0.

The generated file is checked in; neither this script nor a C compiler is
needed to build the released library and CLI.  ObjConv emits valid NASM for
the selected AVX2 baseline.  This script gives translation-unit-local ELF
symbols unique names and combines the units into one include file.
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
    return sorted(set(symbols), key=len, reverse=True)


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
    for index, symbol in enumerate(
        sorted(definitions - globals_, key=len, reverse=True)
    ):
        text = replace_symbol(text, symbol, f"L_{tag}_gcc_{index}")

    output: list[str] = []
    skipping_note = False
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line == ".text":
            skipping_note = False
            output.append("SECTION .text progbits alloc exec nowrite align=16")
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
                "        db " + ", ".join(f"{byte:02X}H" for byte in value)
            )
            continue
        if directive == ".base64":
            value = base64.b64decode(ast.literal_eval(line.split(None, 1)[1]))
            output.append(
                "        db " + ", ".join(f"{byte:02X}H" for byte in value)
            )
            continue
        if directive == ".zero":
            output.append(f"        times {line.split(None, 1)[1]} db 0")
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
            compiler_arguments = [
                "gcc",
                "-I",
                str(upstream / "c/include"),
                "-I",
                str(upstream),
                "-O2",
                "-DNDEBUG",
                "-march=x86-64",
                "-mtune=generic",
                "-fno-semantic-interposition",
                "-fno-stack-protector",
                "-fno-asynchronous-unwind-tables",
                "-fno-unwind-tables",
                "-fno-pic",
            ]
            if relative == Path("dec/decode.c"):
                run(
                    *compiler_arguments,
                    "-S",
                    "-masm=intel",
                    str(source),
                    "-o",
                    str(asm),
                )
                chunks.append(f"; ---- c/{relative} (GCC symbolic NASM) ----")
                chunks.append(gcc_asm_to_nasm(asm.read_text(), tag))
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
            chunks.append(clean_objconv(asm.read_text(), obj, tag))

        output.parent.mkdir(parents=True, exist_ok=True)
        temporary_output = output.with_suffix(output.suffix + ".tmp")
        temporary_output.write_text("\n".join(chunks))
        os.replace(temporary_output, output)


if __name__ == "__main__":
    main()
