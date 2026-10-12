// A switch with an AC supply and a DC supply in its bays, a rail-mounted PDU
// with IEC outlets, and a PDU whose outlets are no slots: the catalogue as
// `loadSlots` hands it to the rack kit (configs.json and components.json, cut
// to what the rules read), and what a page reads off the drawings. The shapes
// are the library's: every supply composes `std/c14-inlet@1` as its part
// `inlet` and publishes it as a connector slot; a PDU's outlets are top-level
// placements of class `inlet`, each a connector slot whose path is its id; a
// NEMA 5-20R declares no interface and is no slot; the screws of a DC terminal
// are the slots, and the terminal is not.

import {looseReason} from '../../../kit/rack/cable-rules.js';

const comp = (ref, rest) => { const [ns, tail] = ref.split('/'), [name, major] = tail.split('@'); return {ns, name, major: `v${major}`, parts: [], cages: [], bays: {}, attrs: {}, ...rest}; };
const slot = (id, iface, accepts, rest = {}) => ({id, kind: 'connector', interface: iface, media: null, bores: [], accepts, default: null, ...rest});
const part = (id, ref) => ({id, ref});

export const C13 = 'generic/c13-plug@1', C14 = 'generic/c14-plug@1', C19 = 'generic/c19-plug@1', C20 = 'generic/c20-plug@1';
export const LUG = 'generic/ring-lug@1', RJ = 'generic/rj45-plug@1', SFP = 'generic/sfp-lc@1';
export const PSU_AC = 'acme/psu-ac@1', PSU_DC = 'acme/psu-dc@1', BREAKER = 'acme/breaker@1';

export const COMPONENTS = [
  // cable ends: class `port`, as every cord end and lug of the library is
  comp(C13, {class: 'port', mates: 'iec-c14', attrs: {connector: 'c13', media: 'c13'}}),
  comp(C14, {class: 'port', mates: 'iec-c13', attrs: {connector: 'c14', media: 'c14'}}),
  comp(C19, {class: 'port', mates: 'iec-c20', attrs: {connector: 'c19', media: 'c19'}}),
  comp(C20, {class: 'port', mates: 'iec-c19', attrs: {connector: 'c20', media: 'c20'}}),
  comp(LUG, {class: 'port', mates: 'terminal-stud', attrs: {connector: 'terminal-stud', media: 'ring-lug'}}),
  comp(RJ, {class: 'port', mates: 'rj45', attrs: {connector: 'rj45', media: 'rj45'}}),
  // a receptacle that takes two plugs, each stating its rating, as a 5-15/20R will
  comp('acme/plug-15a@1', {class: 'port', mates: 'acme-t-slot', attrs: {'rating-a': 15}}),
  comp('acme/plug-20a@1', {class: 'port', mates: 'acme-t-slot', attrs: {'rating-a': 20}}),
  // what is not a cable end
  comp(SFP, {class: 'transceiver', kind: 'module', attrs: {media: 'fiber', face: 'lc-duplex', mode: 'single-mode'}}),
  comp('acme/touch-guard@1', {class: 'mechanical', mates: 'breaker-guard'}),
  comp('common/lc-dust-cap@1', {class: 'cap', mates: 'lc'}),
  // receptacles: class `inlet` whether they hand power on or take it
  comp('std/c14-inlet@1', {class: 'inlet', interface: 'iec-c14', attrs: {input: 'ac', media: 'ac'}}),
  comp('std/c20-inlet@1', {class: 'inlet', interface: 'iec-c20', attrs: {input: 'ac', media: 'ac'}}),
  comp('std/c13-outlet@1', {class: 'inlet', interface: 'iec-c13', attrs: {outlet: 'iec-60320-c13', 'rating-a': 10}}),
  comp('std/c19-outlet@1', {class: 'inlet', interface: 'iec-c19', attrs: {outlet: 'iec-60320-c19', 'rating-a': 16}}),
  comp('std/nema-5-20r@1', {class: 'inlet', attrs: {accepts: '5-15P, 5-20P', outlet: 'nema-5-20r', 'rating-a': 20, model: 'NEMA 5-20R'}}),
  comp('acme/t-slot-outlet@1', {class: 'inlet', interface: 'acme-t-slot', attrs: {outlet: 'acme-t-slot'}}),
  comp('acme/fixed-cord@1', {class: 'inlet', attrs: {plug: 'nema-l5-20p', model: 'FIXED CORD'}}),
  comp('common/ground-stud@1', {class: 'ground', interface: 'terminal-stud'}),
  comp('common/terminal-screw@1', {class: 'screw', interface: 'terminal-stud'}),
  comp('common/dc-terminal@1', {class: 'inlet', attrs: {media: 'dc-terminal', model: 'DC TERMINAL'},
    parts: [part('lug-1', 'common/terminal-screw@1'), part('lug-2', 'common/terminal-screw@1'), part('lug-10', 'common/terminal-screw@1')],
    cages: [slot('lug-1', 'terminal-stud', [LUG]), slot('lug-2', 'terminal-stud', [LUG]), slot('lug-10', 'terminal-stud', [LUG])]}),
  comp('common/led-dot@1', {class: 'led'}),
  comp('std/rj45@1', {class: 'port', interface: 'rj45', attrs: {media: 'rj45'}}),
  // supplies
  comp(PSU_AC, {class: 'psu', kind: 'module', attrs: {model: 'PSU-AC', input: 'ac', inlet: 'c14'}, description: 'Acme PSU-AC - 550 W AC supply.',
    parts: [part('inlet', 'std/c14-inlet@1'), part('led', 'common/led-dot@1')], cages: [slot('inlet', 'iec-c14', [C13])]}),
  comp(PSU_DC, {class: 'psu', kind: 'module', attrs: {model: 'PSU-DC', input: 'dc'}, description: 'Acme PSU-DC - 550 W DC supply.',
    parts: [part('terminal', 'common/dc-terminal@1'), part('art', 'acme/fixed-cord@1')], cages: []}),
  // a breaker whose one slot takes a guard, not a cable
  comp(BREAKER, {class: 'breaker', kind: 'module', attrs: {model: 'BRK'}, description: 'Acme BRK - a breaker.',
    parts: [part('guard', 'acme/guard-seat@1')], cages: [slot('guard', 'breaker-guard', ['acme/touch-guard@1'])]}),
  comp('acme/guard-seat@1', {class: 'mechanical', interface: 'breaker-guard'}),
];

const bay = (id, accepts, def = null) => ({id, group: 'bays', accepts, default: def});
export const SLOTS = {
  // a switch: supply bays and a breaker bay at the rear; a cage, a jack and a blind slot on the front; ground studs.
  // psu-3 is filled by its default alone, as most supply bays of the library are: no configuration names it.
  sw: {default: 'base', 'pdu-class': null,
       bays: {front: [], rear: [bay('psu-1', [PSU_AC, PSU_DC]), bay('psu-2', [PSU_AC, PSU_DC]), bay('brk-1', [BREAKER]), bay('psu-3', [PSU_AC], PSU_AC)]},
       cages: {front: [{id: 'port-1', kind: 'cage', group: 'sfp', interface: 'sfp', media: 'sfp', accepts: [SFP], default: null},
                       slot('rj-1', 'rj45', [RJ]), slot('blind-1', 'acme-blind', []), slot('fibre-1', 'lc', ['common/lc-dust-cap@1'])],
               rear: [slot('ground', 'terminal-stud', [LUG])], left: [slot('ground-left', 'terminal-stud', [LUG])]},
       configs: [{name: 'base', description: '', airflow: 'front-to-back', bays: {'psu-1': PSU_AC, 'psu-2': PSU_DC, 'brk-1': BREAKER}, occupants: {}}]},
  // a rail-mounted PDU with IEC outlets: every outlet and the inlet a top-level connector slot
  pdu: {default: 'base', 'pdu-class': 'basic', bays: {front: [], rear: []},
        cages: {front: [slot('outlet-front-1', 'iec-c13', [C14]), slot('outlet-front-2', 'iec-c13', [C14])],
                rear: [slot('input', 'iec-c20', [C19]), slot('outlet-rear-1', 'iec-c19', [C20]),
                       slot('outlet-rear-2', 'acme-t-slot', ['acme/plug-20a@1', 'acme/plug-15a@1']), slot('ground', 'terminal-stud', [LUG])]},
        configs: [{name: 'base', description: '', airflow: 'passive', bays: {}, occupants: {}}]},
  // a PDU whose outlets declare no interface: nothing is a slot
  nema: {default: 'base', 'pdu-class': 'managed', bays: {front: [], rear: []}, cages: {front: [], rear: []},
         configs: [{name: 'base', description: '', airflow: 'passive', bays: {}, occupants: {}}]},
};
export const SIZES = {sw: {ru: 1, w: 438, h: 43.6, d: 400, model: 'SW', manufacturer: 'Acme', kind: 'switch', configs: ['base'], default: 'base'},
                      pdu: {ru: 1, w: 434, h: 44.45, d: 108, model: 'PDU-IEC', manufacturer: 'Acme', kind: 'pdu', configs: ['base'], default: 'base'},
                      nema: {ru: 1, w: 434, h: 44.45, d: 108, model: 'PDU-NEMA', manufacturer: 'Acme', kind: 'pdu', configs: ['base'], default: 'base'}};
const byRef = new Map(COMPONENTS.map(c => [`${c.ns}/${c.name}@${c.major.slice(1)}`, c]));
export const chassisOf = ref => SIZES[ref] || null;
export const compByRef = ref => (ref == null ? null : byRef.get(String(ref).split(':')[0]) ?? null);
export const ctx = {chassisOf, slotsOf: ref => SLOTS[ref] ?? null, compByRef};

// WHAT IS DRAWN, per device and panel: {path: [class, ref, data-media]}. A
// seated part's own parts are at `<bay>/module/<part>`.
export const DRAWN = {
  sw: {front: {'port-1': ['port', 'std/sfp@1', 'sfp'], 'rj-1': ['port', 'std/rj45@1', 'rj45'], 'blind-1': ['mechanical', null, null],
               'fibre-1': ['mechanical', null, null]},
       rear: {'psu-1': ['bay', null, null], 'psu-1/module': ['psu', PSU_AC, null], 'psu-1/module/inlet': ['inlet', 'std/c14-inlet@1', 'ac'],
              'psu-1/module/led': ['led', 'common/led-dot@1', null],
              'psu-2': ['bay', null, null], 'psu-2/module': ['psu', PSU_DC, null], 'psu-2/module/terminal': ['inlet', 'common/dc-terminal@1', 'dc-terminal'],
              'psu-2/module/terminal/lug-1': ['screw', 'common/terminal-screw@1', null], 'psu-2/module/terminal/lug-2': ['screw', 'common/terminal-screw@1', null],
              'psu-2/module/terminal/lug-10': ['screw', 'common/terminal-screw@1', null],
              'psu-3': ['bay', null, null], 'psu-3/module': ['psu', PSU_AC, null], 'psu-3/module/inlet': ['inlet', 'std/c14-inlet@1', 'ac'],
              'psu-3/module/led': ['led', 'common/led-dot@1', null],
              'brk-1': ['bay', null, null], 'brk-1/module': ['breaker', BREAKER, null], 'brk-1/module/guard': ['mechanical', 'acme/guard-seat@1', null],
              ground: ['ground', 'common/ground-stud@1', null]}},
  pdu: {front: {'outlet-front-1': ['inlet', 'std/c13-outlet@1', null], 'outlet-front-2': ['inlet', 'std/c13-outlet@1', null]},
        rear: {input: ['inlet', 'std/c20-inlet@1', 'ac'], 'outlet-rear-1': ['inlet', 'std/c19-outlet@1', null],
               'outlet-rear-2': ['inlet', 'acme/t-slot-outlet@1', null], ground: ['ground', 'common/ground-stud@1', null]}},
  nema: {front: {}, rear: {'outlet-9': ['inlet', 'std/nema-5-20r@1', null], input: ['inlet', 'acme/fixed-cord@1', null]}},
};
const strip = path => String(path).split('-occupant')[0];
// The component drawn at an end's path: `ctx.drawnAt`, as ports.js ownSlot documents it.
export const drawnAt = rack => end => DRAWN[rack.items.find(i => i.id === end.item)?.ref]?.[end.view]?.[strip(end.path)]?.[1] ?? null;

// A PAGE THAT KNOWS CLASS `port` ALONE, as every page did: a port is drawn at
// the path when the element there is of class `port`. `cableFacts(rack, extra)`.
export const oldPage = () => async (rack, extra = []) => {
  const ends = new Map();
  for (const end of [...(rack.cables || []).flatMap(c => [c.a, c.b]), ...extra]) {
    const item = rack.items.find(i => i.id === end.item);
    if (!item) { ends.set(`${end.item}|${end.view}|${end.path}`, {facts: {item: false}, info: {family: null, mode: null}, reason: 'the device was removed'}); continue; }
    const el = DRAWN[item.ref]?.[end.view]?.[end.path] ?? null;
    const cut = end.path.lastIndexOf('/module/'), bayPath = cut < 0 ? null : end.path.slice(0, cut);
    const card = bayPath ? DRAWN[item.ref]?.[end.view]?.[`${bayPath}/module`] : null;
    const facts = {item: true, drawing: true, port: el?.[0] === 'port', cage: end.path === 'port-1', occupied: false,
                   holder: bayPath ? {path: bayPath, part: card ? compByRef(card[1])?.attrs?.model ?? null : null} : null};
    const info = el?.[0] === 'port' && el[2] === 'rj45' ? {family: 'copper', mode: null} : {family: null, mode: null};
    ends.set(`${end.item}|${end.view}|${end.path}`, {facts, info, reason: looseReason(end, facts)});
  }
  return {seats: {}, ends};
};

// The zones of one panel as zones.js readSvg gives them for `ends`: the ports,
// the bays, and the slots a cable lands on (`end: true`, with `ref`).
export const zonesOf = (ref, view, ends = []) => Object.entries(DRAWN[ref]?.[view] || {})
  .filter(([path, [cls]]) => cls === 'port' || cls === 'bay' || ends.includes(path))
  .map(([path, [cls, r, media]]) => ({id: path.split('/').join('--'), cls, path, ...(cls !== 'port' && cls !== 'bay' ? {end: true, ref: r} : {}),
                                       group: null, media, speed: null, model: null}));
