"""The ASR 9000 400G and 200G modular line cards fit seven chassis.

Cisco data sheet c78-735809 says so twice: p4, "Features and benefits", and p6,
Table 2, "Chassis compatibility", with a per-chassis maximum card count on p7.
The library seated the four carriers on the ASR 9010 only. These tests hold the
other six chassis to the sheet: every line card slot takes the four carriers, no
slot that holds only RSPs does, and the slot counts agree with Table 2. The
MOD80 and MOD160 are not in that sheet and stay where they were.
"""
import pathlib

import pytest

from portrayal import libwalk
from portrayal.manifest import load_yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
LIB = ROOT / "library"

CARRIERS = {"cisco/a9k-mod400-se@2", "cisco/a9k-mod400-tr@2",
            "cisco/a9k-mod200-se@2", "cisco/a9k-mod200-tr@2"}
NOT_COVERED = {"cisco/a9k-mod80-se@2", "cisco/a9k-mod80-tr@2",
               "cisco/a9k-mod160-se@2", "cisco/a9k-mod160-tr@2"}
# Table 2, "Card density": the most modular line cards each chassis takes
MAX_CARDS = {"asr-9922": 20, "asr-9912": 10, "asr-9910": 8, "asr-9906": 4,
             "asr-9904": 2, "asr-9010": 8, "asr-9006": 4}
SUPERVISOR_SLOTS = {"asr-9006": 2, "asr-9904": 2, "asr-9906": 2, "asr-9910": 2}
GAINED =sorted(set(MAX_CARDS) - {"asr-9010"})


def _bays(chassis):
    dev = load_yaml(LIB / "devices/cisco" / chassis / "device.yaml")
    return [bay for view in dev["views"].values()
            for bay in (view.get("components") or {}).get("bays", [])]


def _slots(chassis):
    """(line card slots, other slots) of a chassis: a slot is a line card slot
    when it accepts a part whose contract class is line-card."""
    line, other = [], []
    for bay in _bays(chassis):
        if bay.get("group") != "slots":
            continue
        classes = {(libwalk.load_contract(ref, [LIB]) or {}).get("class")
                   for ref in bay["accepts"]}
        (line if "line-card" in classes else other).append(bay)
    return line, other


@pytest.mark.parametrize("chassis", sorted(MAX_CARDS))
def test_every_line_card_slot_takes_the_four_carriers(chassis):
    line, _ = _slots(chassis)
    missing = {b["id"]: sorted(CARRIERS - set(b["accepts"])) for b in line
               if CARRIERS - set(b["accepts"])}
    assert missing == {}


@pytest.mark.parametrize("chassis", sorted(MAX_CARDS))
def test_the_line_card_slot_count_is_table_2s_maximum(chassis):
    line, _ = _slots(chassis)
    assert len(line) == MAX_CARDS[chassis]


@pytest.mark.parametrize("chassis", GAINED)
def test_only_line_card_slots_take_a_carrier(chassis):
    line, other = _slots(chassis)
    # these chassis put an RSP in a slot of the line card size; the others
    # keep their RPs outside the slot group
    assert len(other) == SUPERVISOR_SLOTS.get(chassis, 0)
    takers = {b["id"] for b in _bays(chassis) if CARRIERS & set(b["accepts"])}
    assert takers == {b["id"] for b in line}


@pytest.mark.parametrize("chassis", GAINED)
def test_the_mod80_and_mod160_are_not_added(chassis):
    seated = {ref for bay in _bays(chassis) for ref in bay["accepts"]}
    assert seated & NOT_COVERED == set()
