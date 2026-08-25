# Changelog

All notable changes to BenchTab are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0] - 2026-08-25

Visual and UX overhaul of the workbench. The design direction is
"quiet instrument": a neutral surface built from flat planes and hairlines,
replacing both the original uniform card wall and the decorated laboratory-panel
treatment that first replaced it. Structure carries the design; colour is spent
only where it means something.

### Added

- A repository-wide release policy in `AGENTS.md` now requires every AI agent
  to version, document, verify, tag, and push each completed logical change.
- Changelog started at `v0.5.0`.
- **Daily research overview** in the previously unused workspace header: an
  explicit-permission Open-Meteo forecast, a device-local month calendar with
  colour-coded events, drag-to-reschedule, upcoming items, and iCalendar
  import/export.
- Weather location entry now offers immediate offline Turkish province matches,
  richer Open-Meteo suggestions after access is granted, and an explicit
  browser-geolocation action. Forecast requests no longer depend on a matching
  service-worker message version.
- **Quick tools drawer** with safe parsed arithmetic/scientific expressions,
  degree/radian modes, factorials, memory and history, unit conversion, an
  auto-saved scratch note, clipboard copy, and one-shot transfer into a chosen
  numeric calculator field.
- **Focus and status strip** with a reload-safe Pomodoro timer, clipboard-number
  capture, online/on-device-AI/local-save indicators, daily CODATA constant,
  overview backup, and editable weekly progress goal.
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
  at 12.5 px or above. One sans carries the interface; readouts are monospace
  and tabular.
- Card accents are now semantic. Each module family — measure, literature,
  reference, workflow, record — owns a colour, replacing per-card accent classes
  that had been assigned arbitrarily. The accent appears as a marker — an
  eyebrow dot, a filter-chip dot — rather than as a tint across the card.
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

### Changed — minimalist pass

- **Decoration removed.** The two radial accent washes behind the page, the
  corner brackets painted on every card, the gradient card fills, the gradient
  brand mark, and the gradient options sheet are gone. Surfaces are flat and
  separations are hairlines.
- **Palette is neutral.** Both themes moved off the teal-tinted greys onto a
  neutral scale — near-black surfaces in dark, white sheets on a soft grey
  field in light. Family accents were desaturated to match, and muted/faint text
  was darkened enough to hold 4.5:1 against its background.
- **One filled button style.** Filled controls are monochrome (`--solid` /
  `--on-solid`, ink on paper) instead of taking the module family accent, so a
  board of seventeen cards no longer shows a grid of coloured blocks.
- **Labels stopped shouting.** Field labels across the feed, notebook, AI,
  language, calculator, reference, and workflow panels drop the uppercase,
  letter-spaced treatment for 11.5 px regular text. Uppercase survives only on
  eyebrows, and its tracking dropped from 0.13em to 0.08em.
- **Result panels are neutral.** Calculator and translation outputs sit on a
  recessed plane; the mono face and weight carry the emphasis that an accent
  tint used to.
- **Selection reads the same everywhere.** Filter chips, AI mode pills, and
  preset buttons all mark the active choice as a plane that steps forward, on
  one 8 px radius; the pill shapes are gone.
- Shadows are reserved for the module manager, the only surface that floats.
  Cards, buttons, and the options sheet carry none.
- Card padding, the grid gap, and the shell inset each grew one step; the radius
  scale tightened (`lg` 12 – 10 px, `xl` 18 – 14 px).

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

[Unreleased]: https://github.com/ozkurkuran/MikroStart/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/ozkurkuran/MikroStart/compare/v0.5.0-baseline...v0.6.0
[0.5.0]: https://github.com/ozkurkuran/MikroStart/releases/tag/v0.5.0-baseline
