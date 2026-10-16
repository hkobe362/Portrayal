"""DC power, step 1: the role vocabulary, the `dc` block in the component and
device schemas, and the lint rules that hold them (L187 to L191).

Synthetic parts only (spec/tests/fixtures/dc): no library part states a `dc`
block yet. Each rule is shown passing on a good part and failing on that part
with one edit, and the schemas are shown accepting the block and refusing bad
ones. The vocabulary and its match table are read from spec/schemas/dc.yaml.
"""
import copy
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys

import pytest
import yaml
from jsonschema import Draft202012Validator

from portrayal import dc
from portrayal import lint

ROOT = pathlib.Path(__file__).resolve().parents[2]
LIB = ROOT / "spec/tests/fixtures/dc/lib"
ROOTS = [str(LIB)]
SUPPLY, UNSTATED, HEADER = "fixture/dc-supply@1", "fixture/dc-unstated@1", "fixture/dc-header@1"

COMPONENT_SCHEMA = json.loads((ROOT / "spec/schemas/component.schema.json").read_text())
DEVICE_SCHEMA = json.loads((ROOT / "spec/schemas/device.schema.json").read_text())


def contract(name):
    return yaml.safe_load((LIB / "components/fixture" / name / "v1/contract.yaml").read_text())


def edited(name, edit):
    doc = copy.deepcopy(contract(name))
    edit(doc)
    return doc


def port(doc):
    return doc["dc"]["ports"][0]


def part_errors(doc):
    with lint.collecting() as got:
        lint.lint_component_dc("contract.yaml", doc)
    return got.errors


def device(placements=(), gaps=None, bays=()):
    doc = {"views": {"rear": {"components": {"placements": list(placements), "bays": list(bays)}}}}
    if gaps is not None:
        doc["gaps"] = gaps
    return doc


def place(ref=SUPPLY, **keys):
    return {"id": "psu-0", "ref": ref, "at": [0, 0], **keys}


def device_errors(doc):
    with lint.collecting() as got:
        lint.lint_device_dc("device.yaml", doc, ROOTS)
    return got.errors


def only(errors, code, *words):
    assert errors and all(f"[{code}]" in e for e in errors), errors
    assert any(all(w in e for w in words) for e in errors), errors


GAP = [{"what": "dc-polarity", "reason": "vendor-silent", "wanted": "the guide's connecting-power figure"}]


# --- the registry (spec/schemas/dc.yaml) --------------------------------------------------

def test_the_vocabulary_is_the_six_roles():
    assert set(dc.roles()) == {"batt", "rtn", "pos", "neg", "gnd", "unstated"}


@pytest.mark.parametrize("a,b", [("batt", "batt"), ("rtn", "rtn"), ("pos", "pos"), ("neg", "neg")])
def test_a_role_matches_itself_at_any_sign(a, b):
    assert dc.matches(a, b, negative=True) and dc.matches(a, b, negative=False)


@pytest.mark.parametrize("a,b", [("batt", "neg"), ("neg", "batt"), ("rtn", "pos"), ("pos", "rtn")])
def test_battery_pairs_with_negative_and_return_with_positive_only_on_a_negative_end(a, b):
    assert dc.matches(a, b, negative=True)
    assert not dc.matches(a, b, negative=False)


@pytest.mark.parametrize("a,b", [("batt", "rtn"), ("pos", "neg"), ("batt", "pos"), ("rtn", "neg")])
def test_crossed_roles_never_match(a, b):
    assert not dc.matches(a, b, negative=True) and not dc.matches(b, a, negative=True)


@pytest.mark.parametrize("role", ["unstated", "gnd"])
def test_unstated_and_ground_match_nothing(role):
    for other in dc.roles():
        assert not dc.matches(role, other, negative=True), (role, other)


def test_every_pair_has_its_source_and_names_roles_of_the_vocabulary():
    doc = dc.load()
    for m in doc["matches"]:
        assert m["a"] in doc["roles"] and m["b"] in doc["roles"], m
        assert isinstance(m.get("source"), str) and m["source"].strip(), m
        assert m.get("when") in (None, "negative-voltage"), m
    cross = [m for m in doc["matches"] if m["a"] != m["b"]]
    assert {(m["a"], m["b"]) for m in cross} == {("batt", "neg"), ("rtn", "pos")}
    assert all(m["when"] == "negative-voltage" for m in cross)


# --- the schemas ---------------------------------------------------------------------------

def test_the_component_schema_accepts_the_example_block():
    v = Draft202012Validator(COMPONENT_SCHEMA)
    for name in ("dc-supply", "dc-unstated", "dc-header"):
        assert sorted(v.iter_errors(contract(name)), key=str) == [], name


def test_a_component_without_a_dc_block_is_as_valid_as_before():
    doc = contract("dc-supply")
    del doc["dc"]
    assert not list(Draft202012Validator(COMPONENT_SCHEMA).iter_errors(doc))


def test_the_schema_lists_the_block_without_changing_its_format():
    assert COMPONENT_SCHEMA["properties"]["format"] == {"const": 1}
    assert DEVICE_SCHEMA["properties"]["format"] == {"const": 1}
    assert "dc" in COMPONENT_SCHEMA["properties"]


BAD_BLOCKS = {
    "a direction that is neither": lambda p: p.update(direction="both"),
    "no direction": lambda p: p.pop("direction"),
    "no poles": lambda p: p.update(poles=[]),
    "a pole with no slot": lambda p: p["poles"][0].pop("slot"),
    "a pole with no role": lambda p: p["poles"][0].pop("role"),
    "a side that is not a or b": lambda p: p.update(side="c"),
    "a zero nominal": lambda p: p["voltage"].update(nominal=0),
    "a voltage with no nominal": lambda p: p.update(voltage={"range": [-44, -65]}),
    "a range of three": lambda p: p["voltage"].update(range=[-44, -48, -65]),
    "a voltage as text": lambda p: p.update(voltage={"nominal": "-48"}),
    "a rating of zero": lambda p: p.update({"rating-a": 0}),
    "an awg as text": lambda p: p.update(awg=["12"]),
    "an unknown key on the port": lambda p: p.update(polarity="reversed"),
    "an unknown key on a pole": lambda p: p["poles"][0].update(colour="red"),
    "a stand-in with no order": lambda p: p["poles"][0].update({"stand-in": {}}),
    "a source key the port does not have": lambda p: p["source"].update(colour="x"),
    "a slot that is not a segment": lambda p: p["poles"][0].update(slot="Terminal RTN"),
}


@pytest.mark.parametrize("what", sorted(BAD_BLOCKS))
def test_the_component_schema_refuses(what):
    doc = edited("dc-supply", lambda d: BAD_BLOCKS[what](port(d)))
    assert list(Draft202012Validator(COMPONENT_SCHEMA).iter_errors(doc)), what


def test_the_component_schema_refuses_a_block_with_no_ports_or_another_key():
    v = Draft202012Validator(COMPONENT_SCHEMA)
    assert list(v.iter_errors(edited("dc-supply", lambda d: d["dc"].update(ports=[]))))
    assert list(v.iter_errors(edited("dc-supply", lambda d: d["dc"].update(extra=1))))


def test_a_kit_takes_no_dc_block():
    kit = {"format": 1, "kind": "kit", "name": "a-kit", "version": "1.0.0",
           "parts": [{"count": 1, "ref": "fixture/dc-post@1"}], "configurations": {},
           "motion": "fixed", "dc": contract("dc-supply")["dc"]}
    assert any("dc" in str(e.message) for e in Draft202012Validator(COMPONENT_SCHEMA).iter_errors(kit))


def _placement_dc_schema():
    """The `dc` property of a placement, found by its neighbour `fed-by`, with
    the schema's `$defs` so its references resolve."""
    def walk(node):
        if isinstance(node, dict):
            props = node.get("properties")
            if isinstance(props, dict) and "fed-by" in props and "dc" in props:
                return props["dc"]
            for v in node.values():
                found = walk(v)
                if found:
                    return found
        elif isinstance(node, list):
            for v in node:
                found = walk(v)
                if found:
                    return found
    return {"$schema": DEVICE_SCHEMA["$schema"], "$defs": DEVICE_SCHEMA["$defs"], **walk(DEVICE_SCHEMA)}


OVERRIDE = {"input": {"side": "b", "voltage": {"nominal": -48, "range": [-40.5, -57]},
                      "rating-a": 30, "poles": {"terminal-1": "rtn", "terminal-2": "batt"},
                      "source": "the guide's connecting-power figure"}}


def test_the_device_schema_accepts_a_placement_override():
    assert not list(Draft202012Validator(_placement_dc_schema()).iter_errors(OVERRIDE))


@pytest.mark.parametrize("bad", [
    {"input": {}},
    {"input": {"side": "c"}},
    {"input": {"voltage": {"nominal": 0}}},
    {"input": {"voltage": {"range": [-40, -57]}}},
    {"input": {"rating-a": -1}},
    {"input": {"poles": {}}},
    {"input": {"poles": {"Terminal 1": "batt"}}},
    {"input": {"colour": "red"}},
    {"Input Port": {"side": "a"}},
], ids=lambda b: json.dumps(b))
def test_the_device_schema_refuses(bad):
    assert list(Draft202012Validator(_placement_dc_schema()).iter_errors(bad))


def test_a_placement_accepts_dc_in_the_whole_device_schema():
    props = []

    def walk(node):
        if isinstance(node, dict):
            if isinstance(node.get("properties"), dict) and "fed-by" in node["properties"]:
                props.append(node)
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
    walk(DEVICE_SCHEMA)
    assert props and all("dc" in n["properties"] and n.get("additionalProperties") is False for n in props)


# --- the component rules ---------------------------------------------------------------------

def test_the_fixture_parts_are_clean():
    for name in ("dc-supply", "dc-unstated", "dc-header"):
        assert part_errors(contract(name)) == [], name


def test_a_part_with_no_dc_block_has_nothing_to_check():
    assert part_errors({"name": "plain"}) == []


def test_L187_a_role_outside_the_vocabulary():
    only(part_errors(edited("dc-supply", lambda d: port(d)["poles"][0].update(role="minus48"))),
         "L187", "minus48", "dc.yaml")


def test_L187_a_stated_role_with_no_source():
    only(part_errors(edited("dc-supply", lambda d: port(d).pop("source"))), "L187", "no source")


def test_L187_a_stated_role_whose_source_key_is_not_in_provenance():
    only(part_errors(edited("dc-supply", lambda d: port(d)["source"].update(poles="the-guide"))),
         "L187", "the-guide", "provenance")


def test_L187_a_source_key_naming_an_empty_note():
    only(part_errors(edited("dc-supply", lambda d: d["provenance"].update(terminals=" "))),
         "L187", "terminals")


def test_L187_a_figure_source_that_names_nothing():
    only(part_errors(edited("dc-supply", lambda d: port(d)["source"].update(awg="nowhere"))),
         "L187", "source.awg")


def test_L187_an_unstated_role_needs_no_source():
    assert part_errors(contract("dc-unstated")) == []


def test_L188_a_slot_that_resolves_to_nothing():
    only(part_errors(edited("dc-supply", lambda d: port(d)["poles"][1].update(slot="terminal-neg"))),
         "L188", "terminal-neg")


def test_L188_a_terminal_drawn_only_as_an_element_does_not_resolve():
    def edit(d):
        d["elements"] = {"terminal-block": {"at": [0, 0], "size": [10, 10]}}
        port(d)["poles"][1]["slot"] = "terminal-block"
    only(part_errors(edited("dc-supply", edit)), "L188", "terminal-block", "seat part")


def test_L188_two_poles_on_one_slot():
    only(part_errors(edited("dc-supply", lambda d: port(d)["poles"][1].update(slot="terminal-rtn"))),
         "L188", "two poles")


def test_L188_a_port_id_used_twice():
    def edit(d):
        d["dc"]["ports"].append(copy.deepcopy(port(d)))
    errs = part_errors(edited("dc-supply", edit))
    assert errs and {e.split("[")[1][:4] for e in errs} == {"L188"}
    assert any("used twice" in e for e in errs)


def test_L188_a_connection_point_resolves():
    assert part_errors(contract("dc-header")) == []
    only(part_errors(edited("dc-header", lambda d: port(d)["poles"][0].update(slot="wire-9"))),
         "L188", "wire-9")


def test_L189_poles_that_are_slots_and_points():
    def edit(d):
        port(d)["poles"][1]["slot"] = "wire-1"
        d["connection-points"] = {"wire-1": {"at": [1, 1]}}
    only(part_errors(edited("dc-supply", edit)), "L189", "slots and some connection points")


def test_L189_poles_that_are_all_points_pass():
    assert part_errors(contract("dc-header")) == []


def test_L191_a_battery_pole_on_a_positive_nominal():
    only(part_errors(edited("dc-supply", lambda d: port(d)["voltage"].update(nominal=48))),
         "L191", "batt", "minus")


def test_L191_a_range_limit_with_the_wrong_sign():
    only(part_errors(edited("dc-supply", lambda d: port(d)["voltage"].update(range=[44, -65]))),
         "L191", "range limit 44")


def test_L191_an_unsigned_range_beside_a_negative_nominal():
    only(part_errors(edited("dc-supply", lambda d: port(d)["voltage"].update(range=[44, 65]))),
         "L191", "range limit")


def test_L191_a_zero_nominal():
    only(part_errors(edited("dc-supply", lambda d: port(d)["voltage"].update(nominal=0))), "L191", "nominal is 0")


def test_L191_a_positive_supply_with_a_neg_pole_is_fine():
    assert part_errors(contract("dc-header")) == []


def test_L191_a_voltage_that_is_not_stated_has_no_sign_to_check():
    assert part_errors(edited("dc-supply", lambda d: port(d).pop("voltage"))) == []


# --- the device rules ---------------------------------------------------------------------------

def test_a_device_placing_stated_parts_needs_no_gap():
    assert device_errors(device([place(), place(HEADER) | {"id": "out-0"}])) == []


def test_L190_an_unstated_pole_with_no_gap():
    only(device_errors(device([place(UNSTATED)])), "L190", "psu-0/input/terminal-1", "dc-polarity")


def test_L190_the_gap_closes_it():
    assert device_errors(device([place(UNSTATED)], gaps=GAP)) == []


def test_L190_a_gap_about_something_else_does_not():
    other = [{"what": "fan-direction", "reason": "vendor-silent", "wanted": "x"}]
    only(device_errors(device([place(UNSTATED)], gaps=other)), "L190")


def test_L190_a_bay_default_is_presented_too():
    bay = {"id": "psu-1", "at": [0, 0], "size": {"w": 50, "h": 40}, "accepts": [UNSTATED], "default": UNSTATED}
    only(device_errors(device(bays=[bay])), "L190")


def test_L190_a_part_in_a_bay_that_is_only_accepted_is_not_presented():
    bay = {"id": "psu-1", "at": [0, 0], "size": {"w": 50, "h": 40}, "accepts": [UNSTATED]}
    assert device_errors(device(bays=[bay])) == []


def test_L190_a_configuration_occupant_is_presented_too():
    doc = device()
    doc["configurations"] = {"dc": {"bays": {"psu-1": UNSTATED}}}
    only(device_errors(doc), "L190")


def test_L190_a_placement_that_states_every_role_needs_no_gap():
    override = {"input": {"poles": {"terminal-1": "rtn", "terminal-2": "batt"}, "source": "the connecting-power figure"}}
    assert device_errors(device([place(UNSTATED, dc=override)])) == []


def test_L190_a_placement_that_states_one_role_leaves_the_other_unstated():
    override = {"input": {"poles": {"terminal-1": "rtn"}, "source": "the connecting-power figure"}}
    only(device_errors(device([place(UNSTATED, dc=override)])), "L190", "terminal-2")


def test_L190_a_placement_may_set_a_role_back_to_unstated():
    override = {"input": {"poles": {"terminal-48v": "unstated"}, "source": "a photo that does not show it"}}
    only(device_errors(device([place(dc=override)])), "L190", "terminal-48v")


def test_L187_a_placement_role_outside_the_vocabulary():
    override = {"input": {"poles": {"terminal-1": "minus"}, "source": "x"}}
    only(device_errors(device([place(UNSTATED, dc=override)], gaps=GAP)), "L187", "minus")


def test_L187_a_placement_role_with_no_source():
    override = {"input": {"poles": {"terminal-1": "rtn", "terminal-2": "batt"}}}
    only(device_errors(device([place(UNSTATED, dc=override)])), "L187", "no `source`")


def test_L188_a_placement_naming_a_port_the_part_does_not_have():
    only(device_errors(device([place(dc={"output": {"side": "b"}})])), "L188", "output", "input")


def test_L188_a_placement_naming_a_port_on_a_part_with_no_dc_block():
    only(device_errors(device([place("fixture/dc-post@1", dc={"input": {"side": "b"}})])), "L188", "no `dc` block")


def test_L188_a_placement_naming_a_pole_the_port_does_not_have():
    override = {"input": {"poles": {"terminal-9": "rtn"}, "source": "x"}}
    only(device_errors(device([place(dc=override)])), "L188", "terminal-9")


def test_L191_a_placement_voltage_that_drops_the_sign():
    errs = device_errors(device([place(dc={"input": {"voltage": {"nominal": 48}}})]))
    only(errs, "L191", "batt")


def test_L191_a_placement_voltage_with_its_sign_is_clean():
    assert device_errors(device([place(dc={"input": {"voltage": {"nominal": -60, "range": [-40.5, -72]}}})])) == []


def test_L191_a_placement_may_set_only_the_side_and_the_part_signs_are_not_repeated():
    assert device_errors(device([place(dc={"input": {"side": "b"}})])) == []


def test_a_ref_that_resolves_to_nothing_is_not_this_rules_business():
    assert device_errors(device([place("fixture/not-there@1")])) == []
    assert device_errors(device([place("fixture/dc-supply")])) == []


# --- the device lock ------------------------------------------------------------------------------

def _locked(**keys):
    from portrayal import devicelock as dl
    doc = {"format": 1, "kind": "device", "name": "d", "version": "1.0.0",
           "chassis": {"width": 100, "height": 40, "depth": 30},
           "provenance": {"size": "a"}, "gaps": [],
           "views": {"rear": {"size": {"w": 100, "h": 40}, "components": {"placements": [place(**keys)]}}}}
    return dl.entry(doc)


def _bump(before, after):
    from portrayal import devicelock as dl
    return dl.required_bump(_locked(**before), _locked(**after))


def test_a_placement_dc_override_is_sorted_by_the_lock():
    from portrayal import devicelock as dl
    assert "dc" in dl.PLACEMENT_ADDRESSING


def test_stating_a_dc_override_is_a_minor_and_changing_or_dropping_one_a_major():
    side_a = {"dc": {"input": {"side": "a"}}}
    side_b = {"dc": {"input": {"side": "b"}}}
    assert _bump({}, side_a) == "minor"
    assert _bump(side_a, side_b) == "major"
    assert _bump(side_a, {}) == "major"
    assert _bump(side_a, side_a) is None


# --- the whole linter ----------------------------------------------------------------------------

def test_the_rules_are_in_the_catalogue_with_their_scopes():
    scopes = {c: lint.RULES[c][0] for c in ("L187", "L188", "L189", "L190", "L191")}
    assert scopes == {"L187": "component, device", "L188": "component, device",
                      "L189": "component", "L190": "device", "L191": "component, device"}
    assert all(lint.RULES[c][4] == lint.ERROR for c in scopes)


def _run_linter(library):
    out = subprocess.run([sys.executable, str(ROOT / "spec/tools/portrayal/lint.py"),
                          "--schemas", str(ROOT / "spec/schemas"), "--library", str(library)],
                         capture_output=True, text=True, env={**os.environ, "PYTHONPATH": str(ROOT / "spec/tools")})
    return out.stdout + out.stderr


def test_the_command_line_linter_reaches_the_component_rules(tmp_path):
    """The rules are called from the walk and not only from here: the fixture
    library raises none of them as written, and a copy of one part with a role
    outside the vocabulary raises L187 through the command."""
    assert not re.search(r"\[L(187|188|189|190|191)\]", _run_linter(LIB))
    lib = tmp_path / "lib"
    shutil.copytree(LIB, lib)
    f = lib / "components/fixture/dc-supply/v1/contract.yaml"
    f.write_text(f.read_text().replace("role: batt", "role: minus48"))
    assert re.search(r"dc-supply.*\[L187\].*minus48", _run_linter(lib))
