"""The Juniper QFX5120-48Y and QFX5120-48YM, from the QFX5120 Switch Hardware Guide (2026-09-30).

One device per front panel: the 48Y and the 48YM do not share one (the 48YM puts its eight QSFP28
ports between two blocks of SFP28 and prints one lamp a port). Each model's power and airflow
variants are `orderable` configurations of its device, because the guide shows the same panel for
all four. Each field-replaceable unit is a component named by its Juniper part number.

What the guide fixes, and so what these tests hold:
  Table 9    the envelope - 1.72 x 17.36 x 20.48 in, 1RU
  Table 7    the variants, the part numbers and the supplies and fan modules each ships with
  Table 23   the fan module part numbers and the airflow of each
  Tables 25, 26   the supply part numbers (650 W for the 48Y, 850 W for the 48YM) and their airflow
  figures 30 to 40   the ports, their count and numbering, and what is on the rear
"""
import pathlib

import pytest
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
DEV = ROOT / "library/devices/juniper"
COMP = ROOT / "library/components/juniper"
EXPORTS = ROOT / "library/exports"

INCH = 25.4

# Table 9: height, width, depth in inches (1RU); the 48Y and 48YM share one row of figures
ENVELOPE_IN = {"h": 1.72, "w": 17.36, "d": 20.48}

# Table 7: configuration -> (part number, power supply, fan module, airflow)
VARIANTS = {
    "qfx5120-48y": {
        "ac-f2b": ("QFX5120-48Y-AFO2", "jpsu-650w-ac-ao", "qfx5110-fanafo", "front-to-back"),
        "ac-b2f": ("QFX5120-48Y-AFI2", "jpsu-650w-ac-ai", "qfx5110-fanafi", "back-to-front"),
    },
    "qfx5120-48ym": {
        "ac-f2b": ("QFX5120-48YM-AFO", "jpsu-850w-ac-afo", "qfx5110-fanafo", "front-to-back"),
        "ac-b2f": ("QFX5120-48YM-AFI", "jpsu-850w-ac-afi", "qfx5110-fanafi", "back-to-front"),
    },
}
DEVICES = sorted(VARIANTS)
# The supply and fan modules each model's bays accept, from Tables 25 and 23
ACCEPTS = {
    "qfx5120-48y": {"psu": {"jpsu-650w-ac-ao", "jpsu-650w-ac-ai"}},
    "qfx5120-48ym": {"psu": {"jpsu-850w-ac-afo", "jpsu-850w-ac-afi"}},
}
FANS = {"qfx5110-fanafo", "qfx5110-fanafi"}
# Table 8/guide: the supply and fan power figures are not published, the supply rating is its name
PSU_WATTS = {"jpsu-650w-ac-ao": 650, "jpsu-650w-ac-ai": 650,
             "jpsu-850w-ac-afo": 850, "jpsu-850w-ac-afi": 850}


def load_device(name):
    return yaml.safe_load((DEV / name / "device.yaml").read_text())


def load_component(name):
    return yaml.safe_load((COMP / name / "v1" / "contract.yaml").read_text())


def placements(dev, view):
    return (dev["views"][view].get("components") or {}).get("placements") or []


def bays(dev, view):
    return (dev["views"][view].get("components") or {}).get("bays") or []


def ref_name(ref):
    return ref.split("/")[-1].split("@")[0]


# --- the envelope ------------------------------------------------------------

@pytest.mark.parametrize("name", DEVICES)
def test_the_envelope_is_table_9(name):
    ch = load_device(name)["chassis"]
    assert ch["ru"] == 1
    assert ch["height"] == pytest.approx(ENVELOPE_IN["h"] * INCH, abs=0.1)
    assert ch["width"] == pytest.approx(ENVELOPE_IN["w"] * INCH, abs=0.1)
    assert ch["depth"] == pytest.approx(ENVELOPE_IN["d"] * INCH, abs=0.1)


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


@pytest.mark.parametrize("name", DEVICES)
def test_the_front_is_the_body_and_not_the_rack_face(name):
    """Table 9: the brackets extend 17.36 in to 19 in, so the body is what is drawn."""
    d = load_device(name)
    assert d["views"]["front"]["size"]["w"] < 480


# --- the ports, per face -----------------------------------------------------

def ports_by_cage(dev):
    out = {"sfp": [], "qsfp": []}
    for p in placements(dev, "front"):
        name = ref_name(p["ref"])
        if name == "sfp-ganged":
            out["sfp"].append(p)
        elif name == "qsfp-ganged":
            out["qsfp"].append(p)
    return out


@pytest.mark.parametrize("name", DEVICES)
def test_48_sfp28_and_8_qsfp28_cages_on_the_front(name):
    cages = ports_by_cage(load_device(name))
    assert len(cages["sfp"]) == 48
    assert len(cages["qsfp"]) == 8


@pytest.mark.parametrize("name", DEVICES)
def test_ports_are_numbered_0_to_55_as_printed(name):
    d = load_device(name)
    cages = ports_by_cage(d)
    sfp = sorted(int(p["id"].split("-")[1]) for p in cages["sfp"])
    qsfp = sorted(int(p["id"].split("-")[1]) for p in cages["qsfp"])
    assert sfp == list(range(0, 48))
    assert qsfp == list(range(48, 56))
    # the numeral printed beside each cage is its number
    printed = {s["text"] for s in d["views"]["front"]["silkscreen"] if s.get("text", "").isdigit()}
    assert {str(n) for n in range(56)} <= printed


@pytest.mark.parametrize("name", DEVICES)
def test_the_groups_say_what_the_ports_are(name):
    g = load_device(name)["groups"]
    assert g["sfp28"]["attrs"] == {"media": "sfp28", "speed": "25g"}
    assert g["qsfp28"]["attrs"] == {"media": "qsfp28", "speed": "100g"}
    assert g["sfp28"]["role"] == g["qsfp28"]["role"] == "traffic"


def test_48y_ports_sit_in_three_blocks_of_sfp28_then_the_qsfp28_block():
    d = load_device("qfx5120-48y")
    cages = ports_by_cage(d)
    sfp_x = max(p["at"][0] for p in cages["sfp"])
    qsfp_x = min(p["at"][0] for p in cages["qsfp"])
    assert qsfp_x > sfp_x, "the QSFP28 block is at the right of the SFP28 block"
    # two rows, upper cages even and lower odd: the printed column order
    y = {int(p["id"].split("-")[1]): p["at"][1] for p in cages["sfp"]}
    assert all(y[2 * c] < y[2 * c + 1] for c in range(24))


def test_48ym_puts_the_qsfp28_between_two_sfp28_blocks():
    d = load_device("qfx5120-48ym")
    cages = ports_by_cage(d)
    x = {int(p["id"].split("-")[1]): p["at"][0] for p in cages["sfp"] + cages["qsfp"]}
    assert max(x[n] for n in range(0, 24)) < min(x[n] for n in range(48, 56))
    assert max(x[n] for n in range(48, 56)) < min(x[n] for n in range(24, 48))


def test_the_lamps_follow_the_guide_tables():
    """48Y: two lamps a SFP28 port and four a QSFP28 port (Tables 18, 19); 48YM: one each (20, 21)."""
    y = load_device("qfx5120-48y")
    ids = {p["id"] for p in placements(y, "front") if ref_name(p["ref"]) == "led-dot"}
    for n in range(48):
        assert f"led-port-{n}" in ids and f"led-port-{n}-speed" in ids
    for n in range(48, 56):
        assert f"led-port-{n}" in ids
        assert {f"led-port-{n}-lane-{k}" for k in (2, 3, 4)} <= ids
    assert len(ids) == 96 + 32
    ym = load_device("qfx5120-48ym")
    ids = {p["id"] for p in placements(ym, "front") if ref_name(p["ref"]) == "led-dot"}
    assert ids == {f"led-port-{n}" for n in range(56)}


def test_48ym_prints_one_numeral_strip_under_the_lower_row():
    d = load_device("qfx5120-48ym")
    ys = {s["at"][1] for s in d["views"]["front"]["silkscreen"] if s.get("text", "").isdigit()}
    assert len(ys) == 1 and min(ys) > 36.0


@pytest.mark.parametrize("name", DEVICES)
def test_the_rear_has_console_usb_and_two_management_jacks(name):
    d = load_device(name)
    by_id = {p["id"]: p for p in placements(d, "rear")}
    assert ref_name(by_id["console"]["ref"]) == "rj45-ganged"
    assert by_id["console"]["attrs"]["role"] == "console"
    assert ref_name(by_id["usb"]["ref"]) == "usb-a"
    for jack in ("mgmt-c0", "mgmt-c1"):
        assert ref_name(by_id[jack]["ref"]) == "rj45-ganged-eth"
        assert by_id[jack]["attrs"]["speed"] == "1g"
    assert {"led-alm", "led-sys", "led-mst", "led-id", "reset-btn", "esd-rear-jack"} <= set(by_id)


def test_c0_and_c1_are_printed_the_other_way_up_on_the_48ym():
    """48Y prints C0 above C1; the 48YM prints C1 above C0 (the photographs, not the callouts)."""
    y = {p["id"]: p["at"][1] for p in placements(load_device("qfx5120-48y"), "rear")}
    ym = {p["id"]: p["at"][1] for p in placements(load_device("qfx5120-48ym"), "rear")}
    assert y["mgmt-c0"] < y["mgmt-c1"]
    assert ym["mgmt-c1"] < ym["mgmt-c0"]


def test_only_the_48ym_has_the_timing_outputs():
    y = {p["id"] for p in placements(load_device("qfx5120-48y"), "rear")}
    ym = {p["id"]: p for p in placements(load_device("qfx5120-48ym"), "rear")}
    assert not ({"pps-out", "out-10m"} & y)
    assert ref_name(ym["pps-out"]["ref"]) == ref_name(ym["out-10m"]["ref"]) == "din-1-0-2-3-jack"


@pytest.mark.parametrize("name", DEVICES)
def test_five_fan_slots_and_two_supply_slots_numbered_as_the_guide_numbers_them(name):
    """Fan slots 0 to 4 and supply slots 0 and 1, left to right (Fan Modules, AC Power Supply)."""
    d = load_device(name)
    b = {x["id"]: x for x in bays(d, "rear")}
    fans = sorted(i for i in b if i.startswith("fan-"))
    assert fans == [f"fan-{n}" for n in range(5)]
    assert [b[f]["at"][0] for f in fans] == sorted(b[f]["at"][0] for f in fans)
    assert sorted(i for i in b if i.startswith("psu-")) == ["psu-0", "psu-1"]
    assert b["psu-0"]["at"][0] < b["psu-1"]["at"][0]
    assert b["psu-1"]["at"][0] > b["fan-4"]["at"][0]


# --- the configurations ------------------------------------------------------

@pytest.mark.parametrize("name", DEVICES)
def test_each_variant_is_an_orderable_configuration_with_its_part_number(name):
    cfgs = load_device(name)["configurations"]
    assert set(cfgs) == set(VARIANTS[name])
    for cid, (part, *_rest) in VARIANTS[name].items():
        assert cfgs[cid]["kind"] == "orderable"
        assert set(cfgs[cid]["part-numbers"]) == {part}


@pytest.mark.parametrize("name", DEVICES)
def test_the_default_is_ac_front_to_back(name):
    cfgs = load_device(name)["configurations"]
    defaults = [c for c, v in cfgs.items() if v.get("default")]
    assert defaults == ["ac-f2b"]


def seated(dev, cid):
    """bay id -> component name, as the configuration leaves it (default where unstated)."""
    cfg = dev["configurations"][cid]
    out = {}
    for b in bays(dev, "rear"):
        ref = (cfg.get("bays") or {}).get(b["id"], b.get("default"))
        out[b["id"]] = ref_name(ref)
    return out


@pytest.mark.parametrize("name", DEVICES)
@pytest.mark.parametrize("cid", ["ac-f2b", "ac-b2f"])
def test_each_configuration_seats_its_supply_and_fan_module_with_matching_airflow(name, cid):
    d = load_device(name)
    _part, psu, fan, airflow = VARIANTS[name][cid]
    s = seated(d, cid)
    assert {s["psu-0"], s["psu-1"]} == {psu}
    assert {s[f"fan-{n}"] for n in range(5)} == {fan}
    for comp in (psu, fan):
        assert load_component(comp)["attrs"]["airflow"] == airflow
    # the chassis states the default airflow; a configuration states it only where it differs
    cfg_airflow = d["configurations"][cid].get("airflow", d["chassis"]["airflow"])
    assert cfg_airflow == airflow


@pytest.mark.parametrize("name", DEVICES)
def test_a_bay_accepts_the_modules_the_guide_lists(name):
    d = load_device(name)
    for b in bays(d, "rear"):
        got = {ref_name(r) for r in b["accepts"]}
        want = FANS if b["id"].startswith("fan-") else ACCEPTS[name]["psu"]
        assert got == want, b["id"]
        assert ref_name(b["default"]) in got


def test_the_48ym_does_not_take_the_650_w_supplies():
    """Table 25: the 48T and 48Y take the 650 W part, the 48YM the 850 W one."""
    y = {ref_name(r) for b in bays(load_device("qfx5120-48y"), "rear") if b["id"].startswith("psu-") for r in b["accepts"]}
    ym = {ref_name(r) for b in bays(load_device("qfx5120-48ym"), "rear") if b["id"].startswith("psu-") for r in b["accepts"]}
    assert all("650w" in n for n in y) and all("850w" in n for n in ym)


@pytest.mark.parametrize("name", DEVICES)
def test_bays_reserve_one_size_for_each_module_they_accept(name):
    d = load_device(name)
    for b in bays(d, "rear"):
        for ref in b["accepts"]:
            c = load_component(ref_name(ref))["size"]
            assert b["size"]["w"] == pytest.approx(c["w"], abs=0.3)
            assert b["size"]["h"] == pytest.approx(c["h"], abs=0.3)


# --- the field-replaceable units ---------------------------------------------

PARTS = ["jpsu-650w-ac-ao", "jpsu-650w-ac-ai", "jpsu-850w-ac-afo", "jpsu-850w-ac-afi",
         "qfx5110-fanafo", "qfx5110-fanafi"]


@pytest.mark.parametrize("part", PARTS)
def test_a_unit_is_named_by_its_juniper_part_number(part):
    c = load_component(part)
    assert c["name"] == part
    assert c["attrs"]["model"] == part.upper()
    assert c["kind"] == "module"


@pytest.mark.parametrize("part", PARTS)
def test_a_unit_is_described_as_the_unit_and_names_the_lines_that_take_it(part):
    text = " ".join(load_component(part)["description"].split())
    assert "field-replaceable" in text
    assert "QFX5120-48Y" in text
    if "850w" in part:
        assert "QFX5120-48YM" in text and "QFX5120-48Y " not in text.replace("QFX5120-48YM", "")
    elif part.startswith("qfx5110"):
        assert "QFX5120-48YM" in text and "QFX5120-48T" in text


@pytest.mark.parametrize("part,watts", sorted(PSU_WATTS.items()))
def test_a_supply_states_the_power_it_provides_as_an_output(part, watts):
    attrs = load_component(part)["attrs"]
    assert attrs["power-output-w"] == watts
    assert not any(k.startswith("power-draw") for k in attrs)


@pytest.mark.parametrize("part", ["qfx5110-fanafo", "qfx5110-fanafi"])
def test_a_fan_module_says_its_power_is_not_published(part):
    assert load_component(part)["attrs"]["power-absent"] == "not-published"


@pytest.mark.parametrize("front,back", [("jpsu-650w-ac-ao", "jpsu-650w-ac-ai"),
                                          ("jpsu-850w-ac-afo", "jpsu-850w-ac-afi"),
                                          ("qfx5110-fanafo", "qfx5110-fanafi")])
def test_the_back_to_front_unit_has_a_blue_handle_and_the_front_to_back_a_gold_one(front, back):
    """Tables 23, 26: AIR OUT with a Juniper Gold handle, AIR IN with a Juniper Azure Blue handle."""
    def handle(part):
        feats = load_component(part)["relief"]["features"]
        return next(f for f in feats if f["node"] in ("latch", "handle"))["color"]
    f, b = handle(front), handle(back)
    assert f != b
    assert f.lower() == "#e8731f"                       # the photographed orange
    r, g, bl = (int(b[i:i + 2], 16) for i in (1, 3, 5))
    assert bl > r and bl > g, "blue is the dominant channel"
    assert load_component(front)["attrs"]["airflow"] == "front-to-back"
    assert load_component(back)["attrs"]["airflow"] == "back-to-front"
    if front.startswith("qfx5110"):
        # the fan module prints its direction on the chip; the supplies' photograph shows no label
        for part, word in ((front, "AIR OUT"), (back, "AIR IN")):
            svg = (COMP / part / "v1/skins/default.svg").read_text()
            assert f">{word.split()[1]}</text>" in svg and ">AIR</text>" in svg


# --- the DCIM export ---------------------------------------------------------

@pytest.mark.parametrize("name", DEVICES)
@pytest.mark.parametrize("cid", ["ac-f2b", "ac-b2f"])
def test_the_dcim_device_types_export_one_per_orderable_configuration(name, cid):
    part = VARIANTS[name][cid][0]
    for target in ("netbox", "nautobot"):
        f = EXPORTS / target / "device-types" / "Juniper" / f"{part}.yaml"
        assert f.exists(), f"{f} is missing - run dcim_export.py for {name}"
        doc = yaml.safe_load(f.read_text())
        assert doc["manufacturer"] == "Juniper"
        assert doc["model"] == part
        assert doc["u_height"] == 1.0


def test_no_other_juniper_qfx5120_export_exists():
    got = {p.stem for p in (EXPORTS / "netbox/device-types/Juniper").glob("QFX5120-*.yaml")}
    want = {v[0] for per in VARIANTS.values() for v in per.values()}
    assert got == want
