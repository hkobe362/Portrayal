"""MX10004 / MX10008 / MX10016 base configurations ship slot covers.

Juniper's configuration tables ship a cover in every power supply slot and every
routing-and-control-board slot a base leaves unfilled, as well as in every
line-card slot. A base that seats all its supplies and boards is a different
box from the one the vendor sells. These tests hold the covers (sized from the
aperture they fill, named by their part number) and the base counts per chassis.
SFBs are not visible from outside the chassis and no SFB bay is drawn, so their
covers are not part of this slice.
"""
import pathlib
import re

import pytest

from portrayal.manifest import load_yaml

ROOT = pathlib.Path(__file__).resolve().parents[2]
LIB = ROOT / "library"
COMP = LIB / "components" / "juniper"

PWR = "juniper/jnp10k-pwr-blnk@1"
RE = "juniper/jnp10k-re-blnk@1"
LC = "juniper/jnp10k-lc-blank@1"

# chassis -> boards and supplies seated, and the covers beside them
COUNTS = {
    "mx10004": dict(re=1, re_cover=1, psu=2, psu_cover=1),
    "mx10008": dict(re=1, re_cover=1, psu=3, psu_cover=3),
    # the MX10016 table lists no RCB cover; the second slot is covered as on the other two
    "mx10016": dict(re=1, re_cover=1, psu=5, psu_cover=5),
}


def device(name):
    return load_yaml(LIB / "devices" / "juniper" / name / "device.yaml")


def contract(name):
    return load_yaml(COMP / name / "v1" / "contract.yaml")


def bays(dev, view, prefix):
    found = dev["views"][view]["components"]["bays"]
    return [b for b in found if re.fullmatch(prefix + r"\d+", b["id"])]


def seated(dev, view, prefix):
    """{bay id: ref} for the base configuration; a bay it does not name keeps its default."""
    over = dev["configurations"]["base"].get("bays") or {}
    return {b["id"]: over.get(b["id"], b.get("default")) for b in bays(dev, view, prefix)}


def rcb_prefix(name):
    return "re" if name == "mx10004" else ("cb")


@pytest.mark.parametrize("part,model", [("jnp10k-pwr-blnk", "JNP10K-PWR-BLNK"),
                                        ("jnp10k-re-blnk", "JNP10K-RE-BLNK")])
def test_cover_carries_its_part_number_in_provenance(part, model):
    c = contract(part)
    assert c["attrs"]["model"] == model
    assert model in c["provenance"]["part-number"]
    assert c["provenance"]["part-number"].startswith("vendor")
    assert c["provenance"]["face"].startswith("estimated")
    assert c["class"] == "blank"


def test_re_cover_is_the_size_of_the_rcb_aperture_in_all_three():
    c = contract("jnp10k-re-blnk")["size"]
    for name in COUNTS:
        sizes = {(b["size"]["w"], b["size"]["h"]) for b in bays(device(name), "front", rcb_prefix(name))}
        assert sizes == {(c["w"], c["h"])}, name


def test_pwr_cover_is_the_smallest_psu_aperture_so_it_overhangs_none():
    c = contract("jnp10k-pwr-blnk")["size"]
    heights = {}
    for name in COUNTS:
        sizes = {(b["size"]["w"], b["size"]["h"]) for b in bays(device(name), "rear", "psu")}
        assert len(sizes) == 1, name
        w, h = sizes.pop()
        assert w == c["w"], name
        assert h >= c["h"], name
        heights[name] = h
    assert min(heights.values()) == c["h"]


@pytest.mark.parametrize("name", sorted(COUNTS))
def test_chassis_accepts_the_covers_where_juniper_seats_one(name):
    dev = device(name)
    for b in bays(dev, "rear", "psu"):
        assert PWR in b["accepts"], (name, b["id"])
    for b in bays(dev, "front", rcb_prefix(name)):
        assert RE in b["accepts"], (name, b["id"])
        # the default stays the board: the cover is a choice, not what is drawn in a full box
        assert b["default"] == "juniper/jnp10k-re1@2"


@pytest.mark.parametrize("name", sorted(COUNTS))
def test_base_seats_the_vendor_counts(name):
    dev, want = device(name), COUNTS[name]
    psus = list(seated(dev, "rear", "psu").values())
    assert sum(1 for r in psus if r and r.startswith("juniper/jnp10k-pwr-ac")) == want["psu"]
    assert psus.count(PWR) == want["psu_cover"]
    res = list(seated(dev, "front", rcb_prefix(name)).values())
    assert res.count("juniper/jnp10k-re1@2") == want["re"]
    assert res.count(RE) == want["re_cover"]
    # every line-card slot keeps its cover
    fpcs = seated(dev, "front", "fpc")
    assert fpcs and set(fpcs.values()) == {LC}


@pytest.mark.parametrize("name", sorted(COUNTS))
def test_base_source_records_no_outstanding_difference(name):
    src = " ".join(device(name)["configurations"]["base"]["source"].split())
    assert "NOT YET FULLY FAITHFUL" not in src
    assert "are not modelled yet" not in src
    assert "JNP10K-PWR-BLNK" in src


def test_mx10016_premium_is_orderable_with_two_rcbs_and_ten_supplies():
    dev = device("mx10016")
    cfg = dev["configurations"]["premium"]
    assert cfg["kind"] == "orderable"
    assert cfg.get("default") is not True
    over = cfg.get("bays") or {}
    cbs = {b["id"]: over.get(b["id"], b["default"]) for b in bays(dev, "front", "cb")}
    assert list(cbs.values()) == ["juniper/jnp10k-re1@2"] * 2
    psus = {b["id"]: over.get(b["id"], b["default"]) for b in bays(dev, "rear", "psu")}
    assert list(psus.values()) == ["juniper/jnp10k-pwr-ac2@1"] * 10
    fpcs = {b["id"]: over.get(b["id"]) for b in bays(dev, "front", "fpc")}
    assert set(fpcs.values()) == {LC} and len(fpcs) == 16
