"""The Juniper EX2300-24T, -24P, -48T and -48P, from the EX2300 Switch Hardware Guide (2025-08-12).

One device per front panel: the PoE and non-PoE models do not share a rear (the PoE models have a
second fan and a deeper chassis) and the 24- and 48-port models differ in their jacks. Each model's
-TAA and -VC part numbers, and the 24T's -DC, are `orderable` configurations of its device, because
the guide shows the same front panel for all of them.

What the guide fixes, and so what these tests hold:
  Table 3    the envelope - 1.75 in high, 17.4 in wide, 10.2 in deep without PoE and 12.2 in with it, and
             the weight of each model
  Table 1    the part numbers of each model and its variants
  Figures 3 to 13   the ports, their count and numbering, and what is on the rear
  Power Supply, Cooling System   the supply and the fans are built into the chassis, so no bay and no
             module is modelled for them
"""
import pathlib

import pytest
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
DEV = ROOT / "library/devices/juniper"
COMP = ROOT / "library/components/juniper"
EXPORTS = ROOT / "library/exports"

# Table 3 (centimetres as printed), Table 1 (part numbers), Figures 3 to 13 (the rest)
MODELS = {
    "ex2300-24t": {"ports": 24, "poe": False, "depth_cm": 25.9, "weight_kg": 3.29, "fans": 1, "mode_leds": 3,
                   "configs": {"ac": "EX2300-24T", "dc": "EX2300-24T-DC", "taa": "EX2300-24T-TAA",
                               "vc": "EX2300-24T-VC"}},
    "ex2300-24p": {"ports": 24, "poe": True, "depth_cm": 30.98, "weight_kg": 4.49, "fans": 2, "mode_leds": 4,
                   "configs": {"ac": "EX2300-24P", "taa": "EX2300-24P-TAA", "vc": "EX2300-24P-VC"}},
    "ex2300-48t": {"ports": 48, "poe": False, "depth_cm": 25.9, "weight_kg": 3.76, "fans": 1, "mode_leds": 3,
                   "configs": {"ac": "EX2300-48T", "taa": "EX2300-48T-TAA", "vc": "EX2300-48T-VC"}},
    "ex2300-48p": {"ports": 48, "poe": True, "depth_cm": 30.98, "weight_kg": 5.02, "fans": 2, "mode_leds": 4,
                   "configs": {"ac": "EX2300-48P", "taa": "EX2300-48P-TAA", "vc": "EX2300-48P-VC"}},
}
DEVICES = sorted(MODELS)
PART_NUMBERS = [(name, cid, pn) for name, m in MODELS.items() for cid, pn in m["configs"].items()]


def load_device(name):
    return yaml.safe_load((DEV / name / "device.yaml").read_text())


def placements(dev, view):
    return (dev["views"][view].get("components") or {}).get("placements") or []


def bays(dev, view):
    return (dev["views"][view].get("components") or {}).get("bays") or []


def by_id(dev, view):
    return {p["id"]: p for p in placements(dev, view)}


def rear_of(dev, cid="ac"):
    """The rear panel the configuration wears."""
    cfg = dev["configurations"][cid]
    return (cfg.get("views") or {}).get("rear", "rear")


# --- the envelope ------------------------------------------------------------

@pytest.mark.parametrize("name", DEVICES)
def test_the_envelope_is_table_3(name):
    ch = load_device(name)["chassis"]
    assert ch["ru"] == 1
    assert ch["height"] == pytest.approx(44.45, abs=0.1)
    assert ch["width"] == pytest.approx(441.9, abs=0.1)
    assert ch["depth"] == pytest.approx(MODELS[name]["depth_cm"] * 10, abs=0.3)
    assert ch["weight-kg"] == pytest.approx(MODELS[name]["weight_kg"], abs=0.01)


@pytest.mark.parametrize("name", DEVICES)
def test_the_faces_are_sized_from_the_envelope(name):
    d = load_device(name)
    ch = d["chassis"]
    for view in ("front", "rear"):
        assert d["views"][view]["size"] == {"w": ch["width"], "h": ch["height"]}
    for view in ("top", "bottom"):
        assert d["views"][view]["size"] == {"w": ch["width"], "h": ch["depth"]}
    for view in ("left", "right"):
        assert d["views"][view]["size"] == {"w": ch["depth"], "h": ch["height"]}


# --- the front ports ---------------------------------------------------------

@pytest.mark.parametrize("name", DEVICES)
def test_the_front_has_the_guides_jacks_numbered_from_zero_as_printed(name):
    d = load_device(name)
    n = MODELS[name]["ports"]
    pl = by_id(d, "front")
    ports = [pl[f"port-{i}"] for i in range(n)]
    assert not [i for i in pl if i.startswith("port-") and int(i.split("-")[1]) >= n]
    for i, p in enumerate(ports):
        assert p["ref"] == "common/rj45-ganged-eth@1"
        assert p["rel-pos"] == i
        assert p["group"] == "rj45"
    # the printed numbers are on the silkscreen, one per jack, under its column
    texts = {s["for"]: s["text"] for s in d["views"]["front"]["silkscreen"] if str(s.get("for", "")).startswith("port-")}
    assert texts == {f"port-{i}": str(i) for i in range(n)}


@pytest.mark.parametrize("name", DEVICES)
def test_the_jacks_stand_in_two_rows_with_the_even_number_on_top(name):
    pl = by_id(load_device(name), "front")
    n = MODELS[name]["ports"]
    for col in range(n // 2):
        upper, lower = pl[f"port-{2 * col}"], pl[f"port-{2 * col + 1}"]
        assert upper["at"][0] == lower["at"][0]
        assert upper["at"][1] < lower["at"][1]
        assert upper.get("rotate") == 180 and not lower.get("rotate")
    assert len({p["at"][1] for i, p in pl.items() if i.startswith("port-") and int(i[5:]) % 2 == 0}) == 1


@pytest.mark.parametrize("name", DEVICES)
def test_the_jacks_pitch_and_shells(name):
    d = load_device(name)
    pl = by_id(d, "front")
    xs = sorted({p["at"][0] for i, p in pl.items() if i.startswith("port-")})
    steps = [round(b - a, 2) for a, b in zip(xs, xs[1:])]
    n = MODELS[name]["ports"] // 2
    assert len(xs) == n
    # 13.97 within a shell of six, a 5.0 mm gutter between shells
    assert steps.count(13.97) == n - n // 6
    assert steps.count(18.97) == n // 6 - 1
    assert len([x for x in d["views"]["front"]["panel"]["decor"] if x.get("kind") == "jack-shell"]) == n // 6


@pytest.mark.parametrize("name", DEVICES)
def test_four_uplinks_numbered_zero_to_three_in_one_row(name):
    d = load_device(name)
    pl = by_id(d, "front")
    ups = [pl[f"uplink-{i}"] for i in range(4)]
    assert not [i for i in pl if i.startswith("uplink-") and int(i.split("-")[1]) > 3]
    assert {u["ref"] for u in ups} == {"std/sfp-ganged@1"}
    assert len({u["at"][1] for u in ups}) == 1
    assert [u["rel-pos"] for u in ups] == [0, 1, 2, 3]
    xs = [u["at"][0] for u in ups]
    assert xs == sorted(xs) and xs[0] > max(p["at"][0] for i, p in pl.items() if i.startswith("port-"))
    # two lamps beside each numeral
    lamps = [i for i in pl if i.startswith("led-uplink-")]
    assert len(lamps) == 8


@pytest.mark.parametrize("name", DEVICES)
def test_the_front_has_the_guides_status_lamps_button_and_console(name):
    d = load_device(name)
    m = MODELS[name]
    pl = by_id(d, "front")
    assert {"led-sys", "led-alm", "led-mst"} <= set(pl)
    modes = {i for i in pl if i in ("led-spd", "led-dx", "led-en", "led-poe")}
    assert len(modes) == m["mode_leds"]
    assert ("led-poe" in modes) == m["poe"]
    assert pl["btn-mode"]["ref"] == "common/reset-button@1"
    # the mini-USB console is chassis art with its own opening, not a placed part (nothing in the DCIM
    # export could carry it)
    decor = {x.get("id"): x for x in d["views"]["front"]["panel"]["decor"]}
    assert decor["console"]["size"] == [7.9, 4.6]
    assert "console" not in pl
    legends = {s["text"] for s in d["views"]["front"]["silkscreen"] if "text" in s}
    assert {"SYS", "ALM", "MST", "SPD", "DX", "EN", "CON", "0", "1", "2", "3"} <= legends
    assert ("POE" in legends) == m["poe"] and ("PoE+" in legends) == m["poe"]


@pytest.mark.parametrize("name", DEVICES)
def test_poe_is_stated_on_the_jacks_of_the_poe_models_only(name):
    g = load_device(name)["groups"]["rj45"]["attrs"]
    assert g["media"] == "rj45" and g["speed"] == "1g"
    assert ("poe" in g) == MODELS[name]["poe"]


# --- the rear ----------------------------------------------------------------

@pytest.mark.parametrize("name", DEVICES)
def test_the_rear_has_the_management_console_usb_and_esd_ports(name):
    d = load_device(name)
    pl = by_id(d, "rear")
    assert pl["mgmt"]["ref"] == "common/rj45-eth@1"
    assert pl["usb"]["ref"] == "std/usb-a@1"
    assert pl["console-rj45"]["ref"] == "std/rj45@2"
    assert pl["esd-rear-jack"]["ref"] == "common/esd-jack@1"
    assert pl["console-rj45"]["attrs"]["role"] == "console"
    decor = {x.get("id") for x in d["views"]["rear"]["panel"]["decor"]}
    assert {"earth-terminal", "earth-hole-1", "earth-hole-2"} <= decor


@pytest.mark.parametrize("name", DEVICES)
def test_the_power_input_and_fans(name):
    d = load_device(name)
    fans = [x for x in d["views"]["rear"]["panel"]["decor"] if x.get("kind") == "fan-grille"]
    assert len(fans) == MODELS[name]["fans"]
    assert by_id(d, "rear")["ac-inlet"]["ref"] == "std/c14-inlet@1"


def test_the_dc_rear_has_the_terminal_block_and_one_fan():
    d = load_device("ex2300-24t")
    assert d["configurations"]["dc"]["views"] == {"rear": "rear-dc"}
    assert d["views"]["rear-dc"]["face"] == "rear"
    pl = by_id(d, "rear-dc")
    decor = {x.get("id"): x for x in d["views"]["rear-dc"]["panel"]["decor"]}
    assert decor["dc-terminal"]["size"] == [52.6, 17.5]
    assert len([i for i in decor if i.startswith("dc-pole-") and not i.endswith("-screw")]) == 4
    assert "ac-inlet" not in pl and "dc-terminal" not in pl
    assert len([x for x in d["views"]["rear-dc"]["panel"]["decor"] if x.get("kind") == "fan-grille"]) == 1
    # the management cluster is the AC rear's
    for i in ("mgmt", "usb", "console-rj45", "esd-rear-jack"):
        assert i in pl
    assert d["views"]["rear-dc"]["size"] == d["views"]["rear"]["size"]


@pytest.mark.parametrize("name", [n for n in DEVICES if n != "ex2300-24t"])
def test_only_the_24t_has_a_dc_configuration(name):
    assert "dc" not in load_device(name)["configurations"]


# --- the built-in supply and fans are the chassis, not bays ------------------

@pytest.mark.parametrize("name", DEVICES)
def test_no_bay_and_no_supply_or_fan_component_is_modelled(name):
    d = load_device(name)
    for view in d["views"]:
        assert not bays(d, view), f"{name} {view}: the guide's supply and fans are built in"
        for p in placements(d, view):
            ref = p["ref"].split("/")[-1]
            assert not any(w in ref for w in ("psu", "fan", "jpsu")), (name, view, p["id"])
    assert "built-in" in d["provenance"]["built-in-power-and-fans"]["note"]


# --- the configurations ------------------------------------------------------

@pytest.mark.parametrize("name,cid,part", PART_NUMBERS)
def test_each_configuration_carries_its_part_number(name, cid, part):
    cfg = load_device(name)["configurations"][cid]
    assert set(cfg["part-numbers"]) == {part}
    assert cfg["kind"] in ("base", "orderable")


@pytest.mark.parametrize("name", DEVICES)
def test_the_configurations_are_the_guides_and_one_is_default(name):
    d = load_device(name)
    assert set(d["configurations"]) == set(MODELS[name]["configs"])
    defaults = [c for c, v in d["configurations"].items() if v.get("default")]
    assert defaults == ["ac"]
    assert [c for c, v in d["configurations"].items() if v["kind"] == "base"] == ["ac"]


@pytest.mark.parametrize("name", DEVICES)
def test_the_variants_share_the_front_and_only_the_dc_changes_the_rear(name):
    d = load_device(name)
    for cid, cfg in d["configurations"].items():
        assert "bays" not in cfg
        assert (cfg.get("views") or {}).get("front") is None
        assert rear_of(d, cid) == ("rear-dc" if cid == "dc" else "rear")


# --- the DCIM export ---------------------------------------------------------

@pytest.mark.parametrize("name,cid,part", PART_NUMBERS)
def test_the_dcim_device_types_export_one_per_configuration(name, cid, part):
    for target in ("netbox", "nautobot"):
        f = EXPORTS / target / "device-types" / "Juniper" / f"{part}.yaml"
        assert f.exists(), f"{f} is missing - run dcim_export.py for {name}"
        doc = yaml.safe_load(f.read_text())
        assert doc["manufacturer"] == "Juniper"
        assert doc["model"] == part
        assert doc["u_height"] == 1.0
        assert not doc.get("module-bays")


# --- the components ----------------------------------------------------------

def test_this_slice_adds_no_component():
    """Every part is a registry or common one: the guide's supply and fans are built in, and the two
    pieces of metalwork no library part covers (the mini-USB console, the DC terminal block) are chassis
    art, because the DCIM export has no row that could carry a part of either kind."""
    assert not list(COMP.glob("ex2300-*"))
