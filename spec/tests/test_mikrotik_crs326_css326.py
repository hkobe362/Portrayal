"""MikroTik's CRS326-24G-2S+RM and CSS326-24G-2S+RM: the maker, the envelope and the faces.

Both devices come from one MikroTik dimensions drawing ("CRS/CSS326-24G-2S+ dimensions", printed
19.09.2023: 443 wide, 44.5 high, 144.6 deep) and from each model's brochure (24 10/100/1000
ports, two SFP+ cages; a serial RJ45 on the CRS only). The device name spells the + as `-plus`;
`model:` keeps it as printed.
"""
import json
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
DEVICES = ROOT / "library/devices/mikrotik"
NAMES = ["crs326-24g-2s-plus-rm", "css326-24g-2s-plus-rm"]
MODELS = {"crs326-24g-2s-plus-rm": "CRS326-24G-2S+RM", "css326-24g-2s-plus-rm": "CSS326-24G-2S+RM"}


def load(name):
    return yaml.safe_load((DEVICES / name / "device.yaml").read_text())


def placements(d, view):
    return (d["views"][view].get("components") or {}).get("placements") or []


def test_mikrotik_resolves_in_the_vendor_registry():
    reg = yaml.safe_load((ROOT / "spec/schemas/vendors.yaml").read_text())["vendors"]
    assert reg["mikrotik"]["display"] == "MikroTik"
    assert reg["mikrotik"]["role"] == "both"
    assert str(reg["mikrotik"]["source"]).strip()
    # the entry sits directly after cisco's
    order = list(reg)
    assert order[order.index("cisco") + 1] == "mikrotik"


@pytest.mark.parametrize("name", NAMES)
def test_the_device_is_named_as_the_maker_prints_it(name):
    d = load(name)
    assert d["name"] == name
    assert d["manufacturer"] == "MikroTik"
    assert d["model"] == MODELS[name]
    assert "+" not in name


@pytest.mark.parametrize("name", NAMES)
def test_envelope_matches_the_dimensions_drawing(name):
    """443 x 44.5 x 144.6, one rack unit; the brochure's 443 x 144 x 44 is the same box rounded."""
    d = load(name)
    c = d["chassis"]
    assert (c["width"], c["height"], c["depth"], c["ru"]) == (443.0, 44.5, 144.6, 1)
    assert d["views"]["front"]["size"] == {"w": 443.0, "h": 44.5}
    assert d["views"]["rear"]["size"] == {"w": 443.0, "h": 44.5}
    assert d["views"]["top"]["size"] == {"w": 443.0, "h": 144.6}


@pytest.mark.parametrize("name", NAMES)
def test_ears_are_in_the_box_and_flush(name):
    ears = load(name)["chassis"]["ears"]
    default = [p for p in ears["positions"] if p.get("default")]
    assert [(p["name"], p["at"]) for p in default] == [("flush", 0)]


@pytest.mark.parametrize("name", NAMES)
def test_twenty_four_gigabit_ports_numbered_as_printed(name):
    d = load(name)
    jacks = [p for p in placements(d, "front") if p["ref"] == "common/rj45-ganged-eth-plain@1"]
    assert sorted(p["rel-pos"] for p in jacks) == list(range(1, 25))
    assert {p["id"] for p in jacks} == {f"port-{n}" for n in range(1, 25)}
    by_id = {p["id"]: p for p in jacks}
    # the lower jack of a column takes the odd number; port 1 is the POE IN jack
    for n in range(1, 25, 2):
        lower, upper = by_id[f"port-{n}"], by_id[f"port-{n + 1}"]
        assert lower["at"][1] > upper["at"][1]
        assert lower["at"][0] == upper["at"][0]
        assert "rotate" not in lower and upper["rotate"] == 180
    # three blocks of four columns on the 13.97 pitch with the drawing's 63.5 step
    xs = sorted({by_id[f"port-{n}"]["at"][0] for n in range(1, 25, 2)})
    assert len(xs) == 12
    assert xs[4] - xs[0] == pytest.approx(63.5, abs=0.05)
    assert xs[1] - xs[0] == pytest.approx(13.97, abs=0.01)
    # one lamp per port
    lamps = {p["for"] for p in placements(d, "front") if p["ref"] == "common/led-sq@1" and p["id"].startswith("led-port-")}
    assert lamps == set(by_id)


@pytest.mark.parametrize("name", NAMES)
def test_two_sfp_plus_cages(name):
    d = load(name)
    cages = [p for p in placements(d, "front") if p["ref"] == "std/sfp@1"]
    assert len(cages) == 2
    assert [p["rel-pos"] for p in cages] == [1, 2]
    assert d["groups"]["sfp-plus"]["attrs"] == {"media": "sfp-plus", "speed": "10g"}
    texts = {s.get("text") for s in d["views"]["front"]["silkscreen"]}
    assert {"SFP+ 1", "SFP+ 2", "ACT/LINK", "10G"} <= texts


def test_only_the_crs_has_the_rj45_console():
    crs, css = load(NAMES[0]), load(NAMES[1])
    assert [p["id"] for p in placements(crs, "front") if p["ref"] == "std/rj45@2"] == ["console"]
    assert not [p for p in placements(css, "front") if p["ref"] == "std/rj45@2"]


@pytest.mark.parametrize("name", NAMES)
def test_power_is_a_dc_jack_not_a_built_in_supply(name):
    d = load(name)
    # the jack is drawn as chassis art: common/dc-barrel is pinned to four other devices
    decor = {x.get("id") for x in d["views"]["rear"]["panel"]["decor"]}
    assert {"dc-jack-ring", "dc-jack-bore", "dc-jack-pin"} <= decor
    assert not [p for p in placements(d, "rear") if "dc-barrel" in p["ref"]]
    assert not (d["views"]["front"].get("components") or {}).get("bays")
    assert not (d["views"]["rear"].get("components") or {}).get("bays")
    assert d["chassis"]["power"] == "dc"


@pytest.mark.parametrize("name", NAMES)
def test_the_logo_is_reserved_not_drawn(name):
    front = load(name)["views"]["front"]
    assert [r["id"] for r in front["regions"]] == ["logo-zone"]
    assert not [s for s in front["silkscreen"] if "mikrotik" in str(s.get("text", "")).lower()]


@pytest.mark.parametrize("name", NAMES)
def test_dcim_device_type_exports_one_per_device(name):
    """One orderable configuration, one exported device type, u_height 1.

    The export files are written by the exporter itself (dcim_export.py --device), never by hand."""
    docs = [
        yaml.safe_load(f.read_text())
        for f in (ROOT / "library/exports/netbox/device-types/MikroTik").glob("*.yaml")
    ]
    mine = [d for d in docs if d["model"] == MODELS[name]]
    assert len(mine) == 1
    assert mine[0]["u_height"] == 1
    assert mine[0]["manufacturer"] == "MikroTik"
    assert sum(1 for i in mine[0]["interfaces"] if i["type"] == "1000base-t") == 24
    assert len(mine[0]["interfaces"]) == 26


def test_the_lock_files_exist_for_both_devices():
    for name in NAMES:
        lock = json.loads((DEVICES / name / "device.lock.json").read_text())
        assert lock
