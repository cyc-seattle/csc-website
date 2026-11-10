# AGENTS.md

Guidance for coding agents working in this repository.

Follow `cyc:conventions` (the rules shared by every cyc-seattle repo).

## Overview

`csc-website` is CYC Community Sailing Center's public website, `cyccommunitysailing.org`. It replaces the Wix site
([cyc-seattle/platform#150](https://github.com/cyc-seattle/platform/issues/150)). It's a static Astro site with
Tailwind: the build reads the `website_*` collections from the platform's Directus
([cyc-seattle/platform](https://github.com/cyc-seattle/platform)), resizes the pictures, and writes plain HTML that
Firebase Hosting serves. Visitors never call Directus, and the pages run no JavaScript: the menus open with
`<details>` and CSS.

Staff don't edit the site. Coding agents change its content in Directus and its code here.

This repo held the Wix site's synced code until the move. It's in the git history.

## Tasks

mise provides the tools. Run `mise trust`, then `mise run install`.

- `mise run ci`: `check`, `test`, then `smoke`
- `mise run check`: `pull`, then `astro check` (types, `.astro` files too), Prettier check, ESLint
- `mise run pull`: write the content snapshot to `.content/` (below)
- `mise run dev`: `pull`, then serve the site locally, reloading on change
- `mise run build`: `pull`, then build the site into `dist/`
- `mise run preview`: serve `dist/`
- `mise run format`: fix formatting and lint
- `mise run test`: run the unit tests with Vitest
- `mise run smoke`: `build`, then visit every page in the sitemap in Chromium: each loads with a heading and its
  pictures, and every link on the site works
- `mise run deploy`: build from `$PULUMI_STACK`'s Directus and deploy it (below)
- `mise run screenshots`: save the main pages at laptop and phone sizes to `screenshots/`, from `dist/`

Playwright downloads a Chromium that runs on most Linux, macOS, and Windows machines. Where it can't, such as on NixOS,
point `PLAYWRIGHT_BROWSERS_PATH` at a matching set of browsers in a git-ignored `mise.local.toml`.

## Content

Every word and picture on the site comes from Directus. Change content there, not here.

- `scripts/pull-content.ts` writes a snapshot to `.content/` before every build: `content.json`, the rows of each
  `website_*` collection as Directus returns them, and `files/`, the pictures. Astro has to find the pictures on disk
  to resize them, so the pull runs first, not during the build.
- `CONTENT_SOURCE` picks where it comes from. `fixtures`, the default, copies `test/fixtures/`. `directus` reads
  `DIRECTUS_URL` (dev is `https://directus.dev.cycsail.team`, prod `https://directus.cycsail.team`) with
  `DIRECTUS_TOKEN`, the Website Build user's token, which can read only the `website_*` collections and the Website
  folder's files. Its value is in Secret Manager as `dev-csc-website-directus-token` and `csc-website-directus-token`.
  Never print it.
- `src/lib/content.ts` is the only module pages import content from. It reads the snapshot and hands it to
  `src/lib/model.ts`, which turns the rows into what the pages show: categories with their programs, FAQ topics and
  crew, the policy version in effect, and where each program's button goes. `src/lib/snapshot.ts` types the rows.
- `test/fixtures/` is made-up content in the same shape, with drawn pictures. CI, the smoke test and screenshots use
  it. Never put real content or photos there: the repo is public.
- Text fields are Markdown, rendered as trusted HTML (`src/components/Markdown.astro`).

## Layout

- `src/pages/` holds the pages. A file's path is its URL, and Astro writes each as a file (`/donate.html`), which
  Firebase Hosting serves as `/donate`, the path Wix used. `[page].astro` is the fixed pages from `website_pages`,
  such as Contact Us and Donate, each with any list it adds from another collection.
- `src/components/` holds the parts pages share, `src/layouts/Base.astro` the header, menu, footer, and each page's
  search and link-preview tags. `src/styles/global.css` holds the colors and the button styles.
- `test/` holds the unit tests, `*.test.ts`, and `test/smoke/` the Playwright tests, run against `dist/`.

## Deploys

Firebase Hosting serves the site from the `csc-website` site in `cyc-admin-scripts`, which platform declares
([cyc-seattle/platform#189](https://github.com/cyc-seattle/platform/pull/189)). `firebase.json` holds its redirects,
such as Wix's `/event-details/*` pages, its security headers, and its clean URLs. Every deploy goes through the org's
`deploy.yml`, which signs in as `deploy-website` without a key and runs `mise run deploy` (`scripts/deploy.sh`). It
reads the Directus token from Secret Manager, builds with `CONTENT_SOURCE=directus`, and deploys.

- **A PR** (`pull-request.yml`, environment `dev`): after CI, the PR deploys to its own preview channel, `pr-<number>`,
  built from dev's Directus. The URL is in the run's summary. A channel expires 7 days after its last deploy. A fork's
  PR doesn't deploy.
- **A push to `main`** (`pull-request.yml`, environment `prod`): deploys the live site from prod's Directus, once a
  maintainer approves.
- **A content change** (`publish.yml`, environment `publish`): a Directus Flow sends the `publish` repository
  dispatch when website content changes, and a nightly run catches anything it missed. Both build `main` from prod's
  Directus and deploy live with no reviewer. `gh workflow run publish.yml` publishes by hand.

`PULUMI_STACK`, which `deploy.yml` sets, picks the Directus, the token's secret, and preview or live
(`mise.toml`). Locally it defaults to `dev`, so a local `mise run deploy` makes a preview channel named for the branch.

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
