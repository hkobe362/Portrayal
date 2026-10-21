"""The Dell PowerEdge R960 (library/devices/dell/r960), against Dell's own documents.

Every number below is read from the R960 Installation and Service Manual (the ISM),
the Technical Guide (TG) or the Spec Sheet, and each test names the table or figure
it comes from. Nothing here is a reading of this library's own output: the
expectations are written out from the documents, so a model that drifts from them
fails here and not in a review.

The tests that need the built faces read `library/dist`, as the library's other
device tests do, and fail without a build. The envelope, the fronts, the supplies, the
top view and the DCIM exports are checked on the manifest and the tracked exports.
"""
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / "library"
DEVICE = LIB / "devices" / "dell" / "r960" / "device.yaml"
DIST = LIB / "dist"
EXPORTS = LIB / "exports"

_DOC = None


def doc():
    global _DOC
    if _DOC is None:
        _DOC = yaml.safe_load(DEVICE.read_text())
    return _DOC


def component(name):
    return yaml.safe_load((LIB / "components" / "dell" / name / "v1" / "contract.yaml").read_text())


def bays(view):
    return doc()["views"][view]["components"]["bays"]


def placements(view):
    return doc()["views"][view]["components"].get("placements", [])


# the six fronts of ISM figures 1 to 6: view -> (2.5 inch bays, E3.S bays)
FRONTS = {
    "front-sff32": (32, 0),    # figure 1
    "front-sff24": (24, 0),    # figure 2
    "front": (16, 0),          # figure 3
    "front-sff8": (8, 0),      # figure 4
    "front-e3s16": (0, 16),    # figure 5
    "front-sff8-e3s16": (8, 16),  # figure 6
}

# ISM table 88 (and TG tables 13-17): the slots each riser carries and the processor that controls each
RISER_SLOTS = {
    "r960-riser-1a": {1: 3, 3: 1},
    "r960-riser-1b": {1: 3, 2: 1, 3: 1},
    "r960-riser-1c": {1: 3, 3: 1},
    "r960-riser-2": {4: 2, 9: 1},
    "r960-riser-3a": {6: 4, 8: 3},
    "r960-riser-3b": {5: 4, 6: 4, 7: 3, 8: 3},
    "r960-riser-3b-scale-out": {5: 4, 6: 2, 7: 3, 8: 1},   # ISM table 13, "Riser 3B (In scale out configuration)"
    "r960-riser-4a": {10: 4, 11: 2},
    "r960-riser-4b": {10: 4, 11: 2, 12: 2},
    "r960-riser-4c": {10: 4, 11: 2},
}

# ISM table 88: the slots each riser configuration offers
CONFIG_SLOTS = {
    "rc01": {1, 3, 10, 11},
    "rc02": {1, 3, 10, 11},
    "rc1": {1, 3, 5, 6, 7, 8, 10, 11},
    "rc2": set(range(1, 13)),
    "rc3": {1, 3, 4, 6, 8, 9, 10, 11},
}

CONFIGS = [
    f"{f}-{r}"
    for f in ("sff8", "sff16", "sff24", "sff32", "e3s16", "sff8-e3s16")
    for r in ("rc01-1c-4c", "rc02-1c-4c", "rc1-1c-3b-4c", "rc2-1b-2-3b-4b", "rc3-1a-2-3a-4a")
]


def _built(path):
    assert (DIST / "r960.configs.json").exists(), "library/dist has no r960 build: these read it, so run ./build.sh first"
    return path


def _paths(svg):
    return {n.get("data-path") for n in ET.parse(svg).iter() if n.get("data-path")}


# --- the envelope: ISM table 7 and figure 32 --------------------------------

def test_the_envelope_is_the_isms_table_7():
    ch = doc()["chassis"]
    assert ch["width"] == 444.0          # Xb, between the ears
    assert ch["height"] == 174.3         # Y
    assert ch["ru"] == 4
    assert doc()["attrs"]["physical"]["ru"] == 4


def test_the_depth_is_the_front_face_to_the_rear_wall():
    # Za without the bezel (22) plus Zb, ear to rear wall (844.74): the R660's derivation
    assert doc()["chassis"]["depth"] == pytest.approx(22 + 844.74)
    # and it is NOT the spec sheet's 869.195 / 883.195 (to the PSU handles, Zc 847.195)
    assert doc()["chassis"]["depth"] != 869.195
    assert 22 + 847.195 == pytest.approx(869.195) and 36 + 847.195 == pytest.approx(883.195)


def test_the_r940xa_columns_of_the_technical_guide_are_not_used():
    # the guide's table 2 prints 441.16 wide and 877.84 / 865.9 deep in the R940xa's column
    text = DEVICE.read_text()
    for stray in ("441.16", "877.84"):
        assert f"w: {stray}" not in text and f"width: {stray}" not in text and f"depth: {stray}" not in text


@pytest.mark.parametrize("view", sorted(FRONTS))
def test_each_front_is_the_482_rack_face_over_a_444_body(view):
    v = doc()["views"][view]
    assert v["size"] == {"w": 482.0, "h": 174.3}      # Xa across the ears; the ears carry the panels
    assert doc()["chassis"]["width"] == 444.0          # Xb between them
    ids = {b["id"] for b in v["components"]["bays"]}
    assert "panel-left" in ids
    refs = {p["id"]: p["ref"] for p in v["components"]["placements"]}
    assert {"power-btn", "usb-1", "idrac-direct", "vga", "info-tag", "bezel"} <= set(refs)


def test_the_rear_is_the_body_and_the_top_is_the_plan():
    assert doc()["views"]["rear"]["size"] == {"w": 444.0, "h": 174.3}
    assert doc()["views"]["top"]["size"] == {"w": 444.0, "h": 866.74}


# --- the fronts: ISM figures 1-6 -----------------------------------------------

@pytest.mark.parametrize("view,counts", sorted(FRONTS.items()))
def test_each_front_has_its_bays_numbered_as_dell_numbers_them(view, counts):
    sff, e3s = counts
    b = bays(view)
    drives = [x for x in b if x["id"].startswith("drive-")]
    carriers = [x for x in b if x["id"].startswith("e3s-")]
    assert len(drives) == sff and len(carriers) == e3s
    assert [x["id"] for x in drives] == [f"drive-{i}" for i in range(sff)]
    # ISM figure 27: E3.S carriers are 0-15, or 8-23 after the eight 2.5 inch drives of bay 1 (0-7)
    first = sff
    assert [x["id"] for x in carriers] == [f"e3s-{first + i}" for i in range(e3s)]
    assert [x["rel-pos"] for x in carriers] == [first + i for i in range(e3s)]
    assert [x["rel-pos"] for x in drives] == list(range(sff))      # the group numbers from 0
    assert {x["group"] for x in drives} <= {"drives"} and {x["group"] for x in carriers} <= {"drives-e3s"}


@pytest.mark.parametrize("view,printed", [("front", 16), ("front-sff8", 8), ("front-sff24", 24),
                                           ("front-sff32", 16), ("front-sff8-e3s16", 8), ("front-e3s16", 0)])
def test_the_number_strip_prints_what_the_figure_prints(view, printed):
    # ISM figures 1-4 and 6 print 0.. on the strip under the upper row (figure 1 prints 0-15 only,
    # not the lower row's 16-31); figure 5 prints no digits under the E3.S block
    marks = [m for m in doc()["views"][view]["silkscreen"]
             if str(m.get("for", "")).startswith("drive-") and "text" in m]
    assert sorted(int(m["text"]) for m in marks) == list(range(printed))
    for m in marks:
        assert m["for"] == f"drive-{m['text']}"


def test_the_32_bay_front_has_two_rows_of_sixteen():
    b = {x["id"]: x for x in bays("front-sff32")}
    upper = {n: b[f"drive-{n}"]["at"][1] for n in range(16)}
    lower = {n: b[f"drive-{n}"]["at"][1] for n in range(16, 32)}
    assert len(set(upper.values())) == 1 and len(set(lower.values())) == 1
    assert list(lower.values())[0] - list(upper.values())[0] == pytest.approx(84.8, abs=1.0)  # figure 1's row pitch


def test_the_e3s_carriers_stand_in_the_right_of_the_upper_band():
    xs = [x["at"][0] for x in bays("front-e3s16") if x["id"].startswith("e3s-")]
    assert xs == sorted(xs) and len(xs) == 16
    assert xs[0] > 250 and xs[-1] + 7.75 < 456.5      # right of the vent plates, inside the right panel
    pitch = {round(b - a, 1) for a, b in zip(xs, xs[1:])}
    assert pitch <= {10.5, 10.51, 10.52}


@pytest.mark.parametrize("view", sorted(FRONTS))
def test_every_bay_defaults_to_a_blank_and_the_bezel_hides_them(view):
    b = bays(view)
    for x in b:
        if x["id"].startswith(("drive-", "e3s-")):
            assert "blank" in x["default"], x["id"]
    bezel = next(p for p in placements(view) if p["id"] == "bezel")
    assert bezel["ref"] == "dell/r960-bezel@1"
    covered = [x["id"] for x in b if x["id"].startswith(("drive-", "e3s-"))]
    assert bezel["hides"] == covered
    assert set(covered) <= set(bezel["for"])


def test_the_default_front_is_the_16_bay_one_and_every_other_front_is_bound_by_configuration():
    cfgs = doc()["configurations"]
    assert [n for n, c in cfgs.items() if c.get("default")] == ["sff16-rc01-1c-4c"]
    want = {"sff8": "front-sff8", "sff24": "front-sff24", "sff32": "front-sff32",
            "e3s16": "front-e3s16", "sff8-e3s16": "front-sff8-e3s16"}
    for name in CONFIGS:
        front = name.split("-rc")[0]
        got = (cfgs[name].get("views") or {}).get("front")
        assert got == want.get(front), name


def test_the_thirty_builds_are_six_fronts_by_five_riser_configurations():
    cfgs = doc()["configurations"]
    orderable = [n for n, c in cfgs.items() if c["kind"] == "orderable"]
    assert sorted(orderable) == sorted(CONFIGS) and len(orderable) == 30


# --- the rears: ISM table 88, TG tables 12-17 ----------------------------------

@pytest.mark.parametrize("name,slots", sorted(RISER_SLOTS.items()))
def test_each_riser_module_has_its_slots_and_processors(name, slots):
    c = component(name)
    got = {int(k.split("-")[1]): v["slot"]["processor"] for k, v in c["bays"].items()}
    assert got == slots
    for v in c["bays"].values():
        assert v["slot"]["generation"] == 5 and v["slot"]["connector"] == "x16"


@pytest.mark.parametrize("name", CONFIGS)
def test_each_riser_configurations_rear_has_the_slots_the_ism_gives(name):
    _built(None)
    cfg = {c["name"]: c for c in json.loads((DIST / "r960.configs.json").read_text())["configs"]}[name]
    paths = _paths(DIST / cfg["files"]["rear"])
    slots = {int(m.group(1)) for p in paths for m in [re.fullmatch(r"riser-\d/module/slot-(\d+)", p)] if m}
    assert slots == CONFIG_SLOTS[re.search(r"-(rc\d+)-", name).group(1)]
    # a riser 2 only where the ISM's table 88 has one: configurations 2 and 3
    assert any(p.startswith("riser-2/module") for p in paths) == bool(re.search(r"-rc[23]-", name))


def test_riser_2_is_slots_4_and_9_not_3_and_9():
    # ISM table 5 says "slot 3 and slot 9"; tables 6, 13 and 88 and the guide say 4 and 9
    assert set(component("r960-riser-2")["bays"]) == {"slot-4", "slot-9"}


def test_the_slot_numbers_printed_on_riser_3_are_the_figures():
    svg = (LIB / "components/dell/r960-riser-3b-cage/v1/skins/default.svg").read_text()
    assert [t for t in re.findall(r">(\d)</text>", svg)] == ["5", "6", "7", "8"]


# --- the supplies: ISM tables 5, 10 and 11 ---------------------------------------

def test_four_supply_bays_two_over_two():
    b = {x["id"]: x for x in bays_of("rear") if x["id"].startswith("psu-")}
    assert sorted(b) == ["psu-1", "psu-2", "psu-3", "psu-4"]
    assert b["psu-3"]["at"][0] == b["psu-1"]["at"][0] and b["psu-4"]["at"][0] == b["psu-2"]["at"][0]
    assert b["psu-3"]["at"][1] < b["psu-1"]["at"][1] and b["psu-4"]["at"][1] < b["psu-2"]["at"][1]
    assert b["psu-1"]["at"][0] < b["psu-2"]["at"][0]            # PSU 1 at the left as the rear faces you
    for x in b.values():
        assert x["size"]["w"] == 86.0                           # Dell's 86 mm form factor
    assert doc()["groups"]["psus"]["attrs"]["redundancy"] == "2+2"


def bays_of(view):
    return doc()["views"][view]["components"]["bays"]


def test_the_supply_bays_accept_the_supplies_the_ism_lists():
    # 2400 W and 2800 W are 86 mm; 1100 W and 1400 W are 60 mm and seat in the 26 mm adapter (ISM table 11)
    for x in (b for b in bays_of("rear") if b["id"].startswith("psu-")):
        assert {"dell/r960-psu-2800w-ac@1", "dell/r960-psu-2400w-ac@1",
                "dell/r960-psu-adapter-60mm@1", "dell/r960-psu-blank@1"} == set(x["accepts"])
    assert component("r960-psu-2800w-ac")["attrs"]["power-output-w"] == 2800
    assert component("r960-psu-2400w-ac")["attrs"]["power-output-w"] == 2400
    inner = component("r960-psu-adapter-60mm")["bays"]["psu"]
    assert set(inner["accepts"]) == {"dell/psu-1100w-ac-60mm@1", "dell/psu-1400w-ac-60mm@1"}
    assert inner["size"] == [59.8, 40.1]
    assert 59.8 + 26.0 == pytest.approx(85.8, abs=0.3)          # the 60 mm supply and its 26 mm adapter fill the bay


# --- the top view: ISM figures 12-15, 95, 96 and TG table 2 ----------------------------

def test_the_top_view_has_64_dimm_slots_named_as_the_figures_print_them():
    names = sorted(b["id"] for b in bays_of("top") if b["id"].startswith("dimm-"))
    want = sorted(f"dimm-{c}{n}" for c in "abcd" for n in range(1, 17))
    assert names == want and len(names) == 64
    on_board = {b["id"][5]: b["in"] for b in bays_of("top") if b["id"].startswith("dimm-")}
    assert on_board == {"a": "system-board", "b": "system-board", "c": "pem-board", "d": "pem-board"}


def test_the_top_view_has_six_fans_and_four_heatsinks():
    fans = [b for b in bays_of("top") if b["id"].startswith("fan-")]
    assert [b["id"] for b in fans] == [f"fan-{i}" for i in range(1, 7)]
    assert [b["at"][0] for b in fans] == sorted(b["at"][0] for b in fans)
    heat = [p for p in placements("top") if p["id"].startswith("heatsink-")]
    assert sorted(p["id"] for p in heat) == ["heatsink-1", "heatsink-2", "heatsink-3", "heatsink-4"]
    assert doc()["groups"]["fans"]["attrs"]["redundancy"] == "n+1"


def test_memory_sockets_run_between_the_banks_as_figure_95_shows():
    # CPU 2 and CPU 4 on the left, CPU 1 and CPU 3 on the right as the front faces you
    x = {b["id"]: b["at"][0] for b in bays_of("top") if b["id"].startswith("dimm-")}
    heat = {p["id"]: p["at"][0] for p in placements("top") if p["id"].startswith("heatsink-")}
    assert heat["heatsink-2"] < heat["heatsink-1"] and heat["heatsink-4"] < heat["heatsink-3"]
    # a heatsink is placed by its prefab's corner (128 wide); its 78.9 fin block stands 48.7 in, between the banks
    # (spec/tests/test_dell_r960_model.py reads the block against the sockets' edges)
    assert x["dimm-b8"] < heat["heatsink-2"] < x["dimm-b9"]
    assert x["dimm-a12"] < heat["heatsink-1"] + 48.7 < x["dimm-a9"]


# --- the DCIM exports: one device type per configuration ----------------------------

# The exporter writes one device type per DISTINCT configuration, as it does for the R660 (26 types for 42 builds): a
# riser configuration is not a DCIM fact, so configurations 0-1 and 0-2, and 2 and 3, export one type each. Six fronts
# by the three riser shapes a DCIM can tell apart: 18 types.
EXPORTED = [f"{f}-{r}" for f in ("sff8", "sff16", "sff24", "sff32", "e3s16", "sff8-e3s16")
            for r in ("rc01-1c-4c", "rc1-1c-3b-4c", "rc2-1b-2-3b-4b")]


@pytest.mark.parametrize("name", sorted(EXPORTED))
def test_the_dcim_device_type_is_four_u_and_full_depth(name):
    f = EXPORTS / "netbox" / "device-types" / "Dell" / f"PowerEdge R960 {name}.yaml"
    assert f.exists(), f"{f.name} is not exported: run dcim_export.py --device r960"
    d = yaml.safe_load(f.read_text())
    assert d["manufacturer"] == "Dell" and d["model"] == f"PowerEdge R960 {name}"
    assert d["u_height"] == 4.0
    assert d["is_full_depth"] is True
    g = EXPORTS / "nautobot" / "device-types" / "Dell" / f.name
    assert g.exists()


def test_nothing_but_those_are_exported_and_each_is_a_configuration():
    names = {p.name[len("PowerEdge R960 "):-len(".yaml")]
             for p in (EXPORTS / "netbox" / "device-types" / "Dell").glob("PowerEdge R960 *.yaml")}
    assert names == set(EXPORTED)
    assert names <= set(doc()["configurations"])


def test_the_module_types_of_the_new_parts_are_exported():
    for part in ("r960-psu-2800w-ac", "r960-psu-2400w-ac", "r960-psu-adapter-60mm", "r960-riser-1b",
                 "r960-riser-2", "r960-riser-3b", "r960-riser-4b", "r960-rear-io-board", "r960-fan",
                 "r960-bezel"):
        assert (EXPORTS / "netbox" / "module-types" / "Dell" / f"{part}.yaml").exists(), part
