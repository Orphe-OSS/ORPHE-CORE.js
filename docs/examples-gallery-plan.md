# Catalog-Driven Examples Gallery Plan

This document describes how the landing page and future examples index should use `examples/catalog.json` as the source of truth.

The goal is to make the public examples area easier to maintain as the project grows toward a visible "100 examples" experience, without hand-editing the same example metadata in multiple places.

## Current Problem

The landing page currently shows a small curated set of examples, while the repository contains many more learning units:

- browser examples in `examples/`
- starter templates
- getting-started guides
- workshop archives
- app/tool examples
- recipe candidates inside existing sketches and modules

This is useful raw material, but it creates three maintenance problems:

1. Public examples and internal examples are mixed in the filesystem.
2. Display metadata such as title, thumbnail, audience, device count, and public priority is not stored in one place.
3. Adding many examples later will make the landing page hard to review if every card is hand-coded.

## Source Of Truth

Use `examples/catalog.json` as the canonical metadata file.

The gallery should only render entries where:

- `public_navigation` is `featured` or `listed`
- `status` is `public` or `public-candidate`
- `type` is not `internal-test`

Entries with `needs-review`, `needs-fix`, `internal`, or `public_navigation: hidden` should stay out of the public gallery unless a maintainer explicitly promotes them.

## Recommended Display Groups

Use `category` for primary grouping:

| Category | Public label | Purpose |
| --- | --- | --- |
| `getting-started` | Start building | First connection, LED, CoreToolkit, p5.js, VSCode |
| `sensor-basics` | Sensor basics | Acceleration, gyro, orientation, raw/converted sensor values |
| `gait-analysis` | Gait Analysis | Steps, stride, pronation, foot angle, landing impact |
| `recording-analysis` | Recording and analysis | Calibration, logs, DTW, replay, CSV workflows |
| `playable-app` | Playable apps | Games and interactive body-motion experiences |
| `creative-coding` | Creative coding | p5.js, pose, sound, visuals |
| `research-integration` | Research and integrations | BLE integrations, external sensors, domain-specific prototypes |
| `workshop-archive` | Workshops | Workshop outputs and teaching archives |
| `developer-tool` | Developer tools | Terminal and debugging utilities |

Use `featured: true` and `sort_order` for the landing page's first examples strip. Use category tabs or filters on a larger examples page.

## Implementation Options

### Option A: Static Cards In `index.html`

Keep the current hand-coded cards, but update them from `catalog.json` manually.

Pros:

- Simple.
- No build step.
- Very low runtime risk.

Cons:

- Metadata drifts.
- Scaling to 100 examples is tedious.
- Every copy or thumbnail update requires editing HTML.

### Option B: Runtime JSON Gallery

Load `examples/catalog.json` in the browser and render cards with client-side JavaScript.

Pros:

- No build step.
- One metadata source.
- Easy filtering and search.
- Good fit for GitHub Pages.

Cons:

- Requires a local server for `fetch()` during local preview.
- Needs fallback UI if JSON loading fails.
- Slightly more JS on the landing page.

### Option C: Static Generation Script

Add a small Node.js script that reads `examples/catalog.json` and writes a generated HTML partial.

Pros:

- Fast page load.
- No runtime fetch.
- Reviewable generated HTML.
- Works from `file://` when needed.

Cons:

- Requires a generation step before commit.
- Generated files can create noisy diffs.
- Needs a clear rule for when to regenerate.

## Recommendation

Use Option B first for a dedicated examples index page, not the landing page hero.

Rationale:

- GitHub Pages can serve `examples/catalog.json` directly.
- The current landing page can stay stable while the larger gallery evolves.
- Filtering by category, difficulty, and device count is easier with runtime JSON.
- If runtime rendering feels fragile later, the same catalog can feed a static generator.

Recommended sequence:

1. Keep the current LP cards curated and small.
2. Add a new `examples/index.html` or `docs/examples.html` that renders from `examples/catalog.json`.
3. Link from the LP's examples section to the full catalog-driven gallery.
4. Once stable, optionally replace the LP's repeated cards with a small renderer using only `featured` entries.

## Minimum Card Fields

Each public card should be able to show:

- title
- category label
- difficulty
- expected device count
- thumbnail, with a text fallback
- short value sentence
- demo link
- source link
- validation note when real-device verification is still needed

## Runtime Rendering Rules

The renderer should:

- hide `public_navigation: hidden`
- hide `internal-test`
- group by `category`
- sort by `sort_order`
- show a placeholder state when `thumbnail` is `null`
- display `Needs device verification` only when `needs_real_device_validation` is true
- avoid showing `needs-review` entries publicly unless a maintainer promotes them

## Local Development

Because browser `fetch()` usually fails from `file://`, the catalog-driven gallery should document a local preview command:

```sh
python3 -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765/
```

## Follow-Up PRs

1. Add `scripts/check-examples-catalog.js` and keep it passing.
2. Add missing thumbnails or explicit placeholder styling.
3. Create the dedicated catalog-driven examples index.
4. Add simple category filters.
5. Promote `public-candidate` entries in small batches after browser/device review.
