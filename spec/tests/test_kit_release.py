"""The kit's version is bumped when the kit is published, not in a pull request.

Every pull request that touched `kit/` used to bump `kit/package.json`, so two
open ones collided on the same line. A pull request now adds a changelog
fragment only. What stays guarded is the publish: `kitrelease.py` refuses a
`kit/package.json` version that the README's newest "New in" note does not name.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]

from portrayal import kitrelease   # noqa: E402


def _kit(tmp_path, version, readme):
    (tmp_path / "kit").mkdir()
    (tmp_path / "kit" / "package.json").write_text(json.dumps({"version": version}))
    (tmp_path / "kit" / "README.md").write_text(readme)
    return tmp_path


def test_a_kit_change_that_leaves_the_version_alone_passes(tmp_path):
    """A pull request edits kit code and adds a fragment; the version and README
    heading stay as published, and nothing the pull request gates on objects."""
    root = _kit(tmp_path, "0.50.0", "**New in 0.50.0: a thing.**\n")
    (root / "kit" / "rack.js").write_text("export const x = 2;\n")
    assert kitrelease.problems(root) == []


def test_the_live_kit_has_no_pinned_version_in_the_tests():
    text = (ROOT / "spec/tests/test_ref_redirects.py").read_text()
    assert 'pkg["version"] == "0.' not in text


def test_publish_refuses_a_version_the_readme_does_not_name(tmp_path):
    root = _kit(tmp_path, "0.51.0", "**New in 0.50.0: a thing.**\n")
    found = kitrelease.problems(root, publishing=True)
    assert len(found) == 1 and "0.51.0" in found[0] and "0.50.0" in found[0]


def test_publish_passes_when_the_version_and_the_readme_agree(tmp_path):
    root = _kit(tmp_path, "0.51.0", "**New in 0.51.0: b.**\n\n**New in 0.50.0: a.**\n")
    assert kitrelease.problems(root, publishing=True) == []


def test_publish_refuses_a_version_that_is_not_three_numbers(tmp_path):
    root = _kit(tmp_path, "0.51", "**New in 0.51: b.**\n")
    assert kitrelease.problems(root, publishing=True)


def test_the_readme_of_the_kit_as_it_stands_is_publishable():
    assert kitrelease.problems(ROOT, publishing=True) == []
