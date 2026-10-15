"""The part-conformance prototype finds the faults it is for, and only those.

`spec/tools/dev/part_conformance.py` (docs/part-conformance-design.md) runs two
checks over a built part. These tests give it a library built here, a few lines
of JSON in the shape the build writes, so the expected findings do not depend
on what a live device lacks the day this runs:

- a good part is clean; each planted fault is found, under its code, and
  planting it is the only change;
- the same runner, pointed at the real build, walks something: it is not a
  check that passes because it looked at nothing.
"""
import copy
import json
import pathlib
import shutil
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[2]
TOOL = ROOT / "spec/tools/dev/part_conformance.py"
DIST = ROOT / "library" / "dist"


def _need_node():
    if shutil.which("node") is None:
        pytest.skip("node not installed")


def comp(ref, **rest):
    ns, tail = ref.split("/")
    name, major = tail.split("@")
    return {"ns": ns, "name": name, "major": f"v{major}", "class": "port", "kind": "component", "parts": [], "cages": [],
            "bays": {}, "attrs": {}, "fields": {}, "faces": None, **rest}


JACK = comp("std/rj45@2", attrs={"media": "rj45", "connector": "rj45"})
PLUG = comp("generic/rj45-plug@1", attrs={"media": "rj45", "connector": "rj45"}, mates="rj45")
LAMP = comp("common/led-dot@1", **{"class": "led"})


def slot(pid, accepts=("generic/rj45-plug@1",)):
    return {"id": pid, "kind": "connector", "interface": "rj45", "media": None, "bores": [], "accepts": list(accepts),
            "default": None, "at": [0, 0], "mate": [1, 1], "rotate": None}


def panel(back):
    """A two-jack coupler; `back` gives it a rear that carries two ends."""
    face = comp("acme/pnl@1", **{"class": "adapter-panel", "kind": "module"},
                parts=[{"id": "p1", "ref": "std/rj45@2"}, {"id": "p2", "ref": "std/rj45@2"}],
                cages=[slot("p1"), slot("p2")], faces={"rear": "acme/pnl-rear@1"} if back else None)
    rear = comp("acme/pnl-rear@1", **{"class": "adapter-panel"}, parts=[{"id": "b1", "ref": "std/rj45@2"}, {"id": "b2", "ref": "std/rj45@2"}],
                cages=[slot("b1"), slot("b2")])
    return [face, rear] if back else [face]


def element(pid, cls="port", x=10, y=5, **extra):
    return {"id": pid.replace("/", "--"), "path": pid, "class": cls, "parent": None, "box": {"x": x, "y": y, "w": 12, "h": 10}, **extra}


def build(tmp_path, *, lamp_states_in_catalogue=True, back=True, tilt=False, mate=True):
    """A library of one 1U device `dev` with two jacks, a lamp and a bay for the coupler."""
    mating = {"connection-points": {"mate": {"at": [6, 5], "dir": "front", "face": [16, 10]}}} if mate else {}
    front = [{"id": "chassis-faceplate", "path": "chassis", "class": "chassis", "parent": None, "box": {"x": 0, "y": 0, "w": 436, "h": 43.7}},
             element("port-1", x=30, **mating), element("port-2", x=60, **mating),
             element("led-sys", "led", x=100, y=3, states=["off", "ok", "fault"])]
    dist = tmp_path / "dist"
    dist.mkdir()
    def put(name, value):
        (dist / name).write_text(json.dumps(value))
    put("components.json", {"components": [JACK, PLUG, LAMP, *panel(back)]})
    put("rack.json", {"format": 1, "devices": {"dev": {"ru": 1, "w": 436, "h": 43.7, "d": 300, "mount": "rack", "kind": "switch",
                                                        "manufacturer": "Acme", "model": "DEV", "default": "base", "configs": ["base"]}}})
    put("dev.configs.json", {
        "default": "base", "pdu-class": None, "bays": {"front": [{"id": "bay-1", "accepts": ["acme/pnl@1"], "default": None, "group": "b"}], "rear": []},
        "cages": {"front": [slot("port-1"), slot("port-2")], "rear": []},
        "configs": [{"name": "base", "files": {"front": "dev.base.front.svg", "rear": "dev.base.rear.svg"}, "bays": {}, "occupants": {},
                     "states": {"led-sys": ["off", "ok", "fault"]} if lamp_states_in_catalogue else {}, "names": {}, "slots": [], "mount-points": []}]})
    rear = [{"id": "chassis-faceplate", "path": "chassis", "class": "chassis", "parent": None, "box": {"x": 0, "y": 0, "w": 436, "h": 43.7}}]
    for view, els in (("front", front), ("rear", rear)):
        put(f"dev.base.{view}.elements.json", {"device": "dev", "config": "base", "view": view, "viewBox": [0, 0, 436, 43.7], "elements": els})
        tilted = '<g data-path="port-1" data-tilt="30" data-tilt-on="x"></g>' if tilt and view == "front" else ""
        (dist / f"dev.base.{view}.svg").write_text(f'<svg><style>.state-ok{{fill:#2c2}}.state-off{{fill:#555}}.state-fault{{fill:#c22}}</style>{tilted}</svg>')
    return dist


def run(dist, tmp_path, *, skip=()):
    out = tmp_path / "report.json"
    p = subprocess.run([sys.executable, str(TOOL), "--dist", str(dist), "--refs", "dev", "--out", str(out), "--max-ends", "20",
                        *(["--skip", *skip] if skip else [])], capture_output=True, text=True)
    assert p.returncode == 0, p.stderr[-1500:] + p.stdout[-1500:]
    report = json.loads(out.read_text())
    codes = {}
    part = report["parts"][0]
    for f in (part.get("occupants") or {}).get("found", []):
        codes.setdefault(f["code"], []).append(f)
    for row in part["configs"]:
        for check in ("settings", "cabling"):
            for f in row[check]["found"]:
                codes.setdefault(f["code"], []).append(f)
    return report, codes


@pytest.fixture(scope="module", autouse=True)
def node():
    _need_node()


def blocking(codes):
    return sorted(c for c in codes if c not in ("C15", "C14"))


def test_a_good_part_is_clean(tmp_path):
    report, codes = run(build(tmp_path), tmp_path)
    assert blocking(codes) == [], codes
    row = report["parts"][0]["configs"][0]
    # it walked something: two jacks offered, drawn, judged on both rails; one lamp, set
    assert row["cabling"]["counts"]["offered"] == 2 and row["cabling"]["counts"]["judged"] >= 4, row["cabling"]["counts"]
    assert row["settings"]["counts"]["set"] == 3 and row["settings"]["counts"]["drawn"] == 1, row["settings"]["counts"]
    assert report["parts"][0]["occupants"]["counts"]["occupants"] == 1


def test_a_lamp_the_catalogue_does_not_know_is_found_both_ways(tmp_path):
    """The Explorer reads the drawing; the agent reads the catalogue. A lamp only the first knows is settable one way."""
    report, codes = run(build(tmp_path, lamp_states_in_catalogue=False), tmp_path)
    assert {"S1", "S4"} <= set(codes), codes
    assert codes["S4"][0]["n"] == 3 and "declares no state" in codes["S4"][0]["examples"][0]
    # and nothing else changed
    assert blocking(codes) == ["S1", "S4"], codes


def test_a_coupler_with_one_side_is_found(tmp_path):
    report, codes = run(build(tmp_path, back=False), tmp_path)
    assert blocking(codes) == ["C11"], codes
    assert "acme/pnl" in codes["C11"][0]["examples"][0] or "PNL" in codes["C11"][0]["text"]


def test_an_angled_port_with_no_axis_is_reported_not_blocked(tmp_path):
    report, codes = run(build(tmp_path, tilt=True), tmp_path)
    assert "C10" in codes and report["summary"]["C10"]["level"] == "standin", codes
    assert blocking(codes) == ["C10"], "the stand-in is reported; nothing else is wrong with the part"
    assert "30" in codes["C10"][0]["text"], "it names the angle the drawing declares"


def test_an_end_with_no_mating_point_is_a_stand_in(tmp_path):
    report, codes = run(build(tmp_path, mate=False), tmp_path)
    assert "C14" in codes and report["summary"]["C14"]["level"] == "standin"
    assert blocking(codes) == [], codes


def test_a_made_up_end_is_not_silently_accepted(tmp_path):
    report, codes = run(build(tmp_path), tmp_path)
    assert "C15" in codes, "a cable to a port that does not exist was accepted and nothing said so"
    assert report["summary"]["C15"]["level"] == "warn"


def test_the_report_is_written_to_out_and_names_its_timing(tmp_path):
    report, _ = run(build(tmp_path), tmp_path)
    assert report["seconds"] > 0 and set(report["timing"]) >= {"settings", "cabling", "occupants", "configs"}
    assert "summary" in report


@pytest.mark.skipif(not (DIST / "devices.json").exists(), reason="library/dist not built - run ./build.sh")
def test_on_the_real_build_it_walks_ends_and_states(tmp_path):
    out = tmp_path / "real.json"
    p = subprocess.run([sys.executable, str(TOOL), "--dist", str(DIST), "--refs", "fhd-1ube", "s9700-53dx", "--max-configs", "1",
                        "--out", str(out)], capture_output=True, text=True)
    assert p.returncode == 0, p.stderr[-1500:]
    r = json.loads(out.read_text())
    switch = next(x for x in r["parts"] if x["ref"] == "s9700-53dx")["configs"][0]
    assert switch["cabling"]["counts"]["offered"] > 40 and switch["cabling"]["counts"]["judged"] >= 6
    assert switch["settings"]["counts"]["drawn"] > 40
    assert not [f for f in switch["cabling"]["found"] if f["code"] == "C0"], "the check threw"
