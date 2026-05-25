# Kya? What? Entha?

**Structured medical history-taking across India's language barrier.**

*Kya* (Hindi) · *What* (English) · *Entha* (Malayalam) — the same bewildered question a doctor and patient ask each other when they share no language.

![PWA](https://img.shields.io/badge/PWA-offline--ready-F97316?style=flat-square)
![Netlify](https://img.shields.io/badge/deployed-Netlify-00C7B7?style=flat-square)
![Sarvam AI](https://img.shields.io/badge/TTS%20%2F%20translate-Sarvam%20AI-4F46E5?style=flat-square)
![Soniox](https://img.shields.io/badge/STT-Soniox-22C55E?style=flat-square)

---

## The Problem

India has multiple languages and hundreds of regional dialects. A doctor trained in Delhi speaks Hindi. The patient in front of her speaks Tamil. The intern in a Mumbai ward may be taking history from a Bengali-speaking patient.

OPDs run at 50–80 patients per day. A consult is 3 minutes. There is no time for a human interpreter, and none is available at the bedside.

Existing tools fail clinicians:

- **Google Translate** — generic, no medical structure
- **Phone-a-colleague** — slow, not always available, breaks patient confidentiality
- **Hand gestures / simple English** — produces incomplete, unreliable histories
- **Skipping the history** — causes missed diagnoses and poor clinical decisions

Language barrier in clinical settings leads to **missed diagnoses, incomplete histories, incorrect treatment, and patient distress**. This app fixes the history-taking step.

---

## Who Uses It

| Role | Setting | Primary workflow |
|------|---------|-----------------|
| MBBS student | Ward, supervised | Bedside structured history. Reads each question aloud, records patient answer, reviews Q&A log with supervisor. |
| Intern | OPD + ward | Rapid pre-built templates (fever, chest pain, SOB). Rarely needs to type custom questions — the templates cover 80% of cases. |
| Resident (PGY1–3) | OPD + casualty | Pre-built templates + "Ask something else" for specific clinical details. PDF export attached to case notes. |
| Senior Resident / Fellow | Ward rounds | Complex history elements, sometimes switches language mid-session (patient understands both Hindi and Marathi). |
| Consultant | Ward rounds | Quick verification pass — the answered counter shows coverage at a glance without scrolling through every card. |

---

## Use Cases

**OPD triage (3-min consult)**
Doctor picks "Fever" template, selects "Hindi". App translates 14 standard fever questions into Hindi with native script and romanised pronunciation. Doctor reads aloud, holds phone toward patient, records answer. Moves to next question. Done in under 2 minutes.

**Emergency — first contact**
Patient brought in acute distress, family member is the historian. Doctor selects the closest complaint template, uses the custom question bar for family-specific questions. Records all answers. Full Q&A available for the emergency team immediately.

**Ward admission — full history**
Resident takes a structured history over 10–15 minutes. Uses all template questions, adds custom questions for system review. Exports PDF at the end and attaches it to the hospital information system.

**Teaching**
Medical student assigned to a patient who speaks only Malayalam. Uses the app independently, supervised from a distance. Student reads translated questions aloud (practises pronunciation via the romanised guide), records answers. Reviews session summary with the attending for feedback.

---

## Tech Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (PWA)                       │
│  Vanilla JS · Hash router · IndexedDB · Service Worker   │
│                                                          │
│  Home → Session Setup → Session → Summary → Past         │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS POST
              ┌────────────┼─────────────┐
              ▼            ▼             ▼
       /api/translate  /api/tts     /api/stt
       Sarvam Mayura   Sarvam       Soniox STT
       v1 + Sarvam     Bulbul       stt-async-v3
       transliterate   (base64      (async poll +
                        WAV)        built-in en
                                    translation)
```

### Frontend

**Zero-dependency vanilla JS.** No React, no Vue, no build step. A `<script type="module">` in `index.html` is the entire entry point. This was a deliberate choice: hospital networks are slow and unreliable, and a 200 KB framework bundle is a bad trade for a tool that must load on 3G.

**Router** — hash-based SPA (`#home`, `#session`, etc.) defined in `src/router.js`. Each screen is a module that exports `register()`. Screen transitions are CSS animations. Screens receive a `_unmount` DOM event for cleanup (removing event listeners, aborting fetch requests).

**Storage** — `src/db.js` wraps IndexedDB in a thin Promise-based API. Two object stores:
- `sessions` — full Q&A log, patient label, template, language, timestamps, duration
- `translationCache` — keyed by `translations_v2:{templateId}:{langCode}`, stores native + romanised per question

**Service Worker** (`service-worker.js`) — versioned cache (`medtranslate-v8`). Install-time caches all static assets. Fetch handler:
- `/api/*` — network-first (always fresh)
- `fonts.googleapis.com` / `fonts.gstatic.com` — cache-first with runtime population (Noto Sans offline)
- everything else — cache-first

**Animations** — `src/animations.js` wraps GSAP for card stagger entrance, orb (recording/speaking visualiser), card expand/collapse, and button pulse feedback.

### Netlify Functions (ESM)

**`/api/translate`** (`netlify/functions/translate.mjs`)
Takes an array of English question strings + target language code. Calls:
1. Sarvam AI Mayura v1 (`/translate`) — returns native-script translation
2. Sarvam AI (`/transliterate`) — returns romanised pronunciation guide

Both are called per question. Responses are batched and cached in IndexedDB to avoid repeat API calls on language re-select.

**`/api/tts`** (`netlify/functions/tts.mjs`)
Takes native-language text + Sarvam language code. Calls Sarvam Bulbul TTS. Returns base64-encoded WAV played via the Web Audio API.

**`/api/stt`** (`netlify/functions/stt.mjs`)
Takes base64 audio blob + MIME type. Flow:
1. Upload audio to Soniox (`/files`)
2. Submit transcription job with `translation: { type: "one_way", target_language: "en" }`
3. Poll until complete (max 15 × 1.5 s = 22.5 s)
4. Fetch transcript — Soniox returns native tokens with `translated_text` per token
5. Return `{ original (native language), english (Soniox built-in translation) }`

### Medical Templates

11 chief complaint templates, 161 questions total, defined in `src/data/templates.js`.

| Template | Questions |
|----------|-----------|
| Fever | 14 |
| Chest Pain | 16 |
| Shortness of Breath | 14 |
| Abdominal Pain | 16 |
| Headache | 14 |
| Joint Pain | 14 |
| Urinary Symptoms | 14 |
| Skin Rash | 12 |
| Fatigue / Weakness | 13 |
| Vomiting / Nausea | 12 |
| Trauma / Injury | 12 |

Questions follow SOCRATES / systems-review structure. All are phrased as closed or short-answer questions a patient can answer with a nod, a number, or a brief phrase — designed for cross-language use.

### Language Support

| Language | Script | Sarvam code |
|----------|--------|------------|
| Hindi | Devanagari | `hi-IN` |
| Telugu | Telugu | `te-IN` |
| Tamil | Tamil | `ta-IN` |
| Malayalam | Malayalam | `ml-IN` |
| Bengali | Bengali | `bn-IN` |
| Marathi | Devanagari | `mr-IN` |
| Nepali | Devanagari | `ne-NP` |

Noto Sans is loaded from Google Fonts to render all scripts correctly. It is cached offline by the service worker on first load.

---

## Versioning

### Service Worker Cache

| Version | What changed |
|---------|-------------|
| v1–v3 | PWA shell, hash router, IndexedDB storage layer |
| v4–v5 | Netlify Functions — translate, TTS, STT |
| v6 | Session summary, PDF / text export, past sessions screen |
| v7 | UX audit batch 1 — bottom sheets, keyboard avoidance, language grid |
| v8 | UX audit batch 2 — offline fonts, popstate intercept, answered counter |

Bump `CACHE_NAME` in `service-worker.js` any time a static asset changes. The activate handler deletes all previous-version caches automatically.

### Pinned Model IDs

| Artefact | Value | Why pinned |
|----------|-------|-----------|
| SW cache | `medtranslate-v8` | Explicit version control |
| Translation cache key | `translations_v2:` | v2 after template schema refactor — v1 keys silently ignored |
| Sarvam translate model | `mayura:v1` | `mode: "formal"` — casual mode gives worse clinical phrasing |
| Soniox STT model | `stt-async-v3` | Async required; sync model times out on mobile audio lengths |

---

## Debugging History

### Batch 1 — Critical / High severity (May 2026)

**`window.confirm()` blocked in standalone PWA mode.**
On some Android browsers, `window.confirm()` returns `false` immediately without showing a dialog when the app is installed as a PWA (no browser chrome). This silently prevented users from ending or deleting sessions. Fixed by replacing all confirmation dialogs with a custom `showBottomSheet()` utility (`src/utils.js`) that renders a native-feeling bottom sheet with animated slide-up and backdrop.

**iOS software keyboard covers fixed footer.**
When the patient name input is focused in Session Setup, the iOS software keyboard raises the visual viewport but leaves `position: fixed` elements in place — the "Begin Session →" button was hidden under the keyboard. Fixed using the `visualViewport` API: a resize listener calculates the keyboard height and applies a `translateY` transform to the footer. Same fix applied to the custom question bar in the Session screen.

**Language selector clipped off-screen on 375 px devices.**
The language picker was a horizontally scrolling flex row. On 375 px wide screens (iPhone SE, older Android) the row overflowed with no visual affordance that more options existed, and scroll-snap targets were hard to hit. Rebuilt as a 2-column CSS Grid — all 7 languages visible at once, no scrolling required.

**✕ and "End" buttons conflicted.**
The session header had ✕ (close/discard) on the left and "End" (save + exit) on the right. Both small, adjacent, with opposite consequences. Doctors reported accidentally tapping ✕ and losing consultation data. ✕ removed entirely. ← Back button added. Both ← and "End" now trigger the same "End Session?" bottom sheet (Save & Exit / Discard / Cancel).

**Export buttons hidden on empty sessions.**
Session Summary only showed Export PDF / Export Text if `qaLog.length > 0`. A doctor might open a session, not record any answers, and still want a timestamped PDF record (e.g., patient refused to answer). Condition removed — exports always visible.

**Mic denied toast vanished in 2 s.**
Default toast duration was too short to read and act on. Mic permission errors now show for 5 s with actionable text: "Mic access denied — enable it in your browser settings".

### Batch 2 — Medium / Minor severity (May 2026)

**Hero h1 duplicated the header title.**
The home screen rendered an `<h1>` "Kya? What? Entha?" in the hero section, identical to the app header above it. Wasted vertical space and looked like a layout error on small screens. The h1 was removed; the tagline and Start button fill the space cleanly.

**Browser back gesture abandoned active sessions.**
Swipe-back on iOS or the Android back button triggered `popstate`, which the hash router treated as navigation — it unmounted the session screen and navigated home, discarding the in-progress consultation with no warning. Fixed by intercepting `popstate` in the session screen: `history.pushState` keeps the URL stable and the event handler shows the exit bottom sheet instead. The listener is registered on mount and removed on unmount to avoid leaks.

**Unicode symbols rendered inconsistently.**
Play (▶), Record (●), and Stop (■) Unicode characters rendered at wildly different sizes across Android font stacks. On some devices they appeared as boxes (missing glyph). Replaced with plain text: "Play in Hindi", "Record Answer", "Stop Recording".

**Noto Sans re-fetched on every session start.**
The Google Fonts stylesheet and woff2 files were fetched from the network on each page load. In areas with poor connectivity (hospital basements, rural settings) this caused a flash of unstyled text or broken Devanagari rendering mid-consultation. Fixed by adding a cache-first strategy in the service worker's fetch handler for `fonts.googleapis.com` and `fonts.gstatic.com`. Runtime caching (not `addAll`) was required because Google Fonts responses are CORS-opaque — `addAll` in the SW install handler fails on these URLs.

---

## Local Development

```bash
# Clone
git clone https://github.com/abeejuice/MedTranslate.git
cd MedTranslate

# Environment
cp .env.example .env
# Fill in SARVAM_API_KEY and SONIOX_API_KEY

# Install Netlify CLI
npm install

# Run (local functions + hot reload)
npm run dev
# Opens http://localhost:3000
```

### Environment Variables

| Variable | Provider | Used by |
|----------|----------|---------|
| `SARVAM_API_KEY` | sarvam.ai | `translate.mjs`, `tts.mjs` |
| `SONIOX_API_KEY` | soniox.com | `stt.mjs` |

---

## Deployment

1. Push to GitHub
2. Connect repo to Netlify (Import project)
3. Set the three env vars in Netlify → Site settings → Environment variables
4. Deploy — no build command, publish directory is `.` (root)

Netlify detects `netlify/functions/` automatically. The PWA manifest and service worker are served from root.

---

## Project Structure

```
.
├── index.html                  # PWA entry point
├── manifest.json               # PWA manifest
├── service-worker.js           # Offline cache (v8)
├── styles/
│   └── main.css                # Design system (Warm Ember tokens)
├── src/
│   ├── app.js                  # SW registration, screen bootstrap
│   ├── router.js               # Hash-based SPA router
│   ├── db.js                   # IndexedDB (sessions + translation cache)
│   ├── utils.js                # showBottomSheet(), escapeHtml()
│   ├── animations.js           # GSAP helpers (orb, stagger, expand)
│   ├── toast.js                # Toast notification utility
│   ├── data/
│   │   └── templates.js        # 11 templates, 161 questions, 7 languages
│   └── screens/
│       ├── home.js
│       ├── session-setup.js
│       ├── session.js
│       ├── session-summary.js
│       └── past-sessions.js
└── netlify/
    └── functions/
        ├── translate.mjs       # Sarvam translate + transliterate
        ├── tts.mjs             # Sarvam Bulbul TTS
        └── stt.mjs             # Soniox STT with built-in en translation
```

---

*Built for the doctors who spend 3 minutes with a patient and need every second to count.*
