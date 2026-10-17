#!/usr/bin/env python3
"""The rack products in a build: `rack-products.json` and `racks/` (#935).

A rack product (`library/racks/<vendor>/<name>/rack.yaml`) is compiled to
JSON, because the kit consumes compiled artifacts and never reads YAML:

- `racks/<vendor>--<name>.rack.json` - the manifest, as it is written;
- `racks/rack-product.schema.json` - the schema it was checked against, so a
  reader with a product and no checkout can validate it;
- `rack-products.json` - one row per rack, the picker's view: its ref
  (`<vendor>/<name>@<major>`, the form a saved rack file's `frame.ref` takes),
  its identity and the numbers a list shows.

It is a different file from `rack.json`, the Rack Builder's catalogue of
placeable devices, which a product does not change. `npm_packages.py` ships
each product as its own package from these files.

build.sh runs it through registry_index.py, which already ships the library's
other source-tree files; it also runs on its own.

Several roots are read as one library, and a rack in two of them is an error
that names both: an overlay adds racks and never replaces one.

    racks_index.py --library library --out library/dist
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

from portrayal import libwalk
from portrayal.manifest import load_yaml

FORMAT = 1
SCHEMA = "rack-product.schema.json"


def row(key, doc):
    vendor, name = key.split("/")
    major = int(str(doc["version"]).split(".")[0])
    out = {"ref": f"{key}@{major}", "vendor": vendor, "name": name,
           "version": doc["version"], "major": major,
           "manufacturer": doc["manufacturer"], "model": doc["model"],
           "form": doc["form"], "ru": doc["ru"], "maturity": doc["maturity"]}
    names = [a["name"] for a in doc.get("aliases") or []]
    if names:
        out["aliases"] = names
    out["file"] = f"racks/{vendor}--{name}.rack.json"
    return out


def build(roots, out, schemas):
    """Write the products of `roots` under `out`; return the rows."""
    out, schemas = Path(out), Path(schemas)
    racks_dir = out / "racks"
    racks_dir.mkdir(parents=True, exist_ok=True)
    seen, rows = {}, []
    for root in roots:
        for f in libwalk.iter_racks([root]):
            key = libwalk.rack_key(f)
            if key in seen:
                raise SystemExit(f"rack {key} is in both {seen[key]} and {root}; an overlay "
                                 "adds to the public library and never replaces an entry of it")
            seen[key] = root
            doc = load_yaml(f)
            vendor, name = key.split("/")
            (racks_dir / f"{vendor}--{name}.rack.json").write_text(
                json.dumps(doc, indent=1, sort_keys=False, ensure_ascii=False) + "\n")
            rows.append(row(key, doc))
    shutil.copyfile(schemas / SCHEMA, racks_dir / SCHEMA)
    (out / "rack-products.json").write_text(json.dumps(
        {"format": FORMAT,
         "generated-from": "library/racks/*/*/rack.yaml, by racks_index.py",
         "racks": rows}, indent=1, sort_keys=True, ensure_ascii=False) + "\n")
    return rows


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--library", action="append", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--schemas", default="spec/schemas")
    a = ap.parse_args(argv)
    rows = build([Path(r) for r in a.library], a.out, a.schemas)
    print(f"racks_index: {len(rows)} rack products -> {a.out}/rack-products.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
