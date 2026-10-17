"""#1105: the three generic rack shapes, with sourced EIA-310 numbers.

`generic/2-post-frame`, `generic/4-post-frame` and `generic/4-post-cabinet` are
rack products (#935) that stand for the Rack Builder's generic frames. They gain
`hole-centres` and `opening`, and are otherwise what the Rack Builder already
draws: the golden check reads `normalizeFrame` itself and compares.

The figures come from two secondary pages (an IBM rack-requirements page and
Wikipedia's article on the 19-inch rack). The text of EIA-310 was not read, so
no figure says "EIA-310 says": each is carried with the page it was read from,
declared a stand-in in `provenance`, and named in `gaps`.
"""
import copy
import json
import pathlib
import shutil
import subprocess

import pytest
import yaml
from jsonschema import Draft202012Validator

from portrayal import devicelock, dcim_export, lint, libwalk, racks_index
from portrayal.manifest import load_yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
LIB = ROOT / "library"
SCHEMA = json.loads((ROOT / "spec/schemas/rack-product.schema.json").read_text())

SHAPES = {
    "generic/2-post-frame": "2-post-frame",
    "generic/4-post-frame": "4-post-frame",
    "generic/4-post-cabinet": "4-post-cabinet",
}
# what the figures are, and the pages they were read from
HOLE_CENTRES, OPENING = 465, 450
SECONDARY = ("IBM", "Wikipedia")


def rack(key):
    return load_yaml(LIB / "racks" / key / "rack.yaml")


def problems(doc):
    return [e.message for e in Draft202012Validator(SCHEMA).iter_errors(doc)]


# ---- the three shapes are rack products ----------------------------------------

def test_the_three_shapes_are_in_the_library_under_generic():
    keys = {libwalk.rack_key(f) for f in libwalk.iter_racks([LIB])}
    assert set(SHAPES) <= keys


@pytest.mark.parametrize("key", sorted(SHAPES))
def test_the_shape_matches_the_schema_and_names_its_form(key):
    doc = rack(key)
    assert problems(doc) == []
    assert doc["form"] == SHAPES[key] and doc["manufacturer"] == "Generic"
    assert doc["name"] == key.split("/")[1] and doc["kind"] == "rack"


@pytest.mark.parametrize("key", sorted(SHAPES))
def test_the_shape_is_locked_and_passes_its_rule(key):
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


@pytest.mark.parametrize("key", sorted(SHAPES))
@pytest.mark.parametrize("style,thread", [
    ("square", None), ("round", None),
    ("tapped", "12-24"), ("tapped", "10-32"), ("tapped", "M6")])
def test_every_hole_style_and_thread_the_issue_lists_validates(key, style, thread):
    doc = copy.deepcopy(rack(key))
    doc["holes"] = {"style": style, **({"thread": thread} if thread else {})}
    assert problems(doc) == []


@pytest.mark.parametrize("key", sorted(SHAPES))
def test_a_thread_on_an_untapped_hole_or_a_tapped_hole_without_one_is_refused(key):
    doc = copy.deepcopy(rack(key))
    doc["holes"] = {"style": "square", "thread": "M6"}
    assert problems(doc)
    doc["holes"] = {"style": "tapped"}
    assert problems(doc)
    doc["holes"] = {"style": "tapped", "thread": "8-32"}
    assert problems(doc)


def test_the_rails_follow_the_form():
    assert [r["id"] for r in rack("generic/2-post-frame")["rails"]] == ["front"]
    for key in ("generic/4-post-frame", "generic/4-post-cabinet"):
        assert [r["id"] for r in rack(key)["rails"]] == ["front", "rear"]


# ---- every figure has a source -------------------------------------------------

@pytest.mark.parametrize("key", sorted(SHAPES))
def test_the_numbers_are_the_issues(key):
    doc = rack(key)
    assert doc["hole-centres"] == HOLE_CENTRES and doc["opening"] == OPENING
    assert doc["width"] == 19


@pytest.mark.parametrize("key", sorted(SHAPES))
def test_each_figure_has_a_source_and_a_secondary_one_has_a_gap(key):
    doc = rack(key)
    gaps = {g["what"]: g for g in doc.get("gaps") or []}
    titles = [r["title"] for r in doc["references"]]
    for fig in ("hole-centres", "opening", "width"):
        prov = doc["provenance"][fig]
        assert prov["note"].strip(), (key, fig)
        assert any(s in prov["note"] and any(s in t for t in titles) for s in SECONDARY), \
            (key, fig, "names no reference")
        # the two figures read from a secondary page are stand-ins until the standard is read
        if fig != "width":
            assert prov["confidence"] == "estimated", (key, fig)
            assert fig in gaps, (key, fig)
            note = gaps[fig]["note"]
            assert "EIA-310 text was not read" in note or "standard was not read" in note, (key, fig)
            assert any(s in note for s in SECONDARY), (key, fig)
    for r in doc["references"] + [doc.get("datasheet") or {}]:
        assert r.get("url", "https://").startswith("https://"), r
        assert "sha256" not in r


@pytest.mark.parametrize("key", sorted(SHAPES))
def test_no_figure_is_credited_to_the_standard_itself(key):
    text = (LIB / "racks" / key / "rack.yaml").read_text()
    for phrase in ("EIA-310 says", "EIA-310 specifies", "the standard says", "the standard specifies"):
        assert phrase.lower() not in text.lower(), phrase


@pytest.mark.parametrize("key", sorted(SHAPES))
def test_the_two_secondary_pages_are_cited_and_the_makers_sheets_where_they_print_the_figure(key):
    doc = rack(key)
    titles = " ".join(r["title"] for r in doc["references"])
    assert "IBM" in titles and "Wikipedia" in titles
    note = doc["provenance"]["hole-centres"]["note"] + doc["provenance"]["opening"]["note"]
    assert "rack-products-design.md" in note or "design note" in note
    assert "465" in note and "450" in note


@pytest.mark.parametrize("key", sorted(SHAPES))
def test_a_twenty_three_inch_figure_nobody_found_is_a_gap_and_not_a_number(key):
    doc = rack(key)
    gaps = {g["what"]: g for g in doc["gaps"]}
    assert "width-23-in" in gaps
    assert doc["width"] == 19
    assert "23" not in json.dumps({k: v for k, v in doc.items()
                                   if k not in ("provenance", "gaps", "references", "description")})


@pytest.mark.parametrize("key", sorted(SHAPES))
def test_a_stand_in_from_the_rack_builder_is_declared(key):
    doc = rack(key)
    gaps = {g["what"] for g in doc["gaps"]}
    for fig in ("ru", "numbering", "holes"):
        assert doc["provenance"][fig]["confidence"] == "estimated", (key, fig)
        assert fig in gaps, (key, fig)


@pytest.mark.parametrize("key", sorted(SHAPES))
def test_the_shape_says_nothing_private(key):
    text = (LIB / "racks" / key / "rack.yaml").read_text().lower()
    for word in ("okf", "/volumes", "/home/", "fs-hw", "customer", "agent", "factory"):
        assert word not in text, word


# ---- the generic frames are otherwise unchanged (golden) -----------------------

NODE = shutil.which("node")


def builder_frame(kind):
    script = ("import {defaultFrame} from %s;"
              "process.stdout.write(JSON.stringify(defaultFrame(%s)))"
              % (json.dumps((ROOT / "kit/rack/model.js").as_uri()), json.dumps(kind)))
    out = subprocess.run([NODE, "--input-type=module", "-e", script], capture_output=True,
                         text=True, check=True)
    return json.loads(out.stdout)


# normalizeFrame's output for a frame with no product, as it stood before #1105
GOLDEN = {
    "four-post": {"kind": "four-post", "heightRU": 42, "numbering": "bottom-up",
                  "holes": {"style": "square", "thread": None}, "railDepth": 740,
                  "usableDepth": 1000, "ref": None},
    "two-post": {"kind": "two-post", "heightRU": 42, "numbering": "bottom-up",
                 "holes": {"style": "square", "thread": None}, "railDepth": None,
                 "usableDepth": 1000, "ref": None},
}
KIND = {"2-post-frame": "two-post", "4-post-frame": "four-post", "4-post-cabinet": "four-post"}


@pytest.mark.skipif(NODE is None, reason="node not installed")
@pytest.mark.parametrize("kind", sorted(GOLDEN))
def test_the_rack_builder_frame_with_no_product_is_unchanged(kind):
    got = builder_frame(kind)
    assert {k: got[k] for k in GOLDEN[kind]} == GOLDEN[kind]
    assert "hole-centres" not in got and "opening" not in got


@pytest.mark.skipif(NODE is None, reason="node not installed")
@pytest.mark.parametrize("key", sorted(SHAPES))
def test_the_shape_is_the_rack_builders_frame_plus_the_sourced_numbers(key):
    doc, frame = rack(key), builder_frame(KIND[SHAPES[key]])
    assert KIND[doc["form"]] == frame["kind"]
    assert doc["ru"] == frame["heightRU"]
    assert doc["numbering"] == {"direction": frame["numbering"], "start": 1}
    assert doc["holes"] == {"style": frame["holes"]["style"]}
    # the Builder's rail depth and usable depth are its own defaults, not a source's
    assert all("depth" not in r for r in doc["rails"]) and "max-device-depth" not in doc
    assert {"hole-centres", "opening"} <= set(doc)


# ---- nothing else moves --------------------------------------------------------

def test_the_apc_frames_and_the_devices_are_untouched():
    changed = subprocess.run(["git", "diff", "--name-only", "origin/main", "--", "library/devices",
                              "library/racks/apc"], capture_output=True, text=True, cwd=ROOT).stdout
    assert changed.split() == []


# ---- the DCIM export -----------------------------------------------------------

@pytest.fixture(scope="module")
def exported(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("rack-export")
    racks_index.build([LIB], tmp / "dist", ROOT / "spec/schemas")
    dcim_export.export_racks(tmp / "dist", tmp / "exports")
    return tmp / "exports"


def doc_at(root, target, manufacturer, model):
    return yaml.safe_load((root / target / "rack-types" / manufacturer / f"{model}.yaml").read_text())


@pytest.mark.parametrize("key", sorted(SHAPES))
def test_the_netbox_rack_type_names_the_form(exported, key):
    doc = doc_at(exported, "netbox", "Generic", key.split("/")[1])
    assert doc["manufacturer"] == "Generic" and doc["form_factor"] == SHAPES[key]
    assert doc["slug"] == "generic-" + key.split("/")[1]
    assert doc["width"] == 19 and doc["u_height"] == 42 and doc["starting_unit"] == 1
    assert doc["desc_units"] is False
    assert "hole" in doc["comments"].lower() and "465" in doc["comments"]


@pytest.mark.parametrize("key", sorted(SHAPES))
def test_the_nautobot_rack_fields_name_the_form(exported, key):
    doc = doc_at(exported, "nautobot", "Generic", key.split("/")[1])
    assert doc["type"] == SHAPES[key] and doc["width"] == 19 and doc["u_height"] == 42
    assert doc["desc_units"] is False
    assert not {"starting_unit", "outer_height", "mounting_depth", "weight", "max_weight",
                "form_factor"} & set(doc)
    assert "hole-centres 465 mm" in doc["comments"]


def test_the_apc_frames_export_their_sheet_figures(exported):
    nb = doc_at(exported, "netbox", "APC", "AR203A")
    assert nb["form_factor"] == "4-post-frame" and nb["u_height"] == 44
    assert (nb["outer_width"], nb["outer_height"], nb["outer_depth"], nb["outer_unit"]) == \
        (600, 2130, 747, "mm")
    assert nb["mounting_depth"] == 740
    assert (nb["weight"], nb["max_weight"], nb["weight_unit"]) == (40.32, 907.2, "kg")
    assert "cooling_capability" not in nb and "cooling_capacity" not in nb
    two = doc_at(exported, "netbox", "APC", "AR201")
    assert two["form_factor"] == "2-post-frame" and "mounting_depth" not in two


def test_a_desktop_frame_exports_as_a_two_post_frame_with_a_comment():
    doc = {"form": "desktop-frame", "manufacturer": "X", "model": "D", "ru": 8, "width": 19,
           "numbering": {"direction": "bottom-up", "start": 1}}
    for target in ("netbox", "nautobot"):
        out = dcim_export.rack_type(doc, target)
        assert out.get("form_factor", out.get("type")) == "2-post-frame"
        assert "desktop" in out["comments"].lower()


def test_the_export_is_the_same_twice(tmp_path):
    racks_index.build([LIB], tmp_path / "dist", ROOT / "spec/schemas")
    for n in ("a", "b"):
        dcim_export.export_racks(tmp_path / "dist", tmp_path / n)
    a = sorted(p.relative_to(tmp_path / "a") for p in (tmp_path / "a").rglob("*.yaml"))
    assert a and a == sorted(p.relative_to(tmp_path / "b") for p in (tmp_path / "b").rglob("*.yaml"))
    for p in a:
        assert (tmp_path / "a" / p).read_bytes() == (tmp_path / "b" / p).read_bytes()


def test_the_committed_export_holds_every_product():
    for key, form in SHAPES.items():
        for target in ("netbox", "nautobot"):
            f = LIB / "exports" / target / "rack-types" / "Generic" / f"{key.split('/')[1]}.yaml"
            assert f.exists(), f
