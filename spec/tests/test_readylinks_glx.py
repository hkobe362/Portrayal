"""The ReadyLinks GL-x family: one device per SKU on one chassis (#763).

`readylinks/gl-12xb-240d` (#673) models the GL-x chassis with its ports on line-card
components. The seven siblings share that chassis, so these tests hold three things:
each SKU states its own data sheet's power figures and its `as-sold` part number and seats
the cards the SKU ships with; the chassis is the GL-12xB-240D's, drawn again and not
re-measured differently; and the F-type card seats on `std/f-type@1` in the plate the
BNC card and the blank already use.
"""
import json
import pathlib
import subprocess
import sys

import pytest
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
LIB = ROOT / "library"
RENDER = ROOT / "spec/tools/portrayal/render.py"

BNC = "readylinks/gl-x-lc-12xb@1"
FTYPE = "readylinks/gl-x-lc-12xc@1"
BLANK = "readylinks/gl-x-lc-blank@1"

# model, card, cards seated as sold, the PoE budget on dual and on single power (W), as each
# SKU's own data sheet prints them
SKUS = {
    "gl-24xb-240d": ("GL-24xB-240D", BNC, 2, 240, 90),
    "gl-12xb-p600d": ("GL-12xB-P600D", BNC, 1, 520, 220),
    "gl-24xb-p600d": ("GL-24xB-P600D", BNC, 2, 520, 220),
    "gl-12xc-240d": ("GL-12xC-240D", FTYPE, 1, 240, 90),
    "gl-12xc-p600d": ("GL-12xC-P600D", FTYPE, 1, 520, 220),
    "gl-24xc-240d": ("GL-24xC-240D", FTYPE, 2, 240, 90),
    "gl-24xc-p600d": ("GL-24xC-P600D", FTYPE, 2, 520, 220),
}
EXISTING = "gl-12xb-240d"
SHARED_FACES = ("rear", "left", "right", "top", "bottom")


def _device(name):
    return yaml.safe_load((LIB / "devices/readylinks" / name / "device.yaml").read_text())


def _contract(name):
    return yaml.safe_load((LIB / "components/readylinks" / name / "v1/contract.yaml").read_text())


def _bays(doc):
    return {b["id"]: b for b in doc["views"]["front"]["components"]["bays"]}


@pytest.mark.parametrize("name", sorted(SKUS))
def test_a_sku_states_its_own_datasheet_power_figures(name):
    model, _card, _n, dual, single = SKUS[name]
    doc = _device(name)
    assert doc["model"] == model
    power = doc["attrs"]["power"]
    assert power["poe-budget-w"] == dual
    assert f"{single} W using single power" in power["poe-budget-scope"]
    assert power["power-self-max-w"] == 80
    assert power["power-supply"] == "AC/DC, internal, (2) 300W"
    assert power["power-input"] == "100-240V AC, 50/60 Hz; 48-56VDC"


@pytest.mark.parametrize("name", sorted(SKUS))
def test_a_sku_as_sold_has_its_part_number_and_seats_its_cards(name):
    model, card, n, _dual, _single = SKUS[name]
    cfg = _device(name)["configurations"]["as-sold"]
    assert cfg["kind"] == "orderable"
    assert list(cfg["part-numbers"]) == [model]
    assert cfg["bays"] == {"slot-1": card, "slot-2": card if n == 2 else BLANK}


@pytest.mark.parametrize("name", sorted(SKUS))
def test_a_sku_base_blanks_both_traffic_slots(name):
    cfgs = _device(name)["configurations"]
    assert cfgs["base"]["bays"] == {"slot-1": BLANK, "slot-2": BLANK}
    assert cfgs["base"].get("default") is True


@pytest.mark.parametrize("name", sorted(SKUS))
def test_a_sku_bays_take_its_card_and_the_blank_and_default_to_what_ships(name):
    _model, card, n, _dual, _single = SKUS[name]
    bays = _bays(_device(name))
    assert sorted(bays) == ["slot-1", "slot-2"]
    for b in bays.values():
        assert b["accepts"] == [card, BLANK]
    assert bays["slot-1"]["default"] == card
    assert bays["slot-2"]["default"] == (card if n == 2 else BLANK)


@pytest.mark.parametrize("name", sorted(SKUS))
def test_a_sku_is_the_gl12xb_chassis(name):
    """Everything but the bays and the identity is the GL-12xB-240D's, to the key."""
    mine, ref = _device(name), _device(EXISTING)
    assert mine["chassis"] == ref["chassis"]
    assert mine["chassis"]["width"] == 440.0 and mine["chassis"]["depth"] == 300.1
    for face in SHARED_FACES:
        assert mine["views"][face] == ref["views"][face], face
    mf, rf = mine["views"]["front"], ref["views"]["front"]
    assert mf["panel"] == rf["panel"]
    assert mf["silkscreen"] == rf["silkscreen"]
    assert mf["regions"] == rf["regions"]
    assert mf["components"]["placements"] == rf["components"]["placements"]
    # the slot group's prose names the cards a SKU fits, so only its shape is shared
    assert mine["groups"].keys() == ref["groups"].keys()
    assert {k: {a: b for a, b in g.items() if a != "description"} for k, g in mine["groups"].items()} == \
        {k: {a: b for a, b in g.items() if a != "description"} for k, g in ref["groups"].items()}


@pytest.mark.parametrize("name", sorted(SKUS))
def test_a_sku_keeps_the_line_card_part_number_gap(name):
    gaps = {g["what"] for g in _device(name)["gaps"]}
    assert "line-card-part-numbers" in gaps


def test_the_f_type_card_seats_on_std_f_type_in_the_shared_plate():
    c = _contract("gl-x-lc-12xc")
    assert c["class"] == "line-card" and c["behaviour"] == "fills"
    assert c["size"] == {"w": 281.5, "h": 19.55}
    assert c["size"] == _contract("gl-x-lc-12xb")["size"] == _contract("gl-x-lc-blank")["size"]
    jacks = [p for p in c["parts"] if p["ref"] == "std/f-type@1"]
    assert [p["id"] for p in jacks] == [f"rl{i}" for i in range(1, 13)]
    xs = [p["at"][0] for p in jacks]
    assert xs == pytest.approx([19.5 + 20.7 * i for i in range(12)], abs=0.01)
    assert {p["at"][1] for p in jacks} == {4.55}
    assert {p["group"] for p in jacks} == {"readylink"}
    assert c["groups"]["readylink"]["attrs"] == {"media": "coax-f", "speed": "1g"}
    assert not [p for p in c["parts"] if p["ref"].startswith("common/bnc")]


def test_the_existing_device_and_cards_are_not_widened():
    bays = _bays(_device(EXISTING))
    for b in bays.values():
        assert b["accepts"] == [BNC, BLANK]
    assert _contract("gl-x-lc-12xb")["version"] == "1.0.0"
    assert _contract("gl-x-lc-blank")["version"] == "1.0.0"


@pytest.mark.parametrize("name", sorted(SKUS))
def test_a_sku_renders_with_its_cards_seated(name, tmp_path):
    _model, card, n, _dual, _single = SKUS[name]
    r = subprocess.run([sys.executable, str(RENDER), str(LIB / "devices/readylinks" / name / "device.yaml"),
                        "--library", str(LIB), "--out", str(tmp_path)], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr[-800:]
    els = (tmp_path / f"{name}.as-sold.front.elements.json").read_text()
    for slot in ("slot-1", "slot-2")[:n]:
        for i in range(1, 13):
            assert f'"{slot}/module/rl{i}"' in els, (slot, i)
    if n == 1:
        assert '"slot-2/module/rl' not in els
