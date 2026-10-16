"""Part conformance, the prototype (docs/part-conformance-design.md).

Runs the two checks over a sample of devices in a built library:

  cabling   every place a cable can end, in each configuration, laid to a
            matching far end: offered to an agent, accepted, not a loose end,
            routed, standing on its mating point along its axis;
  settings  every state the drawings declare is a state the agent's tools take,
            and gives the document and the drawing the page does.

The kit does the work (part_conformance.mjs, under node); this is the front
door: the sample, the timing, the summary and the report file.

    python3 spec/tools/dev/part_conformance.py --dist library/dist \\
        --sample spec/tools/dev/part_conformance_sample.json --out report.json

The report is written to --out, never to a redirect. Exit status 1 when a
BLOCKING finding exists and --strict is given; a finding marked gap, standin,
warn or note only reports.
"""
import argparse
import json
import os
import pathlib
import shutil
import subprocess
import sys
import time

HERE = pathlib.Path(__file__).resolve().parent
RUNNER = HERE / "part_conformance_run.mjs"
SAMPLE = HERE / "part_conformance_sample.json"

# What each code says, and whether it blocks a merge (design section 5).
CODES = {
    "S0": ("settings", "block", "the check could not run on this configuration"),
    "S1": ("settings", "block", "a state the drawings declare is unknown to the agent's catalogue"),
    "S2": ("settings", "report", "the catalogue lists a state no drawing declares"),
    "S3": ("settings", "block", "the drawing and the catalogue disagree on a vocabulary"),
    "S4": ("settings", "block", "state.set refuses a state the drawings declare"),
    "S5": ("settings", "block", "state.set gives another document than the page writes"),
    "S6": ("settings", "block", "an accepted state is dropped before the drawing"),
    "S7": ("settings", "block", "a declared state has no rule that paints it"),
    "S8": ("settings", "gap", "a display's whole readings cannot be set by any command"),
    "S9": ("settings", "block", "field refuses a field the drawn part declares"),
    "C0": ("cabling", "block", "the check could not run on this configuration"),
    "C1": ("cabling", "block", "a cable to an offered end is refused at add time"),
    "C2": ("cabling", "block", "an accepted cable is a loose end"),
    "C3": ("cabling", "block", "an accepted cable does not route"),
    "C4": ("cabling", "block", "the route does not start on the end's point"),
    "C5": ("cabling", "block", "the first leg leaves the end off its axis"),
    "C6": ("cabling", "block", "the end falls outside the device in a face pane"),
    "C7": ("cabling", "block", "a side pane would draw the end off its panel (setback)"),
    "C8": ("cabling", "block", "a drawn port is not offered to an agent"),
    "C9": ("cabling", "block", "an offered port has no drawing"),
    "C10": ("cabling", "standin", "a port on an angled facet declares no axis"),
    "C11": ("cabling", "block", "a coupler has cable ends on one side only"),
    "C12": ("cabling", "gap", "no matching far end or optic to test this end with"),
    "C13": ("cabling", "block", "the plug's first leg runs inside its own device"),
    "C14": ("cabling", "standin", "an end declares no mating point"),
    "C15": ("cabling", "block", "a made-up end is accepted at add time"),
    "C18": ("cabling", "block", "the back of a seated part has ends the host draws no point for"),
    "C19": ("cabling", "block", "a powered part presents no power end an agent is offered"),
    "C20": ("cabling", "block", "a drawn inlet, terminal or stud is not a place a cord or lug can land"),
    "C16": ("cabling", "gap", "the catalogue alone does not answer for an end of a listed part"),
    "C17": ("cabling", "block", "a part a cage lists cannot be fitted to it"),
    "O1": ("cabling", "block", "a bay lists a part the library does not hold"),
}


def node():
    found = shutil.which("node") or os.path.expanduser("~/tools/node-v20.20.2-linux-x64/bin/node")
    if not pathlib.Path(found).exists():
        raise SystemExit("node is not installed")
    return found


def load_sample(path):
    data = json.loads(pathlib.Path(path).read_text())
    return data["parts"] if isinstance(data, dict) else data


def run(dist, refs, max_configs=3, max_ends=12, max_states=400, skip=(), site=None):
    """Run the node half over `refs`; returns (report dict, seconds)."""
    opts = json.dumps({"refs": list(refs), "maxConfigs": max_configs, "maxEnds": max_ends,
                       "maxStates": max_states, "skip": list(skip), "site": site})
    t = time.monotonic()
    p = subprocess.run([node(), str(RUNNER), str(dist), opts], capture_output=True, text=True, cwd=str(HERE))
    took = time.monotonic() - t
    if p.returncode != 0:
        raise SystemExit(f"node failed:\n{p.stderr[-2000:]}")
    return json.loads(p.stdout.strip().splitlines()[-1]), took


def findings(report):
    """[(ref, cfg, check, finding)] for every finding of a report."""
    out = []
    for part in report["parts"]:
        if part.get("error"):
            out.append((part["ref"], None, "both", {"code": "X0", "text": part["error"], "n": 1}))
        for f in (part.get("occupants") or {}).get("found", []):
            out.append((part["ref"], "(every listed part)", "occupants", f))
        for row in part["configs"]:
            for check in ("settings", "cabling"):
                for f in (row.get(check) or {}).get("found", []):
                    out.append((part["ref"], row["cfg"], check, f))
    return out


def level_of(f):
    return f.get("level") or CODES.get(f["code"], ("", "block", ""))[1]


def summarise(report):
    by_code = {}
    for ref, cfg, check, f in findings(report):
        row = by_code.setdefault(f["code"], {"parts": set(), "configs": 0, "n": 0, "level": level_of(f)})
        row["parts"].add(ref)
        row["configs"] += 1
        row["n"] += f.get("n", 1)
    return {c: {"level": r["level"], "parts": sorted(r["parts"]), "configs": r["configs"], "n": r["n"],
                "says": CODES.get(c, ("", "", ""))[2]} for c, r in sorted(by_code.items())}


def seconds(report):
    out = {"settings": 0.0, "cabling": 0.0, "occupants": 0.0, "configs": 0}
    for part in report["parts"]:
        out["occupants"] += (part.get("occupants") or {}).get("seconds", 0.0)
        for row in part["configs"]:
            out["configs"] += 1
            for check in ("settings", "cabling"):
                out[check] += (row.get(check) or {}).get("seconds", 0.0)
    return {k: round(v, 2) if isinstance(v, float) else v for k, v in out.items()}


def text(report, took, verbose=False):
    lines = [f"part conformance over {len(report['parts'])} parts in {took:.1f} s ({seconds(report)})"]
    shown = set()
    for ref, cfg, check, f in findings(report):
        if not verbose and f["code"] in shown:
            continue
        shown.add(f["code"])
        lines.append(f"  {level_of(f):7} {f['code']:4} {ref}{'/' + cfg if cfg else ''}: {f['text']}")
    lines.append("")
    for code, row in summarise(report).items():
        lines.append(f"  {code:4} {row['level']:7} {len(row['parts']):3} parts {row['configs']:4} configs: {row['says']}")
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--dist", default="library/dist")
    ap.add_argument("--sample", default=str(SAMPLE), help="a JSON file: {parts: [{ref, why}]} or a list of refs")
    ap.add_argument("--refs", nargs="*", help="devices to run, instead of the sample")
    ap.add_argument("--all", action="store_true", help="every device of the build (the scheduled run)")
    ap.add_argument("--max-configs", type=int, default=3)
    ap.add_argument("--max-ends", type=int, default=12, help="cable ends judged per configuration and variant (a stratified sample)")
    ap.add_argument("--max-states", type=int, default=400)
    ap.add_argument("--skip", nargs="*", default=[], choices=["cabling", "settings", "occupants"])
    ap.add_argument("--out", required=True, help="where the JSON report is written")
    ap.add_argument("--site", help="a checkout of the site: its side-pane geometry is asked where the faceplate stands (C7)")
    ap.add_argument("--strict", action="store_true", help="exit 1 on a blocking finding")
    ap.add_argument("--verbose", action="store_true", help="print every finding, not the first of each code")
    a = ap.parse_args(argv)
    dist = pathlib.Path(a.dist).resolve()
    if a.all:
        refs = sorted(p.name[: -len(".configs.json")] for p in dist.glob("*.configs.json"))
        why = {}
    elif a.refs:
        refs, why = a.refs, {}
    else:
        parts = load_sample(a.sample)
        refs = [p["ref"] if isinstance(p, dict) else p for p in parts]
        why = {p["ref"]: p.get("why", "") for p in parts if isinstance(p, dict)}
    report, took = run(dist, refs, a.max_configs, a.max_ends, a.max_states, a.skip, a.site)
    for part in report["parts"]:
        part["why"] = why.get(part["ref"], "")
    report["dist"] = a.dist            # as given: the report names no path of this machine
    report["seconds"] = round(took, 2)
    report["timing"] = seconds(report)
    report["summary"] = summarise(report)
    pathlib.Path(a.out).write_text(json.dumps(report, indent=1, sort_keys=True) + "\n")
    print(text(report, took, a.verbose))
    blocking = [f for _, _, _, f in findings(report) if level_of(f) == "block"]
    return 1 if (a.strict and blocking) else 0


if __name__ == "__main__":
    sys.exit(main())
