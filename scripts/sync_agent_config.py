#!/usr/bin/env python3
"""Sync repository agent instructions to Claude Code and Kimi Code."""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPO_ROOT / "config" / "AGENTS.md"
LEGACY_SOURCE = REPO_ROOT / "config" / "AGENT.md"


@dataclass(frozen=True)
class Target:
    name: str
    root: Path
    document_name: str

    @property
    def document_path(self) -> Path:
        return self.root / self.document_name


def expand_path(path: str | Path) -> Path:
    return Path(path).expanduser().resolve()


def resolve_source(source_arg: str | None) -> Path:
    if source_arg:
        return expand_path(source_arg)
    if DEFAULT_SOURCE.exists():
        return DEFAULT_SOURCE.resolve()
    return LEGACY_SOURCE.resolve()


def read_source(source: Path) -> bytes:
    if not source.exists():
        raise FileNotFoundError(f"source file does not exist: {source}")
    if not source.is_file():
        raise IsADirectoryError(f"source is not a file: {source}")
    return source.read_bytes()


def same_content(path: Path, content: bytes) -> bool:
    return path.exists() and path.is_file() and path.read_bytes() == content


def write_atomic(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "wb") as tmp_file:
            tmp_file.write(content)
            tmp_file.flush()
            os.fsync(tmp_file.fileno())
        shutil.copymode(path, tmp_path) if path.exists() else tmp_path.chmod(0o644)
        os.replace(tmp_path, path)
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def build_targets(args: argparse.Namespace) -> list[Target]:
    all_targets = {
        "claude": Target("claude", expand_path(args.claude_root), "CLAUDE.md"),
        "kimi": Target("kimi", expand_path(args.kimi_root), "AGENTS.md"),
    }
    if args.target == "all":
        return [all_targets["claude"], all_targets["kimi"]]
    return [all_targets[args.target]]


def sync_target(target: Target, content: bytes, dry_run: bool) -> str:
    if target.document_path.exists() and target.document_path.is_dir():
        raise IsADirectoryError(f"target document path is a directory: {target.document_path}")
    if same_content(target.document_path, content):
        return "unchanged"
    existed = target.document_path.exists()
    if dry_run:
        return "would_update" if existed else "would_create"
    write_atomic(target.document_path, content)
    return "updated" if existed else "created"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync config/AGENTS.md to Claude Code CLAUDE.md and Kimi Code AGENTS.md."
    )
    parser.add_argument(
        "--source",
        help="source agent instruction file; defaults to config/AGENTS.md, with config/AGENT.md fallback",
    )
    parser.add_argument(
        "--target",
        choices=("all", "claude", "kimi"),
        default="all",
        help="target tool to sync; defaults to all",
    )
    parser.add_argument(
        "--claude-root",
        default=os.environ.get("CLAUDE_CONFIG_DIR") or os.environ.get("CLAUDE_HOME") or "~/.claude",
        help="Claude config root; defaults to CLAUDE_CONFIG_DIR, CLAUDE_HOME, then ~/.claude",
    )
    parser.add_argument(
        "--kimi-root",
        default=os.environ.get("KIMI_CODE_HOME") or "~/.kimi-code",
        help="Kimi Code root; defaults to KIMI_CODE_HOME, then ~/.kimi-code",
    )
    parser.add_argument("--dry-run", action="store_true", help="preview changes without writing files")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source = resolve_source(args.source)

    try:
        content = read_source(source)
        targets = build_targets(args)
        print(f"source: {source}")
        for target in targets:
            status = sync_target(target, content, args.dry_run)
            print(f"{target.name}: {status} -> {target.document_path}")
    except OSError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
