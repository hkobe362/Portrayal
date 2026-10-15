# Part conformance: every new part is tried, at ingest, for its cable ends and its settings

Status: **proposal for approval**, 2026-10-15 (P-0049, request R-0027). Nothing here is
built except a prototype runner, `spec/tools/dev/part_conformance.py` with its node half, and
a test for it. No rule, skill, schema or workflow changes until this is approved.

The request, in its own words:

> when it models new devices, that it actually tests the cabling in 2 and 3D; any kind of a
> connector, cable, all of those things should be tested with proper routing; that also goes
> for LEDs, LCDs ... we should always test all of the settings, both like we would do in the
> Explorer, as well as the interface an agent would use, to make sure that there's parity
> between the two of them; I'm not sure how we make that something that's checked each time,
> but I would like to investigate how we can do that, because this is coming back and bit us
> a few times.

## 1. What has bitten, and what each fault was

Each was found by a person cabling or lighting a real rack after the part had merged. The
last column is what the prototype does with it on `origin/main` as it is (section 6).

| order | fault | what class it is | the check that should have found it |
|---|---|---|---|
| P-0045 | an RJ45 keystone panel's rear jacks take no cable | a coupler with one side: the part has no `faces.rear` | **C11**, a coupler has ends on both sides (or declares why not) |
| P-0047 | a fibre unit's rear adapters take no cable; its body is solid in 3D | the cassettes have a back, the host draws no rear, and the kit has no catalogue answer for a back in a nested bay | **C18** (ends with no point), **C9** (offered, not drawn), **C13** (the plug inside the body) |
| #1080 | a PDU's network card was unreachable for a cable | the ports of a module in a bay of a part beside the rack were no ends | **C1/C2** on every end of every part, beside the rack too (fixed on `main`: the control) |
| P-0046 | DC terminals are no cable end anywhere | a drawn inlet, terminal or stud that the agent is never offered | **C19**, **C20** |
| P-0048 | cables to an angled cage arrive straight on and stop short of a QSFP28 optic | the drawing tilts the cage and declares no axis; the plug reach ignores the optic | **C10** (no declared axis); the reach itself needs the page's relief reader |
| P-0048 | a device's setback is not drawn in the side views | the side panes and the kit disagree on where the faceplate stands | **C7**, with the site's side-pane geometry |
| P-0041 | LEDs, status digits, outlet lamps and breakers could be set in the Explorer and the agent refused them (`cannot be set: it declares no state`) | the agent's list of states was built from one source, the Explorer's from another | **S1/S3/S4**, the vocabulary of the drawing against the catalogue |
| P-0042 | a display's reading could not be set | no command for it | **S8** (a drawn reading with no command) |

They are one fault seen from two sides. **A part is checked by the author against its
source, and by lint against its own rules, and nobody and nothing ever uses it the way the
Explorer, the Rack Builder and an agent will.** Cabling a part is how it is used; it is what
all of these did and what no gate does.

## 2. How a part gets in today

```
 portrayal-vendor-intake      sources staged, PDFs converted (docling)
          |
 portrayal-model-device       docs/modelling-a-device.md: panel (gate 1), ears and kits (1b),
          |                   cutouts (2), silkscreen (3), components (4), audit against the
          |                   source twice (5)
          |
 ./build.sh --device <m>      lint (L1..L16x) on that device, render it
 devicelock.py                the version bump a change needs
 ./publish.sh --no-images     the build and the DCIM exports
 pytest spec/tests -n auto    after a build; reads library/dist (sharded in CI)
 preflight.py                 seconds, no build: exports, skips, private, changelog, lock, lint, kit, prose
          |
 portrayal-review             two passes: sources, then docs/review-standards.md
 portrayal-pr                 the body, with the gates run and the merge danger
          |
 CI (gates.yml)               lint; build and publish; devicelock; kit tests; 4 shards of the suite
```

What a modelled part is tested for today, by the checks that touch cabling or settings:

| check | what it holds |
|---|---|
| lint L-rules | a port has media; an indicator has `for:`; a cage's `accepts` come from the registry; the shape of the drawing |
| `test_connection_point_markers`, `test_connection_points_resolve` | a declared `mate`/`cable` point reaches the drawing and resolves to the right place |
| `test_cage_accepts`, `test_seated_ports_sweep` | the cages and bays list what the library could seat; the kit's catalogue-only answer for a port under a bay agrees with the drawing |
| `test_cable_ends_3d`, `test_*_plugs`, `test_fibre_ends_js` | the generic plugs build as solids and their `cable` point lands at the stub's far end |
| `rack-*.mjs` (the kit's tests) | the rack kit against **hand-built fixtures**: a fixture switch with `port-1`, a fixture PDU |
| `test_outlet_states_js`, `test_state_css` | an outlet's state reaches its lamp; a state rule is valid CSS |

Every one of these holds **one side** against **itself or a fixture**. Three gaps follow, and
they are the gaps in section 1.

1. **No test takes a real part and cables it.** The kit is exercised on fixtures with the
   ports the author of the fixture thought of. A part's rear, its modules, its terminals are
   never asked.
2. **No test compares the two readers.** The Explorer reads the drawing (`data-states`,
   through `statesOfEl`). The agent's tools read `configs.json` (`states`, through
   `configFacts`), which the build derives from the manifest by a different rule. Two readers
   of one fact, with nothing to say when they differ, is the shape of the LED fault.
3. **Nothing tells the modeller or the reviewer to cable the part.** Gate 5 is "put the render
   beside the reference at matched scale"; the review standards ask for the same. Neither asks
   for a rack, a cable and a route.

**Where the new check belongs.** It needs a build (it reads `library/dist`) and runs in
seconds per device, so it sits **after Gate 4 and before Gate 5** in the modeller's order, as
**Gate 4b**, and **in the CI suite** as a test over the parts a change touches. It cannot be a
lint rule: lint reads a manifest and this reads what the build made of it and what the kit
does with that.

## 3. The cabling check

### 3.1 What it generates from

Nothing is written per part. The check reads the build:

- `<device>.configs.json`: the configurations, the bays and what each accepts, the cages and
  what each accepts, the slots a cord or lug lands on, the connector slots with their `mate`.
- `<device>.<config>.<view>.elements.json`: every element a face draws, with its class, its
  `connection-points`, its box in the face's millimetres, its `states`. The back of a part
  seated in a bay is a row with `of` in place of `path`.
- `components.json`: each part's class, its parts, its `faces.rear` (the back of a seated
  part), its `cages`, its `fields`.
- `rack.json`: size, depth, mount (`rack`, `rack-face`, `rack-side`).

From these it lists **every place a cable can end**:

| end | where it is read from |
|---|---|
| a port, a jack, an SFP/QSFP cage | a drawn element of class `port` (outermost of its kind) |
| a cage **with each optic or cable it lists** | the cage's `accepts`, one fitted at a time through `fit` |
| an adapter face and a coupler side | the ports of a part seated in a bay, front, and the ports of its `faces.rear` |
| a power inlet, an outlet, a DC terminal's lug, a ground stud | a connector slot that takes a cable end (`cableLandsOn`) and a drawn element of class `inlet`, `terminal`, `ground`, `screw` |
| a supply's inlet | the ports of every drawn `psu` |
| a console, a management port | a port, like any other |
| every module, cassette and optic the device can hold | each ref in a bay's `accepts`, in turn, in the bay |
| a part beside the rack | `zeroUEnds`, from the catalogue |

### 3.2 Where it places the part

In a four-post frame of 42 units with the rails 740 mm apart: on the **front rail**, then on
the **rear rail with a 30 mm setback**. A part beside the rack stands at an upright. A copy of
the same part, with the same configuration and the same fittings, stands higher in the rack as
the far end, so the connector at the far end is the same by construction. An inlet is cabled
to the outlet of a rack PDU, and an outlet to the inlet of a switch with supplies.

### 3.3 What it asserts for each end

| code | assertion | 2D | 3D |
|---|---|---|---|
| C8 | every drawn port is offered to an agent (`list_free_ports`) | | |
| C9 | every port the agent is offered is drawn on that panel | | |
| C1 | a cable to the end is accepted when it is added | | |
| C2 | the added cable is **not** a loose end (the page's `looseReason`, settled with the catalogue) | | |
| C3 | the cable routes: a path of finite points | both | both |
| C4 | the route starts on the end's point (portPoint, within 1.5 mm) and the far one on the far end's | front, rear | yes |
| C5 | the first and last leg leave the end along its axis (cosine at least 0.97) | | yes |
| C13 | the plug's first leg is not inside the body of its own device (solids) | | yes |
| C6 | the end is inside the device in the front or rear pane | front, rear | |
| C7 | in the left and right panes the end is on the device's outline, at the panel's depth, with the setback | left, right | |
| C11 | a coupler's two sides: ends on the front **and** on the back, or declared otherwise | | |
| C18 | the back of a seated part has a point the host draws, or a declared closed back | | |
| C19, C20 | every supply, inlet, terminal and stud the drawing shows is a place a cord or lug lands | | |
| C14 | a mating point is declared for the end (`connection-points`); otherwise it is a **stand-in** and reported | | |
| C10 | a port on a tilted facet declares its axis | | yes |
| C15 | a made-up end is refused at add time (today it is accepted and flagged loose afterwards) | | |
| C16, C17 | each module and optic a bay or cage lists can be fitted and the end of it answered for | | |

C4 to C7 and C13 use the numbers the pages are handed: the route the kit lays is the one the
2-D panes and the 3-D scene draw. What none of them can judge from node: where a pane
**paints** the line (the site's own drawing code), and the shape of the plug in a cage (the
page reads it from the relief of the seated part). Those two are in section 9.

### 3.4 What the drawing must declare for this to be generated

Most of it is declared already. What is missing is listed here as a request to the library, not
as a thing the check works around.

| needed | today | proposed |
|---|---|---|
| **a mating point** for an end | `connection-points.mate {at, dir, face}` on tens of thousands of elements; absent on some ends (C14) | every end has one, or says it is a stand-in |
| **an axis** for an angled cage | only `dir` (`front`, `rear`, `down`); the tilt is a `data-tilt` on the group and is not in `connection-points` | `mate.axis: [dx, dy, dz]`, written by the build from the facet's angle, so a route can leave along it |
| **a coupler's pairing** | `faces.rear` links a module to its back; no front-to-back pairing for a copper keystone, only `optical.paths` for fibre | `through: {p1: b1}` for copper; the optical paths already pair fibre |
| **a polarity** | `optical.paths` carry it for fibre; no key for a copper pair | none needed until a copper part has a crossover |
| **a plug reach with an optic** | the plug's `cable` point; the optic's standing-out is in the relief only | the seated optic's `out` in `components.json`, so the reach is computed from data and not from the page |
| **a closed back** | an enclosure that draws no rear simply has none | `faces.rear: closed` (or a `gaps` entry), so C18 can tell a closed back from a forgotten one |

### 3.5 A part that cannot yet say

A stand-in is **never a silent pass**. Three forms, all visible in the report:

- an end with no declared mating point is a **`standin`** finding (C14), counted, never
  blocking, listed with its part;
- a port on a facet with no declared axis is a **`standin`** (C10);
- a thing the check cannot try (no far end of a matching type; no optic in the library for a
  cage) is a **`gap`** finding (C12, C16), counted and listed.

A stand-in becomes blocking only when a part claims `maturity: modelled` with more of them
than its declared exception allows (section 5.3).

## 4. The settings check

### 4.1 Everything a part can be set to

| settable | declared by | Explorer | Rack Builder page | kit command | agent tool |
|---|---|---|---|---|---|
| a lamp, a status digit, an outlet lamp, a breaker, a beacon | `states` on the part (`data-states` on the drawing) | a chip on the selected element (`statesOfEl`) | **no control**: states come from the file | `state.set` | the edit tool, `state.set` |
| an outlet on or off | `states` on the outlet | chip; the bound lamp follows (`expandStates`) | **no control** | `state.set` | the same |
| a display's whole reading | `messages` on the display (`data-messages`) | readings (`messagesOfEl`) | none | none (P-0042 adds `display.set` for text, digits and an image) | none |
| a field: a latch colour, an optic label, a DIP switch, a slide position | `fields` on the component | the field editor | through the lens: `patch {fields}` | `field`, `patch` | `field` |
| a seated part | `accepts` of a bay or cage | the picker | through the lens: `patch {swaps}` | `fit`, `patch` | `fit` |
| a configuration, turned, roll, setback | the device | the select | the inspector | `patch` | `patch` |
| readings | the device's metering | none | none | `readings.set` | the edit tool |

Two things this table shows that no one had written down. **The Rack Builder page has no
control that sets a lamp or an outlet**: a person sets one in the Explorer, which is not kept
in the rack, and the only thing that writes `states` into a rack document is the kit command,
which the agent's tool reaches. And **the agent's tools are the kit's command table**
(`COMMANDS` less the page's own and `dcim`), so a setting that has a command is reachable by
construction; what can differ is **what the command is willing to accept**, and that comes
from `configs.json`.

### 4.2 Why the LED gap happened

`stateRefusal` accepts a path only if it is in `facts.states`, which `configFacts` takes from
`configs[].states` in `<device>.configs.json`. The build wrote that map from placements whose
own `states` was a list: it skipped every `class: led` part, every mapping-form `states`, and
every module seated in a bay (whose lamps are not placements of the device). The Explorer
never looks at `configs.json`: it reads `data-states` off the drawing it has just drawn.
**One fact had two sources, and the Explorer's was the complete one.** A check that read the
two and compared them would have failed on the first LED.

### 4.3 The check

Three layers, each generated from the parts and the schema:

1. **The vocabularies are the same set** (S1, S2, S3): every (path, state) the drawings of a
   configuration declare is in the catalogue the agent is checked against, with the same
   states; nothing is in the catalogue that no drawing declares.
2. **The agent reaches each one** (S4, S5, S6, S9): for every path, `state.set` with its first
   state; for every distinct vocabulary, `state.set` with each of its states; every
   `field` a drawn part declares. Each is accepted, **the document it gives is the document
   the page writes** (the entry with that one key more), and `statesFor` keeps it on the way to
   the drawing.
3. **The drawing shows it** (S7): the stylesheet of the face has a rule that paints the state.
   Painting it, as pixels, is a browser check (section 9).

What the check cannot yet cover, and says so: a module the rack's own `swaps` put in a bay has
no lamps in `configs.json`; a display's whole readings have no command (S8).

### 4.4 What to take from the sibling project's tool-parity gate

The sibling project keeps a component contract with seven declared things, and a merge gate
of four tests, one of them **parity: every action a person can take has a registered tool
that does the same, and acts on every kind of address it names**. What is worth borrowing:

- **Inventory first.** Their actions are declared in a manifest and the gate walks the
  manifest. Here the inventory is **generated** from the build (the table in 4.1 is what the
  build already knows), so no one writes a manifest to forget.
- **A check that bites is part of the check.** Their gate carries a positive control and a
  planted fault ("the check bites: an action naming an unregistered tool is reported"). The
  test for this prototype does the same on a library built in the test: a good part is clean
  and each planted fault is found.
- **Parity on the address, not the name.** An action that says where it acts must name a tool
  that accepts that kind of address. The counterpart here is C8/C9 and S1: the agent must
  accept every *path* the page can name, and not only the kind of setting.
- **A waiver is a named row with a reason.** Their checklist allows "waived by name". Section
  5.3 does the same, with an order id.
- **It is a merge gate**, not a report.

Not borrowed: their parity is one-way (a UI action has a tool). Ours has to be **both ways**,
because the agent can write `states` and the page cannot (4.1).

## 5. The proposal

### 5.1 Where the checks run

| when | what | how long | blocks |
|---|---|---|---|
| **a library PR** | both checks over the parts the change touches: a changed device, and every device that reaches a changed component (preflight already works the set out for lint) | seconds to a minute, one build | the blocking codes |
| **every PR, cheaply** | the same runner over the fixed sample of 30, to catch a kit or schema change that breaks parity | see section 6 | the blocking codes |
| **on a schedule (nightly)** | the whole library, all configurations, all ends and every module and optic | see section 6 | nothing: it opens an issue when a count rises |
| **a kit or compiler PR** | the fixed sample; and the whole library on the PR if it touches `configs.json`, `elements.py`, `ports.js` or `states.js` | | the blocking codes |

It is a pytest module over `library/dist` (as `test_seated_ports_sweep` is), so it joins the
shards and the skip allow-list as they are; the touched set comes from the same function
preflight uses. `preflight.py` itself stays a no-build check: it gains one line, **WARN when a
device or component changed and no conformance report was run on the tree** (the report is
written by the test to a path preflight can read).

### 5.2 What blocks a merge and what only reports

| level | codes | effect |
|---|---|---|
| **block** | S1 to S7, S9, C1 to C9, C11, C13, C18, C19, C20 and any check that throws (C0, S0) | the test fails |
| **stand-in** | C10, C14 | reported with the part; counted; the count may not rise on a PR |
| **gap** | S8, C12, C16 | reported with the part; counted |
| **warn** | C15 | reported; becomes **block** the day the kit refuses a made-up end at add time (the open work for P-0045) |

### 5.3 How a known gap is declared

A gap is never a silent pass and never a comment. It is a row in
**`library/conformance-exceptions.yaml`**, one per (part, code):

```yaml
- part: fs/fhd-fapm6-rj45@1        # a device, or a component
  code: C11
  why: the keystone jack's rear is a punch-down the datasheet draws without a slot layout
  order: P-0045                    # the order that closes it; required
  since: 2026-10-15
```

Rules, each held by a test:

- an exception **names an order**; no order, no row;
- an exception **for a finding that no longer occurs is a failure** (it is stale), as a lint
  baseline entry is;
- an exception **is for a code that may be excepted** (not S1 to S6: an agent that refuses a
  state the page offers is never a declared gap);
- the number of rows **may not rise** without the review standards' "a waiver, a new allowed
  skip, a raised census cap" line applying;
- a **stand-in** is declared in the contract (`stand-in: [axis, mating-point]`), published to
  `components.json`, and the report lists it; a part may stand in for a thing at
  `maturity: modelled` only if it says so.

### 5.4 Changes to the pipeline's skills

Rule text, stated as a mechanism with its check (the form the modelling guide asks for):

1. **`docs/modelling-a-device.md`, a new Gate 4b after Gate 4.** *A part is used before it is
   believed. After the build, run `part_conformance.py --refs <model>`; it cables every end of
   every configuration, module and optic, and sets every state through the agent's command.
   Read the stand-ins and gaps it lists; each is either closed or has a row in
   `library/conformance-exceptions.yaml` with an order. Check: the report has no blocking
   finding and the numbers it walked (ends, states) are not zero.*
2. **`docs/modelling-a-device.md`, Gate 5, by name.** Add one line to the audit: *for each
   end the source names (a console, a DC input, a rear adapter), the conformance report lists
   it.* The callout walk then covers cabling the way it covers ports.
3. **`portrayal-model-device`.** One row in the table of gates (4b: *Can every end be
   cabled and every state set?* How: the runner), and one bullet under the rules: *a part that
   has a front has a back; a coupler's two sides are both written, or the missing one has a
   row*.
4. **`portrayal-review`.** Step 1 runs the runner on the touched parts after preflight and
   reads the report before the passes; the standards pass gains the stand-in and gap counts
   as a thing to question, not a violation.
5. **`docs/review-standards.md`.** Under "A device or a component": *the conformance report
   was run on this tree, and an exception is a row with an order, not a sentence.* Under "A
   test": a test that cables a part uses the real build for the part and a fixture only for
   the far end.
6. **`portrayal-pr`.** "Gates run locally" gains the runner and its counts; "Merge danger"
   gains: a change that raises the count of exceptions or stand-ins says so.
7. **`portrayal-vendor-intake`.** "Then" (the end) gains: *list the ends the sources name
   (rear adapters, a DC input, a console, an RJ45 behind a keystone) so the modeller's Gate 5
   has a list to check the report against.*
8. **`portrayal-retro`.** When a bug was found by a person cabling or lighting a rack, the
   candidate to propose is a *code* in the runner, not a fixture.
9. **`AGENTS.md`.** One pointer: the gate, the command.
10. **`CONTRIBUTING.md`.** The command in its place in the order CI runs them.

### 5.5 The work to a green library

See section 7: the failures found, grouped, with sizes.

### 5.6 What the site needs (described, not changed)

- **A browser conformance harness** for the two things node cannot judge: where a pane paints a
  cable's end (front, rear, left, right), and the plug in a cage (its relief). It would load
  the same sample, add the same cables through the page's own editor, and compare the
  painted line's end with the end's box. This is where "a device's setback is not drawn in
  the side views" would be caught for sure.
- **A rack-document control for lamps and outlets**, or a statement that there is none by
  design: today the Explorer's chips are not kept, and only the agent writes `states`.
- **A tool-description check:** the agent's tool descriptions list what each command takes, and
  the build's `settable` (P-0041) should reach the tool text, so an agent learns what a device
  can be set to without a refusal.
- **A parity test on the site** that every command in the kit's table (less `system` and
  `dcim`) is reachable through the edit tool's schema; it holds by construction today and
  nothing says so.

## 6. The prototype and what it found

`spec/tools/dev/part_conformance.py` (front door, `--out` for the report, never a redirect) and
`part_conformance.mjs` / `part_conformance_run.mjs` (the kit's work under node), with
`spec/tests/test_part_conformance.py`. Run on the library built from `origin/main`
(258 devices, 646 configurations); the sample is `part_conformance_sample.json` and its output
`docs/part-conformance-sample-report.json`. `--site <checkout>` additionally asks the site's own
side-pane geometry (read-only).

### 6.1 The faults, on `main` as it is

| fault | caught? | by | note |
|---|---|---|---|
| P-0045 keystone panel's rear | **yes** | C11 on `FHD-FAPM6-RJ45` in `fhd-1ube` | the part has ends on its front and a `faces.rear` of none |
| P-0047 fibre unit's rear adapters | **yes** | C18 and C2 on `xcu` (24 back ends the catalogue has and the host does not draw); the same on two FHD enclosures | **not** caught: "the body is solid in 3D" (C13 passes, because no route is laid to a point that does not exist). It needs the 3D scene's own solids |
| #1080 PDU network card | control: clean | C1/C2 on `evma8365x` pass | the check does not cry wolf on a fixed fault |
| P-0046 DC terminals | **yes** | C19 on 9 of the sample's parts (the DC configurations of `s9700-53dx`, `mx204`, `s9510-28dc`, `lmfs-f`, ...); C20 on `sr-1-dc`'s DC input and `300cb08`'s feed studs | |
| P-0048 angled cage, plug short of an optic | **partly** | C10 reports the six ports on a 36 degree facet of `nfxs-e-bb` with no axis (a stand-in) | the shortfall itself needs the seated optic's relief: not judged in node |
| P-0048 setback in the side views | **not reproduced** | C7 compares the kit's panel depth with the site's side-pane geometry (`origin/main`): it agrees, with and without a 30 mm setback, on `dinrail2u` and the rest | either the site already draws it on `main` or the fault is in painting, which only a browser can see |
| P-0041 LEDs, digits, lamps, breakers | **yes** | S1, S4: 25 of the sample's 32 parts, 202 of 258 devices; `evma8365x`: 98 of its 140 drawn states refused | the P-0041 change is not on `main` yet; the runner is the test it would have had |
| P-0042 display readings | **yes, as a gap** | S8 on `asr-9901` (a four-character display with eight readings) and two FS fan units; no command sets a reading | |

### 6.2 What else it found, on the sample of 32

`C19` on 9 parts, `C20` on 5, `C11` on 3 devices, `C18` on 1, `C2` on 3, `S9` on 1 (`300cb08`:
the DIP switches `dip-a`, `dip-b` are placed parts with fields, and `field` answers "Nothing is
seated at dip-a"; the Explorer sets them), `C15` on 30 of the 32, and stand-ins: `C14` on 6, `C10`
on 2.

### 6.3 What the runner is not

- It reads the drawings through `elements.json` and `configs.json`, not through the site's DOM
  reader, so a verdict that depends on a DOM quirk is not judged (the page's `portsOf`).
- It does not draw. A cable's line in a pane, and a plug in a cage, are the page's.
- A module the device can hold but no configuration builds has no drawing; it is judged from
  the catalogue alone (`seatedPort`), so its ends are not routed.
- C20 can flag a ground pad that is not a lug point, and C11 a one-sided backplane card that is
  one-sided by design. Both are what the exception file is for; neither was triaged here.

### 6.4 Time, for the budget

One node process, `nice -n 19`, under the heavy lock, on a shared host:

| run | parts | configurations | seconds |
|---|---|---|---|
| the sample | 32 | 71 | **11.1** (settings 0.2, cabling 10.2, every listed module and optic 0.4) |
| the whole library, 12 ends judged per configuration and rail | 258 | 646 | **89** |
| the whole library, every end | 258 | 646 | **307** |

It walked, in the 89 s run, about 14 000 cable ends (of 22 700 offered), 49 000 states, and 1 500
listed modules and optics with 2 050 of their ends. The whole library in one process is cheap
enough to run on **every** library PR: split over the four shards it is about 25 s of a
shard. The exhaustive run is the nightly one (5 minutes). The budget (rule 9) proposed: **the sample
under 15 s, the touched parts under 60 s, the whole library under 2 minutes, the exhaustive
run under 10**; a test that exceeds it names its reason or is split.

## 7. The work to a green library

What the whole-library run finds, grouped by the thing to do, with the size of each. A size is
the number of devices, parts or configurations a person would open, not hours.

| group | codes | found | what closes it | size |
|---|---|---|---|---|
| **A. The agent's catalogue of states** | S1, S4 | 202 devices, 570 configurations; 40 000 declared states, 49 000 refused | the build writes `configs.json` `states` from the drawings (the open P-0041 change); then the check passes by construction | **one change, already open**; re-run to confirm 0 |
| **B. Supplies and terminals with no cable end** | C19, C20 | C19: 120 devices over 46 supply models (most DC); C20: 29 devices (feed studs of the 300 series, ground pads and straps, `sr-1-dc`'s DC input) | give each supply model its inlet or terminals as connector slots (the DC terminal design already exists); decide which ground pads are lug points | **46 supply parts**, then **29 devices**; the biggest group |
| **C. Couplers with one side** | C11, C18 | 11 coupler models on 8 devices; 3 devices (204 back ends) with no point to draw | write the `faces.rear` for the FHD panels and the keystone panel; decide the 7 CH3000 backplane cards (declare one-sided); the nested-bay back of the fibre units needs the kit | **11 models**; **1 kit change** (nested-bay backs) |
| **D. Placed parts with fields** | S9 | 26 devices (DIP switches on the 300 series, fan trays, AIS) | let `field` address a placed part, not only a seated one | **1 kit change** |
| **E. Offered but not landing** | C2 | 6 devices (`ch3000` empty slots, server risers, `xcu`) | decide: the page's list should not offer an empty slot; nested module ports need the catalogue answer | **6 devices**, 1 or 2 kit changes |
| **F. Stand-ins** | C10, C14 | C10: 4 devices (all the angled cages); C14: 22 devices (monitor blocks, alarm cards, test points, ports of fibre panels) | write `mate.axis` in the build for a facet; declare mating points, or `stand-in` | **1 build change**; then **22 devices** |
| **G. Display readings** | S8 | 3 devices | a command for a display's whole reading | **1 command** (P-0042 does text and digits) |
| **H. A made-up end** | C15 | 250 devices (every one) | the kit refuses it at add time (the open P-0045 work) | **1 kit change**, closes all |

Groups A, D, G, H are kit or build changes: five changes in all, three of them open. B and C
are modelling, and are most of the work. Nothing in F or B has to wait for the whole library:
each part is excepted by name (5.3) until its order closes, so the check can start blocking on
**new** parts at once and the old ones burn down.

## 8. Order of work, if approved

1. Land the runner as a **report-only** test (blocks nothing), so every PR shows its counts.
2. Close A (P-0041) and H (P-0045); the counts for S1, S4, C15 go to zero.
3. Write `conformance-exceptions.yaml` for what is left in B to F, each row with an order, and
   turn the blocking codes on for **new and changed** parts.
4. Gate 4b and the skill texts of 5.4.
5. The nightly run and its issue.
6. The site harness (5.6), which closes the two things node cannot judge.

## 9. Open questions

- Is a rack PDU's outlet row (C20 ground pads, C11 backplanes) wanted as a landing place, or is
  "one-sided by design" the answer for them?
- Should C15 block now? It means refusing at add time, which the open P-0045 work does only for a
  seated part.
- Should the Rack Builder page gain a control for lamps and outlets (5.6), or is the agent
  meant to be the only way to write `states` into a rack?
