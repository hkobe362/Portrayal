"""The Explorer's position control (kit/positions.js, #950 step 5,
docs/adjustable-positions-design.md section 7).

A part that slides is set in one place: a slider over the range, a button for
each named stop and a reset, on the page of the device. js/positions.mjs
mounts the real control on the real shell over the stand-in page and holds
what it draws, what each part writes through `setFields`, the sentence for a
refused value, and the line that names the views which show the motion. Here:
that script runs, and kit/index.html and the package wire the module in.

What a browser alone can show (the slider under a pointer, the scene rebuilt
in 3D) is looked at by hand, on the fixture and on a library device.
"""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
KIT = ROOT / "kit"
SCRIPT = ROOT / "spec/tests/js/positions.mjs"


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_the_control_on_a_real_shell():
    p = subprocess.run(["node", "--test", str(SCRIPT)], capture_output=True, text=True,
                       cwd=str(SCRIPT.parent), timeout=120)
    assert p.returncode == 0, p.stdout[-4000:] + p.stderr[-2000:]
    # node --test passes a file whose tests never registered; it must have run them
    assert "# pass 17" in p.stdout and "# fail 0" in p.stdout, p.stdout[-2000:]


def test_the_explorer_mounts_it_once_and_tells_it_the_stage():
    page = (KIT / "index.html").read_text()
    assert "import { positionControl } from './positions.js';" in page
    assert page.count("positionControl(shell,") == 1
    # the control hears which stage is showing from the shell
    assert "shell.emit('mode', m);" in page
    # and the position travels by the roads every field takes
    assert "fields: encodeFields(state.cfgFields)," in page
    assert "v.setFields(state.cfgFields)" in page


def test_it_holds_no_rule_of_its_own():
    """The rows are fields.js's and the write is the shell's: the control
    neither judges a value nor moves a node."""
    src = (KIT / "positions.js").read_text()
    assert "import { adjustmentsOf, adjustmentRows } from './fields.js';" in src
    assert "shell.setFields(row.carrier, {[row.id]: value})" in src
    for name in ("adjustmentAccepts", "paintAdjustments", "moveMember"):
        assert name not in src
    # it writes no transform and no entry of the fields map: the shell does both
    assert "setAttribute('transform'" not in src and "cfgFields[" not in src


def test_the_package_exports_it_and_checks_it():
    pkg = json.loads((KIT / "package.json").read_text())
    assert pkg["exports"]["./positions"] == "./positions.js"
    assert "node --check positions.js" in pkg["scripts"]["test"]
    readme = (KIT / "README.md").read_text()
    assert "| `positions.js` |" in readme and "### The position control" in readme
