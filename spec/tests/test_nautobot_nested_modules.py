"""The Nautobot modules file writes a module seated in a bay of another module
(roc-ops/Portrayal#1127).

Nautobot's CSV import installs such a module with lookup columns down through
the parent module, one `parent_module_bay__parent_module__` more for each level
of nesting. One header cannot carry rows of two depths, so the kit returns one
section per depth, each its own file. The node tests hold the columns, the
order, the files as an importer reads them, the unchanged files for a rack with
no nested module, and a sweep over the 28 nested modules of the library on the
committed Nautobot type files.
"""
import os
import shutil
import subprocess
from pathlib import Path

import pytest

import onebuild

JS = Path(__file__).resolve().parent / "js" / "nautobot-nested-modules.mjs"


def test_the_kit_writes_nested_modules_for_nautobot():
    if shutil.which("node") is None:
        pytest.skip("node not installed")
    p = subprocess.run(["node", "--test", str(JS)], capture_output=True, text=True, cwd=str(JS.parent),
                       env={**os.environ, "PORTRAYAL_COMPONENTS": str(onebuild.components_index())})
    assert p.returncode == 0, p.stdout[-6000:] + p.stderr[-2000:]
