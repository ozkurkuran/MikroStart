# Changelog

All notable changes to BenchTab are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Visual and UX overhaul of the workbench. The design direction is
"precision instrument" — a laboratory panel crossed with technical editorial —
replacing the flat, uniform card wall.

### Added

- Changelog started at `v0.5.0`.
- Git history initialised. Tag `v0.5.0-baseline` marks the pre-redesign snapshot.
- **Design token layer** (`src/shell/tokens.css`): type scale, 4 px spacing scale,
  radius, elevation, and motion tokens, plus fully specified dark and light
  palettes. Fonts stay system-only — the privacy baseline forbids remote assets.
- **Module catalog** (`src/shell/moduleCatalog.ts`): every module now declares a
  family, a kind, and search keywords in one place.
- **Module command bar**: live search over module names and keywords
  (diacritic- and case-insensitive, Turkish-aware), category filter chips with
  live counts, a card-density toggle, and the visible-module count.
- **Empty states** for an empty board and for a filter that matches nothing.
- Sticky card headings, so the module you are reading stays labelled while its
  body scrolls.
- Hover, focus-within, and active states across every control; a global focus
  ring; an `.sr-only` utility; and a `prefers-reduced-motion` guard.

### Changed

- `styles.css` split into `tokens` / `base` / `workbench` / `panels` layers.
- The three overlapping token vocabularies (`--muted` / `--color-muted` /
  `--color-text-muted`, `--line` / `--border` / `--color-border`, …) collapse
  onto one scale through compatibility aliases, removing the drift between cards.
- Type floor raised: card eyebrows go from 8–9 px to 10.5 px and body copy sits
  at 12.5 px or above. Headings are serif; readouts are monospace and tabular.
- Card accents are now semantic. Each module family — measure, literature,
  reference, workflow, record — owns a colour, replacing per-card accent classes
  that had been assigned arbitrarily.
- Cards carry a corner-bracket marker painted as a background, so it stays
  pinned to the frame while the body scrolls.
- Module manager is a real dialog: backdrop, Escape to close, grouped by family
  with per-group show/hide.
- The density preference is now reachable from the board, not just Options, and
  persists.
- Module grid widens to six columns above 1800 px.
- **The interface is now translated.** The `locale` preference (`tr` / `en`)
  already existed but did nothing; it now drives the whole UI. Every user-facing
  string moved into `src/platform/locales/{en,tr}.ts` behind a `t()` helper, and
  the Options language picker switches the interface immediately. English is the
  type source of truth, so a key missing from Turkish is a build error rather
  than an English string leaking through.
- Engine diagnostics are translated by their stable `code`, falling back to the
  engine's own English text — the calculation modules were not touched.
- `lang` on the pages follows the chosen locale instead of being hardcoded to
  `en`, and `Intl` formatters use the matching tag rather than always `tr-TR`.
- Proper nouns (Bragg, Scherrer, Hall, CODATA, FWHM, arXiv, DOI, RSS), unit
  symbols, and export format names stay untranslated on purpose.

### Fixed

- White-on-accent button text in the workflow cards failed contrast once accents
  became semantic; card buttons now use a theme-aware `--on-accent` and only the
  primary verb carries an accent fill.
- Light theme was previously a partial override, and feature stylesheets carried
  hardcoded dark fallbacks that leaked into it. Both palettes are now complete.
- `<select>` elements could not shrink inside `1fr` grid tracks, so unit
  dropdowns pushed narrow layouts wide. Tracks use `minmax(0, 1fr)` and unit
  selects are width-capped.
- `ModuleSlot` reads its grid row and gap from computed styles instead of
  duplicating the values as TypeScript constants that could drift from the CSS.

## [0.5.0] - 2026-08-25

Baseline release captured when version control was introduced. Feature summary
is documented in [`README.md`](README.md).

- Manifest V3 new-tab, dashboard, side-panel, options, and service-worker entries.
- Deterministic Bragg/d-spacing, Scherrer, four-point probe, Hall, and vacuum calculators.
- Bounded RSS 2.0/Atom parsing, curated arXiv presets, local search, DOI/arXiv normalization.
- Chrome on-device summarization, translation, grounded digest, and reranking.
- Offline CODATA constants, the full periodic table, and IEC E6/E12/E24 series.
- Countdowns, stopwatch, sample-ID generation, quick notes, and a local lab notebook.
- Reorderable and hideable dashboard modules with a measured masonry grid.

[Unreleased]: https://github.com/ozkur/benchtab/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/ozkur/benchtab/releases/tag/v0.5.0
