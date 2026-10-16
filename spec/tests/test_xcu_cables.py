"""The Fibrain XCU10's adapters are couplers, by the rack kit (spec/tests/js/xcu-cables.mjs).

An XCU of each configuration on the rear rails of a four-post frame, switches
with SC optics, and a cable to each face of the same adapter: accepted when
added, routed, and read as one path through the panel; a made-up adapter is
refused. Read from library/dist, so it skips on a tree that has not been built."""
import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "library" / "dist"
JS = ROOT / "spec/tests/js/xcu-cables.mjs"


def test_the_xcu_adapters_are_couplers_against_the_rack_kit():
    if shutil.which("node") is None:
        pytest.skip("node not installed")
    if not (DIST / "components.json").exists() or not (DIST / "xcu.configs.json").exists() \
            or not (DIST / "as5912-54x.configs.json").exists():
        pytest.skip("library/dist not built - run ./build.sh")
    p = subprocess.run(["node", "--test", str(JS)], capture_output=True, text=True, cwd=str(JS.parent),
                       env={**os.environ, "PORTRAYAL_DIST": str(DIST)})
    assert p.returncode == 0, p.stdout[-6000:] + p.stderr[-2000:]
