"""#935 step 2: the first two rack products, APC's open frames AR203A and AR201.

Every figure is read from APC's own public documents - the AR203A and AR201
product data sheets on the maker's site, the NetShelter four-post rack manual
and the two-post installation sheet. A figure no sheet prints is a stand-in,
and a stand-in says so three ways: its provenance confidence is `estimated`,
a `gaps` entry asks for the document that would close it, and the note names
what it stands in for. Nothing is guessed quietly.
"""
import json
import pathlib

import pytest
from jsonschema import Draft202012Validator

from portrayal import devicelock, lint, libwalk
from portrayal.manifest import load_yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
LIB = ROOT / "library"
SCHEMA = json.loads((ROOT / "spec/schemas/rack-product.schema.json").read_text())

# what each data sheet prints, and the stand-ins the sheets leave to a standard
WANT = {
    "apc/ar203a": {
        "form": "4-post-frame", "ru": 44, "width": 19,
        "holes": {"style": "square", "size": 9.5, "fixing": "M6"},
        "rails": [{"id": "front"}, {"id": "rear", "depth": {"fixed": 740}}],
        "max-device-depth": 740,
        "outer": {"w": 600, "h": 2130, "d": 747},
        "weight-kg": 40.32,
        "load": {"static-kg": 907.2},
        "model": "AR203A",
    },
    "apc/ar201": {
        "form": "2-post-frame", "ru": 45, "width": 19,
        "holes": {"style": "tapped", "thread": "12-24"},
        "rails": [{"id": "front"}],
        "max-device-depth": 1048,
        "outer": {"w": 513, "h": 2136, "d": 376},
        "weight-kg": 11.82,
        "load": {"static-kg": 340.2},
        "model": "AR201",
    },
}
# EIA-310 figures, and the direction no sheet gives: declared, not read
STAND_INS = ["numbering", "hole-centres", "opening"]


def rack(key):
    return load_yaml(LIB / "racks" / key / "rack.yaml")


def test_both_products_are_in_the_library_under_the_maker():
    keys = [libwalk.rack_key(f) for f in libwalk.iter_racks([LIB])]
    assert {"apc/ar203a", "apc/ar201"} <= set(keys)


@pytest.mark.parametrize("key", sorted(WANT))
def test_the_product_matches_its_schema(key):
    assert list(Draft202012Validator(SCHEMA).iter_errors(rack(key))) == []


@pytest.mark.parametrize("key", sorted(WANT))
def test_every_printed_figure_is_the_sheets(key):
    doc = rack(key)
    for k, v in WANT[key].items():
        assert doc[k] == v, (key, k)
    assert doc["kind"] == "rack" and doc["manufacturer"] == "APC"
    assert doc["name"] == key.split("/")[1]


@pytest.mark.parametrize("key", sorted(WANT))
def test_the_stand_ins_are_eia_310_and_the_direction_of_the_default(key):
    doc = rack(key)
    assert doc["numbering"] == {"direction": "bottom-up", "start": 1}
    assert doc["hole-centres"] == 465.1 and doc["opening"] == 450.85


@pytest.mark.parametrize("key", sorted(WANT))
def test_a_stand_in_is_declared_three_ways(key):
    doc = rack(key)
    gaps = {g["what"]: g for g in doc.get("gaps") or []}
    for fig in STAND_INS:
        prov = doc["provenance"][fig]
        assert prov["confidence"] == "estimated", (key, fig)
        assert "stand" in prov["note"].lower(), (key, fig)
        assert fig in gaps, (key, fig)
        assert gaps[fig]["reason"] in {"vendor-silent", "needs-drawing"}, (key, fig)


@pytest.mark.parametrize("key", sorted(WANT))
def test_every_other_figure_has_a_sourced_provenance_entry(key):
    doc = rack(key)
    figures = ["ru", "form", "width", "holes", "rails", "max-device-depth", "outer",
               "weight-kg", "load"]
    for fig in figures:
        prov = doc["provenance"].get(fig)
        assert prov and prov["note"].strip(), (key, fig)
        assert prov["confidence"] in {"datasheet", "drawing", "measured"}, (key, fig)
    stated = set(doc["provenance"]) - set(figures) - set(STAND_INS)
    assert not stated, f"provenance for a figure the rack does not state: {stated}"


@pytest.mark.parametrize("key", sorted(WANT))
def test_the_sources_are_registered_and_public(key):
    doc = rack(key)
    assert "data sheet" in doc["datasheet"]["title"].lower()
    assert doc["datasheet"]["url"].startswith("https://www.se.com/")
    assert doc["references"], "the manual or installation sheet the other figures came from"
    for r in doc["references"] + [doc["datasheet"]]:
        assert r.get("url", "https://").startswith("https://"), r
        assert "sha256" not in r, "a hash is for a copy the project holds"


@pytest.mark.parametrize("key", sorted(WANT))
def test_the_product_says_nothing_private(key):
    text = (LIB / "racks" / key / "rack.yaml").read_text().lower()
    for word in ("okf", "/volumes", "/home/", "fs-hw", "customer", "agent"):
        assert word not in text, word


def test_the_ar203a_records_where_its_sources_disagree():
    gaps = {g["what"]: g for g in rack("apc/ar203a")["gaps"]}
    assert gaps["weight-kg"]["reason"] == "sources-disagree"
    assert "40.41" in gaps["weight-kg"]["note"] and "40.32" in gaps["weight-kg"]["note"]


def test_the_ar201_does_not_claim_a_rear_rail():
    assert [r["id"] for r in rack("apc/ar201")["rails"]] == ["front"]


@pytest.mark.parametrize("key", sorted(WANT))
def test_the_product_is_locked_and_passes_its_rule(key):
    assert (LIB / "racks" / key / "rack.lock.json").exists()
    got = []
    real = lint.err
    lint.err = lambda p, rule, msg: got.append((rule, msg))
    try:
        lint.lint_rack(LIB / "racks" / key / "rack.yaml", rack(key), [str(LIB)])
    finally:
        lint.err = real
    assert got == []
    assert devicelock.check_racks(LIB) == []


def test_apc_is_a_registered_maker():
    vendors = load_yaml(ROOT / "spec/schemas/vendors.yaml")["vendors"]
    assert vendors["apc"]["role"] == "hardware" and vendors["apc"]["display"]
