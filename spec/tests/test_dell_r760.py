"""The Dell PowerEdge R760 (library/devices/dell/r760): 2U, two-socket, 16th generation.

Every figure below is what Dell's own R760 Installation and Service Manual (ISM), Technical Guide (TG) or Spec
Sheet prints, in the units it prints them, with the table or figure it comes from. What no document dimensions is
estimated in the device and is held here only to what the model itself declares.

The manifests and contracts are read from the tree, so those tests run anywhere; the drawings and the DCIM device
types are read from the build (`library/dist`, `library/exports`) and skip without it, like the other sweeps over
compiled drawings.
"""
import json
import pathlib
import re
import xml.etree.ElementTree as ET

import pytest
import yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
LIB = ROOT / "library"
DIST = LIB / "dist"
EXPORTS = LIB / "exports"
DEVICE = LIB / "devices" / "dell" / "r760" / "device.yaml"

needs_dist = pytest.mark.skipif(not (DIST / "r760.configs.json").is_file(),
                                reason="library/dist not built - run ./build.sh")
needs_exports = pytest.mark.skipif(not (EXPORTS / "netbox" / "device-types" / "Dell").is_dir(),
                                   reason="library/exports not built")

DEV = yaml.safe_load(DEVICE.read_text())
VIEWS = DEV["views"]
CONFIGS = DEV["configurations"]

# ISM table 10 and the spec sheet: the envelope, in mm
ACROSS_EARS = 482.0          # Xa
BETWEEN_EARS = 434.0         # Xb
HEIGHT = 86.8                # Y
EAR_TO_FACE_BEZEL = 35.84    # Za, with the bezel
EAR_TO_FACE = 22.0           # Za, without the bezel
EAR_TO_REAR_WALL = 700.7     # Zb
EAR_TO_PSU_HANDLE = 736.29   # Zc

# the six fronts: the config-name prefix, the view it binds, and the bays it has (ISM figures 1 to 6)
FRONTS = {
    "sff24": ("front", 24, "drive"),
    "sff16": ("front-sff16", 16, "drive"),
    "sff8": ("front-sff8", 8, "drive"),
    "lff12": ("front-lff12", 12, "lff-drive"),
    "e3s16": ("front-e3s16", 16, "e3s"),
    "e3s16r": ("front-e3s16r", 16, "e3s"),
}

# ISM table 153 (and the technical guide's table 14): the slots each riser configuration lists, and the slots the
# model carries beyond them - slot 6 where one processor leaves riser 2's second slot without a CPU, and slot 8
# on riser 4R, which table 18 and figure 222 give and the configuration tables do not (see the device's gaps)
SLOTS = {
    0: (set(), set()),
    1: ({1, 2, 3, 4, 5, 6, 7, 8}, set()),
    2: ({1, 2, 3, 4, 5, 6, 7, 8}, set()),
    3: ({2, 3, 4, 5, 6, 7}, set()),
    4: ({2, 3, 4, 5, 6, 7}, {8}),
    5: ({1, 2, 3, 5, 6, 7}, set()),
    6: ({3, 6, 7, 8}, set()),
    7: ({1, 2, 3, 6, 7, 8}, set()),
    8: ({1, 2, 3}, {6}),
    9: ({1, 2, 3, 7}, {6, 8}),
    10: ({2, 3, 7}, {6, 8}),
    13: ({3}, {6}),
}

# ISM table 153 per slot: (height, controlling processor, PCIe generation, lanes) of the risers whose rows are unambiguous
RISER_SLOTS = {
    "1b": {1: ("full", 1, 4, 8), 2: ("full", 1, 4, 8)},
    "1q": {1: ("full", 1, 5, 8), 2: ("full", 1, 5, 8)},
    "1p": {2: ("full", 1, 5, 16)},
    "1r": {1: ("full", 1, 4, 16), 2: ("full", 1, 5, 16)},
    "2a": {3: ("low", 1, 4, 16), 6: ("low", 2, 4, 16)},
    "3a": {5: ("full", 2, 4, 16)},
    "3b": {4: ("full", 2, 4, 8), 5: ("full", 2, 4, 8)},
    "4b": {7: ("full", 2, 4, 8), 8: ("full", 2, 4, 8)},
    "4p": {7: ("full", 2, 5, 16)},
    "4q": {7: ("full", 2, 5, 8), 8: ("full", 2, 5, 8)},
}


def contract(ref):
    ns, rest = ref.split("/")
    name, major = rest.split("@")
    return yaml.safe_load((LIB / "components" / ns / name / f"v{major}" / "contract.yaml").read_text())


def view_bays(view_name):
    return {b["id"]: b for b in VIEWS[view_name]["components"]["bays"]}


def view_placements(view_name):
    return {p["id"]: p for p in VIEWS[view_name]["components"].get("placements", [])}


def occupant(cfg_name, view_name, bay_id):
    """What a bay holds in a configuration: the configuration's choice, else the bay's default."""
    over = (CONFIGS[cfg_name].get("bays") or {})
    return over.get(bay_id, view_bays(view_name)[bay_id].get("default"))


def config_view(cfg_name, face):
    return (CONFIGS[cfg_name].get("views") or {}).get(face, face)


def orderable():
    return [n for n, c in CONFIGS.items() if c.get("kind") == "orderable"]


def front_of(cfg_name):
    return cfg_name.split("-")[0]


def rc_of(cfg_name):
    return int(re.search(r"-rc(\d+)-", cfg_name).group(1))


def slots_of(cfg_name):
    """The PCIe slot numbers a configuration's rear carries, read from the risers it seats."""
    rear = config_view(cfg_name, "rear")
    found = set()
    for bay_id in ("riser-1", "riser-2", "riser-3", "riser-4"):
        if bay_id not in view_bays(rear):
            continue
        for sid, slot in (contract(occupant(cfg_name, rear, bay_id)).get("bays") or {}).items():
            if "slot" in slot:
                found.add(int(sid.split("-")[1]))
    return found


# --- the envelope ---------------------------------------------------------------------------------

def test_the_envelope_is_the_isms():
    ch = DEV["chassis"]
    assert ch["width"] == BETWEEN_EARS and ch["height"] == HEIGHT and ch["ru"] == 2
    # the depth is the front face to the rear wall: Zb with the ears' 22.0 behind the face (the R660's derivation)
    assert ch["depth"] == pytest.approx(EAR_TO_FACE + EAR_TO_REAR_WALL, abs=0.01)
    # the spec sheet's and technical guide's 772.13 / 758.29 are Za + Zc and 22.0 + Zc, the depth to the PSU handles
    assert EAR_TO_FACE_BEZEL + EAR_TO_PSU_HANDLE == pytest.approx(772.13, abs=0.01)
    assert EAR_TO_FACE + EAR_TO_PSU_HANDLE == pytest.approx(758.29, abs=0.01)
    assert EAR_TO_PSU_HANDLE - EAR_TO_REAR_WALL == pytest.approx(35.59, abs=0.01)


def test_the_front_is_the_rack_face_because_the_ears_carry_the_panels():
    for name, (view, _, _) in FRONTS.items():
        v = VIEWS[view]
        assert v["size"]["h"] == HEIGHT
        # the face is the 482.6 rack face (the spec sheet's 482 is the ISM's Xa to the millimetre)
        assert v["size"]["w"] == 482.6, name
        assert abs(v["size"]["w"] - ACROSS_EARS) < 1.0
        bays = view_bays(view)
        assert bays["panel-left"]["at"][0] < 24.3, f"{name}: the left panel is in the ear"
        placements = view_placements(view)
        assert placements["power-btn"]["at"][0] > 457.0 and placements["vga"]["at"][0] > 460.0, name
    for face in ("rear", "top"):
        assert VIEWS[face]["size"]["w"] == BETWEEN_EARS
    assert VIEWS["top"]["size"]["h"] == DEV["chassis"]["depth"]


# --- the fronts -----------------------------------------------------------------------------------

@pytest.mark.parametrize("front", sorted(FRONTS))
def test_each_front_is_a_view_with_the_bays_the_ism_lists(front):
    view, count, prefix = FRONTS[front]
    bays = [b for b in VIEWS[view]["components"]["bays"] if b["id"].startswith(prefix + "-")]
    assert len(bays) == count
    # Dell's numbering is each bay's rel-pos, 0 to count - 1 (ISM figures 25 to 27: no face prints a number)
    assert sorted(b["rel-pos"] for b in bays) == list(range(count))
    # every bay defaults to a blank: Dell publishes no default drive count and the ISM wants blanks for cooling
    assert all("blank" in b["default"] for b in bays)
    # and the configurations bind the view: every front has a build, and every one of them says so
    mine = [n for n in orderable() if front_of(n) == front]
    assert mine, front
    for n in mine:
        assert config_view(n, "front") == view


def test_the_24_bay_front_numbers_left_to_right():
    bays = sorted(view_bays("front").values(), key=lambda b: b["at"][0] if b["id"].startswith("drive") else -1)
    drives = [b for b in bays if b["id"].startswith("drive-")]
    assert [b["rel-pos"] for b in drives] == list(range(24))
    assert [b["id"] for b in drives] == [f"drive-{i}" for i in range(24)]
    pitch = {round(b2["at"][0] - b1["at"][0], 2) for b1, b2 in zip(drives, drives[1:])}
    assert pitch == {17.87}, "one 17.868 mm pitch, the R740xd's (the figure measures 17.855)"


def test_the_16_bay_front_numbers_a_group_of_eight_either_side_of_the_vent():
    drives = sorted((b for b in view_bays("front-sff16").values() if b["id"].startswith("drive-")),
                    key=lambda b: b["rel-pos"])
    assert [b["rel-pos"] for b in drives] == list(range(16))
    left, right = drives[:8], drives[8:]
    assert max(b["at"][0] for b in left) < 169.83, "bays 0 to 7 are left of the Smart Flow plate"
    assert min(b["at"][0] for b in right) > 312.0, "bays 8 to 15 are right of it"
    assert [b["at"][0] for b in left] == sorted(b["at"][0] for b in left)


def test_the_12_bay_front_numbers_down_each_column():
    # ISM figure 26: 0 1 2 in the first column, 3 4 5 in the second, 6 7 8 in the third, 9 10 11 in the fourth
    drives = {b["rel-pos"]: b for b in view_bays("front-lff12").values() if b["id"].startswith("lff-drive-")}
    assert set(drives) == set(range(12))
    for n, b in drives.items():
        col, row = divmod(n, 3)
        assert b["at"][0] == pytest.approx(26.884 + 107.208 * col, abs=0.001), n
        assert b["at"][1] == pytest.approx(3.89 + 26.99 * row, abs=0.001), n
        assert all("35" in a for a in b["accepts"])


@pytest.mark.parametrize("front,slots", [("front-e3s16", (1, 4)), ("front-e3s16r", (1, 5))])
def test_the_e3s_fronts_fill_two_slots_of_the_five_slot_grid(front, slots):
    # ISM figure 27: five 84.8 mm cage slots from x 28.0; configuration b drives slots 1 and 4, d slots 1 and 5
    drives = sorted((b for b in view_bays(front).values() if b["id"].startswith("e3s-")), key=lambda b: b["rel-pos"])
    assert [b["rel-pos"] for b in drives] == list(range(16))
    for group, slot in ((drives[:8], slots[0]), (drives[8:], slots[1])):
        lo, hi = 28.0 + 84.8 * (slot - 1), 28.0 + 84.8 * slot
        assert all(lo <= b["at"][0] and b["at"][0] + b["size"]["w"] <= hi + 0.5 for b in group), (front, slot)
        xs = [b["at"][0] for b in group]
        assert xs == sorted(xs) and {round(b - a, 2) for a, b in zip(xs, xs[1:])} == {10.2}


def test_every_front_seats_the_bezel_over_its_drives():
    for front, (view, count, prefix) in FRONTS.items():
        bezel = view_placements(view)["bezel"]
        assert bezel["ref"] == "dell/bezel-2u-16g@1"
        assert len(bezel["hides"]) == count and all(h.startswith(prefix + "-") for h in bezel["hides"])
        assert set(bezel["hides"]) <= set(bezel["for"])


def test_the_control_panels_and_right_panel_parts_are_seated():
    for front, (view, _, _) in FRONTS.items():
        bays, placements = view_bays(view), view_placements(view)
        assert bays["panel-left"]["default"] == "dell/control-panel-left-2u-16g@1"
        # ISM table 4: power button, one USB 2.0 port, iDRAC Direct (micro-AB USB), VGA - and no second USB port
        assert {"power-btn", "usb-1", "idrac-direct", "vga"} <= set(placements), front
        assert "usb-2" not in placements, front


# --- the rear -------------------------------------------------------------------------------------

def test_every_front_has_a_build_for_each_riser_configuration_of_ism_table_153():
    names = orderable()
    for front in FRONTS:
        got = {rc_of(n) for n in names if front_of(n) == front and not re.search(r"-r(2x25|4e3s|4x25)$", n)}
        assert got == set(SLOTS), (front, sorted(got ^ set(SLOTS)))


@pytest.mark.parametrize("name", [n for n in orderable()])
def test_each_riser_configurations_rear_has_the_slots_the_ism_lists(name):
    expected, extra = SLOTS[rc_of(name)]
    got = slots_of(name)
    assert expected <= got, f"{name}: ISM table 153 lists slots {sorted(expected - got)} that the rear lacks"
    assert got - expected <= extra, f"{name}: slots {sorted(got - expected - extra)} are not in table 153"


def test_the_risers_slot_records_match_table_153():
    for riser, rows in RISER_SLOTS.items():
        bays = contract(f"dell/riser-{riser}-2u-16g@1")["bays"]
        for number, (height, proc, gen, lanes) in rows.items():
            slot = bays[f"slot-{number}"]["slot"]
            assert slot["connector"] == "x16", (riser, number)
            assert (slot["height"], slot["processor"], slot["generation"], slot["lanes"]) == (height, proc, gen, lanes), \
                (riser, number)


def test_slots_are_numbered_as_the_ism_numbers_them():
    # slot 2 above 1, 5 above 4 and 8 above 7 (ISM figures 208 to 221); riser 2's slot 3 is left of its slot 6 (processor 1
    # is the left socket seen from the rear)
    for riser, upper, lower in (("1b", 2, 1), ("3b", 5, 4), ("4b", 8, 7)):
        bays = contract(f"dell/riser-{riser}-2u-16g@1")["bays"]
        assert bays[f"slot-{upper}"]["at"][1] < bays[f"slot-{lower}"]["at"][1], riser
    r2 = contract("dell/riser-2a-2u-16g@1")["bays"]
    assert r2["slot-3"]["at"][0] < r2["slot-6"]["at"][0]
    # eight slots at most (ISM: 'up to eight PCI express slots'), each number once across the four risers
    assert slots_of("sff24-rc1-1b2a3b4b") == set(range(1, 9))


def test_the_single_slot_risers_close_the_other_window_with_a_filler():
    for riser, plated in (("1p", "slot-1"), ("3a", "slot-4"), ("4p", "slot-8")):
        bay = contract(f"dell/riser-{riser}-2u-16g@1")["bays"][plated]
        assert bay["accepts"] == ["dell/pcie-filler-fh-16g@1"] and "slot" not in bay, riser


def test_the_rear_row_is_the_r660s_moved_down_a_unit():
    rear = view_bays("rear")
    r660 = yaml.safe_load((LIB / "devices" / "dell" / "r660" / "device.yaml").read_text())
    r660_rear = {b["id"]: b for b in r660["views"]["rear"]["components"]["bays"]}
    for bay in ("lom", "rio", "ocp"):
        assert rear[bay]["at"][0] == r660_rear[bay]["at"][0], bay
        assert rear[bay]["at"][1] == pytest.approx(r660_rear[bay]["at"][1] + 44.0, abs=0.01), bay
        assert rear[bay]["accepts"] == r660_rear[bay]["accepts"] or bay == "rio"


def test_the_supply_bays_take_the_86mm_supply_and_the_60mm_adapter():
    # ISM tables 15 and 16: 700 to 1800 W are the 60 mm form, 2400 to 3200 W the 86 mm; the PSU adapter (ISM figures 299
    # and 300) is removed for an 86 mm supply
    for view in ("rear", "rear-4x25"):
        for bay in ("psu-1", "psu-2"):
            b = view_bays(view)[bay]
            assert b["size"]["w"] == pytest.approx(86.3, abs=0.01) and b["size"]["h"] == pytest.approx(41.0)
            assert set(b["accepts"]) == {"dell/psu-2400w-ac-86mm@1", "dell/psu-adapter-60mm-2u-16g@1"}
    adapter = contract("dell/psu-adapter-60mm-2u-16g@1")
    assert adapter["size"]["w"] == pytest.approx(86.3)
    assert {r.split("/")[1].split("@")[0] for r in adapter["bays"]["psu"]["accepts"]} == \
        {"psu-700w-ac-60mm", "psu-800w-ac-60mm", "psu-1100w-ac-60mm", "psu-1400w-ac-60mm"}
    psu = contract("dell/psu-2400w-ac-86mm@1")
    assert psu["attrs"]["power-output-w"] == 2400 and psu["attrs"]["form-factor"] == "86mm"
    assert psu["size"]["w"] == pytest.approx(86.3, abs=0.01), "the 86 mm of Dell's name"
    # the two bays are 1+1 redundant (TG: 'up to two AC power supplies with 1+1 redundancy')
    assert DEV["groups"]["psus"]["attrs"]["redundancy"] == "1+1"


def test_the_rear_drive_modules_are_seated_only_where_the_documents_allow():
    # TG table 14 lists rear storage as possible with configurations 6, 7 and 12 only; ISM tables 88 to 90 pair the rear
    # drives with the 12 x 3.5 and 24 x 2.5 fronts
    rear_storage = [n for n in orderable() if re.search(r"-r(2x25|4e3s|4x25)$", n)]
    assert {rc_of(n) for n in rear_storage} <= {6, 7}
    assert {front_of(n) for n in rear_storage} == {"sff24", "lff12"}
    mod = {"r2x25": ("dell/rear-drive-2x25-2u-16g@1", 2), "r4e3s": ("dell/rear-drive-4e3s-2u-16g@1", 4),
           "r4x25": ("dell/rear-drive-4x25-2u-16g@1", 4)}
    for n in rear_storage:
        key = n.rsplit("-", 1)[1]
        ref, drives = mod[key]
        if key == "r4x25":
            assert config_view(n, "rear") == "rear-4x25"
            assert occupant(n, "rear-4x25", "rear-drives") == ref
        else:
            assert occupant(n, "rear", "riser-3") == ref
        assert len(contract(ref)["bays"]) == drives


# --- the top view -----------------------------------------------------------------------------------

def test_the_top_view_carries_the_fans_heatsinks_and_dimm_slots_the_ism_gives():
    bays = view_bays("top")
    fans = sorted((b for b in bays.values() if b["id"].startswith("fan-")), key=lambda b: b["rel-pos"])
    assert len(fans) == 6, "ISM: up to six fans"
    assert all(b["default"] == "dell/fan-2u-16g@1" for b in fans)
    xs = [b["at"][0] for b in fans]
    assert xs == sorted(xs) and xs[3] - xs[2] > 80, "two groups of three with a gap in the middle (figure 15)"
    dimms = {b["id"] for b in bays.values() if b["id"].startswith("dimm-")}
    assert dimms == {f"dimm-{c}{n}" for c in "ab" for n in range(1, 17)}, "32 DIMM slots, A1..A16 and B1..B16 (figure 180)"
    heatsinks = {p["id"] for p in view_placements("top").values() if p["ref"].startswith("dell/heatsink")}
    assert heatsinks == {"heatsink-1", "heatsink-2"}


def test_the_memory_channels_are_the_isms():
    # ISM table 149 (memory channels): processor 1 owns slots A1..A16, processor 2 B1..B16; across the board the sockets
    # run B (left group), B then A (the middle sixteen), A (right group), as figure 180 labels them
    bays = view_bays("top")
    order = [b["id"].split("-")[1] for b in sorted((b for b in bays.values() if b["id"].startswith("dimm-")),
                                                    key=lambda b: b["at"][0])]
    assert order[:8] == ["b8", "b16", "b2", "b10", "b6", "b14", "b4", "b12"]
    assert order[8:24] == ["b9", "b1", "b15", "b7", "b11", "b3", "b13", "b5",
                           "a8", "a16", "a2", "a10", "a6", "a14", "a4", "a12"]
    assert order[24:] == ["a9", "a1", "a15", "a7", "a11", "a3", "a13", "a5"]


def test_the_plan_projections_follow_the_rear_bays():
    # plan x = 434 - rear x - width, the R660's convention, for the supplies and risers
    rear = view_bays("rear")
    for bay in ("psu-1", "psu-2", "riser-1", "riser-3", "riser-4"):
        at, w = rear[bay]["at"][0], rear[bay]["size"]["w"]
        assert rear[bay]["plan"]["at"][0] == pytest.approx(434.0 - at - w, abs=0.15), bay


# --- the parts ----------------------------------------------------------------------------------------

NEW_PARTS = [
    "bezel-2u-16g", "control-panel-left-2u-16g", "psu-2400w-ac-86mm", "psu-86mm-plan", "psu-adapter-60mm-2u-16g",
    "boss-n1-module-2u-16g", "boss-n1-blank-2u-16g",
    "riser-1-cage-2u-16g", "riser-2-cage-2u-16g", "riser-3-cage-2u-16g", "riser-4-cage-2u-16g",
    "riser-1b-2u-16g", "riser-1p-2u-16g", "riser-1q-2u-16g", "riser-1r-2u-16g", "riser-2a-2u-16g",
    "riser-3a-2u-16g", "riser-3b-2u-16g", "riser-4b-2u-16g", "riser-4p-2u-16g", "riser-4q-2u-16g", "riser-4r-2u-16g",
    "riser-1-blank-2u-16g", "riser-2-blank-2u-16g", "riser-3-blank-2u-16g", "riser-4-blank-2u-16g",
    "riser-1-plan-2u-16g", "riser-2-plan-2u-16g", "riser-3-plan-2u-16g", "riser-4-plan-2u-16g",
    "rear-drive-2x25-2u-16g", "rear-drive-4e3s-2u-16g", "rear-drive-4x25-2u-16g",
    "fan-2u-16g", "fan-cage-2u-16g", "air-shroud-2u-16g", "system-cover-2u-16g", "backplane-cover-2u-16g",
    "system-board-r760",
]


@pytest.mark.parametrize("part", NEW_PARTS)
def test_the_new_shared_parts_state_the_document_they_were_read_from(part):
    c = contract(f"dell/{part}@1")
    assert c["version"] == "1.0.0"
    text = json.dumps(c.get("provenance") or {})
    assert re.search(r"R760|ISM|Installation and Service Manual", text), f"{part} names no source"


def test_the_2u_risers_do_not_collide_with_the_1u_riser_names():
    # dell/riser-1p-16g and friends are the R660's 1U parts and keep their names; the 2U parts are `-2u-16g`
    for r in ("1p", "2a", "3a", "4p"):
        assert (LIB / "components" / "dell" / f"riser-{r}-16g").is_dir()
        assert (LIB / "components" / "dell" / f"riser-{r}-2u-16g").is_dir()


# --- the build ----------------------------------------------------------------------------------------

@needs_dist
def test_the_default_build_draws_every_face_and_the_bezel_hides_the_drives():
    cfg = json.loads((DIST / "r760.configs.json").read_text())
    default = next(c for c in cfg["configs"] if c["name"] == cfg["default"])
    assert set(default["files"]) == {"front", "rear", "top", "bottom", "left", "right"}
    front = ET.parse(DIST / default["files"]["front"]).getroot()
    bezel = next(g for g in front.iter() if g.get("id") == "bezel")
    assert bezel.get("data-hides").split() == [f"drive-{i}" for i in range(24)]


@needs_dist
def test_the_build_binds_each_front_to_its_configurations():
    cfg = json.loads((DIST / "r760.configs.json").read_text())
    by_name = {c["name"]: c for c in cfg["configs"]}
    for n in orderable():
        view = config_view(n, "front")
        assert by_name[n]["views"].get("front", "front") == view
    # six fronts are six drawings, each with its own number of bays
    counts = {}
    for n in orderable():
        svg = ET.parse(DIST / by_name[n]["files"]["front"]).getroot()
        counts[front_of(n)] = len([g for g in svg.iter() if re.fullmatch(r"(drive|lff-drive|e3s)-\d+", g.get("id") or "")])
    assert counts == {f: FRONTS[f][1] for f in FRONTS}


@needs_exports
def test_the_dcim_device_types_are_two_u_and_full_depth():
    folder = EXPORTS / "netbox" / "device-types" / "Dell"
    files = sorted(folder.glob("PowerEdge R760 *.yaml"))
    assert files, "no R760 device type was exported"
    assert any(f.name == "PowerEdge R760 sff24-rc1-1b2a3b4b.yaml" for f in files), "the default build is a device type"
    for f in files:
        doc = yaml.safe_load(f.read_text())
        assert doc["u_height"] == 2.0 and doc["is_full_depth"] is True, f.name
        assert doc["manufacturer"] == "Dell" and doc["model"].startswith("PowerEdge R760 "), f.name
    # one device type per distinct configuration: every orderable build is exported under its own name
    wanted = {f"PowerEdge R760 {n}.yaml" for n in orderable()}
    assert wanted <= {f.name for f in files}, sorted(wanted - {f.name for f in files})[:5]
