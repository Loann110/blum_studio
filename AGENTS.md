# Instructions for coding agents

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [ARCHITECTURE.md](ARCHITECTURE.md)
first. Everything there applies to you. This file adds what agents tend to
get wrong.

## Scope

- Do what the task asks, completely, and nothing more. Name anything you chose
  not to do.
- Before editing, list every place the change must reach: callers, tests,
  fixtures, exports, `ARCHITECTURE.md`.
- When fixing a bug, find every caller of the function you touch, then fix
  the cause once in the shared code.
- Code you move keeps its validation and error handling.

## Keep it small

Take the first option that works:

1. Is it needed at all?
2. Does the codebase already have it? Use it the way the surrounding code does.
3. Does the platform or an installed dependency do it?
4. Otherwise, write the least code that works.

No speculative options, wrappers, factories, re-export indexes or catch-all
`utils` folders. A known shortcut gets one comment:
`shortcut: <the limit>, <when to upgrade>`.

## Checks

Run the full check list from CONTRIBUTING.md before you call anything done.
Never disable or skip a test to make it pass.

## Working in this repo

- The default port is 8092. Use your own port for long runs (`BLUM_PORT`).
- Prefix any design you create for testing with your task name, and delete it
  when you finish. Never edit or delete designs you did not create.
- Don't commit unless you are asked to.
- Keep scratch work in `dev/tmp/`, which git ignores.
