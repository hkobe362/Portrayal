"""The DC role vocabulary (spec/schemas/dc.yaml): which roles a pole may have and
which pairs of them a feed may join.

Read by lint (L187 to L191) and, in the build step that follows, by the check
that matches the two ends of a feed. One reader, so the list and the rules that
enforce it cannot drift.
"""
from pathlib import Path

import yaml

SCHEMAS = Path(__file__).resolve().parents[2] / "schemas"
UNSTATED = "unstated"


def load(schemas=None):
    """The registry as written, or {} when the file is absent or broken."""
    try:
        return yaml.safe_load((Path(schemas or SCHEMAS) / "dc.yaml").read_text()) or {}
    except (OSError, yaml.YAMLError):
        return {}


def roles(schemas=None):
    """role -> its entry."""
    return load(schemas).get("roles") or {}


def matches(a, b, negative, schemas=None):
    """True when a pole of role `a` may join one of role `b`. `negative` is
    whether the end's stated voltage is negative: the pairs marked
    `when: negative-voltage` hold only there. `unstated` joins nothing,
    because nothing is known about it; the caller says "by position"."""
    for m in load(schemas).get("matches") or []:
        if {m.get("a"), m.get("b")} != {a, b}:
            continue
        if m.get("when") == "negative-voltage" and not negative:
            continue
        return True
    return False
