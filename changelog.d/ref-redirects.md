### Added
- **`@portrayal/kit` is 0.32.0: a part the library replaced leaves a
  redirect** (#1049). A saved rack that names a removed major (the Fibrain
  HD holders of `@1`, #1046) used to lose the part without a word: the slot
  refused the ref, the swap was ignored, its cables went loose, and the next
  edit that wrote back what a slot accepts dropped the entry. The
  replacement now says which refs it stands in for, `rack/catalog.js`
  `loadSlots` returns the table as `redirects`, and `kit/redirects.js` follows
  it. **A plain load and save changes nothing on disk.** The first edit that
  lands writes the new ref wherever the rack named an old one (every device
  and every part beside the rack), in the same undo step, and its first
  finding says so. A ref that is gone and redirected nowhere is kept as
  written and named ("... is no longer in the library"), never replaced by
  the slot's default.
- **`supersedes:` is a new key of a component contract** and of its
  `components.json` entry (`[]` on every other row): a list of
  `{ref, signature, from}`. The signature is the hash of the removed part's
  published form (its slots, the ids of its parts, its faces, its fibre
  paths), recorded once from the tree at `from` and recomputed from the
  replacement at every build: a replacement that stops being a drop-in stops
  the build. `python -m portrayal.redirects sign` prints one. **L184** checks
  the shape: a listed ref is not the part itself, is not in the library any
  more, and is listed once. The forty `fibrain/xmi*` and `xmn*` holder and
  rear-face refs of #1046 (`@1`) are the first redirects, onto their `@2`.
  Each of those contracts gains the key and nothing else.
