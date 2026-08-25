# BenchTab

BenchTab is a local-first Chrome research workbench for following, calculating, and recording experimental research. The modular design and extension boundaries are documented in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Implemented in v0.5

- Manifest V3 new-tab, dashboard, side-panel, options, and service-worker entries.
- Deterministic Bragg/d-spacing, Scherrer, four-point probe, Hall, and vacuum calculators with units, validation, warnings, and provenance.
- Bounded RSS 2.0/Atom parsing, curated arXiv presets, local search, and DOI/arXiv normalization.
- Optional per-origin source permission flow and service-worker-only fetching.
- Durable, leased refresh jobs and a local deduplicated feed cache.
- Chrome on-device summarization, translation, grounded digest, and reranking with explicit user activation and no cloud fallback.
- Free-text, on-device translation plus explicit Google Translate and Tureng hand-off links; external services receive text only after the user clicks their link.
- Offline CODATA constants, the full periodic table, and IEC E6/E12/E24 component series.
- Multiple persistent countdowns with quick presets, progress bars, optional background alarm audio, and restart/remove controls.
- A persistent stopwatch with start/pause, lap splits, total times, and reset.
- Sample-ID generation and UTC timestamped quick notes.
- Editable reference-aware notes plus versioned JSON import/export, Markdown, BibTeX, and RIS export.
- Reorderable and hideable dashboard modules, compact mode, and a privacy-center data wipe.
- Compact workspace header and a measured masonry-style grid that removes equal-height card whitespace.
- Independently configurable cards for every calculator, reference dataset, language tool, countdown, stopwatch, sample-ID generator, and quick note tool.
- Automatic migration from the earlier composite dashboard cards without deleting workflow data.
- High-density four-column desktop layout sized to keep roughly 8–12 modules in a typical viewport.
- Compact typography, controls, spacing, result panels, and bounded in-card scrolling for long tools and histories.
- A collapsible daily overview with permission-gated weather, a local monthly
  research calendar, quick calculation and conversion tools, scratch notes,
  focus timing, workspace status, daily constants, backups, and weekly goals.

## Added since v0.5

See [`CHANGELOG.md`](CHANGELOG.md) for the full entry.

- A dedicated board-arrangement mode with pointer, touch, pen, and keyboard
  reordering, visible drop positions, edge auto-scroll, persistent order, and
  reduced-motion-aware layout animation.
- Saved multi-source literature searches combine arXiv and Crossref metadata,
  support excluded terms, newest/relevance ordering and bounded result sizes,
  deduplicate DOI/arXiv records, and reuse a one-hour local cache before
  background refresh. Existing notebook and on-device AI actions work on the
  normalized results without a separate data path.
- A local reading inbox separates new, read-later, and read source records. A
  Ctrl/Cmd+K command palette searches modules, notebook notes, and cached
  publications from one keyboard-first surface without a cloud index.
- Named local workspaces preserve independent board layouts across new-tab,
  dashboard, and side-panel surfaces. XRD, vacuum, and thesis-writing starter
  packs—and exported user packs—contain allowlisted layout data only.
- Structured HTTPS JSON monitors track an explicitly selected value with local
  conditions, a thirty-check before/after history, JSON/CSV export, and optional
  user-granted Chrome notifications. General webpage scraping is intentionally
  excluded from this low-permission phase.
- Full versioned backups combine user-owned settings and IndexedDB notebook
  records, validate and preview imports, report conflicts before mutation, and
  keep three local recovery snapshots. Rebuildable caches and Chrome permission
  grants are intentionally excluded.
- Thirteen local-only visual themes spanning paper, clinical, glass, vivid,
  dark, and terminal treatments. The header picker previews each palette and
  saves the choice immediately; the same grouped choices remain available in
  Settings. Themes use only system fonts and packaged code.
- A semantic design-token layer (`src/shell/tokens.css`) covering type,
  spacing, radius, elevation, motion, and theme-controlled surfaces. The theme
  registry lives in `src/platform/themes.ts`, keeping visual presets separate
  from feature components and making future additions data-driven.
- Semantic module families — measure, literature, reference, workflow, record — each with its own accent, replacing per-card colours that had been assigned arbitrarily. The accent shows as a marker rather than as a fill, and filled buttons are monochrome throughout.
- A sticky command bar over the board: live module search, category filter chips with counts, a density toggle, and the visible-module count.
- A module manager dialog grouped by family, with a backdrop, Escape to close, and per-group show/hide.
- A working interface language. The `tr`/`en` preference now drives every string through `src/platform/locales/`; the Options language picker switches the UI immediately. English is the type source of truth, so a missing Turkish key fails the build.

The core extension supports Chrome 114+. Built-in AI controls appear safely as unavailable unless the installed Chrome version, platform, model availability, and hardware meet Chrome's requirements (currently Chrome 138+ for the extension-facing stable APIs).

## Development

Requirements: Node.js 22 or newer and Google Chrome 114 or newer.

```sh
npm install
npm test
npm run typecheck
npm run build:newtab
```

Load the generated `dist` directory from `chrome://extensions` using **Load unpacked**. The alternative build below keeps the browser's existing new-tab page:

```sh
npm run build:dashboard
```

## Privacy baseline

- No account, OAuth, BenchTab backend, or telemetry.
- Notebook records remain local in v1.
- Public sources use optional runtime host permissions. Requests go directly
  from the browser to sources the user enables; those sources can observe the
  request metadata, while BenchTab operates no receiving user-data server.
- No remote executable code or silent cloud AI fallback.
- Countdown audio is generated by a packaged offscreen document; no audio or analytics service is contacted.

This is early development software. Calculator results must be validated against the cited method and should not be used as the sole basis for safety-critical decisions.
