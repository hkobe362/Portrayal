"""The relief is built and drawn in batches (kit 0.43.0, relief-batches.mjs).

A large rack's 3D asked for some 7,000 SVG rasters, one Blob and Image each,
and drew some 140,000 meshes a frame. Two rules make that cheaper without
changing the picture, and both are checked here under bare node:

- a raster is kept by what decides its pixels (`rasterKey`): the text, less
  the ids, `data-` values and title words the drawing's stylesheet and
  references cannot see, at one canvas size and flip. Everything else differing
  is another raster.
- a face's pieces merge into one geometry (`mergePieces`), each carried by its
  own matrix, with normals by the inverse transpose and the winding turned over
  where the matrix mirrors.
"""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "tests/js/relief-batches.mjs"


@pytest.fixture(scope="module")
def out():
    if shutil.which("node") is None:
        pytest.skip("node not installed")
    p = subprocess.run(["node", str(SCRIPT)], capture_output=True, text=True, cwd=str(SCRIPT.parent))
    assert p.returncode == 0, p.stderr
    return json.loads(p.stdout.strip().splitlines()[-1])


def test_two_ports_under_other_names_are_one_raster(out):
    assert out["portsAlike"], "ports that differ only in id, path and title should share a key"
    assert out["onePortDrawnOnce"] == 1
    assert out["firstTextDrawn"]
    # each caller still gets a canvas of its own to draw on
    assert out["ownCanvases"]
    assert out["sourceShared"], "rasterSource should hand back the kept raster"


def test_what_reaches_the_pixels_keeps_rasters_apart(out):
    # an id the stylesheet names, an attribute value a selector reads, an id a
    # url() names, the art itself, a stylesheet and a run of text
    for k in ("namedIdKept", "valuedAttrKept", "referencedIdKept", "artKept", "styleKept", "textKept",
              "titleKeptAsElement"):
        assert out[k], k
    assert out["sizeAndFlipApart"] == 3, "another size or another flip is another raster"


def test_a_flipped_raster_keeps_its_flipped_context(out):
    # buildFaceRelief and viewer3d's refine punch a mirrored face through the
    # context rasterize leaves behind; a copy that reset it moved every hole
    assert out["flippedContext"] == {"a": -1, "d": 1, "e": 40, "f": 0}


def test_a_failure_is_not_kept_and_the_budget_is_pixels(out):
    assert out["failureNotKept"] == 2
    assert out["budgetZero"] == 2, "setRasterBudget(0) keeps nothing"
    assert out["budgetEvicts"] == {"loads": 3, "kept": 1}
    assert out["statsShape"]


def test_the_key_of_a_shared_prefix_tells_apart_what_the_whole_text_does(out):
    # kit 0.45.0: the face's style and defs are rewritten once, and a key is
    # still equal exactly when the whole-text rewrite (`rasterKeyText`) is
    assert out["keyPartition"]
    assert out["keyIsShort"], "a key is no longer the whole text"
    assert out["keyStable"]


def test_a_face_raster_is_the_kept_one(out):
    assert out["svgCanvasShared"], "svgCanvas hands back the kept raster, which its callers only read"


def test_merged_pieces_keep_their_geometry(out):
    assert out["identity"] == {"pos": [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], "nrm": [0, 0, 1] * 4,
                               "uv": [0, 0, 1, 0, 1, 1, 0, 1], "index": [0, 1, 2, 0, 2, 3]}
    assert out["twoCopies"] == {"vertices": 8, "index": [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7], "moved": [5, 0, 2]}
    assert out["range"] == {"vertices": 3, "index": [0, 1, 2]}
    assert out["bare"] == {"nrm": None, "uv": None}


def test_merged_normals_go_by_the_inverse_transpose(out):
    assert out["turnedNormal"] == [0, -1, 0]
    assert out["scaledNormal"] == [0.447214, 0, -0.894427]
    # a mirror turns the winding over and leaves the normal facing out
    assert out["mirrored"] == {"index": [0, 2, 1, 0, 3, 2], "nrm": [0, 0, 1]}
