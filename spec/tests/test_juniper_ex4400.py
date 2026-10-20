"""The Juniper EX4400 copper switches - the 24T, 24P, 48T and 48P - against the hardware guide.

Every figure here is the one the EX4400 Switch Hardware Guide prints (PDF created 2026-07-22), with
the table that prints it named beside it. The tests read the manifests and the committed DCIM
exports and need no build.
"""
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
DEVICES = ROOT / "library/devices/juniper"
COMPONENTS = ROOT / "library/components/juniper"
EXPORTS = ROOT / "library/exports"

# model -> (RJ-45 ports, PoE, shipped supply, shipped supply watts, orderable configurations)
# Tables 7 to 28 of the guide: the 24T and 48T ship a 550 W AC supply, the 24P a 1050 W and the
# 48P a 1600 W one. Only the non-PoE models are sold in back-to-front and DC builds.
MODELS = {
    "ex4400-24t": dict(ports=24, poe=False, psu="jpsu-550-c-ac-afo", watts=550,
                       configs={"ac": "EX4400-24T", "afi": "EX4400-24T-AFI", "dc": "EX4400-24T-DC",
                                "dc-afi": "EX4400-24T-DC-AFI", "s": "EX4400-24T-S"}),
    "ex4400-24p": dict(ports=24, poe=True, psu="jpsu-1050-c-ac-afo", watts=1050,
                       configs={"ac": "EX4400-24P", "s": "EX4400-24P-S"}),
    "ex4400-48t": dict(ports=48, poe=False, psu="jpsu-550-c-ac-afo", watts=550,
                       configs={"ac": "EX4400-48T", "afi": "EX4400-48T-AFI", "dc": "EX4400-48T-DC",
                                "dc-afi": "EX4400-48T-DC-AFI", "s": "EX4400-48T-S"}),
    "ex4400-48p": dict(ports=48, poe=True, psu="jpsu-1600-c-ac-afo", watts=1600,
                       configs={"ac": "EX4400-48P", "s": "EX4400-48P-S"}),
}
NAMES = sorted(MODELS)

EXTENSION_MODULES = ["ex4400-em-1c", "ex4400-em-4s", "ex4400-em-4y"]


def load(name):
    return yaml.safe_load((DEVICES / name / "device.yaml").read_text())


def component(name):
    return yaml.safe_load((COMPONENTS / name / "v1/contract.yaml").read_text())


def view_parts(device, face):
    comps = (device["views"][face].get("components") or {})
    return comps.get("placements") or [], comps.get("bays") or []


def bay(device, bay_id):
    for b in view_parts(device, "rear")[1] + view_parts(device, "front")[1]:
        if b["id"] == bay_id:
            return b
    raise KeyError(bay_id)


def seated(device, cfg_name, bay_id):
    """The component name in a bay for one configuration - '' for an open bay."""
    over = (device["configurations"][cfg_name].get("bays") or {})
    ref = over[bay_id] if bay_id in over else bay(device, bay_id).get("default", "")
    return ref.split("/")[-1].split("@")[0] if ref else ""


@pytest.mark.parametrize("name", NAMES)
def test_envelope_is_the_guides_table_38(name):
    d = load(name)
    c = d["chassis"]
    # Table 38: 1.72 in (4.37 cm) high, 17.39 in (44.17 cm) wide, 15.71 in (39.9 cm) deep with
    # no supply, fan module or extension module fitted.
    assert c["width"] == pytest.approx(441.7, abs=0.05)
    assert c["height"] == pytest.approx(43.7, abs=0.05)
    assert c["depth"] == pytest.approx(399.0, abs=0.05)
    assert c["ru"] == 1
    for face, (w, h) in {"front": (441.7, 43.7), "rear": (441.7, 43.7), "left": (399.0, 43.7),
                         "right": (399.0, 43.7), "top": (441.7, 399.0), "bottom": (441.7, 399.0)}.items():
        size = d["views"][face]["size"]
        assert (size["w"], size["h"]) == pytest.approx((w, h), abs=0.05), face
    assert d["manufacturer"] == "Juniper" and d["model"] == name.upper()
    assert d["portfolio"] == {"line": "EX Series", "family": "EX4400"}


@pytest.mark.parametrize("name", NAMES)
def test_front_jacks_count_pitch_and_numbering(name):
    d = load(name)
    want = MODELS[name]["ports"]
    placements, _ = view_parts(d, "front")
    jacks = [p for p in placements if p["ref"] == "common/rj45-ganged-eth@1"]
    assert len(jacks) == want
    by_id = {p["id"]: p for p in jacks}
    assert sorted(by_id) == sorted(f"port-{n}" for n in range(want))   # printed 0 to N-1
    for n in range(want):
        p = by_id[f"port-{n}"]
        assert p["rel-pos"] == n and p["group"] == "rj45"
        # Figure 50 - the upper jack of a column carries the even number and is turned 180
        assert (p.get("rotate", 0) == 180) == (n % 2 == 0)
    # Table 9 and its siblings: 24 jacks are two blocks of six columns, 48 are four blocks, on the
    # registry's 13.97 mm ganged pitch with one gutter between blocks
    xs = sorted({round(p["at"][0], 2) for p in jacks})
    assert len(xs) == want // 2
    steps = [round(b - a, 2) for a, b in zip(xs, xs[1:])]
    assert steps.count(13.97) == len(steps) - (want // 12 - 1)
    assert all(s in (13.97, 19.41) for s in steps)
    # every jack has a punched cutout of its own
    cut = {c["id"] for c in d["views"]["front"]["panel"]["cutouts"]}
    assert set(by_id) <= cut
    # a printed numeral for each port, and the arrows pointing at it
    marks = d["views"]["front"]["silkscreen"]
    assert {m["text"] for m in marks if m.get("for", "").startswith("port-") and "text" in m} \
        == {str(n) for n in range(want)}
    assert sum(1 for m in marks if "path" in m and m.get("for", "").startswith("port-")) == want


@pytest.mark.parametrize("name", NAMES)
def test_front_has_the_status_block_and_the_extension_slot(name):
    d = load(name)
    placements, bays = view_parts(d, "front")
    ids = {p["id"] for p in placements}
    lamps = {"led-sys", "led-alm", "led-mst", "led-cld", "led-spd", "led-dx", "led-en"}
    if MODELS[name]["poe"]:
        lamps.add("led-poe")      # Figure 6 labels a fourth port mode lamp POE on the PoE models
    assert lamps <= ids and ("led-poe" in ids) == MODELS[name]["poe"]
    assert {"usb-c", "mode-button"} <= ids
    assert [b["id"] for b in bays] == ["ext-module"]
    mods = {a.split("/")[-1].split("@")[0] for a in bays[0]["accepts"]}
    # Table 5 lists three extension modules, and the shipped cover for the empty slot
    assert mods == set(EXTENSION_MODULES) | {"ex4400-em-cover"}
    assert bays[0]["default"] == "juniper/ex4400-em-cover@1"


@pytest.mark.parametrize("name", NAMES)
def test_rear_ports_and_slots(name):
    d = load(name)
    placements, bays = view_parts(d, "rear")
    qsfp = [p for p in placements if p["ref"] == "std/qsfp28@1"]
    assert sorted(p["id"] for p in qsfp) == ["qsfp-0", "qsfp-1"]       # 100GbE QSFP28 ports: 2
    assert d["groups"]["qsfp28"]["attrs"]["speed"] == "100g"
    ids = {p["id"] for p in placements}
    assert {"con", "mgmt", "usb", "reset", "ground-1", "ground-2", "esd-jack"} <= ids
    # four lamps for each QSFP28 port, in two rows of two (Figure 55)
    assert sum(1 for p in placements if p["id"].startswith("led-qsfp-")) == 8
    assert [b["id"] for b in bays] == ["fan-0", "fan-1", "psu-0", "psu-1"]   # slots numbered 0 and 1
    sizes = {b["id"]: (b["size"]["w"], b["size"]["h"]) for b in bays}
    # Table 39 (fan 1.65 in square) and Table 40 (supply 3.27 x 1.59 in)
    assert sizes["fan-0"] == pytest.approx((41.8, 41.8), abs=0.1)
    assert sizes["psu-0"] == pytest.approx((83.06, 40.39), abs=0.05)


@pytest.mark.parametrize("name", NAMES)
def test_configurations_and_their_part_numbers(name):
    d = load(name)
    cfgs = d["configurations"]
    orderable = {k: v for k, v in cfgs.items() if v["kind"] == "orderable"}
    assert {k: sorted(v["part-numbers"]) for k, v in orderable.items()} \
        == {k: [v] for k, v in MODELS[name]["configs"].items()}
    assert [k for k, v in cfgs.items() if v.get("default")] == ["ac"]
    assert all(v["kind"] == "example" for k, v in cfgs.items() if k not in orderable)


@pytest.mark.parametrize("name", NAMES)
def test_shipped_configuration_seats_the_supply_and_fans_the_guide_ships(name):
    d = load(name)
    m = MODELS[name]
    # Tables 8, 11, 20 and 26: one supply, two fan modules, a cover on the empty supply slot
    assert seated(d, "ac", "psu-0") == m["psu"]
    assert seated(d, "ac", "psu-1") == "ex4400-psu-cover"
    assert seated(d, "ac", "fan-0") == seated(d, "ac", "fan-1") == "ex4400-fan-afo"
    assert component(m["psu"])["attrs"]["power-output-w"] == m["watts"]
    # a spare ships with neither supplies nor fan modules
    for b in ("fan-0", "fan-1", "psu-0", "psu-1"):
        assert seated(d, "s", b) == ""


@pytest.mark.parametrize("name", NAMES)
def test_every_orderable_seats_parts_of_the_airflow_and_feed_it_states(name):
    d = load(name)
    for cfg_name in MODELS[name]["configs"]:
        cfg = d["configurations"][cfg_name]
        airflow = cfg.get("airflow") or d["chassis"].get("airflow")
        for bay_id in ("fan-0", "fan-1", "psu-0"):
            part = seated(d, cfg_name, bay_id)
            if not part:
                assert cfg_name == "s"
                continue
            c = component(part)
            assert c["attrs"]["airflow"] == airflow, (cfg_name, bay_id, part)
            if bay_id == "psu-0":
                assert c["attrs"]["role"] == f"{cfg['power']}-power-supply", (cfg_name, part)
    # the guide names handle colours by direction: orange for AIR OUT, blue for AIR IN
    afo, afi = component("ex4400-fan-afo"), component("ex4400-fan-afi")
    assert afo["attrs"]["airflow"] == "front-to-back" and afi["attrs"]["airflow"] == "back-to-front"
    assert afo["relief"]["features"][0]["color"] != afi["relief"]["features"][0]["color"]
    assert afi["relief"]["features"][0]["color"] == "#2a8bd8"


def test_the_poe_models_have_no_back_to_front_or_dc_orderable():
    # the guide lists no -AFI, -DC or -DC-AFI for the 24P or the 48P; their only DC supply is the
    # 2000 W one of the -S spare
    for name in ("ex4400-24p", "ex4400-48p"):
        d = load(name)
        assert sorted(k for k, v in d["configurations"].items() if v["kind"] == "orderable") == ["ac", "s"]
        accepted = {a.split("/")[-1].split("@")[0] for a in bay(d, "psu-0")["accepts"]}
        assert "jpsu-2000-c-dc-afo" in accepted
        assert not {"jpsu-550-c-ac-afo", "jpsu-550-c-ac-afi"} & accepted


def test_the_psu_and_fan_parts_are_named_by_their_juniper_part_numbers():
    parts = {
        "jpsu-550-c-ac-afo": "JPSU-550-C-AC-AFO", "jpsu-550-c-ac-afi": "JPSU-550-C-AC-AFI",
        "jpsu-550-c-dc-afo": "JPSU-550-C-DC-AFO", "jpsu-550-c-dc-afi": "JPSU-550-C-DC-AFI",
        "jpsu-1050-c-ac-afo": "JPSU-1050-C-AC-AFO", "jpsu-1600-c-ac-afo": "JPSU-1600-C-AC-AFO",
        "jpsu-2000-c-dc-afo": "JPSU-2000-C-DC-AFO"}
    for name, pn in parts.items():
        c = component(name)
        assert c["class"] == "psu" and c["kind"] == "module"
        assert c["part-numbers"] == {pn: {"part": pn}}
        # Table 40 - 3.27 x 1.59 x 8.88 in
        assert (c["size"]["w"], c["size"]["h"], c["size"]["d"]) == pytest.approx((83.06, 40.39, 225.55), abs=0.05)
        assert c["attrs"]["power-output-w"] == int(pn.split("-")[1])


@pytest.mark.parametrize("name", EXTENSION_MODULES)
def test_extension_modules_have_the_ports_the_guide_lists(name):
    c = component(name)
    assert c["class"] == "line-card"
    ports = [p for p in c["parts"] if p["id"].startswith("port-")]
    want = {"ex4400-em-4s": (4, "std/sfp-ganged@1", "sfp-plus", "10g"),
            "ex4400-em-4y": (4, "std/sfp-ganged@1", "sfp28", "25g"),
            "ex4400-em-1c": (1, "std/qsfp28@1", "qsfp28", "100g")}[name]
    assert len(ports) == want[0] and {p["ref"] for p in ports} == {want[1]}
    assert c["groups"][want[2]]["attrs"]["speed"] == want[3]
    # Table 5 - the module fills the slot at the front right
    assert (c["size"]["w"], c["size"]["h"]) == (74.0, 23.5)


@pytest.mark.parametrize("name", NAMES)
def test_extension_slot_example_seats_a_module(name):
    d = load(name)
    ex = d["configurations"]["em-4y"]
    assert ex["kind"] == "example" and ex["bays"] == {"ext-module": "juniper/ex4400-em-4y@1"}


def device_type_files(target):
    return sorted((EXPORTS / target / "device-types/Juniper").glob("EX4400-*.yaml"))


@pytest.mark.parametrize("target", ["netbox", "nautobot"])
def test_dcim_exports_one_device_type_per_orderable_configuration(target):
    want = {pn for m in MODELS.values() for pn in m["configs"].values()}
    got = {}
    for f in device_type_files(target):
        doc = yaml.safe_load(f.read_text())
        got[doc["model"]] = doc
    assert set(got) == want
    for model, doc in got.items():
        assert doc["manufacturer"] == "Juniper"
        assert doc["u_height"] == 1.0          # Table 38 - 1.72 in, one rack unit
    # 24 or 48 RJ-45 jacks, two QSFP28 ports on the rear
    for model, doc in got.items():
        ports = [i for i in doc["interfaces"] if i["type"] == "1000base-t" and i["name"].startswith("port-")]
        n = 24 if "24" in model else 48
        assert len(ports) == n
        assert sum(1 for i in doc["interfaces"] if i["type"] == "100gbase-x-qsfp28") == 2


@pytest.mark.parametrize("target", ["netbox", "nautobot"])
def test_dcim_exports_each_powered_module_type_once(target):
    files = sorted((EXPORTS / target / "module-types/Juniper").glob("*.yaml"))
    models = {yaml.safe_load(f.read_text())["model"] for f in files}
    assert {"JPSU-550-C-AC-AFO", "JPSU-550-C-AC-AFI", "JPSU-550-C-DC-AFO", "JPSU-550-C-DC-AFI",
            "JPSU-1050-C-AC-AFO", "JPSU-1600-C-AC-AFO", "JPSU-2000-C-DC-AFO"} <= models
