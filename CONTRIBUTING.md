# Contributing

Thanks for helping. Read this page before you open a pull request.

## Setup

```sh
npm run setup
npm start
```

## Before you open a pull request

Every check must pass:

```sh
cd ui
npm run build
npm run test:engine
npm run build:server && npm run build:server-test && npm run test:server
cd .. && npm run check
```

A change that adds logic adds a test. Engine tests live next to the engine,
server tests live in `server/test/`.

## Where code goes

[ARCHITECTURE.md](ARCHITECTURE.md) lists every folder and what it owns. Find
the place first, then write.

- **One subject per file.** A gesture goes in `ui/editor/gestures/`, an op in
  `ui/engine/ops/kinds/`, an MCP tool group in `server/mcp/tools/`.
- **Keep files short.** A file nearing 300 lines usually holds two subjects.
  Split it before you add to it.
- **The engine is the single source of truth.** Validation, ops and lint live
  in `ui/engine/` and run in both the browser and the server. The renderer in
  `ui/render/` is shared by the editor, the gallery and the export.
- **Update `ARCHITECTURE.md`** in the same change when you add, move or
  delete a file.

## How to write it

- English everywhere: names, comments, docs.
- Names say what things do. Avoid abbreviations except `x`, `y`, `w`, `h`.
- Prefer the smallest change that fully works. Don't add options, wrappers or
  layers that nobody needs yet.
- Comments explain *why*, not *what*.
- No dead or commented-out code.
- Never weaken validation at a trust boundary: HTTP bodies, MCP arguments,
  files read from disk.
- No new dependency without discussing it in an issue first.

## Assets

New fonts, stickers or textures need a licence that allows commercial use and
redistribution (OFL, MIT, CC0, Apache-2.0). Put the licence file next to the
files and add the source to [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

By contributing, you agree that your contribution is licensed under
AGPL-3.0-or-later, like the rest of the project.
