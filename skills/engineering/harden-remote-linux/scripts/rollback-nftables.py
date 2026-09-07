#!/usr/bin/env python3
"""Restore persistence files and only the skill-owned nftables table."""

import argparse
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile


TABLE = {"family": "inet", "name": "host_public_ingress"}
ABSENT = "__ABSENT__"
OBJECTS = {"table", "chain", "rule", "set", "map", "element", "counter", "quota", "limit"}


def read_snapshot(filename):
    if filename == ABSENT:
        return []
    data = json.loads(Path(filename).read_text())
    if not isinstance(data, dict) or set(data) != {"nftables"} or not isinstance(data["nftables"], list):
        raise ValueError("Expected nft --json list table output.")
    commands = []
    table_count = 0
    for entry in data["nftables"]:
        if not isinstance(entry, dict) or len(entry) != 1:
            raise ValueError("Invalid snapshot object.")
        kind, value = next(iter(entry.items()))
        if kind == "metainfo":
            continue
        if kind not in OBJECTS or not isinstance(value, dict):
            raise ValueError("Snapshot must contain table declarations, not commands.")
        name = value.get("name" if kind == "table" else "table")
        if value.get("family") != TABLE["family"] or name != TABLE["name"]:
            raise ValueError("Snapshot contains an object outside inet host_public_ingress.")
        if kind == "table":
            table_count += 1
        elif table_count != 1:
            raise ValueError("Snapshot must declare its table before its contents.")
        if kind == "chain" and value.get("hook") not in (None, "input"):
            raise ValueError("Snapshot contains a non-input base chain.")
        # Rule handles and indexes refer to the old table and must not control
        # insertion into its replacement. Preserve declaration order instead.
        value = {key: item for key, item in value.items() if key not in {"handle", "index"}}
        commands.append({"add": {kind: value}})
    if table_count != 1:
        raise ValueError("Snapshot must contain exactly one owned table.")
    return commands


def nft(*args, payload=None):
    return subprocess.run(["nft", *args], input=payload, universal_newlines=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True).stdout


def persistence_files(pairs):
    files = []
    failures = []
    targets = set()
    for backup, target in pairs:
        try:
            target = Path(target)
            if not target.is_absolute() or target.is_symlink() or not target.parent.is_dir():
                raise ValueError("Targets must be absolute, non-symlink paths with existing parents.")
            if target.exists() and not target.is_file():
                raise ValueError("Target must be a regular file.")
            if target in targets:
                raise ValueError("Duplicate persistence target.")
            targets.add(target)
            if backup != ABSENT and (not Path(backup).is_absolute() or not Path(backup).is_file()):
                raise ValueError("Backup must be an existing absolute file path or __ABSENT__.")
            files.append((backup, target))
        except (OSError, ValueError) as error:
            failures.append(f"{target}: {error}")
    return files, failures


def remove_if_present(path):
    try:
        path.unlink()
    except FileNotFoundError:
        pass


def restore_file(backup, target):
    if backup == ABSENT:
        remove_if_present(target)
        return
    info = Path(backup).stat()
    fd, temporary = tempfile.mkstemp(prefix=".hardening-rollback-", dir=target.parent)
    os.close(fd)
    try:
        shutil.copyfile(backup, temporary)
        os.chmod(temporary, stat.S_IMODE(info.st_mode))
        os.chown(temporary, info.st_uid, info.st_gid)
        os.replace(temporary, target)
    finally:
        remove_if_present(Path(temporary))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--table-backup", required=True, help="Owned-table JSON snapshot or __ABSENT__")
    parser.add_argument("--file", nargs=2, action="append", default=[], metavar=("BACKUP_OR_ABSENT", "TARGET"))
    parser.add_argument("--check", action="store_true", help="Validate the rollback without applying it")
    args = parser.parse_args()
    commands = read_snapshot(args.table_backup)
    files, failures = persistence_files(args.file)
    if args.check and failures:
        raise ValueError("Invalid persistence inputs: " + "; ".join(failures))
    current = json.loads(nft("--json", "list", "tables"))
    if any(entry.get("table", {}).get("family") == TABLE["family"]
           and entry.get("table", {}).get("name") == TABLE["name"]
           for entry in current["nftables"]):
        commands.insert(0, {"delete": {"table": TABLE}})
    payload = json.dumps({"nftables": commands})
    if commands:
        nft("--json", "--check", "--file", "-", payload=payload)
    if args.check:
        print("Rollback inputs and owned-table transaction validated; nothing changed.")
        return
    # Restore connectivity first. Persistence failures must not prevent the
    # runtime rollback; report them and attempt every remaining file.
    if commands:
        nft("--json", "--file", "-", payload=payload)
    for backup, target in files:
        try:
            restore_file(backup, target)
        except OSError as error:
            failures.append(f"{target}: {error}")
    if failures:
        raise ValueError("Runtime restored, but persistence restore failed: " + "; ".join(failures))
    print("Restored only inet host_public_ingress and the listed persistence files.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        detail = error.stderr if isinstance(error, subprocess.CalledProcessError) else str(error)
        print(f"Rollback failed: {detail}", file=sys.stderr)
        sys.exit(1)
