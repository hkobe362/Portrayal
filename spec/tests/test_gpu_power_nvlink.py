"""The connectors a GPU card needs: its power inlets and its NVLink bridge
connector, each a registry interface with a part that presents it and a part
that mates it (P-0028; docs/connectors-gpu-design.md).

Run against the real library and a components.json the indexer builds here.
The figures themselves are held by their sources in each contract's provenance;
these tests hold the shape: what mates what, what is exported, and that every
size is stated with a confidence.
"""
import json
from pathlib import Path

import pytest
import yaml

import onebuild
from portrayal import dcim_export as dx
from portrayal import render as render_mod
from test_coax_slots import _contract

ROOT = Path(__file__).resolve().parents[2]

# interface -> (the receptacle that presents it, the standard it conforms to)
HEADERS = {
    "eps12v-8pin": ("std/eps12v-header@1", "mini-fit-8-header"),
    "pcie-8pin": ("std/pcie-8pin-header@1", "mini-fit-8-header"),
    "pcie-12vhpwr": ("std/12vhpwr-header@1", "pcie-16pin-header"),
    "pcie-12v-2x6": ("std/12v-2x6-header@1", "pcie-16pin-header"),
}
PINS = {"eps12v-8pin": 8, "pcie-8pin": 8, "pcie-12vhpwr": 16, "pcie-12v-2x6": 16}
# plug -> the interfaces it mates, as a set
PLUGS = {
    "generic/eps12v-8pin-plug@1": {"eps12v-8pin"},
    "generic/pcie-8pin-plug@1": {"pcie-8pin"},
    "generic/pcie-16pin-plug@1": {"pcie-12vhpwr", "pcie-12v-2x6"},
}
EACH_HEADER = pytest.mark.parametrize("iface", sorted(HEADERS))
EACH_PLUG = pytest.mark.parametrize("ref", sorted(PLUGS))
NVLINK = "nvlink-a100-pcie"
BRIDGE = "nvidia/nvlink-bridge-a100-2slot@1"
NVLINK_CONNECTOR = "nvidia/nvlink-a100-connector@1"
# PCIe CEM slot pitch: a two-slot bridge spans two of them
SLOT_PITCH = 20.32


def standards():
    return yaml.safe_load((ROOT / "spec/schemas/standards.yaml").read_text())["standards"]


def mates(contract):
    m = contract["mates"]
    return {m} if isinstance(m, str) else set(m)


@pytest.fixture(scope="module")
def comps():
    doc = json.loads((onebuild.components_index() / "components.json").read_text())
    return {f"{e['ns']}/{e['name']}@{e['major'][1:]}": e for e in doc["components"]}


# --- the registry ---------------------------------------------------------------

@pytest.mark.parametrize("iface", sorted(HEADERS) + [NVLINK])
def test_every_interface_is_registered_with_a_note(iface):
    reg = render_mod._connector_registry()
    assert iface in reg and reg[iface].get("note"), iface
    if "standard" in reg[iface]:
        assert reg[iface]["standard"] in standards()


@EACH_HEADER
def test_a_header_is_an_inlet_presenting_its_interface_at_the_centre_of_its_face(iface):
    ref, std_key = HEADERS[iface]
    c = _contract(ref)
    assert c["class"] == "inlet" and c["interface"] == iface
    assert c["conforms"] == std_key
    assert c["attrs"]["media"] in ("eps12v", "pcie-8pin", "pcie-12vhpwr", "pcie-12v-2x6")
    w, h = c["size"]["w"], c["size"]["h"]
    assert c["connection-points"]["mate"]["at"] == pytest.approx([w / 2, h / 2])
    s = standards()[std_key]
    assert (w, h) == (s["w"], s["h"])
    assert c["attrs"]["pins"] == PINS[iface]


@EACH_HEADER
def test_a_header_states_a_confidence_for_each_size_and_for_the_depth(iface):
    c = _contract(HEADERS[iface][0])
    assert set(c["size-confidence"]) >= {"w", "h"}
    s = standards()[HEADERS[iface][1]]
    assert s["confidence"] and s["depth-confidence"]
    assert c["provenance"]


def test_the_two_8_pin_headers_do_not_share_an_interface():
    """Molex lists the PCIe housing's polarisation as its own, 'for PCI Express
    applications only', so a PCIe plug is not offered to an EPS12V header."""
    assert HEADERS["eps12v-8pin"][0] != HEADERS["pcie-8pin"][0]
    assert mates(_contract("generic/pcie-8pin-plug@1")).isdisjoint({"eps12v-8pin"})
    assert mates(_contract("generic/eps12v-8pin-plug@1")).isdisjoint({"pcie-8pin"})


# --- the cable plugs ------------------------------------------------------------

@EACH_PLUG
def test_a_plug_is_a_port_that_mates_exactly_its_interfaces(ref):
    c = _contract(ref)
    assert c["class"] == "port"
    assert mates(c) == PLUGS[ref]
    assert "d" not in c["size"], "a port's depth is carried by its relief"
    assert c["connection-points"]["mate"] and c["connection-points"]["cable"]
    assert c["fields"]["cable-od"]["default"] > 0


@EACH_PLUG
def test_a_plug_mate_lands_on_each_header_it_mates(ref):
    for iface in PLUGS[ref]:
        h = _contract(HEADERS[iface][0])
        c = _contract(ref)
        # the plug's mating face is the header's: one size, so the mate points
        # are the centres and a seated plug covers the opening
        assert c["size"]["w"] == pytest.approx(h["size"]["w"])
        assert c["size"]["h"] == pytest.approx(h["size"]["h"])


def test_the_slot_a_header_presents_offers_its_plug_and_no_other(comps):
    for iface, (ref, _std) in HEADERS.items():
        entry = comps[ref]
        assert entry["interface"] == iface
    for ref, ifaces in PLUGS.items():
        got = comps[ref]["mates"]
        assert set([got] if isinstance(got, str) else got) == ifaces


def test_the_16_pin_plug_has_twelve_power_and_four_sense_contacts():
    c = _contract("generic/pcie-16pin-plug@1")
    assert c["attrs"]["pins"] == 16 and c["attrs"]["pins-power"] == 12
    assert c["attrs"]["pins-sense"] == 4


def test_the_8_pin_plugs_state_their_12v_and_ground_split():
    """NVIDIA PB-10577 fig 7: the EPS side is 4 + 4, the PCIe side 3 + 5."""
    eps = _contract("generic/eps12v-8pin-plug@1")["attrs"]
    pcie = _contract("generic/pcie-8pin-plug@1")["attrs"]
    assert (eps["pins-12v"], eps["pins-ground"]) == (4, 4)
    assert (pcie["pins-12v"], pcie["pins-ground"]) == (3, 5)


# --- the exports ----------------------------------------------------------------

@EACH_HEADER
def test_a_card_with_a_power_inlet_exports_a_power_port(iface):
    ref = HEADERS[iface][0].split("@")[0]
    assert ref in dx.PART_POWER
    # no PowerPortTypeChoices value names these, in NetBox or Nautobot: `other`,
    # with the connector as its label
    assert dx.PART_POWER[ref] == "other" and ref in dx.POWER_LABEL
    card = {"name": "t", "attrs": {"model": "T"},
            "parts": [{"ref": HEADERS[iface][0], "id": "aux-power"}]}
    rows = dx.build_module(card, "X")["power-ports"]
    assert rows == [{"name": "aux-power", "type": "other", "label": dx.POWER_LABEL[ref]}]


def test_the_plugs_and_the_bridge_export_nothing():
    for ref in list(PLUGS) + [BRIDGE, NVLINK_CONNECTOR]:
        assert ref.split("@")[0] not in dx.PART_POWER


def test_the_power_labels_name_distinct_connectors():
    labels = [dx.POWER_LABEL[HEADERS[i][0].split("@")[0]] for i in HEADERS]
    assert len(set(labels)) == len(labels)


# --- NVLink ---------------------------------------------------------------------

def test_the_nvlink_connector_presents_the_bridge_interface():
    c = _contract(NVLINK_CONNECTOR)
    assert c["interface"] == NVLINK and c["class"] == "inlet"
    assert c["attrs"]["role"] == "nvlink"
    assert NVLINK_CONNECTOR.split("@")[0] not in dx.PART_POWER


def test_the_bridge_mates_the_nvlink_interface_at_both_ends_one_two_slot_pitch_apart():
    c = _contract(BRIDGE)
    assert c["class"] == "port" and mates(c) == {NVLINK}
    a, b = c["connection-points"]["mate"], c["connection-points"]["mate-b"]
    assert abs(b["at"][0] - a["at"][0]) == pytest.approx(2 * SLOT_PITCH)
    assert b["at"][1] == pytest.approx(a["at"][1])
    assert c["attrs"]["part-number"] == "900-53651-0000-000"
    assert c["attrs"]["per-card-pair"] == 3
    assert c["attrs"]["spans-slots"] == 2


def test_the_bridge_is_wide_enough_to_reach_both_connectors():
    c = _contract(BRIDGE)
    conn = _contract(NVLINK_CONNECTOR)
    assert c["size"]["w"] == pytest.approx(2 * SLOT_PITCH + conn["size"]["w"])
    assert c["size"]["h"] == pytest.approx(conn["size"]["h"])


def test_every_estimated_bridge_figure_says_so():
    c = _contract(BRIDGE)
    assert c["size-confidence"] == {"w": "estimated", "h": "estimated"}
    assert c["provenance"]["size"].startswith("estimated")
    assert c["provenance"]["height"].startswith("estimated")
