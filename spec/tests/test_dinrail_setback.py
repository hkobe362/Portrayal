"""The rail setback of the FS DINRAIL2U and DINRAIL4U (#950, step 5 of
docs/adjustable-positions-design.md): the first two devices that state an
adjustment.

Each carries a DIN rail on a panel that bolts through two slots in each side
bracket and slides along them. The device states that once, as the
`rail-setback` adjustment, and every part of the panel says `moves-with` on
every view. Held here, on the manifests and on a build of each device at both
ends of its travel:

  - the three `din-rail-setback` attrs stay, and pair with the adjustment by
    name. Lint rule L183 holds a paired attr equal to the adjustment and never
    asks for one, so nothing else would say if an attr were dropped or renamed
    out of the pairing;
  - the set of members on each view, so that a part of the panel added later
    without `moves-with` is seen here and not left behind on a moved drawing;
  - at each end every member has moved by the travel, in the direction its
    face shows it, and nothing else has moved;
  - the panel still meets both side brackets (#971,
    test_panel_meets_brackets.py, which reads the default build), and each
    screw still stands in its slot.

The builds are of a copy of each manifest with two more configurations, one
at each end. No such configuration is in the library: no source shows the
bracket shipped at an end of its travel.
"""
import copy
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest
import yaml

import warmrender
from portrayal import adjustments as adj
from portrayal import attrsections as attrs_mod

ROOT = Path(__file__).resolve().parents[2]
LIB = ROOT / "library"
RENDER = ROOT / "spec/tools/portrayal/render.py"
SVG = "{http://www.w3.org/2000/svg}"
AID = "rail-setback"
VIEWS = ("front", "rear", "top", "bottom", "left", "right")

# device -> (range min, default, range max), as its provenance reads them off
# the datasheet side view
DEVICES = {"dinrail2u": (51.2, 161.2, 271.2), "dinrail4u": (50.5, 159.9, 269.4)}

# THE PARTS OF THE PANEL, BY VIEW: the 29 nodes one motion is drawn with.
# Stated, not derived, so that a member dropped from the manifest fails here.
MEMBERS = {
    "front": {"rail-panel", "rail"},
    "rear": {"panel-back"} | {f"cutout-{i}" for i in range(1, 9)},
    "top": {"rail-panel", "rail", "tab-left", "tab-right"},
    "bottom": {"rail-panel", "rail", "tab-left", "tab-right"},
    "left": {"flange", "tab-top", "tab-bottom", "screw-upper", "screw-lower"},
    "right": {"flange", "tab-top", "tab-bottom", "screw-upper", "screw-lower"},
}
# what each face shows of a move back along the depth (section 5 of the note)
MOVES_BY = {"front": (0, 0, 1), "rear": (0, 0, -1), "top": (0, -1, 0), "bottom": (0, -1, 0),
            "right": (1, 0, 0), "left": (-1, 0, 0)}
# everything else these devices draw stays where it is
FIXED = {
    "front": {"side-left-edge", "side-right-edge", "ear-left", "ear-right"},
    "rear": {"side-left-edge", "side-right-edge"},
    "top": {"side-left", "side-right"},
    "bottom": {"side-left", "side-right"},
    "left": {"side-left"},
    "right": {"side-right"},
}


def manifest(name):
    return yaml.safe_load((LIB / "devices/fs" / name / "device.yaml").read_text())


def entries(view):
    """Every placement, bay and decor entry of a view, by id."""
    comps = view.get("components") or {}
    seq = (comps.get("placements") or []) + (comps.get("bays") or []) \
        + ((view.get("panel") or {}).get("decor") or [])
    return {e["id"]: e for e in seq}


# --- the declaration ---------------------------------------------------------------------

@pytest.mark.parametrize("name", DEVICES)
def test_the_adjustment_is_stated_as_the_device_records_it(name):
    lo, mid, hi = DEVICES[name]
    doc = manifest(name)
    assert set(doc["adjustments"]) == {AID}
    a = doc["adjustments"][AID]
    assert (a["carrier"], a["axis"]) == ("rail-panel", "z")
    assert a["range"] == [lo, hi] and a["default"] == mid
    assert a["stops"] == {"front": lo, "middle": mid, "rear": hi}
    assert a["datum"] == "the front face of the rail panel, behind the ear plane"
    # the default is the middle of the travel, to the 0.1 mm a position is kept at
    assert abs((lo + hi) / 2 - mid) <= 0.05 + 1e-9
    # L182: the range has its source, under the id of the adjustment
    note = doc["provenance"][AID]["note"]
    assert f"{lo:g} to {hi:g}" in note and f"{mid:g}" in note
    assert "setback" not in doc["provenance"]
    # and the gap that asked for a way to state it is closed
    assert not [g for g in doc.get("gaps") or [] if g.get("what") == "setback"]


@pytest.mark.parametrize("name", DEVICES)
def test_the_three_setback_attrs_stay_and_pair_with_the_adjustment(name):
    """L183 never requires an attr. These three are how the range reaches the
    DCIM export comments (section 13, question 5), so they are required here."""
    lo, mid, hi = DEVICES[name]
    doc = manifest(name)
    physical = doc["attrs"]["physical"]
    assert physical["din-rail-setback-mm"] == mid
    assert physical["din-rail-setback-min-mm"] == lo
    assert physical["din-rail-setback-max-mm"] == hi
    # paired by name, as lint pairs them: each restates the end it is named for
    paired = adj.restating_attrs(AID, attrs_mod.flatten(doc["attrs"]))
    assert paired == {"din-rail-setback-mm": "default", "din-rail-setback-min-mm": "min",
                      "din-rail-setback-max-mm": "max"}


@pytest.mark.parametrize("name", DEVICES)
def test_the_exports_still_carry_the_three_fact_lines(name):
    lo, mid, hi = DEVICES[name]
    found = sorted((LIB / "exports").glob(f"*/device-types/FS.com/{name.upper()}.yaml"))
    assert len(found) == 2, found          # NetBox and Nautobot
    for f in found:
        text = f.read_text()
        for key, value in (("din-rail-setback-mm", mid), ("din-rail-setback-min-mm", lo),
                           ("din-rail-setback-max-mm", hi)):
            assert re.search(rf"^\s*- physical\.{key}: {value:g}$", text, re.M), (f.name, key)


# --- the members --------------------------------------------------------------------------

@pytest.mark.parametrize("name", DEVICES)
def test_every_part_of_the_panel_moves_and_nothing_else_does(name):
    doc = manifest(name)
    assert set(doc["views"]) == set(VIEWS)
    for view in VIEWS:
        es = entries(doc["views"][view])
        marked = {i for i, e in es.items() if e.get("moves-with") == AID}
        assert marked == MEMBERS[view], (name, view)
        # every entry of the view is in one list or the other: a part added
        # later has to be sorted here
        assert set(es) == MEMBERS[view] | FIXED[view], (name, view)
    assert sum(len(m) for m in MEMBERS.values()) == 29
    assert adj.members(doc)[AID] == sorted(
        f"{v}/{'placements' if 'ref' in entries(doc['views'][v])[i] else 'decor'}/{i}"
        for v in VIEWS for i in MEMBERS[v])


# --- built at both ends ---------------------------------------------------------------------

def _build(tmp, name):
    """A copy of the device with a configuration at each end of the travel."""
    doc = copy.deepcopy(manifest(name))
    for cfg, stop in (("at-front", "front"), ("at-rear", "rear")):
        doc["configurations"][cfg] = {
            "kind": "example", "description": f"The bracket with its rail panel at the {stop} stop.",
            "component-attrs": {"rail-panel": {AID: stop}}}
    dev = tmp / name / "device.yaml"
    dev.parent.mkdir(parents=True, exist_ok=True)
    dev.write_text(yaml.safe_dump(doc, sort_keys=False, allow_unicode=True))
    out = tmp / "o"
    r = warmrender.run([sys.executable, str(RENDER), str(dev), "--library", str(LIB),
                        "--out", str(out)], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr[-3000:]
    return out


@pytest.fixture(scope="module", params=list(DEVICES))
def built(request, tmp_path_factory):
    name = request.param
    return name, _build(tmp_path_factory.mktemp(f"setback-{name}"), name)


def _face(out, name, cfg, view):
    return ET.parse(out / f"{name}.{cfg}.{view}.svg").getroot()


def _num(text):
    return [float(v) for v in re.findall(r"-?\d+(?:\.\d+)?", text or "")]


def _origin(node):
    """Where the build drew a node: the x and y of a decor rect, or the
    translate of a placement's group."""
    if node.tag == f"{SVG}rect":
        return float(node.get("x")), float(node.get("y"))
    m = re.match(r"translate\(([^)]*)\)", node.get("transform") or "")
    assert m, (node.get("id"), node.get("transform"))
    x, y = (_num(m.group(1)) + [0.0])[:2]
    return x, y


def _top(root):
    """The nodes the device itself draws, by id: placement groups, and the
    decor rects, which the build keeps in one group of their own."""
    out = {}
    for n in root:
        if n.get("data-class") == "decor":
            assert not n.get("transform")
            out.update({d.get("id"): d for d in n if d.get("id")})
        elif n.tag == f"{SVG}g" and n.get("id"):
            out[n.get("id")] = n
    return out


def test_each_face_says_where_it_was_built(built):
    name, out = built
    lo, mid, hi = DEVICES[name]
    for cfg, at in (("base", mid), ("at-front", lo), ("at-rear", hi)):
        for view in VIEWS:
            got = json.loads(_face(out, name, cfg, view).get("data-adjustments"))
            assert got[AID]["at"] == at, (cfg, view)
            assert got[AID]["range"] == [lo, hi] and got[AID]["default"] == mid
    cfgs = json.loads((out / f"{name}.configs.json").read_text())
    assert {c["name"]: c["positions"] for c in cfgs["configs"]} == \
        {"base": {}, "at-front": {AID: lo}, "at-rear": {AID: hi}}


def test_each_member_moves_by_the_travel_on_every_face_and_nothing_else_moves(built):
    name, out = built
    lo, mid, hi = DEVICES[name]
    measured = 0
    for cfg, at in (("at-front", lo), ("at-rear", hi)):
        delta = at - mid
        for view in VIEWS:
            base, moved = _top(_face(out, name, "base", view)), _top(_face(out, name, cfg, view))
            # nothing is left behind and nothing is drawn twice: the same nodes, once each
            assert list(base) == list(moved), (cfg, view)
            assert MEMBERS[view] | FIXED[view] <= set(base), (cfg, view)
            dx, dy, dz = MOVES_BY[view]
            for nid in MEMBERS[view] | FIXED[view]:
                b, m = base[nid], moved[nid]
                member = nid in MEMBERS[view]
                assert (m.get("data-moves-with") == AID) is member, (cfg, view, nid)
                (bx, by), (mx, my) = _origin(b), _origin(m)
                want = (bx + dx * delta, by + dy * delta) if member else (bx, by)
                assert abs(mx - want[0]) < 1e-3 and abs(my - want[1]) < 1e-3, (cfg, view, nid)
                if member:
                    assert m.get("data-moves-by") == f"{dx} {dy} {dz}", (cfg, view, nid)
                    measured += 1
                # a node keeps its size wherever it stands
                for k in ("width", "height"):
                    assert b.get(k) == m.get(k), (cfg, view, nid)
    assert measured == 2 * 29


def test_from_the_front_the_floor_of_the_well_is_the_setback(built):
    """The front is an elevation: nothing on it moves, and the depth does. The
    panel is a well whose floor stands at the position, and the rail stands on
    that floor wherever it is."""
    name, out = built
    lo, mid, hi = DEVICES[name]
    for cfg, at in (("base", mid), ("at-front", lo), ("at-rear", hi)):
        top = _top(_face(out, name, cfg, "front"))
        assert float(top["rail-panel"].get("data-depth")) == pytest.approx(at)
        assert float(top["rail"].get("data-z-lift")) == pytest.approx(-at)


def test_the_panel_meets_both_brackets_at_both_ends(built):
    """#971, asked of the moved builds: on each plan the panel's plate runs
    from the inner face of one bracket to the inner face of the other, and its
    tabs lie on the brackets, at either end of the travel."""
    name, out = built
    measured = 0
    for cfg in ("base", "at-front", "at-rear"):
        for view in ("top", "bottom"):
            top = _top(_face(out, name, cfg, view))
            sides = sorted((float(top[i].get("x")), float(top[i].get("width")))
                           for i in ("side-left", "side-right"))
            inner_left, inner_right = sides[0][0] + sides[0][1], sides[1][0]
            panel = top["rail-panel"]
            x0 = float(panel.get("x"))
            x1 = x0 + float(panel.get("width"))
            assert abs(x0 - inner_left) <= 0.05 and abs(x1 - inner_right) <= 0.05, (cfg, view)
            # each tab starts on the bracket and ends on the panel's own plate line
            py = float(panel.get("y")) + float(panel.get("height"))
            for tab in ("tab-left", "tab-right"):
                t = top[tab]
                ty = float(t.get("y")) + float(t.get("height"))
                assert abs(ty - py) <= 0.05, (cfg, view, tab)
                tx0 = float(t.get("x"))
                tx1 = tx0 + float(t.get("width"))
                assert tx0 <= sides[0][0] + 0.05 or tx1 >= sides[1][0] + sides[1][1] - 0.05, (cfg, view, tab)
            # and the whole panel is inside the depth of the bracket
            for i in MEMBERS[view]:
                y0 = float(top[i].get("y"))
                assert -0.05 <= y0 and y0 + float(top[i].get("height")) <= 360.05, (cfg, view, i)
            measured += 1
    assert measured == 6


def _slots(name):
    """The two long slots of a side bracket, from its `right` skin (front at
    the left): [(x0, x1, y0, y1)], mm behind the ears and down from the top."""
    skin = (LIB / "components/fs" / f"{name}-side" / "v1/skins/right.svg").read_text()
    d = re.search(r'id="plate"[^>]*\sd="([^"]+)"', skin).group(1)
    holes = [tuple(float(v) for v in m) for m in
             re.findall(r"M([\d.]+),([\d.]+) h([\d.]+) v([\d.]+) h-[\d.]+ Z", d)]
    slots = [(x, x + w, y, y + h) for x, y, w, h in holes if h <= 8]
    assert len(slots) == 2, holes
    return slots


def test_each_screw_stands_in_its_slot_at_both_ends(built):
    """The screws pass through the slots of the bracket into the panel's
    flange. Moved with the panel, the M5 shank of each is still inside its
    slot, along the slot and across it, on both side views."""
    name, out = built
    slots = _slots(name)
    shank = 5.0 / 2                      # M5
    measured = 0
    for cfg in ("base", "at-front", "at-rear"):
        for view in ("left", "right"):
            top = _top(_face(out, name, cfg, view))
            flange_x = float(top["flange"].get("x"))
            flange_w = float(top["flange"].get("width"))
            for screw in ("screw-upper", "screw-lower"):
                x, y = _origin(top[screw])
                cx, cy = x + 9.5 / 2, y + 9.5 / 2            # the 9.5 head of common/pan-screw-m5@1
                behind = cx if view == "right" else 360.0 - cx    # the left view is mirrored
                hit = [s for s in slots if s[2] <= cy <= s[3]]
                assert len(hit) == 1, (cfg, view, screw, cy)
                x0, x1, _, _ = hit[0]
                assert x0 + shank - 0.11 <= behind <= x1 - shank + 0.11, (cfg, view, screw, behind)
                # and it is still screwed into the flange it holds
                assert flange_x <= cx <= flange_x + flange_w, (cfg, view, screw)
                measured += 1
    assert measured == 12
