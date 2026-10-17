#!/usr/bin/env python3
"""Guard the publish of `@portrayal/kit`.

A pull request does not bump the kit's version; it adds a changelog fragment.
The version is set once, when the kit is published, and this is the check that
run before `npm publish`:

    python3 spec/tools/portrayal/kitrelease.py --publish

It fails unless `kit/package.json` holds a plain `major.minor.patch` version and
the newest "New in X" note in `kit/README.md` names that same version.
Without `--publish` it checks only that the version is well formed.
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SEMVER = re.compile(r"\d+\.\d+\.\d+")
NEW_IN = re.compile(r"New in (\d+(?:\.\d+)*)")


def _version_key(v):
    return tuple(int(p) for p in v.split("."))


def problems(root=ROOT, publishing=False):
    root = Path(root)
    version = json.loads((root / "kit/package.json").read_text())["version"]
    if not SEMVER.fullmatch(version):
        return [f"kit/package.json version {version!r} is not major.minor.patch"]
    if not publishing:
        return []
    named = NEW_IN.findall((root / "kit/README.md").read_text())
    newest = max(named, key=_version_key) if named else None
    if newest != version:
        return [f"kit/package.json says {version} but the newest 'New in' note of "
                f"kit/README.md names {newest}: write the note for {version}, or fix the version"]
    return []


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--publish", action="store_true", help="also require the README to name the version")
    args = ap.parse_args(argv)
    found = problems(ROOT, publishing=args.publish)
    for line in found:
        print(f"FAIL {line}")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
