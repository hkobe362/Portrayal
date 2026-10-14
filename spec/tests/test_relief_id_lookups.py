"""relief.js looks ids up once per drawing, and answers what the selector did.

`cablePoints` found the feature a cable point sits on with a selector per
marker, `extractRelief` found each cavity's node with one per cavity; both walk
the drawing every time and took seconds on a rack of a few hundred cables. Each
now reads an id map. js/relief-id-lookups.mjs runs the module as it is and with
the old lookup put back over real compiled faces and compares what comes back;
it reads library/dist, so it runs after a build.
"""
import shutil
import subprocess
from pathlib import Path

import pytest

JS = Path(__file__).resolve().parent / "js"
SCRIPT = JS / "relief-id-lookups.mjs"


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_cable_points_are_the_same_with_one_id_map_per_parent():
    p = subprocess.run(["node", "--test", str(SCRIPT)], capture_output=True, text=True,
                       cwd=str(JS), timeout=600)
    assert p.returncode == 0, p.stdout[-4000:] + p.stderr[-2000:]
    assert "# fail 0" in p.stdout, p.stdout[-2000:]


def test_no_lookup_by_attribute_selector_is_left_in_the_two_loops():
    src = (SCRIPT.parents[3] / "kit/relief.js").read_text()
    cp = src[src.index("export function cablePoints("):src.index("export function configureRelief(")]
    assert cp.count("querySelector(`[id=") == 1, "one selector, in featureOn, for a host asked once"
    ex = src[src.index("export async function extractRelief("):]
    assert "svg.querySelector(`[id=" not in ex
