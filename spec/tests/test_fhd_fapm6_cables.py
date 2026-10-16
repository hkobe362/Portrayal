"""A cable on the two loaded FAPM6 panels, by the rack kit (spec/tests/js/fapm6-cables.mjs).

The RJ45 panel's six ports are cable ends and a cable from a switch's RJ45 port
lands and routes; the blank panel offers none. Read from library/dist, so it
skips on a tree that has not been built."""
import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "library" / "dist"
JS = ROOT / "spec/tests/js/fapm6-cables.mjs"


def test_the_loaded_fapm6_panels_against_the_rack_kit():
    if shutil.which("node") is None:
        pytest.skip("node not installed")
    if not all((DIST / f).exists() for f in ("components.json", "fhd-1ube.configs.json", "evma8365x.configs.json")):
        pytest.skip("library/dist not built - run ./build.sh")
    p = subprocess.run(["node", "--test", str(JS)], capture_output=True, text=True, cwd=str(JS.parent),
                       env={**os.environ, "PORTRAYAL_DIST": str(DIST)})
    assert p.returncode == 0, p.stdout[-6000:] + p.stderr[-2000:]
