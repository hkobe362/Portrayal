"""The build's view of rack products: `rack-products.json` and `racks/` in dist.

`racks_index.py` is the only thing that turns `library/racks/**/rack.yaml` into
dist files. The catalogue row carries what a picker needs without opening the
product; the product file is the manifest as JSON, so a consumer never reads
YAML (the kit's rule), and the schema it was checked against travels beside it.
"""
import json
import pathlib

import yaml

from portrayal import libwalk, racks_index

ROOT = pathlib.Path(__file__).resolve().parents[2]
LIB = ROOT / "library"

DOC = {
    "format": 1, "kind": "rack", "name": "frame-4p", "version": "2.1.0",
    "maturity": "modelled", "manufacturer": "Acme", "model": "FRAME-4P",
    "form": "4-post-frame", "ru": 42, "numbering": {"direction": "bottom-up", "start": 1},
    "holes": {"style": "square"}, "rails": [{"id": "front"}, {"id": "rear"}],
    "aliases": [{"name": "F4P", "kind": "marketing"}],
}


def lib_with_rack(tmp):
    d = tmp / "racks" / "acme" / "frame-4p"
    d.mkdir(parents=True)
    (d / "rack.yaml").write_text(yaml.safe_dump(DOC, sort_keys=False))
    return tmp


def test_the_catalogue_row_names_the_product_by_vendor_name_and_major(tmp_path):
    out = tmp_path / "dist"
    racks_index.build([lib_with_rack(tmp_path / "lib")], out, ROOT / "spec/schemas")
    cat = json.loads((out / "rack-products.json").read_text())
    assert cat["format"] == 1
    assert cat["racks"] == [{
        "ref": "acme/frame-4p@2", "vendor": "acme", "name": "frame-4p", "version": "2.1.0",
        "major": 2, "manufacturer": "Acme", "model": "FRAME-4P", "form": "4-post-frame",
        "ru": 42, "maturity": "modelled", "aliases": ["F4P"],
        "file": "racks/acme--frame-4p.rack.json"}]


def test_the_product_file_is_the_manifest_as_json(tmp_path):
    out = tmp_path / "dist"
    racks_index.build([lib_with_rack(tmp_path / "lib")], out, ROOT / "spec/schemas")
    assert json.loads((out / "racks/acme--frame-4p.rack.json").read_text()) == DOC
    assert (out / "racks/rack-product.schema.json").read_bytes() == \
        (ROOT / "spec/schemas/rack-product.schema.json").read_bytes()


def test_a_library_with_no_racks_writes_an_empty_catalogue(tmp_path):
    (tmp_path / "lib").mkdir()
    out = tmp_path / "dist"
    racks_index.build([tmp_path / "lib"], out, ROOT / "spec/schemas")
    assert json.loads((out / "rack-products.json").read_text())["racks"] == []
    assert not list((out / "racks").glob("*.rack.json"))


def test_the_output_is_the_same_twice(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    lib = lib_with_rack(tmp_path / "lib")
    racks_index.build([lib], a, ROOT / "spec/schemas")
    racks_index.build([lib], b, ROOT / "spec/schemas")
    assert (a / "rack-products.json").read_bytes() == (b / "rack-products.json").read_bytes()


def test_two_roots_holding_one_rack_are_refused(tmp_path):
    one = lib_with_rack(tmp_path / "one")
    two = lib_with_rack(tmp_path / "two")
    try:
        racks_index.build([one, two], tmp_path / "dist", ROOT / "spec/schemas")
    except SystemExit as e:
        assert "acme/frame-4p" in str(e)
    else:
        raise AssertionError("an overlay replaced a public rack")


def test_the_library_catalogue_lists_every_rack(tmp_path):
    out = tmp_path / "dist"
    racks_index.build([LIB], out, ROOT / "spec/schemas")
    cat = json.loads((out / "rack-products.json").read_text())
    assert [r["ref"].split("@")[0] for r in cat["racks"]] == \
        [libwalk.rack_key(f) for f in libwalk.iter_racks([LIB])]
