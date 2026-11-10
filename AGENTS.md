# AGENTS.md

Guidance for coding agents working in this repository.

Follow `cyc:conventions` (the rules shared by every cyc-seattle repo).

## Overview

`csc-website` is CYC Community Sailing Center's public website, `cyccommunitysailing.org`. It replaces the Wix site
([cyc-seattle/platform#150](https://github.com/cyc-seattle/platform/issues/150)). It will be a static Astro site:
the build reads the `website_*` collections from the platform's Directus
([cyc-seattle/platform](https://github.com/cyc-seattle/platform)) and Firebase Hosting serves the files it writes.
Visitors never call Directus.

Staff don't edit the site. Coding agents change its content in Directus and its code here.

This repo held the Wix site's synced code until the move. It's in the git history.

## Tasks

mise provides the tools. Run `mise trust`, then `mise run install`.

- `mise run ci`: `check`, then `test`
- `mise run check`: typecheck, Prettier check, ESLint
- `mise run format`: fix formatting and lint
- `mise run test`: run the tests with Vitest

## Layout

- `test/` holds the unit tests, `*.test.ts`.

## Pull requests

PR titles are conventional commits. Never push to `main`. Never force-push: to bring a branch up to date, merge
`origin/main` into it. CI (`.github/workflows/pull-request.yml`) runs `mise run ci` through the org's `ci.yml`, and
`pr-title.yml` checks the title. `main` requires both.

### Pull requests that change what people see

The maintainer reviews a UI change from screenshots in its PR description, not by checking out the branch. Every PR
that changes a page or component shows them there:

- Both review sizes from `cyc:conventions`, laptop and phone. Before and after, when it changes an existing page.
- Made-up content only, never real people's names or photos.
- Host them on the `screenshots` branch, which is never merged: commit them to `pr-<number>/` on it, push, and embed
  each with `https://raw.githubusercontent.com/cyc-seattle/csc-website/<commit>/pr-<number>/<name>.png`, using that
  commit's SHA so the link never changes. Never put them on the PR's own branch.

## Code style

TypeScript with ESLint and Prettier from `@cyc-seattle/ts-config`. ESM: relative import paths carry the `.ts`
extension.

### Comments

Comments explain **why**, not what. Keep them to a line or two. Write one where a reader would otherwise get it wrong: a
non-obvious constraint, a surprising API behavior, or a decision that looks arbitrary but isn't.

- Don't narrate the code, restate the diff, or argue for the approach you chose.
- Cite an issue instead of recounting its discussion.
- Don't cite a local plan file. A `docs/` reference is fine.

The same applies to docs: record the outcome, not the path to it.
