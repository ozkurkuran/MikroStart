# Chrome Web Store release guide

This repository produces one Web Store edition: the **new-tab** build. The
dashboard build is for local installation only and must not be uploaded as a
second store item.

## Build the upload package

Requirements: Node.js 22 or newer and a clean dependency install.

```sh
npm ci
npm run release:verify
```

The command runs all tests, TypeScript checking, a production build, manifest
and asset validation, and creates:

- `artifacts/benchtab-v<version>-chrome.zip`
- `artifacts/benchtab-v<version>-chrome.zip.sha256`

The ZIP has `manifest.json` at its root, contains no source maps or remote
scripts, and includes 16, 32, 48, and 128 px PNG icons. Upload the ZIP itself,
not the `dist` or `artifacts` directory.

## Store listing copy

### English

**Title:** BenchTab

**Summary:** A local-first workbench for following, calculating, and recording experimental research.

**Detailed description:**

BenchTab turns Chrome's new-tab page into a private research workspace for
following literature, running repeatable calculations, and recording
experimental work.

- Follow RSS/Atom sources and saved arXiv or Crossref searches.
- Search a local reading inbox and research notebook from one command palette.
- Use packaged scientific calculators, constants, and reference data offline.
- Organize notes, timers, calendars, source monitors, and workspaces locally.
- Export versioned backups and common research citation formats.
- Use compatible Chrome on-device AI features with no cloud fallback.

BenchTab requires no account and includes no telemetry or advertising. Online
sources, weather, location, clipboard reading, and notifications are optional
and requested only from the feature that needs them. Adding BenchTab replaces
Chrome's new-tab page with the research workspace.

### Turkish localization

**Title:** BenchTab

**Summary:** Deneysel araştırmaları takip etmek, hesaplamak ve kaydetmek için yerel öncelikli çalışma alanı.

**Detailed description:**

BenchTab, Chrome'un yeni sekme sayfasını literatür takibi, tekrarlanabilir
hesaplamalar ve deneysel çalışma kayıtları için özel bir araştırma alanına
dönüştürür.

- RSS/Atom kaynaklarını ve kayıtlı arXiv ya da Crossref aramalarını takip edin.
- Yerel okuma gelen kutusunda ve araştırma defterinde tek paletten arama yapın.
- Paketli bilimsel hesap makinelerini, sabitleri ve referans verilerini çevrimdışı kullanın.
- Notları, zamanlayıcıları, takvimi, kaynak monitörlerini ve çalışma alanlarını yerelde düzenleyin.
- Sürümlü yedekler ile yaygın atıf biçimlerini dışa aktarın.
- Uyumlu Chrome cihaz içi yapay zekâ özelliklerini bulut yedeği olmadan kullanın.

BenchTab hesap, telemetri veya reklam gerektirmez. Çevrimiçi kaynak, hava
durumu, konum, pano okuma ve bildirim izinleri isteğe bağlıdır ve yalnızca ilgili
özellikten istenir. BenchTab eklendiğinde Chrome'un yeni sekme sayfası araştırma
alanıyla değiştirilir.

**Primary category:** Productivity

**Homepage:** <https://github.com/ozkurkuran/MikroStart>

**Support URL:** <https://github.com/ozkurkuran/MikroStart/issues>

**Privacy policy:** <https://github.com/ozkurkuran/MikroStart/blob/main/docs/PRIVACY.md>

## Privacy practices answers

**Single purpose:** Turn Chrome's new-tab page into a local-first workspace for
following, calculating, organizing, and recording experimental research.

**Permission justifications:**

- `storage`: Stores user-created research data, settings, workspaces, source
  configuration, and bounded caches in the user's Chrome profile.
- `alarms`: Keeps user-created countdowns and enabled source refresh schedules
  working while the new-tab page is closed.
- `sidePanel`: Shows the same research workspace in Chrome's optional side
  panel when the user opens it.
- `offscreen`: Creates a packaged audio-only document when a user-enabled
  countdown alarm needs to play.
- `clipboardRead` (optional): Reads clipboard text only after the user selects
  Paste, so a number can be moved into the calculator.
- `geolocation` (optional): Reads the current coordinates only after the user
  selects Use my current location for weather.
- `notifications` (optional): Shows a local Chrome notification only for a
  source monitor on which the user enables notifications.
- `https://*/*` (optional host access): Supports user-entered HTTPS RSS/Atom and
  JSON API origins. Although the declaration must cover possible HTTPS hosts,
  BenchTab requests only the exact origin selected by the user, from that
  feature's visible action. It never receives required blanket host access.

**Remote code:** Select **No, I am not using remote code.** All executable code
is packaged. External endpoints return feed, publication, weather, or JSON data
only; responses are not evaluated as code.

**Data-use disclosure:** Disclose locally handled user-provided research
content, website/source content, and optional coarse or precise location under
the closest categories currently shown by the dashboard. State that the
developer does not receive this data. Certify all Limited Use statements. Keep
these answers aligned with `docs/PRIVACY.md`; do not select “no data” merely
because most processing is local.

## Reviewer notes

BenchTab is local-first and has no developer-operated backend. Required
permissions support storage, timers, side-panel access, and packaged alarm
audio. Every sensitive or host permission is optional and requested from a
visible user action with an adjacent disclosure:

1. Add an RSS/Atom URL to see an exact-origin Chrome prompt.
2. Save an arXiv/Crossref search to see provider-origin prompts.
3. Add a structured JSON monitor to see its exact-origin and optional
   notification prompts.
4. Use Weather or Paste to see optional location/host or clipboard prompts.
5. Open Settings → Privacy Center to inspect granted origins, open the privacy
   policy, export a backup, revoke data by deletion, or remove all local data.

The extension uses the URL Overrides API for its disclosed new-tab behavior.
It injects no content scripts and reads no browsing history.

## Graphic assets

- Store icon: `store-assets/store-icon-128.png` (128x128 PNG)
- Small promo tile: `store-assets/small-promo-440x280.png` (440x280 PNG)
- Screenshots: one to five real, current product captures at 1280x800 or
  640x400, full bleed with square corners

Capture at least one screenshot after loading the final `dist` directory from
`chrome://extensions`. Use the new-tab workspace itself; do not use a mockup,
generated UI, browser chrome, personal notes, private source URLs, or permission
dialogs. Recommended captures are the default workspace, calculator/reference
modules, literature/reading workflow, workspace manager, and Privacy Center.

## Dashboard submission checklist

1. Enable two-step verification on the publishing Google Account and complete
   Chrome Web Store developer registration.
2. Create a new item and upload the versioned ZIP.
3. Add the English listing and optional Turkish localization above.
4. Upload the store icon, small promo tile, and at least one real screenshot.
5. Complete the Privacy practices fields exactly as documented above and add
   the public privacy-policy URL.
6. Choose distribution visibility and regions deliberately; leave the item as
   a draft if either choice is undecided.
7. Save the draft, resolve every dashboard warning, and submit for review.
