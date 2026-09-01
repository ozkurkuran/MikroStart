# BenchTab Privacy Policy

Effective date: September 1, 2026

BenchTab turns Chrome's new-tab page into a local-first research workspace. It
does not require an account and the developer operates no BenchTab server.

## Data handled on your device

BenchTab stores the information needed to provide its user-facing features in
your Chrome profile. This can include preferences, workspace layouts, notes,
references, calendar entries, timers, source and monitor configuration, reading
state, cached publication metadata, selected monitor values, and recovery
snapshots. Depending on the feature, Chrome local storage, extension page local
storage, or IndexedDB is used.

BenchTab does not add data to Chrome Sync during normal operation. The backup
tool can read or restore existing BenchTab values from Chrome's sync storage if
such values are present in an imported or older profile. A backup is downloaded
only when you request it.

## Optional permissions and external requests

BenchTab asks for optional access only when you activate a feature that needs
it:

- **HTTPS source access:** When you add an RSS/Atom source or JSON monitor,
  Chrome asks for access to that exact origin. Requests go directly from your
  browser to the source you selected. The source can receive the URL, query,
  IP address, and standard request metadata.
- **Literature search:** Search terms are sent directly to the enabled arXiv or
  Crossref API after you save a search and grant access. Results are cached on
  your device.
- **Weather:** A place name or, if you explicitly choose current location,
  coordinates are sent directly to Open-Meteo after you grant access. BenchTab
  does not collect background location.
- **Clipboard:** Clipboard text is read only after you select the Paste action.
  BenchTab extracts a number for its calculator and does not send the clipboard
  contents to the developer.
- **Notifications:** Chrome notifications are used only for monitors for which
  you enable notifications.
- **External translation and dictionary links:** Text is sent to Google
  Translate or Tureng only when you deliberately open the corresponding link.
  The destination service's privacy policy then applies.

Chrome's built-in on-device AI features, when available and explicitly used,
run through Chrome's packaged APIs. BenchTab has no cloud-AI fallback.

## Collection, sharing, and retention

The developer does not receive, collect, sell, rent, or use BenchTab user data
for advertising, profiling, analytics, or credit decisions. There is no
telemetry or advertising SDK. No developer employee or contractor can read data
that remains in your Chrome profile.

External services receive only the information described above when required
for the feature you selected. BenchTab uses HTTPS for those requests and does
not transfer user data for unrelated purposes.

Local data remains until you remove it, delete all data from BenchTab's Privacy
Center, uninstall the extension and clear its storage, or replace it through the
explicit restore flow. Removing all data also revokes removable optional
permissions. Data retained by an external source is governed by that source's
own policy.

## Chrome Web Store Limited Use disclosure

BenchTab's use of information received from Chrome APIs adheres to the Chrome
Web Store User Data Policy, including the Limited Use requirements. Information
is used only to provide or improve BenchTab's disclosed research-workspace
features. It is not transferred except as necessary to provide a user-requested
feature, for security, to comply with applicable law, or as part of a merger or
acquisition with prior user consent. It is never used for personalized
advertising, sold to data brokers, or made available for humans to read except
where the policy expressly permits it.

## Changes and contact

Material changes to these practices will be disclosed in BenchTab before new
data handling begins and reflected in this policy. Questions and privacy
requests can be filed through the project's public support tracker:

<https://github.com/ozkurkuran/MikroStart/issues>
