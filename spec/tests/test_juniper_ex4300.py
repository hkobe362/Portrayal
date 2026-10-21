"""The Juniper EX4300 1G copper switches: EX4300-24T, -24P, -48T and -48P (#39).

One device per front panel, each with its power, airflow and spare-chassis builds as
`kind: orderable` configurations. The expected figures below are the hardware guide's
(EX4300 Switch Hardware Guide, published 2025-08-12): Table 10 for the envelope, Tables 1, 3
and 8 for what each model ships with, Tables 27, 28, 30, 31, 47 and 48 for the field-replaceable
units and their airflow, and the datasheet's Table 2 for the spare chassis. Each test reads the
YAML a contributor edits, or the generated export a DCIM user imports; none reads a table the
exporter holds, because a table that says so proves nothing about the file.
"""
import pathlib

import pytest
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
LIB = ROOT / "library"
INCH = 25.4

# the units the guide lists, by component name: part number, output watts, airflow, feed
PSUS = {
    "ex4300-jpsu-350-ac-afo": ("JPSU-350-AC-AFO-A", 350, "front-to-back", "ac"),
    "ex4300-jpsu-350-ac-afi": ("JPSU-350-AC-AFI-A", 350, "back-to-front", "ac"),
    "ex4300-jpsu-715-ac-afo": ("JPSU-715-AC-AFO-A", 715, "front-to-back", "ac"),
    "ex4300-jpsu-1100-ac-afo": ("JPSU-1100-AC-AFO-A", 1100, "front-to-back", "ac"),
    "ex4300-jpsu-550-dc-afo": ("JPSU-550-DC-AFO-A", 550, "front-to-back", "dc"),
    "ex4300-jpsu-550-dc-afi": ("JPSU-550-DC-AFI-A", 550, "back-to-front", "dc"),
}
FANS = {
    "ex4300-fan-afo": ("EX4300-FAN", "front-to-back"),
    "ex4300-fan-afi": ("EX4300-FAN-AFI", "back-to-front"),
}
BLANKS = ["ex4300-psu-blank", "ex4300-uplink-blank"]

# device: (model, built-in jacks, PoE+, the supply it ships with, configurations -> part numbers)
DEVICES = {
    "ex4300-24t": ("EX4300-24T", 24, False, "ex4300-jpsu-350-ac-afo",
                   {"ac": ["EX4300-24T"], "s": ["EX4300-24T-S"]}),
    "ex4300-24p": ("EX4300-24P", 24, True, "ex4300-jpsu-715-ac-afo",
                   {"ac": ["EX4300-24P"], "s": ["EX4300-24P-S"]}),
    "ex4300-48t": ("EX4300-48T", 48, False, "ex4300-jpsu-350-ac-afo",
                   {"ac": ["EX4300-48T"], "afi": ["EX4300-48T-AFI"], "dc": ["EX4300-48T-DC"],
                    "dc-afi": ["EX4300-48T-DC-AFI"], "s": ["EX4300-48T-S"]}),
    "ex4300-48p": ("EX4300-48P", 48, True, "ex4300-jpsu-1100-ac-afo",
                   {"ac": ["EX4300-48P"], "s": ["EX4300-48P-S"]}),
}
# what each non-spare build seats: (supply, fan, airflow, feed)
BUILDS = {
    "ac": ("default", "ex4300-fan-afo", "front-to-back", "ac"),
    "afi": ("ex4300-jpsu-350-ac-afi", "ex4300-fan-afi", "back-to-front", "ac"),
    "dc": ("ex4300-jpsu-550-dc-afo", "ex4300-fan-afo", "front-to-back", "dc"),
    "dc-afi": ("ex4300-jpsu-550-dc-afi", "ex4300-fan-afi", "back-to-front", "dc"),
}


def load(name):
    return yaml.safe_load((LIB / "devices/juniper" / name / "device.yaml").read_text())


def contract(name):
    return yaml.safe_load(
        (LIB / "components/juniper" / name / "v1/contract.yaml").read_text())


def placements(d, view):
    return (d["views"][view].get("components") or {}).get("placements") or []


def bays(d, view):
    return {b["id"]: b for b in (d["views"][view].get("components") or {}).get("bays") or []}


def name_of(ref):
    return ref.split("/")[1].split("@")[0]


def seated(d, cfg):
    """Bay id -> the component name seated in that configuration, '' for an open bay."""
    out = {}
    for view in ("front", "rear"):
        for bid, b in bays(d, view).items():
            out[bid] = name_of(b["default"]) if b.get("default") else ""
    for bid, ref in ((d["configurations"][cfg].get("bays")) or {}).items():
        out[bid] = name_of(ref) if ref else ""
    return out


# ---------------------------------------------------------------- the envelope


@pytest.mark.parametrize("dev", DEVICES)
def test_the_envelope_is_table_10(dev):
    """Table 10: 1.72 in high, 17.36 in wide (the 19 in figure is over the brackets), 17.51 in
    deep with a power supply fitted, one rack unit."""
    c = load(dev)["chassis"]
    assert c["ru"] == 1
    assert c["height"] == pytest.approx(1.72 * INCH, abs=0.1)
    assert c["width"] == pytest.approx(17.36 * INCH, abs=0.2)
    assert c["depth"] == pytest.approx(44.47 * 10, abs=0.2)
    assert c["depth"] == pytest.approx(17.51 * INCH, abs=0.2)


@pytest.mark.parametrize("dev", DEVICES)
def test_every_face_is_sized_from_the_envelope(dev):
    d = load(dev)
    c = d["chassis"]
    for v in ("front", "rear"):
        assert d["views"][v]["size"] == {"w": c["width"], "h": c["height"]}
    for v in ("top", "bottom"):
        assert d["views"][v]["size"] == {"w": c["width"], "h": c["depth"]}
    for v in ("left", "right"):
        assert d["views"][v]["size"] == {"w": c["depth"], "h": c["height"]}


@pytest.mark.parametrize("dev", DEVICES)
def test_the_maker_and_the_names_are_as_printed(dev):
    d = load(dev)
    assert d["manufacturer"] == "Juniper"
    assert d["model"] == DEVICES[dev][0]
    assert d["portfolio"] == {"line": "EX Series", "family": "EX4300"}
    assert d["maturity"] == "modelled"


# ------------------------------------------------------------------ the faces


@pytest.mark.parametrize("dev", DEVICES)
def test_the_front_has_the_jacks_the_guide_counts_numbered_as_printed(dev):
    _, n, poe, *_ = DEVICES[dev]
    d = load(dev)
    jacks = [p for p in placements(d, "front") if p["ref"] == "common/rj45-ganged-eth@1"]
    assert sorted(int(p["id"].split("-")[1]) for p in jacks) == list(range(n))
    for p in jacks:
        k = int(p["id"].split("-")[1])
        assert p["rel-pos"] == k and p["group"] == "rj45"
        # numbering runs down each column: the even number is the upper jack, turned 180
        assert p.get("rotate", 0) == (180 if k % 2 == 0 else 0)
    group = d["groups"]["rj45"]
    assert group["attrs"]["media"] == "rj45" and group["attrs"]["speed"] == "1g"
    assert ("poe" in group["attrs"]) is poe
    # the printed numbers: one numeral per jack, spelled as the metal spells it
    numerals = {s["for"]: s["text"] for s in d["views"]["front"]["silkscreen"]
                if s.get("for", "").startswith("port-")}
    assert numerals == {f"port-{k}": str(k) for k in range(n)}
    cut = {c["id"] for c in d["views"]["front"]["panel"]["cutouts"]}
    assert {f"port-{k}" for k in range(n)} <= cut


@pytest.mark.parametrize("dev", DEVICES)
def test_the_jacks_stand_in_columns_of_six_on_the_registry_pitch(dev):
    _, n, *_ = DEVICES[dev]
    d = load(dev)
    top = {int(p["id"].split("-")[1]): p["at"] for p in placements(d, "front")
           if p["ref"] == "common/rj45-ganged-eth@1" and p.get("rotate") == 180}
    xs = [top[k][0] for k in sorted(top)]
    assert len(xs) == n // 2
    steps = [round(b - a, 2) for a, b in zip(xs, xs[1:])]
    # 13.97 within a block of six columns; wider between blocks
    assert steps.count(13.97) == n // 2 - n // 12
    assert all(s > 13.97 for s in steps if s != 13.97)


@pytest.mark.parametrize("dev", DEVICES)
def test_the_front_carries_the_console_lcd_buttons_lamps_and_the_uplink_slot(dev):
    d = load(dev)
    ids = {p["id"]: p["ref"] for p in placements(d, "front")}
    assert ids["console"] == "juniper/ex4300-console-usb-mini@1"
    assert ids["btn-menu"] == ids["btn-enter"] == "juniper/ex4300-lcd-button@1"
    for lamp in ("led-alm", "led-sys", "led-mst"):
        assert ids[lamp] == "common/led-dot@1"
    legends = {s["text"] for s in d["views"]["front"]["silkscreen"]}
    assert {"JUNIPER", "EX4300", "CON1"} <= legends
    # the photograph prints no legend by the chassis lamps; the guide's names are not invented
    assert not legends & {"ALM", "SYS", "MST"}
    slot = bays(d, "front")["uplink"]
    assert slot["accepts"] == ["juniper/ex4300-uplink-blank@1"]
    assert slot["default"] == "juniper/ex4300-uplink-blank@1"


@pytest.mark.parametrize("dev", DEVICES)
def test_the_rear_has_four_qsfp_ports_the_management_jacks_and_four_bays(dev):
    d = load(dev)
    rear = {p["id"]: p for p in placements(d, "rear")}
    for k in range(4):
        assert rear[f"vcp-{k}"]["ref"] == "std/qsfp-ganged@1"
        assert rear[f"vcp-{k}"]["rel-pos"] == k
        assert rear[f"led-vcp-{k}-a"]["for"] == rear[f"led-vcp-{k}-b"]["for"] == f"vcp-{k}"
    assert rear["mgmt"]["ref"] == "common/rj45-eth@1"
    assert rear["con2"]["ref"] == "std/rj45@2"
    assert rear["usb"]["ref"] == "std/usb-a@1"
    assert set(bays(d, "rear")) == {"fan-0", "fan-1", "psu-0", "psu-1"}
    assert d["groups"]["vcp"]["attrs"] == {"media": "qsfp", "speed": "40g"}
    assert d["groups"]["fans"]["attrs"]["redundancy"] == "n+0"


# ------------------------------------------------- the field-replaceable units


@pytest.mark.parametrize("comp", sorted(PSUS))
def test_a_power_supply_states_its_part_number_output_and_airflow(comp):
    pn, watts, flow, feed = PSUS[comp]
    c = contract(comp)
    assert c["class"] == "psu" and c["kind"] == "module"
    assert c["attrs"]["part-number"] == pn
    assert c["attrs"]["power-output-w"] == watts
    assert c["attrs"]["airflow"] == flow
    assert c["attrs"]["airflow-label"] == ("AIR OUT (AFO)" if flow == "front-to-back"
                                           else "AIR IN (AFI)")
    if feed == "dc":
        assert c["attrs"]["inlet"] == "dc-terminal"
    else:
        assert any(p["ref"] == "std/c14-inlet@1" for p in c["parts"])
    # the guide's Tables 30 and 47: every supply weighs 2.43 lb
    assert c["attrs"]["weight-kg"] == 1.1


@pytest.mark.parametrize("comp", sorted(FANS))
def test_a_fan_module_states_its_part_number_and_airflow(comp):
    pn, flow = FANS[comp]
    c = contract(comp)
    assert c["class"] == "fan" and c["attrs"]["part-number"] == pn
    assert c["attrs"]["airflow"] == flow


@pytest.mark.parametrize("dev", DEVICES)
def test_the_bays_accept_what_the_guide_lists(dev):
    d = load(dev)
    psus = {f"juniper/{c}@1" for c in PSUS} | {"juniper/ex4300-psu-blank@1"}
    fans = {f"juniper/{c}@1" for c in FANS}
    for bid in ("psu-0", "psu-1"):
        assert set(bays(d, "rear")[bid]["accepts"]) == psus
    for bid in ("fan-0", "fan-1"):
        assert set(bays(d, "rear")[bid]["accepts"]) == fans


@pytest.mark.parametrize("dev", DEVICES)
def test_the_default_build_ships_what_the_guide_says(dev):
    """Tables 1, 3 and 8: one supply, a cover panel over the other slot, two AIR OUT fans."""
    _, _, _, psu, _ = DEVICES[dev]
    d = load(dev)
    s = seated(d, "ac")
    assert s == {"uplink": "ex4300-uplink-blank", "psu-0": psu, "psu-1": "ex4300-psu-blank",
                 "fan-0": "ex4300-fan-afo", "fan-1": "ex4300-fan-afo"}


# ------------------------------------------------------------- configurations


@pytest.mark.parametrize("dev", DEVICES)
def test_each_configuration_lists_its_part_numbers(dev):
    d = load(dev)
    want = DEVICES[dev][4]
    assert set(d["configurations"]) == set(want)
    for cfg, pns in want.items():
        got = d["configurations"][cfg]
        assert got["kind"] == "orderable"
        assert list(got["part-numbers"]) == pns
    defaults = [c for c, v in d["configurations"].items() if v.get("default")]
    assert defaults == ["ac"]


@pytest.mark.parametrize("dev", DEVICES)
def test_a_built_configuration_seats_a_matching_set(dev):
    """The guide's caution (Tables 27, 28): never mix AIR IN and AIR OUT parts, never mix AC
    and DC. Every build seats a supply and two fans whose airflow and feed agree with the build's."""
    d = load(dev)
    for cfg in DEVICES[dev][4]:
        if cfg == "s":
            continue
        supply, fan, flow, feed = BUILDS[cfg]
        s = seated(d, cfg)
        if supply == "default":
            supply = DEVICES[dev][3]
        assert s["psu-0"] == supply and s["fan-0"] == s["fan-1"] == fan
        c = d["configurations"][cfg]
        assert c.get("airflow", d["chassis"]["airflow"]) == flow
        assert c.get("power", d["chassis"]["power"]) == feed
        assert contract(supply)["attrs"]["airflow"] == flow == contract(fan)["attrs"]["airflow"]
        assert PSUS[supply][3] == feed
        # the cover panel keeps the empty slot closed
        assert s["psu-1"] == "ex4300-psu-blank"


@pytest.mark.parametrize("dev", DEVICES)
def test_the_spare_chassis_shows_its_bays_open(dev):
    d = load(dev)
    s = seated(d, "s")
    assert s["psu-0"] == s["psu-1"] == s["fan-0"] == s["fan-1"] == ""
    assert s["uplink"] == "ex4300-uplink-blank"


def test_only_the_48t_has_airflow_and_dc_builds():
    """Tables 1, 3 and 8 list AFI and DC builds for the 48T alone among these four panels."""
    for dev in ("ex4300-24t", "ex4300-24p", "ex4300-48p"):
        assert set(load(dev)["configurations"]) == {"ac", "s"}
    d = load("ex4300-48t")
    assert d["configurations"]["afi"]["airflow"] == "back-to-front"
    assert d["configurations"]["dc"]["power"] == "dc"
    assert d["configurations"]["dc-afi"]["power"] == "dc"
    assert d["configurations"]["dc-afi"]["airflow"] == "back-to-front"


# ------------------------------------------------------------------- the DCIM


@pytest.mark.parametrize("target", ["netbox", "nautobot"])
@pytest.mark.parametrize("dev", DEVICES)
def test_the_dcim_types_export_one_per_orderable_configuration(target, dev):
    d = load(dev)
    want = {pn for v in d["configurations"].values() if v["kind"] == "orderable"
            for pn in v["part-numbers"]}
    folder = LIB / "exports" / target / "device-types" / "Juniper"
    got = {p.stem for p in folder.glob("EX4300-*.yaml")
           if p.stem == DEVICES[dev][0] or p.stem.startswith(DEVICES[dev][0] + "-")}
    # EX4300-48T-S must not be taken for a 48T family member's sibling, so compare exactly
    assert want <= got
    for pn in want:
        doc = yaml.safe_load((folder / f"{pn}.yaml").read_text())
        assert doc["manufacturer"] == "Juniper"
        assert doc["model"] == pn
        assert doc["u_height"] == 1.0


@pytest.mark.parametrize("dev", DEVICES)
def test_the_exported_type_lists_the_jacks_and_the_qsfp_ports(dev):
    _, n, *_ = DEVICES[dev]
    doc = yaml.safe_load(
        (LIB / "exports/netbox/device-types/Juniper" / f"{DEVICES[dev][0]}.yaml").read_text())
    names = {i["name"] for i in doc["interfaces"]}
    assert {f"port-{k}" for k in range(n)} <= names
    assert {f"vcp-{k}" for k in range(4)} <= names
    assert not {f"port-{k}" for k in range(n, 48)} & names


@pytest.mark.parametrize("target", ["netbox", "nautobot"])
@pytest.mark.parametrize("dev", DEVICES)
def test_the_exported_type_lists_both_consoles(target, dev):
    """CON1 on the front is a mini-USB console and CON2 on the rear an RJ-45 one."""
    doc = yaml.safe_load(
        (LIB / "exports" / target / "device-types/Juniper" / f"{DEVICES[dev][0]}.yaml").read_text())
    consoles = {(c["name"], c["type"]) for c in doc["console-ports"]}
    assert consoles == {("Console (mini-USB)", "usb-mini-b"), ("Console", "rj-45")}


# ------------------------------------------------------------- the components


def test_the_new_components_are_family_prefixed():
    """This slice adds no shared Juniper EX/QFX component: every juniper/ part its devices
    place or seat is the EX4300's own."""
    refs = set()
    for dev in DEVICES:
        d = load(dev)
        for view in ("front", "rear"):
            for p in placements(d, view):
                refs.add(p["ref"])
            for b in bays(d, view).values():
                refs.update(b["accepts"])
    mine = {r for r in refs if r.startswith("juniper/")}
    assert mine and all(r.startswith("juniper/ex4300-") for r in mine)


@pytest.mark.parametrize("comp", sorted(PSUS) + sorted(FANS) + BLANKS +
                         ["ex4300-console-usb-mini", "ex4300-lcd-button"])
def test_each_component_states_where_its_size_came_from(comp):
    c = contract(comp)
    assert c["size-confidence"]
    assert all(isinstance(v, str) for v in c["provenance"].values())
