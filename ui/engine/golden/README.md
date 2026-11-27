# Engine golden cases

`cases.json` holds the engine's reference behaviour, recorded from the former
C++ engine (lint cases updated on purpose since). `ui/engine/engine.test.ts`
replays every case through the real engine (`npm run test:engine`) and needs a
deep-equal result. Only the tests read this file: the app never loads it and it
is not shipped on npm.

## What a case holds

| Field | Meaning |
|---|---|
| `name` | `group: what it checks`. |
| `design` | The input design. |
| `ops` | Ops applied to it with `applyOps` (absent for snap cases). |
| `snap` | Instead of ops: drag item `id` by `dx`, `dy` with `snapMoveAt`. |
| `validate`, `lint` | Expected validation errors and lint report of the input. |
| `result` | `{ design }` after the ops, `{ snap }` for a snap, or `{ error }` with the exact `EngineError` message. |
| `result_validate`, `result_lint` | Expected validation and lint of the result design. |

Every case also checks that the input design is left untouched.

## When a case fails

A failing case means the engine's behaviour changed. Fix the code, unless the
new result is the correct one: then update that case by hand and say which
case and why in the commit. Never regenerate the whole file from the current
engine, that would bless bugs along with the intended changes.

This list is generated from `cases.json`: regenerate it when cases are added,
renamed or removed.

## The 495 cases

Columns: the input (ops or snap), the expected outcome, and the expected lint
score with its checks (of the result when ops apply, else of the input).

### core (26)

Basic engine behaviour: validation, edits, groups, alignment, photos, lint.

| Case | Input | Expected | Lint |
|---|---|---|---|
| empty story validates | no op | applies | 92 (empty_design) |
| bad format | no op | error: format must be one of story\|post\|square\|landscape\|a6\|a5\|a4\|a3\|a6-land… | 92 (empty_design) |
| add+update+remove | `add`, `update`, `remove` | applies | 92 (empty_design) |
| stops at first error | `add`, `update` | error: unknown item 'missing' | 92 (empty_design) |
| unknown op | `explode` | error: unknown op 'explode' | 92 (empty_design) |
| unknown update field | `update` | error: update 't1': unknown field 'nope' for this item type | 100 |
| locked blocks update | `update` | error: item 't1' is locked | 100 |
| locked blocks remove | `remove` | error: item 't1' is locked | 100 |
| group then ungroup | `group`, `ungroup` | applies | 100 |
| align top | `align` | applies | 100 |
| bad align mode | `align` | error: align must be left\|center-x\|right\|top\|center-y\|bottom | 100 |
| duplicate then reorder back | `duplicate`, `reorder` | applies | 100 |
| duplicate group renames children | `duplicate` | applies | 100 |
| photo fit contain | `update` | applies | 92 (photo_empty) |
| photo bad fit | `update` | error: update 'ph': fit must be cover\|contain | 92 (photo_empty) |
| photo arch ok | `add` | applies | 100 |
| photo star mask accepted | `add` | applies | 100 |
| photo mask blob accepted | `update` | applies | 92 (photo_empty) |
| photo mask circle | `update` | applies | 92 (photo_empty) |
| tiny text lint | no op | applies | 92 (text_too_small) |
| clean lint score 100 | no op | applies | 100 |
| photo empty warns | no op | applies | 92 (photo_empty) |
| photo visitor info | no op | applies | 100 (photo_empty) |
| grouped lint absolute | no op | applies | 92 (overlap) |
| accents survive | `add` | applies | 100 |
| int patch numbers | `update` | applies | 92 (off_canvas) |

### fields (1)

Visitor fields (designs with fillable slots).

| Case | Input | Expected | Lint |
|---|---|---|---|
| visitor design | no op | applies | 92 (unsafe_zone) |

### text (24)

Text properties: curves, lists, decoration, shrink-to-fit, effects, weights.

| Case | Input | Expected | Lint |
|---|---|---|---|
| curve up | `update` | applies | 100 |
| bad curve | `update` | error: update 't1': curve must be none\|up\|down | 100 |
| bad curveAmount | `update` | error: update 't1': curveAmount must be within 0..400 | 100 |
| list none | `update` | applies | 100 |
| list bullet | `update` | applies | 100 |
| list numbered | `update` | applies | 100 |
| bad list | `update` | error: update 't1': list must be none\|bullet\|numbered | 100 |
| strike+underline | `update` | applies | 100 |
| strike wrong type | `update` | error: update 't1': field 'strikethrough' needs true/false | 100 |
| shrink flags | `update` | applies | 100 |
| bad minSize | `update` | error: update 't1': minSize must be within 0..1000 | 100 |
| full effects | `update` | applies | 100 |
| bad shadowColor | `update` | error: update 't1': bad color 'nope' | 100 |
| bad strokeWidth | `update` | error: update 't1': strokeWidth must be within 0..60 | 100 |
| bad shadowBlur | `update` | error: update 't1': shadowBlur must be within 0..200 | 100 |
| bad haloBlur | `update` | error: update 't1': haloBlur must be within 0..200 | 100 |
| hollow wrong type | `update` | error: update 't1': field 'hollow' needs true/false | 100 |
| weight 300 | `update` | applies | 100 |
| weight 500 | `update` | applies | 100 |
| weight 600 | `update` | applies | 100 |
| weight 800 | `update` | applies | 100 |
| weight 900 | `update` | applies | 100 |
| weight low | `update` | error: update 't1': weight must be within 100..900 | 100 |
| weight high | `update` | error: update 't1': weight must be within 100..900 | 100 |

### fx (19)

Shadows and photo/image filters.

| Case | Input | Expected | Lint |
|---|---|---|---|
| shape shadow | `update` | applies | 100 |
| shape bad shadow color | `update` | error: update 's': bad color 'nope' | 100 |
| shape shadowBlur high | `update` | error: update 's': shadowBlur must be within 0..200 | 100 |
| shape shadowX high | `update` | error: update 's': field 'shadowX' must be within -500..500 | 100 |
| shape shadowColor number | `update` | error: update 's': field 'shadowColor' needs text | 100 |
| sticker shadow | `update` | applies | 100 |
| sticker shadowY low | `update` | error: update 'k': field 'shadowY' must be within -500..500 | 100 |
| group shadow | `update` | applies | 100 |
| group shadowBlur high | `update` | error: update 'G1': shadowBlur must be within 0..200 | 100 |
| photo full filters | `update` | applies | 100 |
| photo bad preset | `update` | error: update 'p': filterPreset must be original\|vivid\|warm\|cold\|mono\|noir\|f… | 100 |
| photo brightness high | `update` | error: update 'p': field 'brightness' must be within -100..100 | 100 |
| photo hue high | `update` | error: update 'p': field 'hue' must be within -180..180 | 100 |
| photo blur high | `update` | error: update 'p': field 'blur' must be within 0..100 | 100 |
| photo vignette low | `update` | error: update 'p': field 'vignette' must be within 0..100 | 100 |
| photo grayscale text | `update` | error: update 'p': field 'grayscale' needs true/false | 100 |
| photo sepia number | `update` | error: update 'p': field 'sepia' needs true/false | 100 |
| image noir+grayscale | `update` | applies | 100 |
| image bad preset | `update` | error: update 'i': filterPreset must be original\|vivid\|warm\|cold\|mono\|noir\|f… | 100 |

### opts (20)

Shape options: arrows, lines, stars, polygons, caps.

| Case | Input | Expected | Lint |
|---|---|---|---|
| arrow full | `update` | applies | 100 |
| line bend+dotted | `update` | applies | 100 |
| dotted bend+dotted | `update` | applies | 100 |
| doubleArrow bend+dotted | `update` | applies | 100 |
| star points+ratio | `update` | applies | 100 |
| polygon sides | `update` | applies | 100 |
| blockArrow valid | no op | applies | 100 |
| bend high | `update` | error: update 's': bend must be within -1..1 | 100 |
| headSize high | `update` | error: update 's': headSize must be within 0..500 | 100 |
| lineStyle wavy | `update` | error: update 's': lineStyle must be solid\|dashed\|dotted | 100 |
| points low | `update` | error: update 's': field 'points' must be a whole number within 3..12 | 100 |
| innerRatio low | `update` | error: update 's': innerRatio must be within 0.1..0.95 | 100 |
| sides low | `update` | error: update 's': field 'sides' must be a whole number within 3..12 | 100 |
| caps none | `update` | applies | 100 |
| caps arrow | `update` | applies | 100 |
| caps triangle | `update` | applies | 100 |
| caps circle | `update` | applies | 100 |
| caps square | `update` | applies | 100 |
| caps bar | `update` | applies | 100 |
| bad endCap | `update` | error: update 's': endCap must be none\|arrow\|triangle\|circle\|square\|bar | 100 |

### shapes (44)

Every shape kind validates; unknown kinds fail.

| Case | Input | Expected | Lint |
|---|---|---|---|
| rect validates | no op | applies | 100 |
| ellipse validates | no op | applies | 100 |
| triangle validates | no op | applies | 100 |
| line validates | no op | applies | 100 |
| star validates | no op | applies | 100 |
| diamond validates | no op | applies | 100 |
| separator validates | no op | applies | 100 |
| frame validates | no op | applies | 100 |
| rounded validates | no op | applies | 100 |
| polygon validates | no op | applies | 100 |
| arrow validates | no op | applies | 100 |
| doubleArrow validates | no op | applies | 100 |
| dotted validates | no op | applies | 100 |
| heart validates | no op | applies | 100 |
| bubble validates | no op | applies | 100 |
| cross validates | no op | applies | 100 |
| trapezoid validates | no op | applies | 100 |
| parallelogram validates | no op | applies | 100 |
| ring validates | no op | applies | 100 |
| cloud validates | no op | applies | 100 |
| bolt validates | no op | applies | 100 |
| blockArrow validates | no op | applies | 100 |
| unknown shape refused | `add` | error: item: 's' bad shape 'hexagon' | 92 (empty_design) |
| stroke fields | `update` | applies | 100 |
| bad stroke color | `update` | error: update 'r': bad color 'red' | 100 |
| gradient fill | `add`, `update` | applies | 100 |
| thin gradient refused | `update` | error: update 'r': gradient fill needs at least 2 stops | 100 |
| zero-stop fill refused | `update` | error: update 'r': gradient fill needs at least 2 stops | 100 |
| 3 stops wild angle | `update` | applies | 100 |
| edge {'width': 0} invalid | no op | error: item: 's' needs 0 < w,h <= 10000 | 100 |
| add edge {'width': 0} refused | `add` | error: item: 's' needs 0 < w,h <= 10000 | 92 (empty_design) |
| edge {'height': 0} invalid | no op | error: item: 's' needs 0 < w,h <= 10000 | 100 |
| add edge {'height': 0} refused | `add` | error: item: 's' needs 0 < w,h <= 10000 | 92 (empty_design) |
| edge {'width': -5} invalid | no op | error: item: 's' needs 0 < w,h <= 10000 | 100 |
| add edge {'width': -5} refused | `add` | error: item: 's' needs 0 < w,h <= 10000 | 92 (empty_design) |
| edge {'width': 10001} invalid | no op | error: item: 's' needs 0 < w,h <= 10000 | 100 |
| add edge {'width': 10001} refused | `add` | error: item: 's' needs 0 < w,h <= 10000 | 92 (empty_design) |
| negative stroke invalid | no op | error: item: 's' stroke width must be 0..500 | 100 |
| add negative stroke refused | `add` | error: item: 's' stroke width must be 0..500 | 92 (empty_design) |
| ok {'stroke': '#ffffff'} | `update` | applies | 100 |
| ok {'strokeWidth': 8.0} | `update` | applies | 100 |
| ok {'cornerRadius': 500.0} | `update` | applies | 100 |
| ok {'fill': '#abc'} | `update` | applies | 100 |
| cornerRadius update cap | `update` | error: update 'r': field 'cornerRadius' must be within 0..500 | 100 |

### bg (12)

Backgrounds: flat, gradient, image.

| Case | Input | Expected | Lint |
|---|---|---|---|
| color ok 0 | no op | applies | 92 (empty_design) |
| gradient ok 1 | no op | applies | 92 (empty_design) |
| pattern ok 2 | no op | applies | 92 (empty_design) |
| pattern ok 3 | no op | applies | 92 (empty_design) |
| image ok 4 | no op | applies | 92 (empty_design) |
| bad 0 | no op | error: background kind must be color\|gradient\|pattern\|image | 92 (empty_design) |
| bad 1 | no op | error: background pattern must be dots\|grid\|stripes\|checker\|waves\|crosses\|zi… | 92 (empty_design) |
| bad 2 | no op | error: bad background pattern color | 92 (empty_design) |
| bad 3 | no op | error: background image needs a source | 92 (empty_design) |
| bad 4 | no op | error: background gradient needs at least 2 stops | 92 (empty_design) |
| tie-dye kind refused | `set_background` | error: background kind must be color\|gradient\|pattern\|image | 92 (empty_design) |
| pattern round trip | `set_background`, `set_background` | applies | 92 (empty_design) |

### pattern (16)

Background patterns and their settings.

| Case | Input | Expected | Lint |
|---|---|---|---|
| zigzag valid | `set_background` | applies | 92 (empty_design) |
| triangles valid | `set_background` | applies | 92 (empty_design) |
| hexagons valid | `set_background` | applies | 92 (empty_design) |
| diamonds valid | `set_background` | applies | 92 (empty_design) |
| scallops valid | `set_background` | applies | 92 (empty_design) |
| bricks valid | `set_background` | applies | 92 (empty_design) |
| hearts valid | `set_background` | applies | 92 (empty_design) |
| stars valid | `set_background` | applies | 92 (empty_design) |
| settings round trip | `set_background` | applies | 92 (empty_design) |
| bad 0 refused | `set_background` | error: background pattern must be dots\|grid\|stripes\|checker\|waves\|crosses\|zi… | 92 (empty_design) |
| bad 1 refused | `set_background` | error: background pattern scale must be within 0.25..4 | 92 (empty_design) |
| bad 2 refused | `set_background` | error: background pattern scale must be within 0.25..4 | 92 (empty_design) |
| bad 3 refused | `set_background` | error: background pattern angle must be within 0..360 | 92 (empty_design) |
| bad 4 refused | `set_background` | error: background pattern angle must be within 0..360 | 92 (empty_design) |
| bad 5 refused | `set_background` | error: background pattern weight must be within 0.25..4 | 92 (empty_design) |
| bad 6 refused | `set_background` | error: background pattern weight must be within 0.25..4 | 92 (empty_design) |

### compact (3)

Compact JSON: default values stay out of the file.

| Case | Input | Expected | Lint |
|---|---|---|---|
| group update | `update`, `group` | applies | 92 (off_canvas) |
| arrange column | `arrange` | applies | 100 |
| arrange no layout | `arrange` | error: arrange needs a layout | 100 |

### mcp (4)

Cases recorded from MCP tool calls.

| Case | Input | Expected | Lint |
|---|---|---|---|
| batch add+update | `add`, `update` | applies | 92 (off_canvas) |
| lock cycle | `add`, `lock`, `lock` | applies | 100 |
| cafe story placeholder | `add`, `lock`, `lock` | applies | 100 |
| cafe story | `set_background`, `add`, `lock`, `lock` | applies | 100 |

### add (37)

The add op: every item type, bad items refused.

| Case | Input | Expected | Lint |
|---|---|---|---|
| full text | `add` | applies | 100 |
| shape rect | `add` | applies | 100 |
| shape ellipse | `add` | applies | 100 |
| shape triangle | `add` | applies | 100 |
| shape line | `add` | applies | 100 |
| shape star | `add` | applies | 100 |
| shape diamond | `add` | applies | 100 |
| shape separator | `add` | applies | 100 |
| shape frame | `add` | applies | 100 |
| shape rounded | `add` | applies | 100 |
| shape polygon | `add` | applies | 100 |
| shape arrow | `add` | applies | 100 |
| shape doubleArrow | `add` | applies | 100 |
| shape dotted | `add` | applies | 100 |
| shape heart | `add` | applies | 100 |
| shape bubble | `add` | applies | 100 |
| shape cross | `add` | applies | 100 |
| shape trapezoid | `add` | applies | 100 |
| shape parallelogram | `add` | applies | 100 |
| shape ring | `add` | applies | 100 |
| shape cloud | `add` | applies | 100 |
| shape bolt | `add` | applies | 100 |
| shape blockArrow | `add` | applies | 100 |
| line full options | `add` | applies | 100 |
| star full options | `add` | applies | 100 |
| polygon sides | `add` | applies | 100 |
| full image | `add` | applies | 100 |
| full sticker | `add` | applies | 100 |
| full photo | `add` | applies | 100 |
| group with children | `add` | applies | 76 (off_canvas, overlap) |
| missing item | `add` | error: add needs an item | 92 (empty_design) |
| missing id | `add` | error: add needs an item id | 92 (empty_design) |
| duplicate id | `add` | error: duplicate item id 't1' | 100 |
| unknown type | `add` | error: unknown item type | 92 (empty_design) |
| invalid item | `add` | error: item: 's' bad shape 'hexagon' | 92 (empty_design) |
| empty image src | `add` | error: item: 'im' image src is empty | 92 (empty_design) |
| empty sticker | `add` | error: item: 'st' sticker id is empty | 92 (empty_design) |

### update (37)

The update op: every patch field, bad values refused.

| Case | Input | Expected | Lint |
|---|---|---|---|
| missing item | `update` | error: unknown item 'ghost' | 100 |
| text x as text | `update` | error: update 't1': field 'x' needs a number | 100 |
| text size as bool | `update` | error: update 't1': field 'size' needs a number | 100 |
| italic as number | `update` | error: update 't1': field 'italic' needs true/false | 100 |
| weight as float | `update` | error: update 't1': field 'weight' needs a number | 100 |
| weight as text | `update` | error: update 't1': field 'weight' needs a number | 100 |
| name+locked+visible | `update` | applies | 92 (empty_design) |
| locked as text | `update` | error: update 't1': field 'locked' needs true/false | 100 |
| opacity high | `update` | error: update 't1': opacity must be within 0..1 | 100 |
| width text | `update` | error: update 't1': field 'width' needs a number | 100 |
| text unknown field | `update` | error: update 't1': unknown field 'src' for this item type | 100 |
| field key bad | `update` | error: update 't1': bad visitor field key '9bad' | 100 |
| label free text | `update` | applies | 100 |
| multi patch mixed error | `update` | error: update 't1': field 'fill' needs a shape item | 100 |
| shape unknown field | `update` | error: update 's': unknown field 'text' for this item type | 100 |
| shape fill bad color | `update` | error: update 's': bad color 'not-a-color' | 100 |
| shape unknown paint field | `update` | error: update 's': unknown paint field 'stroke2' | 100 |
| fill paint on text item | `update` | error: update 't1': field 'fill' needs a shape item | 100 |
| gradient stop out of range | `update` | error: update 's': gradient fill stop out of 0..1 | 100 |
| gradient bad stop color | `update` | error: update 's': bad gradient fill color 'red' | 100 |
| shape to unknown kind | `update` | error: update 's': shape must be a known shape, got 'hexagon' | 100 |
| points float | `update` | error: update 's': field 'points' must be a whole number within 3..12 | 100 |
| sides as text | `update` | error: update 's': field 'sides' needs a number | 100 |
| caps clear | `update` | applies | 100 |
| startCap bad | `update` | error: update 's': startCap must be none\|arrow\|triangle\|circle\|square\|bar | 100 |
| startCap number | `update` | error: update 's': field 'startCap' needs text | 100 |
| photo src+label | `update` | applies | 100 |
| photo unknown field | `update` | error: update 'p': unknown field 'shape' for this item type | 92 (photo_empty) |
| photo cornerRadius high | `update` | error: update 'p': cornerRadius must be within 0..1000 | 92 (photo_empty) |
| photo field bad | `update` | error: update 'p': bad visitor field key '-x' | 92 (photo_empty) |
| photo fit bad | `update` | error: update 'p': fit must be cover\|contain | 92 (photo_empty) |
| image src empty | `update` | error: update 'i': src must not be empty | 100 |
| image unknown field | `update` | error: update 'i': unknown field 'sticker' for this item type | 100 |
| sticker id empty | `update` | error: update 'k': sticker must not be empty | 100 |
| sticker tint bad | `update` | error: update 'k': bad color 'red' | 100 |
| sticker unknown field | `update` | error: update 'k': unknown field 'fit' for this item type | 100 |
| nested child | `update` | applies | 100 |

### remove (2)

The remove op.

| Case | Input | Expected | Lint |
|---|---|---|---|
| unknown | `remove` | error: unknown item 'ghost' | 100 |
| nested child | `remove` | error: item: group 'g' needs at least 2 children | 100 |

### reorder (9)

The reorder op (z-order).

| Case | Input | Expected | Lint |
|---|---|---|---|
| index middle | `reorder` | applies | 100 |
| index out of range | `reorder` | error: reorder index out of range | 100 |
| bad to | `reorder` | error: reorder needs to=front\|back\|forward\|backward | 100 |
| no target | `reorder` | error: reorder needs to=front\|back\|forward\|backward | 100 |
| forward | `reorder` | applies | 100 |
| backward of first | `reorder` | applies | 100 |
| front then back | `reorder`, `reorder` | applies | 100 |
| unknown | `reorder` | error: unknown item 'ghost' | 100 |
| nested refused | `reorder` | error: reorder only works on top-level items | 100 |

### duplicate (6)

The duplicate op.

| Case | Input | Expected | Lint |
|---|---|---|---|
| nested refused | `duplicate` | error: duplicate only works on top-level items | 100 |
| named | `duplicate` | applies | 100 |
| name collision | `duplicate` | error: duplicate item id 'b' | 100 |
| auto chain | `duplicate`, `duplicate` | applies | 100 |
| unknown | `duplicate` | error: unknown item 'z' | 100 |
| locked copies unlocked | `duplicate` | applies | 100 |

### lock (2)

The lock op.

| Case | Input | Expected | Lint |
|---|---|---|---|
| unknown | `lock` | error: unknown item 'ghost' | 100 |
| default unlocks | `lock` | applies | 100 |

### group (8)

The group op.

| Case | Input | Expected | Lint |
|---|---|---|---|
| named | `group` | applies | 100 |
| auto name | `group` | applies | 100 |
| one id | `group` | error: group needs at least 2 item ids | 100 |
| unknown member | `group` | error: unknown item 'ghost' | 100 |
| nested member | `group` | error: group needs top-level items | 100 |
| locked member | `group` | error: item 'a' is locked | 100 |
| duplicate name | `group` | error: group needs top-level items | 100 |
| rotated member box | `group` | applies | 100 |

### ungroup (5)

The ungroup op.

| Case | Input | Expected | Lint |
|---|---|---|---|
| plain | `ungroup` | applies | 100 |
| rotated group | `ungroup` | applies | 100 |
| not a group | `ungroup` | error: 'a' is not a group | 100 |
| unknown | `ungroup` | error: unknown item 'ghost' | 100 |
| locked | `ungroup` | error: item 'g' is locked | 100 |

### align (10)

The align op.

| Case | Input | Expected | Lint |
|---|---|---|---|
| left | `align` | applies | 100 |
| center-x | `align` | applies | 100 |
| right | `align` | applies | 100 |
| top | `align` | applies | 100 |
| center-y | `align` | applies | 100 |
| bottom | `align` | applies | 100 |
| rotated boxes | `align` | applies | 100 |
| one id | `align` | error: align needs at least 2 item ids | 100 |
| unknown member | `align` | error: unknown item 'ghost' | 100 |
| locked member | `align` | error: item 'a' is locked | 100 |

### distribute (5)

The distribute op.

| Case | Input | Expected | Lint |
|---|---|---|---|
| x | `distribute` | applies | 100 |
| y | `distribute` | applies | 100 |
| two ids | `distribute` | error: distribute needs at least 3 item ids | 100 |
| bad axis | `distribute` | error: distribute axis must be x\|y | 100 |
| unknown member | `distribute` | error: unknown item 'ghost' | 100 |

### background (3)

The set_background op.

| Case | Input | Expected | Lint |
|---|---|---|---|
| color | `set_background` | applies | 92 (empty_design) |
| missing data | `set_background` | error: set_background needs data | 92 (empty_design) |
| bad kind | `set_background` | error: background kind must be color\|gradient\|pattern\|image | 92 (empty_design) |

### arrange (26)

The arrange op: stacks and anchors.

| Case | Input | Expected | Lint |
|---|---|---|---|
| column left safe | `arrange` | applies | 100 |
| column center safe | `arrange` | applies | 100 |
| column right canvas | `arrange` | applies | 76 (unsafe_zone) |
| row top | `arrange` | applies | 92 (off_canvas) |
| row center | `arrange` | applies | 84 (off_canvas, overlap) |
| row bottom | `arrange` | applies | 92 (off_canvas) |
| gap sm | `arrange` | applies | 84 (overlap) |
| gap md | `arrange` | applies | 84 (overlap) |
| gap lg | `arrange` | applies | 92 (overlap) |
| gap huge | `arrange` | applies | 84 (overlap) |
| anchor top | `arrange` | applies | 92 (overlap) |
| anchor bottom | `arrange` | applies | 92 (overlap) |
| anchor left | `arrange` | applies | 76 (overlap) |
| anchor right | `arrange` | applies | 76 (overlap) |
| anchor center | `arrange` | applies | 76 (overlap) |
| stack and anchors | `arrange` | error: arrange: arrange needs exactly one of stack or anchors | 76 (overlap) |
| neither | `arrange` | error: arrange: arrange needs exactly one of stack or anchors | 76 (overlap) |
| bad stack | `arrange` | error: arrange: stack must be column\|row | 76 (overlap) |
| bad zone | `arrange` | error: arrange: zone must be safe\|canvas | 76 (overlap) |
| one item | `arrange` | error: arrange: stack needs at least 2 items | 76 (overlap) |
| unknown item | `arrange` | error: arrange: unknown item 'ghost' | 76 (overlap) |
| locked item | `arrange` | error: arrange: item 'a' is locked | 76 (overlap) |
| locked anchor | `arrange` | error: arrange: item 'a' is locked | 76 (overlap) |
| bad anchor | `arrange` | error: arrange: anchor must be top\|bottom\|left\|right\|center | 76 (overlap) |
| bad column align | `arrange` | error: arrange: column align must be left\|center\|right | 76 (overlap) |
| bad row align | `arrange` | error: arrange: row align must be top\|center\|bottom | 76 (overlap) |

### op (1)

Unknown or malformed ops.

| Case | Input | Expected | Lint |
|---|---|---|---|
| empty kind | `` | error: unknown op '' | 92 (empty_design) |

### validate (76)

Design validation rules on whole designs.

| Case | Input | Expected | Lint |
|---|---|---|---|
| v_version | no op | error: version must be 1 | 92 (empty_design) |
| v_format | no op | applies | 92 (empty_design) |
| v_name | no op | error: name is empty | 92 (empty_design) |
| v_bg_kind | no op | error: background kind must be color\|gradient\|pattern\|image | 92 (empty_design) |
| v_bg_color | no op | error: bad background color | 92 (empty_design) |
| v_bg_grad_stops | no op | error: background gradient needs at least 2 stops | 92 (empty_design) |
| v_bg_grad_color | no op | error: bad background gradient color | 92 (empty_design) |
| v_bg_grad_at | no op | error: background gradient stop out of 0..1 | 92 (empty_design) |
| pattern dots full settings | no op | applies | 92 (empty_design) |
| pattern grid full settings | no op | applies | 92 (empty_design) |
| pattern stripes full settings | no op | applies | 92 (empty_design) |
| pattern checker full settings | no op | applies | 92 (empty_design) |
| pattern waves full settings | no op | applies | 92 (empty_design) |
| pattern crosses full settings | no op | applies | 92 (empty_design) |
| pattern zigzag full settings | no op | applies | 92 (empty_design) |
| pattern triangles full settings | no op | applies | 92 (empty_design) |
| pattern hexagons full settings | no op | applies | 92 (empty_design) |
| pattern diamonds full settings | no op | applies | 92 (empty_design) |
| pattern scallops full settings | no op | applies | 92 (empty_design) |
| pattern bricks full settings | no op | applies | 92 (empty_design) |
| pattern hearts full settings | no op | applies | 92 (empty_design) |
| pattern stars full settings | no op | applies | 92 (empty_design) |
| v_bg_pattern | no op | error: background pattern must be dots\|grid\|stripes\|checker\|waves\|crosses\|zi… | 92 (empty_design) |
| v_bg_pat_color | no op | error: bad background pattern color | 92 (empty_design) |
| v_bg_pat_bg | no op | error: bad background pattern background color | 92 (empty_design) |
| v_bg_pat_scale | no op | error: background pattern scale must be within 0.25..4 | 92 (empty_design) |
| v_bg_pat_angle | no op | error: background pattern angle must be within 0..360 | 92 (empty_design) |
| v_bg_pat_weight | no op | error: background pattern weight must be within 0.25..4 | 92 (empty_design) |
| v_bg_image | no op | error: background image needs a source | 92 (empty_design) |
| v_empty_id | no op | error: an item id is empty | 100 |
| v_dup_id | no op | error: duplicate item id 'a' | 92 (overlap) |
| v_dup_nested | no op | error: duplicate item id 'same' | 84 (off_canvas, overlap) |
| v_text_font | no op | error: item: 't' font is empty | 100 |
| v_text_size | no op | error: item: 't' font size must be 0..1000 | 92 (text_too_small) |
| v_text_color | no op | error: item: 't' bad text color | 100 |
| v_text_hl | no op | error: item: 't' bad highlight color | 100 |
| v_text_align | no op | error: item: 't' bad align | 100 |
| v_text_deco | no op | error: item: 't' decoration must be none\|underline | 100 |
| v_text_list | no op | error: item: 't' list must be none\|bullet\|numbered | 100 |
| v_text_curve | no op | error: item: 't' curve must be none\|up\|down | 100 |
| v_text_curve_amount | no op | error: item: 't' curve amount must be within 0..400 | 100 |
| v_text_min_size | no op | error: item: 't' minimum size must be 0..1000 | 100 |
| v_text_shadow | no op | error: item: 't' bad shadow color | 100 |
| v_text_shadow_blur | no op | error: item: 't' shadow blur must be within 0..200 | 100 |
| v_text_stroke | no op | error: item: 't' bad stroke color | 100 |
| v_text_stroke_w | no op | error: item: 't' stroke width must be within 0..60 | 100 |
| v_text_field | no op | error: item: 't' bad visitor field key '9x' | 100 |
| v_shape_bad | no op | error: item: 's' bad shape 'hexagon' | 100 |
| v_shape_fill | no op | error: item 's' fill: bad color 'red' | 100 |
| v_shape_grad_1 | no op | error: item 's' fill: gradient needs at least 2 stops | 100 |
| v_shape_grad_color | no op | error: item 's' fill: bad gradient color 'red' | 100 |
| v_shape_grad_at | no op | error: item 's' fill: gradient stop out of 0..1 | 100 |
| v_shape_stroke_w | no op | error: item: 's' stroke width must be 0..500 | 100 |
| v_shape_bend | no op | error: item: 's' bend must be within -1..1 | 100 |
| v_shape_head | no op | error: item: 's' head size must be 0..500 | 100 |
| v_shape_style | no op | error: item: 's' line style must be solid\|dashed\|dotted | 100 |
| v_shape_caps | no op | error: item: 's' line ends must be none\|arrow\|triangle\|circle\|square\|bar | 100 |
| v_shape_points | no op | error: item: 's' points must be within 3..12 | 100 |
| v_shape_ratio | no op | error: item: 's' inner ratio must be within 0.1..0.95 | 100 |
| v_shape_sides | no op | error: item: 's' sides must be within 3..12 | 100 |
| v_shape_shadow | no op | error: item 's': bad shadow color 'nope' | 100 |
| v_image_src | no op | error: item: 'i' image src is empty | 100 |
| v_image_preset | no op | error: item 'i': filter preset must be original\|vivid\|warm\|cold\|mono\|noir\|fa… | 100 |
| v_image_filter | no op | error: item 'i': brightness/contrast/saturation must be within -100..100 | 100 |
| v_image_hue | no op | error: item 'i': hue must be within -180..180 | 100 |
| v_image_blur | no op | error: item 'i': blur must be within 0..100 | 100 |
| v_image_vignette | no op | error: item 'i': vignette must be within 0..100 | 100 |
| v_sticker_id | no op | error: item: 'k' sticker id is empty | 100 |
| v_sticker_tint | no op | error: item: 'k' bad tint | 100 |
| v_photo_mask_blob | no op | applies | 92 (photo_empty) |
| v_photo_field | no op | error: item: 'p' bad visitor field key '9x' | 100 (photo_empty) |
| v_group_small | no op | error: item: group 'g' needs at least 2 children | 100 |
| v_group_shadow | no op | error: item 'g': shadow blur must be within 0..200 | 92 (overlap) |
| v_nested_child | no op | error: item 'g'/: 'b' bad shape 'hexagon' | 92 (overlap) |
| v_opacity | no op | error: item: 't' opacity must be 0..1 | 100 |
| v_wh | no op | error: item: 't' needs 0 < w,h <= 10000 | 92 (text_overflow) |

### lint (22)

Design checks (lint): findings and care score.

| Case | Input | Expected | Lint |
|---|---|---|---|
| empty design warns | no op | applies | 92 (empty_design) |
| off canvas | no op | applies | 92 (off_canvas) |
| unsafe zone story | no op | applies | 100 |
| post safe ok | no op | applies | 100 |
| post unsafe bottom | no op | applies | 100 |
| empty text info | no op | applies | 100 (empty_text) |
| small 29 warns | no op | applies | 92 (text_too_small) |
| size 30 quiet | no op | applies | 100 |
| text overflow | no op | applies | 92 (text_overflow) |
| no overflow | no op | applies | 100 |
| contrast error | no op | applies | 80 (contrast) |
| contrast warn small | no op | applies | 80 (contrast) |
| contrast warn big | no op | applies | 100 |
| contrast ok | no op | applies | 100 |
| gradient bg contrast | no op | applies | 100 |
| pattern bg contrast | no op | applies | 80 (contrast) |
| image bg contrast | no op | applies | 100 (contrast_picture) |
| overlap warns | no op | applies | 100 |
| no overlap | no op | applies | 100 |
| hidden skipped | no op | applies | 100 |
| upper case width | no op | applies | 100 |
| score combo | no op | applies | 64 (empty_text, text_too_small, contrast, photo_empty) |

### snap (11)

Drag snapping against the canvas and siblings.

| Case | Input | Expected | Lint |
|---|---|---|---|
| center pull | snap `a` by 437, 0 | snapped delta | 100 |
| no pull far | snap `a` by 3, 4 | snapped delta | 100 |
| exact zero | snap `a` by 0, 0 | snapped delta | 100 |
| vertical edge | snap `a` by 440, 0 | snapped delta | 100 |
| sibling edge | snap `a` by 200, 0 | snapped delta | 100 |
| sibling center | snap `b` by -100, -100 | snapped delta | 100 |
| invisible ignored | snap `a` by 200, 0 | snapped delta | 100 |
| rotated box | snap `a` by 10, 10 | snapped delta | 100 |
| group box | snap `c` by -50, -50 | snapped delta | 100 |
| unknown item | snap `ghost` by 10, 10 | error: unknown item 'ghost' | 100 |
| post canvas | snap `a` by 437, 0 | snapped delta | 100 |

### sweep (66)

Broad sweeps over many values of one field.

| Case | Input | Expected | Lint |
|---|---|---|---|
| stroke rect | `update` | applies | 100 |
| stroke ellipse | `update` | applies | 100 |
| stroke triangle | `update` | applies | 100 |
| stroke line | `update` | applies | 100 |
| stroke star | `update` | applies | 100 |
| stroke diamond | `update` | applies | 100 |
| stroke separator | `update` | applies | 100 |
| stroke frame | `update` | applies | 100 |
| stroke rounded | `update` | applies | 100 |
| stroke polygon | `update` | applies | 100 |
| stroke arrow | `update` | applies | 100 |
| stroke doubleArrow | `update` | applies | 100 |
| stroke dotted | `update` | applies | 100 |
| stroke heart | `update` | applies | 100 |
| stroke bubble | `update` | applies | 100 |
| stroke cross | `update` | applies | 100 |
| stroke trapezoid | `update` | applies | 100 |
| stroke parallelogram | `update` | applies | 100 |
| stroke ring | `update` | applies | 100 |
| stroke cloud | `update` | applies | 100 |
| stroke bolt | `update` | applies | 100 |
| stroke blockArrow | `update` | applies | 100 |
| background dots | `set_background` | applies | 92 (empty_design) |
| background grid | `set_background` | applies | 92 (empty_design) |
| background stripes | `set_background` | applies | 92 (empty_design) |
| background checker | `set_background` | applies | 92 (empty_design) |
| background waves | `set_background` | applies | 92 (empty_design) |
| background crosses | `set_background` | applies | 92 (empty_design) |
| background zigzag | `set_background` | applies | 92 (empty_design) |
| background triangles | `set_background` | applies | 92 (empty_design) |
| background hexagons | `set_background` | applies | 92 (empty_design) |
| background diamonds | `set_background` | applies | 92 (empty_design) |
| background scallops | `set_background` | applies | 92 (empty_design) |
| background bricks | `set_background` | applies | 92 (empty_design) |
| background hearts | `set_background` | applies | 92 (empty_design) |
| background stars | `set_background` | applies | 92 (empty_design) |
| preset original | `update` | applies | 92 (photo_empty) |
| preset vivid | `update` | applies | 92 (photo_empty) |
| preset warm | `update` | applies | 92 (photo_empty) |
| preset cold | `update` | applies | 92 (photo_empty) |
| preset mono | `update` | applies | 92 (photo_empty) |
| preset noir | `update` | applies | 92 (photo_empty) |
| preset faded | `update` | applies | 92 (photo_empty) |
| preset vintage | `update` | applies | 92 (photo_empty) |
| preset dramatic | `update` | applies | 92 (photo_empty) |
| textCase none | no op | applies | 100 |
| textCase upper | no op | applies | 100 |
| textCase lower | no op | applies | 100 |
| textCase title | no op | applies | 100 |
| curve none | `update` | applies | 100 |
| curve down | `update` | applies | 100 |
| mask rect | `update` | applies | 92 (photo_empty) |
| mask circle | `update` | applies | 92 (photo_empty) |
| mask arch | `update` | applies | 92 (photo_empty) |
| image fit cover | `update` | applies | 100 |
| image fit contain | `update` | applies | 100 |
| post add+align | `add`, `add`, `align` | applies | 100 |
| duplicate chain | `duplicate`, `duplicate`, `duplicate` | applies | 100 |
| group three | `group` | applies | 100 |
| ungroup restores | `ungroup` | applies | 100 |
| distribute four x | `distribute` | applies | 100 |
| distribute four y | `distribute` | applies | 100 |
| arrange default align | `arrange` | applies | 100 |
| arrange row canvas | `arrange` | applies | 84 (unsafe_zone, off_canvas) |
| snap sibling vertical | snap `a` by 0, -300 | snapped delta | 100 |
| snap safe zone | snap `b` by 30, 100 | snapped delta | 100 |
