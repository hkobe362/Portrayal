"""Where the rings of a rack device stand in depth: rack.json `rings` (#1027).

A cable meets a ring where the part draws it, so rack_index.py reads each ring
off the plan of the device: `z`, mm back from its front to the middle of the
ring, and `depth`, its band along its run. The kit's route.js `guidesFor`
reads them."""
import json

from portrayal import rack_index, rack_solids

# a 100 deep device: the panel is the back 12 mm of the plan (y runs from the
# back), the two rings stand in front of it, 12 to 100 from the back, so from
# the front 0 to 88: the middle of each is 44 back
TOP = """<svg xmlns="http://www.w3.org/2000/svg">
  <rect id="guide-1-arm" data-kind="ring" x="10" y="12" width="12" height="77"/>
  <rect id="guide-1-lower" data-kind="ring" x="10" y="89" width="12" height="11"/>
  <rect id="guide-2-arm" data-kind="ring" x="60" y="12" width="12" height="77"/>
  <rect id="guide-2-lower" data-kind="ring" x="60" y="89" width="12" height="11"/>
  <rect id="chassis-panel" x="0" y="0" width="100" height="12"/>
</svg>"""
FRONT = """<svg xmlns="http://www.w3.org/2000/svg">
  <rect id="guide-1-end" data-kind="ring"/><rect id="guide-2-end" data-kind="ring"/>
</svg>"""


def _build(tmp_path, chassis, top=TOP):
    (tmp_path / "devices.json").write_text(json.dumps({"devices": [
        {"name": "mgr", "manufacturer": "FS.com", "model": "CMH", "profile": "passive"}]}))
    (tmp_path / "mgr.configs.json").write_text(json.dumps({
        "chassis": chassis, "default": "base", "configs": [{"name": "base"}], "attrs": {}}))
    (tmp_path / "mgr.base.top.svg").write_text(top)
    (tmp_path / "mgr.base.front.svg").write_text(FRONT)
    return rack_index.build(tmp_path)["devices"]["mgr"]


def test_a_rack_device_manager_says_where_its_rings_stand(tmp_path):
    e = _build(tmp_path, {"w": 430, "h": 44, "d": 100, "ru": 1})
    assert e["rings"] == {"guide-1": {"z": 44.0, "depth": 12.0}, "guide-2": {"z": 44.0, "depth": 12.0}}


def test_a_rack_face_part_says_nothing_of_its_rings(tmp_path):
    # the kit stands a lacer's rings out from its own depth
    e = _build(tmp_path, {"w": 483, "h": 44, "d": 55, "ru": 1, "mount": "rack-face"})
    assert "rings" not in e


def test_a_ring_that_states_its_depth_keeps_it(tmp_path):
    top = """<svg xmlns="http://www.w3.org/2000/svg">
      <g id="guide-1" data-guide="ring" data-guide-run="x" data-guide-depth="6.8">
        <rect x="10" y="20" width="9" height="40"/></g></svg>"""
    e = _build(tmp_path, {"w": 430, "h": 44, "d": 100, "ru": 1}, top)
    assert e["rings"]["guide-1"] == {"z": 60.0, "depth": 6.8}


def test_a_device_with_no_plan_has_no_rings(tmp_path):
    assert rack_solids.ring_depths({}, {"d": 100}, ["guide-1"]) is None
