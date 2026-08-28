# Changelog

All notable changes to BenchTab are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.13.1] - 2026-08-28

### Fixed

- Weather location suggestions now include all 973 Turkish districts offline,
  show each district with its province, and match queries typed without Turkish
  diacritics or in province-first form.
- Packaged district selections are qualified by province and constrained to
  Turkey during geocoding, preventing same-named settlements from resolving to
  the wrong location while retaining additional online suggestions.

## [0.13.0] - 2026-08-25

### Added

- A full versioned backup combines preferences, workspaces, source and monitor
  configuration, monitor history, reading state, local workflow values, and
  the complete notebook into one portable JSON file.
- Settings now show the last full-backup time and a weekly due state, validate
  imports before mutation, report key and notebook-record conflicts, and offer
  conflict-free merge or explicitly confirmed replacement.
- The latest three full backups are retained as local IndexedDB recovery
  snapshots. A replacement restore creates an additional pre-restore snapshot
  before current data is cleared.
- The dashboard backup indicator now downloads the same full backup rather than
  exporting only the overview card state.
- Full-backup schema, size, unknown-field, unsafe-key, notebook-envelope, and
  recovery-retention boundaries have automated regression coverage.

### Changed

- Full restore reloads the extension after successful application so every
  surface observes imported settings and local data consistently.
- Rebuildable public publication metadata, durable retry jobs, recovery
  snapshots, and Chrome permission grants are excluded from portable backups.
  Restored online sources therefore require fresh user permission.

### Security

- Imports are capped at 20 MiB, limited to JSON-safe values and a known schema,
  reject prototype keys and excessive nesting, and run the existing strict
  notebook validator before displaying an actionable preview.
- Merge never overwrites a conflicting key or notebook record. Replacement is
  unavailable without a separate confirmation and recoverable pre-restore
  snapshot.

## [0.12.0] - 2026-08-25

### Added

- A structured source-monitor module tracks one allowlisted value from an HTTPS
  JSON API using a dotted path or JSON Pointer, with 30-minute to daily checks.
- Monitor conditions support changed, contains, does-not-contain, number-above,
  and number-below rules. The first successful check establishes a silent
  baseline; later matching changes can create a local Chrome notification.
- Each monitor retains the latest thirty bounded checks with before/after
  views, trigger state, manual refresh, and JSON or CSV history export.
- Monitor URL, path, numeric-condition, interval, runtime-message, extraction,
  due-time, and prototype-key boundaries have automated regression coverage.

### Changed

- The durable source queue now schedules enabled JSON monitors alongside the
  existing RSS/Atom and literature connectors while retaining one predictable
  worker path and bounded fetch broker.
- Deleting all local data also revokes removable clipboard, geolocation, and
  notification capabilities in addition to optional host origins.

### Security

- JSON responses are capped at 1 MB, selected values at 8,000 characters,
  monitors at thirty, and history at thirty records per monitor. General HTML,
  selectors, XPath, content scripts, and executable extraction are excluded.
- Host and optional notification access are requested together only from the
  visible save action. A monitor without notifications adds no notification
  permission.

## [0.11.0] - 2026-08-25

### Added

- Up to twelve named local workspaces can keep independent module order and
  visibility while sharing the user's underlying notebook and research data.
- A workspace manager creates, renames, switches, removes, exports, and imports
  data-only workspace packs from the main board.
- Packaged XRD, vacuum, and thesis-writing starter packs provide focused module
  arrangements without adding code, remote URLs, or source permissions.
- Versioned workspace and pack normalizers recover malformed legacy state,
  preserve the existing single-board layout during migration, bound imported
  JSON to 256 KB, and reject unsupported schemas.

### Changed

- Dashboard, new-tab, and side-panel surfaces now observe the same active
  workspace through local storage changes.
- Module reordering and visibility changes are persisted into the active
  workspace instead of overwriting one global layout.

### Security

- Workspace packs are an allowlisted data format containing only packaged
  module identifiers, order, and visibility. Import cannot execute code, add a
  network source, or grant a Chrome permission.

## [0.10.0] - 2026-08-25

### Added

- The research feed now has a local reading inbox with unread, read-later,
  read, and all views, per-view counts, and explicit state controls.
- A keyboard-first command palette opens with Ctrl/Cmd+K and searches packaged
  modules, local notebook notes, and cached source records without a remote
  index or additional Chrome permission.
- Command-palette results can reveal hidden modules, focus a selected notebook
  note, open a cached publication, or navigate to privacy settings.
- Reading-state and command-ranking normalizers have regression coverage for
  malformed storage, Turkish diacritic folding, multi-term matching, and result
  ordering.

### Changed

- Opening a source marks it read, while read-later remains independent from
  notebook references and can be reversed without deleting cached metadata.
- Feed source links now use controlled buttons so reading state is recorded
  before the external page opens.

### Security

- Reading state is bounded to 1,000 validated local records. The command
  palette reads only packaged metadata, IndexedDB notes, and the existing
  bounded public-source cache; it adds no host or sensitive browser permission.

## [0.9.0] - 2026-08-25

### Added

- Saved literature searches can query arXiv, Crossref, or both from one local
  stream, with an optional display name, excluded terms, newest or relevance
  ordering, and bounded 10/20/30/50-result choices.
- A packaged Crossref JSON normalizer validates response size and item count,
  strips markup, canonicalizes DOI links, bounds authors and abstracts, and
  preserves retrieval provenance without rendering remote content.
- The research feed can scope cached results by saved stream, display merged
  provider provenance, manually refresh or remove a stream, and pass the same
  normalized records to the notebook and on-device AI context selector.
- Regression coverage now includes literature-stream validation and legacy
  storage recovery, provider URL construction, malformed Crossref payloads,
  excluded-term filtering, unified relevance ranking, versioned runtime message
  validation, one-hour freshness, and provenance-safe cache replacement.

### Changed

- Public literature calls run sequentially through the existing bounded fetch
  broker, respecting Crossref's public concurrency limit and the service
  worker's durable retry queue.
- Saved searches refresh in the background only when their one-hour local cache
  is stale; the shared public-metadata cache remains capped at 500 records.
- arXiv and Crossref origin permissions are requested together only from the
  visible save action and are revoked when their last saved stream is removed.
- Feed privacy copy now states the precise boundary: BenchTab has no receiving
  user-data server, while an enabled external provider can observe the direct
  browser request, including its query and standard request metadata.

### Security

- Literature stream commands are deny-by-default, length bounded, provider
  allowlisted, and limited to packaged arXiv and Crossref connector behavior;
  no arbitrary URL or executable selector crosses the runtime message boundary.

## [0.8.0] - 2026-08-25

### Added

- Thirteen bundled, local-only visual themes: Cobalt, Citrus, Glass, Clinical,
  Paper, Plain, Circuit, Magnetic, Aurora, Night Glass, Ink, Graphite, and
  Phosphor.
- An accessible header theme picker groups light and dark choices, shows a
  compact palette preview and description for each theme, closes on outside
  pointer input or Escape, and persists a selection immediately on device.
- The Options page exposes the same theme catalog through grouped native
  controls, with complete Turkish and English labels and descriptions.
- Theme preference normalization includes regression tests for every bundled
  identifier, malformed stored data, and migration from the original light and
  dark values.

### Changed

- Theme packages can now control semantic colours, module-family accents,
  surface depth, card treatments, corner geometry, display typography, and
  optional background atmosphere through one extensible registry.
- Existing light and dark preferences migrate to Plain and Graphite
  respectively, while the system-following mode remains available.
- Glass effects and decorative backgrounds use packaged CSS only; every font
  remains a local system stack and no permission, account, telemetry, or remote
  asset was added.

## [0.7.0] - 2026-08-25

### Added

- A dedicated Arrange mode now exposes a drag handle on every dashboard card
  without making calculator inputs, text selection, or scrolling draggable.
- Pointer Events-based module reordering works through one input path for mouse,
  touch, and pen, with pointer capture, cancellation cleanup, and viewport-edge
  auto-scroll for long boards.
- Two-dimensional masonry hit testing uses the cards' measured visual bounds and
  shows an explicit insertion edge while preserving the complete stored order
  when the visible board is filtered.
- Keyboard reordering supports Space/Enter to pick up and drop, arrow keys to
  choose a position, Home/End jumps, Escape cancellation, and translated
  assertive announcements of every state change.
- Pure module-order and drop-target geometry services include regression tests
  for hidden modules, no-op and clamped moves, multiple columns, uneven card
  heights, grid gaps, and single-column layouts.

### Changed

- A dragged card now moves on a compositor-friendly inner surface while its
  masonry slot remains in place as a stable placeholder; completed moves use a
  short FLIP animation that is skipped under `prefers-reduced-motion`.
- Search, category, density, and module-management controls are intentionally
  locked while Arrange mode is active, and card contents become inert so layout
  editing cannot accidentally trigger a scientific tool.
- The Module Manager now delegates mouse and button reordering to the same pure
  order functions as the board instead of maintaining a second implementation.
- Side-panel ordering remains a compact read-only projection of the shared
  dashboard order; no new Chrome permission is required by this release.

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

[Unreleased]: https://github.com/ozkurkuran/MikroStart/compare/v0.13.1...HEAD
[0.13.1]: https://github.com/ozkurkuran/MikroStart/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/ozkurkuran/MikroStart/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/ozkurkuran/MikroStart/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/ozkurkuran/MikroStart/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/ozkurkuran/MikroStart/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/ozkurkuran/MikroStart/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/ozkurkuran/MikroStart/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/ozkurkuran/MikroStart/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/ozkurkuran/MikroStart/compare/v0.5.0-baseline...v0.6.0
[0.5.0]: https://github.com/ozkurkuran/MikroStart/releases/tag/v0.5.0-baseline
