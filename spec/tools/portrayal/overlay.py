#!/usr/bin/env python3
"""An overlay library: devices and components kept in another folder, built on
top of this one.

A downstream project that wants its own devices without forking this repository
keeps them in a folder shaped like `library/` and builds them with

    build.sh --overlay-library DIR --overlay-out OUT

The overlay's devices see the public components plus the overlay's own, and
their drawings and indexes go to OUT. The public dist is not touched. The kit
loads OUT beside the public dist (kit/dist.js, kit/rack/catalog.js).

THE ONE RULE IS THAT AN OVERLAY ADDS AND NEVER REPLACES. `contract_path` searches
its roots in order and the first match wins, so an overlay component with a
public ref would silently change how every public device that seats it is
drawn, and a device name is a filename in a dist, so two of them would render
over each other. `check` refuses both before anything is linted or drawn, and
names the public file and the overlay file.

    overlay.py check --library library --overlay DIR
"""
import argparse
import sys
from pathlib import Path

from portrayal import libwalk
from portrayal.manifest import load_yaml

# What an overlay may hold, by kind: the glob under a root, and how the id reads.
# A path is the id of a thing the library keys by its place - a part by
# `ns/name@major`, a device by `ns/model` - so the same path under two roots is
# the same thing under two roots.
KINDS = (
    ("component", libwalk.iter_components, libwalk.ref_of),
    ("device", libwalk.iter_devices, lambda f: f"{f.parent.parent.name}/{f.parent.name}"),
    ("listing", libwalk.iter_listings, libwalk.listing_key),
    ("lab", libwalk.iter_labs, lambda f: f.parent.name),
)


def _within(a, b):
    a, b = Path(a).resolve(), Path(b).resolve()
    return a == b or b in a.parents


def findings(public_roots, overlay_root):
    """Every way the overlay at `overlay_root` clashes with the public roots, as
    sentences. [] when it only adds."""
    out = []
    overlay_root = Path(overlay_root)
    if not overlay_root.is_dir():
        return [f"overlay: {overlay_root} is not a folder"]
    for pub in public_roots:
        if _within(overlay_root, pub) or _within(pub, overlay_root):
            out.append(f"overlay: {overlay_root} and the public library {pub} contain one another; "
                       "an overlay is a separate folder")
    if out:
        return out

    def held(root, walk, ident):
        found = {}
        for f in walk([root]):
            found.setdefault(ident(f), f)
        return found

    for kind, walk, ident in KINDS:
        public = {}
        for pub in public_roots:
            for k, f in held(pub, walk, ident).items():
                public.setdefault(k, f)
        for k, f in held(overlay_root, walk, ident).items():
            if k in public:
                out.append(f"overlay: {kind} {k} is in the public library ({public[k]}) and in the "
                           f"overlay ({f}). An overlay adds to the public library and never replaces "
                           "an entry of it; rename the overlay's")
    # A DEVICE'S NAME IS ITS FILENAME IN A DIST (devices_index.check_unique_names),
    # and the kit reads two dists as one library, so a name has to be unique
    # across both even where the directories differ.
    names = {}
    for pub in public_roots:
        for f in libwalk.iter_devices([pub]):
            names.setdefault((load_yaml(f) or {}).get("name"), f)
    for f in libwalk.iter_devices([overlay_root]):
        name = (load_yaml(f) or {}).get("name")
        if name in names:
            out.append(f"overlay: device name {name!r} is in the public library ({names[name]}) and in "
                       f"the overlay ({f}). A device's name is its filename in a dist, so the two would "
                       "render over each other; rename the overlay's")
    return out


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check", help="refuse an overlay that clashes with the public library")
    c.add_argument("--library", action="append", required=True, help="a public library root (repeatable)")
    c.add_argument("--overlay", required=True, help="the overlay library root")
    args = ap.parse_args()
    bad = findings(args.library, args.overlay)
    for line in bad:
        print(line, file=sys.stderr)
    if bad:
        return 1
    print(f"overlay: {args.overlay} only adds to {', '.join(args.library)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
