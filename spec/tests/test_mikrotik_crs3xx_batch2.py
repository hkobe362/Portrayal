"""MikroTik's second Cloud Router Switch batch: the CRS328-24P-4S+RM.

The envelope comes from MikroTik's dimensions drawing for the model (printed 19.09.2023: 443 wide, 298 deep; the
drawing prints no height, the side view reads 44.3) and the counts from the brochure. The device name spells the +
as `-plus`; `model:` keeps it as printed. The pilot (CRS326-24G and CSS326-24G) is in its own test module.
"""
import json
from pathlib import Path

import pytest
import yaml

from portrayal import dcim_export as dx
from portrayal import devicelock

ROOT = Path(__file__).resolve().parents[2]
DEVICES = ROOT / "library/devices/mikrotik"
NAMES = ["crs328-24p-4s-plus-rm"]
MODELS = {"crs328-24p-4s-plus-rm": "CRS328-24P-4S+RM"}
POE_OUT = "802.3af/at or 26 V / 53 V passive (out)"


def load(name):
    return yaml.safe_load((DEVICES / name / "device.yaml").read_text())


def placements(d, view):
    return (d["views"][view].get("components") or {}).get("placements") or []


@pytest.mark.parametrize("name", NAMES)
def test_the_device_is_named_as_the_maker_prints_it(name):
    d = load(name)
    assert d["name"] == name
    assert d["manufacturer"] == "MikroTik"
    assert d["model"] == MODELS[name]
    assert d["portfolio"] == {"line": "Switches", "family": "Cloud Router Switch", "series": "CRS328"}
    assert "+" not in name


def test_crs328_envelope_matches_the_dimensions_drawing():
    """443 x 298 from the drawing; the brochure's 300 is declared; the height is the side view's 44.3."""
    d = load("crs328-24p-4s-plus-rm")
    c = d["chassis"]
    assert (c["width"], c["height"], c["depth"], c["ru"]) == (443.0, 44.3, 298.0, 1)
    assert d["views"]["front"]["size"] == {"w": 443.0, "h": 44.3}
    assert d["views"]["top"]["size"] == {"w": 443.0, "h": 298.0}
    assert d["views"]["right"]["size"] == {"w": 298.0, "h": 44.3}
    assert "300" in d["provenance"]["chassis"]["note"] and "298" in d["provenance"]["chassis"]["note"]


def test_crs328_has_24_poe_out_ports_numbered_as_printed():
    d = load("crs328-24p-4s-plus-rm")
    jacks = [p for p in placements(d, "front") if p["ref"] == "common/rj45-ganged-eth-plain@1"]
    assert sorted(p["rel-pos"] for p in jacks) == list(range(1, 25))
    assert all(p["attrs"]["poe"] == POE_OUT for p in jacks)
    assert d["groups"]["rj45"]["attrs"]["poe"] == POE_OUT
    by_id = {p["id"]: p for p in jacks}
    xs = sorted({by_id[f"port-{n}"]["at"][0] for n in range(1, 25, 2)})
    assert len(xs) == 12
    # three blocks of four columns on the 13.97 pitch; the drawing's block step is 70.3
    assert xs[1] - xs[0] == pytest.approx(13.97, abs=0.01)
    assert xs[4] - xs[0] == pytest.approx(70.4, abs=0.15)
    # every port has a lamp above its column and one below, both numbered with the port
    lamps = [p for p in placements(d, "front") if p["ref"] == "common/led-sq@1" and p["id"].startswith("led-port-")]
    assert len(lamps) == 48
    assert {p["for"] for p in lamps} == set(by_id)
    assert sorted(p["rel-pos"] for p in lamps) == list(range(1, 49))


def test_crs328_has_four_sfp_plus_cages_one_console_and_no_management_port():
    d = load("crs328-24p-4s-plus-rm")
    cages = [p for p in placements(d, "front") if p["ref"] == "std/sfp@1"]
    assert [p["rel-pos"] for p in cages] == [1, 2, 3, 4]
    assert d["groups"]["sfp-plus"]["attrs"] == {"media": "sfp-plus", "speed": "10g"}
    assert [p["id"] for p in placements(d, "front") if p["ref"] == "std/rj45@2"] == ["console"]
    texts = {s.get("text") for s in d["views"]["front"]["silkscreen"]}
    assert {"CONSOLE", "RESET", "MODE", "PWR", "USR", "FAN", "PoE", "SFP+"} <= texts


def test_crs328_has_two_buttons_reset_and_mode():
    d = load("crs328-24p-4s-plus-rm")
    buttons = {p["id"]: p["attrs"]["function"] for p in placements(d, "front") if p["ref"] == "common/reset-button@1"}
    assert buttons == {"btn-reset": "reset", "btn-mode": "mode"}


def test_crs328_power_is_built_in_and_figures_are_filed_as_worded():
    d = load("crs328-24p-4s-plus-rm")
    assert not (d["views"]["front"].get("components") or {}).get("bays")
    assert d["chassis"]["power"] == "ac"
    p = d["attrs"]["power"]
    # the page's maximum, the brochure's 44 W only without PoE devices, the 450 W guaranteed for PoE
    assert (p["power-max-w"], p["poe-budget-w"], p["power-envelope"]) == (494, 450, "fully-configured")
    assert "without PoE devices connected" in p["power-without-attachments"]


def test_crs328_rear_is_empty_and_no_inlet_is_placed():
    """No held document shows the rear: it is not drawn from another model, and no power port is exported."""
    d = load("crs328-24p-4s-plus-rm")
    assert d["views"]["rear"].get("empty")
    assert not placements(d, "rear")
    assert not [p for v in d["views"].values() for p in (v.get("components") or {}).get("placements") or []
                if p["ref"] == "std/c14-inlet@1"]
    gap = [g for g in d["gaps"] if g["what"] == "rear-face"]
    assert len(gap) == 1 and gap[0]["scope"] == ["rear"]


def test_crs328_two_fans_are_drawn_on_the_right_wall():
    d = load("crs328-24p-4s-plus-rm")
    fans = [x["id"] for x in d["views"]["right"]["panel"]["decor"] if x.get("kind") == "fan-grille"]
    assert fans == ["fan-0", "fan-1"]
    assert d["views"]["left"].get("empty")
    assert d["attrs"]["thermal"]["cooling"].startswith("two built-in fans")


def test_crs328_ears_are_in_the_box_and_flush():
    ears = load("crs328-24p-4s-plus-rm")["chassis"]["ears"]
    default = [p for p in ears["positions"] if p.get("default")]
    assert [(p["name"], p["at"]) for p in default] == [("flush", 0)]


@pytest.mark.parametrize("name", NAMES)
def test_the_logo_is_reserved_not_drawn(name):
    front = load(name)["views"]["front"]
    assert [r["id"] for r in front["regions"]] == ["logo-zone"]
    assert not [s for s in front["silkscreen"] if "mikrotik" in str(s.get("text", "")).lower()]


@pytest.mark.parametrize("name", NAMES)
def test_dcim_device_type_exports_one_per_device(name):
    """One orderable configuration, one exported device type, u_height 1."""
    docs = [
        yaml.safe_load(f.read_text())
        for f in (ROOT / "library/exports/netbox/device-types/MikroTik").glob("*.yaml")
    ]
    mine = [d for d in docs if d["model"] == MODELS[name]]
    assert len(mine) == 1
    assert mine[0]["u_height"] == 1
    assert mine[0]["manufacturer"] == "MikroTik"
    assert sum(1 for i in mine[0]["interfaces"] if i["type"] == "1000base-t") == 24
    assert sum(1 for i in mine[0]["interfaces"] if i["type"] == "10gbase-x-sfpp") == 4
    assert not mine[0].get("power-ports")


@pytest.mark.parametrize("target", ["netbox", "nautobot"])
@pytest.mark.parametrize("name", NAMES)
def test_the_committed_exports_are_what_the_exporter_writes_now(name, target, tmp_path, monkeypatch):
    dist = ROOT / "library/dist"
    assert (dist / "devices.json").exists(), "run the build first: this reads library/dist"
    monkeypatch.setattr(dx, "RASTER", False)
    dx.export_device(dx.Dist(str(dist)), name, str(tmp_path), str(dist))
    rel = Path(target) / "device-types" / "MikroTik" / f"{MODELS[name]}.yaml"
    assert (tmp_path / rel).read_text() == (ROOT / "library/exports" / rel).read_text()


def test_the_lock_files_match_the_devices():
    lib = ROOT / "library"
    assert not [f for f in devicelock.check(lib) if f[0].startswith("mikrotik/")]
    known = devicelock.load_lock(lib)["devices"]
    for name in NAMES:
        entry = known[f"mikrotik/{name}"]
        assert entry["version"] == load(name)["version"]
        per_device = json.loads((DEVICES / name / "device.lock.json").read_text())
        assert per_device["gaps"] == entry["gaps"]
