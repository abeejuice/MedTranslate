# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

---

## [1.2.0] — 2026-05-29

### Added
- **Quick OPD screen**: Instant doctor-patient translation. Doctor speaks
  English → Soniox STT → Sarvam translate → Sarvam TTS plays in patient's
  language. Patient replies in native language → STT with auto-English
  translation shown to doctor. Session saved to IndexedDB.
- **Spotify-style conversation log**: Full-width entries, native text
  prominent (17px bold), GSAP slide-up + fade animation on entry arrival,
  active entry accent glow, `▶ Playing to patient…` indicator during TTS.
- **OPD button redesign**: 3D glass circle with radial-gradient convex depth
  and inner highlight. Rotating conic-gradient orange ring — 5s idle spin,
  1.2s fast spin on hover. Mic icon + OPD label inside.
- **Haptic feedback** on all primary buttons: 12ms tap, 20ms recording start,
  `[8, 40, 8]` double-pulse on stop (Android Chrome / Firefox only).

### Fixed
- **Service worker v17**: Resilient install — individual `cache.add()` calls
  replace `addAll()` so one failed asset no longer aborts the entire install.
  HTML served network-first so CSP headers are never cached stale.
  `skipWaiting()` moved inside `waitUntil` chain to prevent race condition.

### Changed
- Home layout: 32px bottom padding on hero, 20px gap between pill and OPD
  button, horizontal divider line separating the actions zone from sessions.
- Session list gap: 8px → 12px.
- Quick OPD log: removed left/right chat-bubble alignment — all entries
  full-width. Removed romanised transliteration field.

---

## [1.1.0] — earlier

See git log for details.
