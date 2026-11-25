# Stickers

`manifest.json` lists every sticker with its category, label and licence.

| Folder | Source | Commit | Licence |
|---|---|---|---|
| `fluent-color/`, `fluent-flat/` | https://github.com/microsoft/fluentui-emoji | `1ffb34c752ecf5d402f04cfb4b392c77f57c54bc` | MIT |
| `tabler-icons/` | https://github.com/tabler/tabler-icons | `58f60538fe2fab2e1459a09198f9bd3b033bf90e` | MIT |
| `illustrations/opendoodles/` | https://www.opendoodles.com | — | CC0 1.0 |
| `illustrations/kenney-*/` | https://kenney.nl/assets | — | CC0 1.0 |
| `blum/`, `blum-doodles/` | Made for Blum Studio | — | CC0 1.0 |

The MIT licence texts are in `fluent-color/LICENSE`, `fluent-flat/LICENSE`
and `tabler-icons/`.

## What changed from upstream

- SVG files are sanitised: no scripts, comments or external links.
- Fluent Emoji: only the Color and Flat variants, only the default skin tone,
  no country flags and no brand logos.
- Tabler Icons: `currentColor` is replaced by `#1b1b1f` and `white` by
  `#ffffff`, so the editor can recolour them.
- `blum-doodles/` use a single `#2B2118` stroke, recoloured by the `tint`
  field.

`blum/`, `blum-doodles/` and `tabler-icons/` are inlined as SVG and can be
recoloured (`"kind": "svg"` in the manifest). The other packs are drawn as
images (`"kind": "image"`).

## Adding a sticker

Take the SVG from one of the sources above, at the pinned commit. Sanitise it,
put it in its pack's folder and add an entry to `manifest.json`. Any other
source needs a verified permissive licence, with its licence file in the pack.
