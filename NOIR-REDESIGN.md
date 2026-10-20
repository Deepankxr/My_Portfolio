# Noir portfolio

Complete static redesign on `codex/noir-redesign`, based on `staging` at
`12a0853`. The original site remains on `staging`; no deployment is performed.

## Preview

From this checkout:

```sh
python3 scripts/preview.py
```

Open <http://127.0.0.1:8767/>. The local server serves public site files only;
credentials, content sources, tooling and the previous video experiments are
not accessible through it. Use `--port 8768` if another preview occupies 8767.

## What's included

- Homepage with the original black-and-white speaking photograph, rotating
  headline, linked portrait, four case studies, six experience entries,
  speaking, capabilities, writing and the existing enquiry form.
- Photo-led About story, including graduation, enterprise events, the n8n
  Builders Challenge, family, Qixazow and the full tool stack. Its portrait
  drifts, shrinks slightly and dissolves into the background on scroll.
- Work index and four complete project pages with illustrated architectures,
  problem/system/result content, tool stacks and next-project navigation.
- Searchable archive of all 17 essays, shareable topic/search URLs, empty
  state and browser-history support.
- All 17 article pages, preserving the article bodies and SEO metadata,
  with contents navigation, reading progress, copy-link and related essays.
- Restyled privacy page with its original legal copy preserved.
- Shared navigation, keyboard focus, mobile menu, light/dark themes and
  reduced-motion support, plus an explicit motion toggle.

The rejected AI videos are not referenced by any of the 26 finished pages.
Only the original photos and retained technology logos are used.

## Editing and rebuilding

The site is ready to serve as static HTML; it needs no Node build or package
installation. `content/portfolio.json` holds the retained project, career,
About and article metadata. `content/essays/` contains the full essay bodies;
`content/privacy.html` contains the retained privacy text.

The shared templates are in `scripts/build-noir.py`. After a content/template
edit, regenerate the static pages:

```sh
python3 scripts/build-noir.py
python3 scripts/check-site.py
node scripts/test-contact.cjs
node --check js/noir.js
```

Presentation lives in `css/noir.css`, interaction in `js/noir.js`, and the
initial theme choice in `js/noir-theme.js`. Archivo is self-hosted with its
OFL license in `assets/fonts/`. Animation libraries retain the original
version-pinned jsDelivr sources and integrity hashes.

## Contact behavior

Both original form locations retain the field order, names and JSON payload:
`name`, `email`, `role`, `company`, `budget`, `budget_value`, `message`,
`source`, `submitted_at`. The existing endpoint in `js/config.js` is retained.
An untouched budget sends an empty label and a null numeric value. A failed
request or missing configuration reports failure and offers direct email.

The local tests mock the network. They cover both page sources, optional and
selected budgets, validation, success, HTTP failure, network failure and
missing configuration. No live test enquiries were sent.

## Verification

- 26 pages and 959 local references checked, with no missing files/anchors.
- All 17 full essay bodies and the privacy text checked for preservation.
- All 26 pages inspected at 320 × 800 and at 1440 × 960 in the light theme:
  no horizontal overflow or broken loaded images.
- Representative home, About, work and article layouts visually reviewed.
- Archive search, topic filtering and empty-state recovery tested in browser.
- Mobile navigation, motion controls, theme persistence and the portrait
  dissolve checked in browser; no browser console errors observed.
- Shared body-text and accent colors exceed WCAG AA text contrast in both
  themes. The original hero photo is fully grayscale.

Details are in `noir-verification.json` and
`noir-browser-verification.json`; screenshots are in `noir-previews/`.

## Comparing versions

Use the app's branch review or:

```sh
git diff staging...codex/noir-redesign
git log --oneline codex/noir-redesign
```

The redesign commit is a local checkpoint for future versions. The previous
mockup and video experiments remain separate local working files and are not
part of this production source checkpoint.

## Design audit and decisions

The original site combined Inter, Space Grotesk and Playfair, blue accents,
glass navigation and a WebGL fence/stage hero. It already had substantial
project, career and writing content, working enquiries and useful article
navigation. Its page URLs, original article metadata, contact payload and
legal copy were the preservation baseline.

This overhaul follows the approved mockup's editorial direction: Archivo,
charcoal/off-white, one coral accent, a small stacked name, large asymmetric
type, staggered work and genuine personal photographs. The reference informed
the hierarchy, hover labels and motion language; the implementation and all
portfolio content are Deepankar's. No reference-site photography, fonts,
source code or project content is shipped.

Motion is limited to headline state changes, pointer feedback, content reveals,
navigation and the requested About portrait dissolve. The home photograph
stays static, and all content remains available without animation libraries.

## Scroll correction, 20 October 2026

Wheel, trackpad and touch scrolling now use the browser's native behavior.
The previous Lenis controller competed with CSS smooth scrolling, producing
lag and unstable scroll positions. Its controller, ticker and script include
have been removed from every generated page. GSAP still observes native scroll
positions for reveals, reading progress and the About portrait dissolve.
Native anchor navigation keeps enough clearance beneath the fixed header
on desktop and mobile. The About correction below also removes CSS smooth
scrolling, which could interfere with ScrollTrigger refresh measurements.
Generated CSS/JS URLs include content hashes so subsequent navigation loads
the corrected assets. Browser checks in `noir-scroll-verification.json` cover
repeated wheel input, direction changes, idle stability, menu scroll locking,
anchor landing positions, the portrait dissolve and article reading progress.


## About navigation and portrait motion, 20 October 2026

The homepage speaking photograph still opens `/about/#speaking`. The About
hero now uses one reversible GSAP timeline with explicit starting values,
rather than two ScrollTriggers competing over the portrait's visibility.
Load, font readiness, hash navigation and browser history restores synchronize
that timeline with the native scroll position. A `pageshow` handler rebuilds
animations after a back/forward cache restore; `pagehide` releases them.

The portrait stays centered, lifts by at most 28px and recedes to 96% scale.
A feathered veil and edge vignette dissolve it into the current theme's
background. Only transforms and opacity animate. There is no fullscreen
zoom, downward fly-out, pinning, scroll controller or new dependency. The
caption and summary fade before they cross the photograph. Pause motion and
reduced-motion preferences keep the photograph static in the hero.

The name now fits tightly around a smaller portrait on desktop. On mobile it
reads as one continuous name above the photograph. Tablet typography stays
on a single line. All generated pages receive new content-hashed assets.

References consulted:
- [Motion: scroll-linked animation](https://motion.dev/docs/scroll)
- [GSAP: competing ScrollTriggers and CSS smooth-scroll refresh mistakes](https://gsap.com/resources/st-mistakes/)
- [GSAP ScrollTrigger: scrubbed timelines](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)

Browser regression evidence and measured states are saved in
`noir-about-motion-verification.json`; before-story, restored-top and
mid-dissolve screenshots are in `noir-previews/`. This change is local to
`codex/noir-redesign` and has not been pushed or deployed.
