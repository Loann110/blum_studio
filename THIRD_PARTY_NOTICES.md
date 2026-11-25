# Third-party notices

Blum Studio's own code is licensed under AGPL-3.0-or-later (see `LICENSE`).
The files below come from other projects and keep their own licences. Each
licence text ships next to the files it covers.

## Fonts

`assets/fonts/`, all under the SIL Open Font License 1.1. Each family has its
licence in a `<family>-OFL.txt` or `<family>-LICENSE.txt` file.

Sources: the [Google Fonts repository](https://github.com/google/fonts)
(`ofl/`) and the [Fontsource](https://fontsource.org) packages 5.3.0.

Abril Fatface, Alfa Slab One, Allura, Anton, Antonio, Archivo Black,
Archivo Narrow, Arvo, Baloo 2, Barlow Condensed, Bebas Neue, Bitter,
Bricolage Grotesque, Bungee, Caveat, Caveat Brush, Comfortaa,
Cormorant Garamond, Courier Prime, Cutive Mono, Dancing Script,
DM Serif Display, Dosis, Figtree, Fraunces, Fredoka, Gochi Hand, Great Vibes,
IBM Plex Mono, Instrument Serif, Inter, JetBrains Mono, Kalam, League Gothic,
Libre Baskerville, Lora, Manrope, Montserrat, Nunito, Oswald, Outfit,
Pacifico, Parisienne, Pinyon Script, Playfair Display, Plus Jakarta Sans,
Poppins, Quicksand, Righteous, Rubik Mono One, Shadows Into Light, Shrikhand,
Six Caps, Sora, Space Grotesk, Space Mono, Syne, Titan One, Zilla Slab.

## Stickers

`assets/stickers/`. Each entry in `manifest.json` carries its licence. Sources
and pinned commits are in [assets/stickers/README.md](assets/stickers/README.md).

| Folder | Project | Licence |
|---|---|---|
| `fluent-color/`, `fluent-flat/` | [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) | MIT, Microsoft Corporation |
| `tabler-icons/` | [Tabler Icons](https://github.com/tabler/tabler-icons) | MIT, Paweł Kuna |
| `illustrations/opendoodles/` | [Open Doodles](https://www.opendoodles.com) | CC0 1.0 |
| `illustrations/kenney-*/` | [Kenney](https://kenney.nl/assets) | CC0 1.0 |
| `blum/`, `blum-doodles/` | Made for Blum Studio | CC0 1.0 |

## Textures

`assets/textures/`: procedural images made for Blum Studio, CC0 1.0
(`CC0.txt` next to the files).

## Photos

`assets/photos.json` lists photos hosted on [Unsplash](https://unsplash.com)
under the [Unsplash License](https://unsplash.com/license). No photo file
ships with the repository.

## Background removal model

`assets/models/u2netp.onnx`: the small U²-Net model by Xuebin Qin et al.,
Apache-2.0, from [U-2-Net](https://github.com/xuebinqin/U-2-Net). Shipped
unmodified.

## npm packages

Installed by `npm run setup`, not vendored:

| Package | Licence |
|---|---|
| `@modelcontextprotocol/sdk` | MIT |
| `zod` | MIT |
| `playwright-core` | Apache-2.0 |
| `onnxruntime-web` (its wasm runtime is copied into `ui/dist/ort/` at build) | MIT |
| `lucide` (icons, bundled into the UI) | ISC |
| `typescript` | Apache-2.0 |
| `esbuild` | MIT |
