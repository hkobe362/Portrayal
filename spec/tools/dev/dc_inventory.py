#!/usr/bin/env python3
"""Every DC power entry and output in the library, and whether a cable can land on it.

    dc_inventory.py [--library library] [--out docs/dc-power-inventory.md] [--json FILE]

WHY THIS EXISTS. A rack's DC feeds were wired in the cable editor: every feed was
accepted and then reported loose at both ends, because the parts that draw a DC
terminal draw it as art in their skin and the library does not offer it as a
cable end. AC power is cabled (docs/cable-ends-design.md); DC is not, and this
counts how far from it each part is, so the model in docs/dc-power-design.md is
sized from the library and not from the four parts that showed the problem.

READS THE SOURCE FILES, NOT A BUILD. It needs only the YAML, so it runs in
seconds before a build and says the same on any checkout.

WHAT A "CABLE END" MEANS HERE is the kit's own rule (kit/rack/cable-rules.js
cableEndsOf): a part publishes a connector slot when it states an `interface`
the registry (spec/schemas/connectors.yaml) knows, and the slot takes a cable
end when some part of class `port` `mates` that interface. A part that composes
such a part (a terminal block composing its screws, a supply composing its
terminal block) lands by it, to the depth cableEndPaths walks. Nothing else
lands. This tool re-derives that from the files and does not run the kit; a
test pins the derivation on the parts that showed the problem.

WHAT IT FINDS is a heuristic, and the output says by which signal each part was
found (`signals`). A part is listed when any of these holds:
  attr      attrs say DC: `inlet: dc-terminal`, an `input` of dc or a DC range, a
            `media` of dc-terminal / terminal-block / two-hole-lug, a DC `role`
  interface it presents one of the DC interfaces (terminal-508-N, dc-barrel,
            p40, stud-pair-N, or terminal-stud on a part that is not a ground)
  element   an element id names a terminal, lug, stud, busbar, BATT, RTN, 48V...
  part      it composes a part that is itself listed
  name      a supply, power module, inlet or breaker whose description says DC
It lists a candidate and never decides a part is not DC: the reviewer of the
output reads the `signals` and rejects what is wrong.

POLARITY IS ONLY WHAT A SOURCE STATES. A conductor is named when an element id or
description, a composed part's id, a connection point, or a sentence of the
part's provenance says so (-48 V, RTN, return, BATT, negative, positive,
ground). It is recorded with the words that said it and whether they are
STRUCTURED (a field a tool can read) or PROSE (a sentence). Where nothing says,
the answer is "none stated"; nothing here infers a polarity from a position, a
colour or a name that merely sounds right.
"""
import argparse
import collections
import json
import pathlib
import re
import sys

import yaml

from portrayal import libwalk

ROOT = pathlib.Path(__file__).resolve().parents[3]

DC_INTERFACES = ("terminal-508-", "dc-barrel", "p40", "stud-pair-", "terminal-stud")
DEPTH = 4                      # the depth the kit walks under a bay's module

# element ids that name a DC termination; a ground, earth or gnd id is never one
DC_ID = re.compile(r"(?:^|[-_])(terminals?|terminal-block|connector-block|batt|battery|rtn|return|48v|"
                   r"busbar|dc-in|dc-inlet|dc-input|dc-power|lugs?|studs?|anderson)(?:[-_\d]|$)", re.I)
NOT_DC_ID = re.compile(r"ground|earth|gnd|chassis-gnd|esd", re.I)
DC_INPUT = re.compile(r"^(dc|hvdc)\b|vdc|(?<!\d)[-−–]\s?\d+\s?(to\s?[-−–]?\s?\d+\s?)?v\b|\bdc\b", re.I)
DC_MEDIA = {"dc-terminal", "terminal-block", "two-hole-lug", "barrel", "p40"}
DC_ROLES = {"dc-power-entry", "dc-power-supply", "hvac-dc-power-supply"}
SUPPLYISH = {"psu", "power", "inlet", "breaker"}
HVDC = re.compile(r"\bhvdc\b|high[- ]voltage dc|\b\d{3}\s?(?:-|to)?\s?(?:\d{3})?\s?v\s?dc\b|\bmixed-mode\b", re.I)
RELAY = re.compile(r"dry[- ]contact|\brelay\b", re.I)
PROTECTOR =re.compile(r"\bTPA\b|bullet|\bDC\b|-48", re.I)
DC_WORDS = re.compile(r"\bDC\b|[-−–]\s?48\s?V|\bbusbar\b|\bbattery\b|\bBATT\b", re.I)

# a conductor, as a source words it; the label is what the source said, upper-cased
POLARITY = [
    ("-48V", re.compile(r"(?<![\d.])[-−–]\s?(?:48|60)\s?v|(?<![\d.])(?:48|60)v\b|\b48v\b", re.I)),
    ("RTN", re.compile(r"\b(?:rtn|return)\b", re.I)),
    ("BATT", re.compile(r"\b(?:batt|battery)\b", re.I)),
    ("BAT", re.compile(r"\be?bat(?:ret)?(?:[-\s]?[ab])?\b", re.I)),
    ("RET", re.compile(r"\b(?:e?batret|ret)\b", re.I)),
    ("negative", re.compile(r"\bnegative\b", re.I)),
    ("positive", re.compile(r"\bpositive\b", re.I)),
    ("ground", re.compile(r"\b(?:ground|earth|safety ground)\b", re.I)),
]
TERMINALISH = re.compile(r"terminal|lug|stud|screw|pole|input|connector|busbar|feed|inlet|output", re.I)
SOURCE_KEYS = ("terminals", "terminal", "screws", "connector-block", "rows", "inlet", "input", "feeds", "power", "sources")


def _listed(v):
    return [] if v is None else v if isinstance(v, list) else [v]


def _load(path):
    return yaml.safe_load(pathlib.Path(path).read_text()) or {}


class Library:
    """The components, devices and registry of one library root, parsed once."""

    def __init__(self, root):
        self.root = pathlib.Path(root)
        self.comps = {}
        for f in libwalk.iter_components([self.root]):
            c = _load(f)
            if isinstance(c, dict):
                self.comps[libwalk.ref_of(f)] = c
        self.devices = {}
        for f in libwalk.iter_devices([self.root]):
            d = _load(f)
            if d.get("kind") == "device":
                self.devices[f"{f.parent.parent.name}/{f.parent.name}"] = d
        reg = _load(ROOT / "spec/schemas/connectors.yaml")
        self.registry = set((reg.get("interfaces") or reg))
        # an interface lands a cable when a class `port` part mates it
        self.plugs = collections.defaultdict(list)
        for ref, c in self.comps.items():
            if c.get("class") == "port":
                for i in _listed(c.get("mates")):
                    self.plugs[str(i)].append(ref)

    def comp(self, ref):
        return self.comps.get(str(ref).split(":")[0])

    def lands(self, ref, dc_only=True):
        """How a DC cable lands on a part: {answer, via, interface, plugs, why}.

        answer is `yes` (it presents the slot), `via-parts` (a part it composes
        does) or `no`, with the reason for the last. ONLY A DC INTERFACE COUNTS
        (DC_INTERFACES): a supply that also has an AC cord inlet, or a USB jack,
        lands a cable by those and not on its DC terminals. `dc_only=False` is
        for a supply that takes HVDC through its AC inlet: the inlet is the end.
        """
        c = self.comp(ref) or {}
        iface = c.get("interface")
        ok = (lambda i: str(i).startswith(DC_INTERFACES)) if dc_only else (lambda i: True)
        if iface and iface in self.registry and self.plugs.get(iface) and ok(iface):
            return {"answer": "yes", "interface": iface, "plugs": sorted(self.plugs[iface]), "via": [], "why": ""}
        via = []

        def walk(comp, base, depth):
            for p in _listed(comp.get("parts")):
                if not isinstance(p, dict):
                    continue
                sub = self.comp(p.get("ref")) or {}
                i = sub.get("interface")
                path = f"{base}/{p.get('id')}"
                if i and i in self.registry and self.plugs.get(i) and ok(i) and sub.get("class") != "ground":
                    via.append({"path": path, "ref": p.get("ref"), "interface": i})
                if depth < DEPTH:
                    walk(sub, path, depth + 1)
        walk(c, "", 0)
        if via:
            return {"answer": "via-parts", "interface": None, "plugs": [], "via": via, "why": ""}
        if not iface:
            why = "presents no interface"
        elif iface not in self.registry:
            why = f"interface {iface} is not registered"
        else:
            why = f"interface {iface} has no cable-end part (no class port part mates it)"
        return {"answer": "no", "interface": iface, "plugs": [], "via": [], "why": why}


def _polarity_of(text):
    return [label for label, rx in POLARITY if rx.search(text)]


def _structured(c):
    """(conductor, where, words) from fields a tool can read."""
    out = []
    for eid, e in (c.get("elements") or {}).items():
        if NOT_DC_ID.search(str(eid)) and not _polarity_of(str(eid)):
            continue
        for text, where in ((str(eid), f"element id `{eid}`"),
                            (str((e or {}).get("description", "")), f"element `{eid}` description")):
            for lab in _polarity_of(text):
                out.append((lab, where, text.strip()[:90]))
    for p in _listed(c.get("parts")):
        if isinstance(p, dict):
            for lab in _polarity_of(str(p.get("id", ""))):
                out.append((lab, f"part id `{p.get('id')}`", str(p.get("id"))))
    for k in (c.get("connection-points") or {}):
        for lab in _polarity_of(str(k)):
            out.append((lab, f"connection point `{k}`", str(k)))
    for k in ("polarity",):
        if (c.get("attrs") or {}).get(k):
            out.append((str(c["attrs"][k]), "attrs.polarity", str(c["attrs"][k])))
    return out


def _prose(c):
    out = []
    prov = dict(c.get("provenance") or {})
    prov["description"] = c.get("description")
    prov.update({f"attrs.{k}": v for k, v in (c.get("attrs") or {}).items() if k in ("input", "inlet", "feeds", "note")})
    for key, text in prov.items():
        if not isinstance(text, str):
            continue
        for sent in re.split(r"(?<=[.;:])\s+|\n", " ".join(text.split())):
            if TERMINALISH.search(sent):
                for lab in _polarity_of(sent):
                    out.append((lab, key if key in ("description",) or key.startswith("attrs.") else f"provenance.{key}",
                                sent.strip()[:110]))
    return out


def polarity(c):
    """{conductors, via, evidence}: what a source states, and where."""
    found = _structured(c)
    via = "structured"
    if not found:
        found, via = _prose(c), "prose"
    if not found:
        return {"conductors": [], "via": "none stated", "evidence": []}
    labs = []
    for lab, _, _ in found:
        if lab not in labs:
            labs.append(lab)
    seen, ev = set(), []
    for lab, where, words in found:
        if (lab, where) not in seen:
            seen.add((lab, where))
            ev.append(f"{lab}: {where}: {words}")
    return {"conductors": labs, "via": via, "evidence": ev[:6]}


def _ac_only(c):
    """The part states an AC input and no DC one."""
    a = c.get("attrs") or {}
    inp = str(a.get("input", ""))
    ac = (inp.lower() == "ac" or str(a.get("inlet", "")) in ("c14", "c20") or a.get("media") == "ac"
          or bool(re.search(r"\bvac\b|\bhz\b|~", inp, re.I)))
    return ac and not re.search(r"vdc|\bdc\b", inp, re.I)


def _attr_signal(c):
    a = c.get("attrs") or {}
    if str(a.get("inlet", "")) == "dc-terminal":
        return "attr:inlet=dc-terminal"
    if a.get("role") in DC_ROLES:
        return f"attr:role={a['role']}"
    if str(a.get("media", "")) in DC_MEDIA:
        return f"attr:media={a['media']}"
    inp = str(a.get("input", ""))
    if inp and not _ac_only(c) and DC_INPUT.search(inp):
        return "attr:input"
    return None


def signals_of(lib, ref, c, listed):
    sig = []
    cls = c.get("class")
    if cls == "ground" or (cls == "port" and c.get("mates")):
        return sig                      # a ground stud, and a lug or plug that IS a cable end
    if RELAY.search(str(c.get("description", ""))):
        return sig                      # a dry-contact header is a signal output, not a power end
    a = _attr_signal(c)
    if a:
        sig.append(a)
    iface = str(c.get("interface") or "")
    if iface.startswith(DC_INTERFACES):
        sig.append(f"interface:{iface}")
    for eid, e in (c.get("elements") or {}).items():
        if DC_ID.search(str(eid)) and not NOT_DC_ID.search(str(eid)) and (e or {}).get("class") in ("inlet", "terminal", "power", None):
            sig.append(f"element:{eid}")
    for p in _listed(c.get("parts")):
        if isinstance(p, dict) and str(p.get("ref")) in listed:
            sig.append(f"part:{p.get('id')}")
    name = ref.split("/")[1].split("@")[0]
    if cls in ("psu", "power") and re.search(r"(?:^|-)dc(?:-|$)", name):
        sig.append("name:ref")
    if (cls in SUPPLYISH and not _ac_only(c) and not re.search(r"(?:^|-)ac(?:-|$)", name)
            and DC_WORDS.search(str(c.get("description", ""))) and not sig):
        sig.append("name:description")
    inputs = [str(v) for k, v in (c.get("attrs") or {}).items() if str(k).startswith("input")]
    if cls in ("psu", "power") and HVDC.search(" ".join([str(c.get("description", ""))] + inputs)):
        sig.append("hvdc:through the AC inlet")
    if cls == "breaker" and PROTECTOR.search(str(c.get("description", ""))):
        sig.append("protector:description")
    return sig


def kind_of(ref, c, signals):
    """What sort of end it is, from the strongest signal."""
    iface = str(c.get("interface") or "")
    name = ref.split("/")[1]
    els = [s.split(":", 1)[1] for s in signals if s.startswith("element:")]
    text = " ".join([name] + els)
    if iface == "dc-barrel":
        return "dc-barrel"
    if iface.startswith("terminal-508-"):
        return "pluggable-header"
    if iface == "p40" or "p40" in name:
        return "p40-connector"
    if iface.startswith("stud-pair-") or re.search(r"stud-pair|input-feed-studs", name):
        return "lug-pair"
    if "busbar" in text:
        return "busbar"
    if "connector-block" in text:
        return "connector-block"
    if c.get("class") == "breaker" or "fuse" in name:
        return "protector"
    if signals and all(s.startswith(("hvdc:", "attr:role=hvac")) for s in signals):
        return "supply: HVDC through the AC inlet"
    if re.search(r"plug", name):
        return "plug-fixed"             # a plug drawn already seated
    parts = " ".join(str(p.get("ref")) for p in _listed(c.get("parts")) if isinstance(p, dict))
    if c.get("class") in ("psu", "power", "filter"):
        # a supply or power module: say what its DC end is DRAWN as, not that it is a supply
        if re.search(r"terminal", text) or "terminal" in parts:
            return "supply: terminal block"
        if re.search(r"dc-in(let|put)|inlet", text):
            return "supply: DC inlet, connector unspecified"
        if re.search(r"plug", parts):
            return "supply: plug"
        return "supply: DC end not drawn"
    if re.search(r"lug|stud", text) or iface == "terminal-stud":
        return "lug-pair" if re.search(r"pair|studs", text) else "screw-terminal"
    if re.search(r"terminal", text) or (c.get("attrs") or {}).get("inlet") == "dc-terminal":
        return "terminal-block"
    return "other"


def role_of(ref, c, kind):
    name = ref.split("/")[1]
    if kind == "protector":
        return "protector"              # passes current between an input and an output; its rating is the check
    if re.search(r"output", name):
        return "output"
    return "input"


def source_of(c):
    prov = c.get("provenance") or {}
    for k in SOURCE_KEYS:
        v = prov.get(k)
        if isinstance(v, str) and v.strip():
            return {"key": k, "text": " ".join(v.split())[:150]}
    return {"key": None, "text": ""}


def drawing_of(c):
    els = [str(e) for e in (c.get("elements") or {}) if DC_ID.search(str(e)) and not NOT_DC_ID.search(str(e))]
    parts = [f"{p.get('id')}={p.get('ref')}" for p in _listed(c.get("parts")) if isinstance(p, dict)
             and re.search(r"terminal|lug|stud|busbar|dc|p40|screw", str(p.get("ref")))]
    return {"elements": els, "parts": parts}


def components_listed(lib):
    """{ref: entry} for every part that carries a DC end, composing parts to a fixed point."""
    listed = {}
    changed = True
    while changed:
        changed = False
        for ref, c in sorted(lib.comps.items()):
            if ref in listed:
                continue
            sig = signals_of(lib, ref, c, listed)
            if not sig:
                continue
            kind = kind_of(ref, c, sig)
            lands = lib.lands(ref, dc_only=not kind.startswith("supply: HVDC"))
            if kind == "protector":
                lands = {"answer": "n/a", "interface": None, "plugs": [], "via": [],
                         "why": "a protector passes current between an input and an output and is no cable end"}
            listed[ref] = {
                "ref": ref,
                "vendor": ref.split("/")[0],
                "class": c.get("class"),
                "kind": kind,
                "role": role_of(ref, c, kind),
                "signals": sig,
                "drawing": drawing_of(c),
                "cable_end": lands["answer"],
                "interface": lands["interface"] or c.get("interface"),
                "plugs": lands["plugs"],
                "via": lands["via"],
                "why_not": lands["why"],
                "polarity": polarity(c),
                "source": source_of(c),
            }
            changed = True
    return listed


def devices_rollup(lib, parts):
    """Per device: the DC parts it places, offers in a bay or fits in a build."""
    out = {}
    for key, d in sorted(lib.devices.items()):
        found, placed = {}, collections.Counter()

        def add(ref, how):
            r = str(ref).split(":")[0]
            # a protector is no end and an HVDC supply lands on its AC inlet: neither is a DC end
            if r in parts and parts[r]["kind"] != "protector" and not parts[r]["kind"].startswith("supply: HVDC"):
                found.setdefault(r, set()).add(how)
                if how.startswith("placed:"):
                    placed[r] += 1
        for vname, v in (d.get("views") or {}).items():
            comps = (v or {}).get("components") or {}
            for p in _listed(comps.get("placements")):
                add(p.get("ref"), f"placed:{vname}")
            for b in _listed(comps.get("bays")):
                for r in _listed(b.get("accepts")) + _listed(b.get("default")):
                    add(r, f"bay:{vname}")
        for cname, cfg in (d.get("configurations") or {}).items():
            for r in ((cfg or {}).get("bays") or {}).values():
                add(r, f"config:{cname}")
        feeds = set()
        ch = (d.get("chassis") or {}).get("power")
        for v in _listed(ch):
            feeds.add(v)
        for cfg in (d.get("configurations") or {}).values():
            for v in _listed((cfg or {}).get("power")):
                feeds.add(v)
        if found or feeds & {"dc", "hvdc"}:
            ends = [parts[r]["cable_end"] for r in found if parts[r]["cable_end"] != "n/a"]
            entry = {
                "device": key,
                "vendor": key.split("/")[0],
                "power": sorted(feeds),
                "parts": {r: sorted(h) for r, h in sorted(found.items())},
                "placements": dict(sorted(placed.items())),
                "lands": ("yes" if any(e != "no" for e in ends) else "no") if ends else "no part",
            }
            if not found:
                # a DC build whose terminals are no part: what the device says of it, if it does
                notes = [" ".join(str(g.get("note", "")).split()) for g in _listed(d.get("gaps")) if isinstance(g, dict)]
                hit = [n for n in notes if re.search(r"terminal|DC feed|DC input|power end|inlet", n, re.I)]
                entry["note"] = hit[0][:160] if hit else ""
            out[key] = entry
    return out


def inventory(root):
    lib = Library(root)
    parts = components_listed(lib)
    devices = devices_rollup(lib, parts)
    for ref, p in parts.items():       # where each is used: placements, and the devices that place or offer it
        p["placements"] = sum(d["placements"].get(ref, 0) for d in devices.values())
        p["devices"] = sum(1 for d in devices.values() if ref in d["parts"])
    ends =[{"ref": r, "mates": [str(i) for i in _listed(c.get("mates"))]} for r, c in sorted(lib.comps.items())
            if c.get("class") == "port" and any(str(i).startswith(DC_INTERFACES) for i in _listed(c.get("mates")))]
    return {"parts": [parts[r] for r in sorted(parts)], "devices": [devices[k] for k in sorted(devices)],
            "cable_end_parts": ends, "components_total": len(lib.comps), "devices_total": len(lib.devices)}


def counts(inv):
    parts, devices = inv["parts"], inv["devices"]
    by = lambda key, rows: dict(sorted(collections.Counter(key(r) for r in rows).items()))
    return {
        "parts": len(parts),
        "by_kind": by(lambda p: p["kind"], parts),
        "by_vendor": by(lambda p: p["vendor"], parts),
        "by_role": by(lambda p: p["role"], parts),
        "by_cable_end": by(lambda p: p["cable_end"], parts),
        "by_polarity": by(lambda p: "stated, structured" if p["polarity"]["via"] == "structured"
                          else "stated, prose only" if p["polarity"]["via"] == "prose" else "none stated", parts),
        "kind_by_cable_end": by(lambda p: f"{p['kind']} / {p['cable_end']}", parts),
        "placements": sum(p["placements"] for p in parts),
        "placements_by_cable_end": dict(sorted(
            (k, sum(p["placements"] for p in parts if p["cable_end"] == k)) for k in {p["cable_end"] for p in parts})),
        "devices_with_dc": len(devices),
        "devices_by_vendor": by(lambda d: d["vendor"], devices),
        "devices_by_lands": by(lambda d: d["lands"], devices),
    }


def render_md(inv):
    c = counts(inv)
    L = ["# DC power in the library: an inventory",
         "",
         "Generated by `spec/tools/dev/dc_inventory.py`; do not edit by hand. Read",
         "[dc-power-design.md](dc-power-design.md) for what the numbers are for. A part is listed",
         "when a signal says it carries a DC end (`signals`); the list is candidates, read with",
         "that column. **Cable end** is the kit's rule re-derived from the source files: `yes`",
         "the part presents a registered interface a `port` part mates; `via-parts` a part it",
         "composes does; `no` neither (the reason follows). **Polarity** is what a source states",
         "and the words that said it; `none stated` is not a guess withheld but a fact absent.",
         "",
         f"Library: {inv['components_total']} component contracts, {inv['devices_total']} devices.",
         f"**{c['parts']} component contracts carry a DC end; {c['devices_with_dc']} devices place, offer or are fed by one.**",
         ""]

    def table(title, d, unit="parts"):
        L.extend([f"### {title}", "", f"| | {unit} |", "|---|---:|"])
        L.extend(f"| {k} | {v} |" for k, v in d.items())
        L.append("")
    L.append("## Counts")
    L.append("")
    table("By kind", c["by_kind"])
    table("By vendor (the namespace of the part)", c["by_vendor"])
    table("By direction", c["by_role"])
    table("Is it a cable end today", c["by_cable_end"])
    table("Kind by cable end", c["kind_by_cable_end"])
    table(f"Placements on a device face, by cable end ({c['placements']} in all)", c["placements_by_cable_end"],
          "placements")
    table("Is polarity stated", c["by_polarity"])
    table("Devices by vendor", c["devices_by_vendor"], "devices")
    table("Devices: does any DC part they carry land a cable", c["devices_by_lands"], "devices")
    L.extend(["## Parts", ""])
    for kind in sorted(c["by_kind"]):
        rows = [p for p in inv["parts"] if p["kind"] == kind]
        L.extend([f"### {kind} ({len(rows)})", "",
                  "| part | class | direction | drawn as | cable end | polarity (stated) | source | devices (placements) |",
                  "|---|---|---|---|---|---|---|---|"])
        for p in rows:
            drawn = ", ".join(p["drawing"]["elements"] + p["drawing"]["parts"]) or "-"
            if p["cable_end"] == "yes":
                end = f"yes: {p['interface']}"
            elif p["cable_end"] == "via-parts":
                end = "via " + ", ".join(v["path"].lstrip("/") for v in p["via"][:4]) + (" ..." if len(p["via"]) > 4 else "")
            else:
                end = f"no: {p['why_not']}"
            pol = p["polarity"]
            ptxt = (" / ".join(pol["conductors"]) + f" ({pol['via']})") if pol["conductors"] else "none stated"
            src = p["source"]["key"] or "-"
            L.append(f"| `{p['ref']}` | {p['class']} | {p['role']} | {drawn} | {end} | {ptxt} | {src} | "
                     f"{p['devices']} ({p['placements']}) |")
        L.append("")
    L.extend(["## Devices", "",
              "| device | power | DC parts (how) | lands |", "|---|---|---|---|"])
    for d in inv["devices"]:
        ps = "; ".join(f"`{r}` ({', '.join(h)})" for r, h in d["parts"].items()) or "none found" + (
            f": {d['note']}" if d.get("note") else "")
        L.append(f"| `{d['device']}` | {', '.join(d['power']) or '-'} | {ps} | {d['lands']} |")
    L.extend(["", "## The cable-end parts that exist", "",
              "Class `port` parts that mate a DC interface: what a feed's end would be today.", "",
              "| part | mates |", "|---|---|"])
    L.extend(f"| `{e['ref']}` | {', '.join(e['mates'])} |" for e in inv["cable_end_parts"])
    L.append("")
    return "\n".join(L)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    ap.add_argument("--library", default=str(ROOT / "library"))
    ap.add_argument("--out", help="write the Markdown report here")
    ap.add_argument("--json", help="write the full inventory as JSON here")
    args = ap.parse_args(argv)
    inv = inventory(args.library)
    md = render_md(inv)
    if args.out:
        pathlib.Path(args.out).write_text(md)
    if args.json:
        pathlib.Path(args.json).write_text(json.dumps({"counts": counts(inv), **inv}, indent=1, sort_keys=True) + "\n")
    if not (args.out or args.json):
        print(md)
    else:
        c = counts(inv)
        print(f"{c['parts']} parts, {c['devices_with_dc']} devices; cable end: {c['by_cable_end']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
