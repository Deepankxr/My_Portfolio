# Portfolio SEO implementation — 21 October 2026

Local work on `codex/noir-redesign`. No push, merge, release, DNS change or Search
Console property/sitemap submission has been performed. The Google code tests
below were separately approved by the owner.

## Stack found before editing

Static HTML, CSS and vanilla JavaScript with GSAP 3.12.5. Shared Python templates
in `scripts/build-noir.py` generate the root, About, work and blog routes from
retained content. Original build: `python3 scripts/build-noir.py`. No framework,
Node package build, TypeScript or configured lint task. The existing XML sitemap
held 26 URLs with priorities and hand-maintained dates. Existing heads had
canonicals, shared OG imagery, Person and article JSON-LD.

## Completed changes

- Extended the same Python generator with `scripts/seo.py`, driven by
  `content/seo.json`. The old sitemap routes/priorities are preserved in the page
  child; the root becomes an index. No parallel site generator was added.
- Generated page and image sitemaps, Git-derived dates, splitting at 1,000 image
  associations per file, crawler access and absolute HTTPS image URLs. Actual
  captions and alt text are retained; icons/decorative assets are excluded.
- Added environment-driven canonical bases, verification meta/file hooks, robots
  preview directives, unique titles/descriptions and 1200×630 social cards.
- Added Person/WebSite, CreativeWork/BreadcrumbList and refreshed BlogPosting
  JSON-LD while retaining original article dates and attribution. The existing
  `thoughts.html?q=...` search is reflected in SearchAction.
- Expanded the four original client-system case studies: problem, implementation,
  stack, unmeasured outcomes, source/demo availability and contextual internal links.
- Updated active image references to descriptive filenames, native WebP/JPEG
  fallbacks, explicit dimensions, asynchronous decoding and loading priorities.
- Added a static noindexed 404, project RSS, XML serving rules, documentation and
  regression checks. Compressed the same Archivo font to WOFF2 without subsetting.
- Fixed image-wrapper regressions reported during review: the hero’s portrait
  retains its rounded pill shape; the lower About photo stays in its intended grid
  column and is capped at 340px on desktop / 300px on mobile (shrinking to fit).
  The existing photo, type, color scheme and motion features remain.

## Verification output

```text
python3 scripts/build-noir.py
SEO: 26 public pages, 61 image associations; sitemap.xml, page-sitemap.xml, image-sitemap.xml
Built 27 pages. Retained all 17 essays and original routes.

python3 scripts/check-site.py
27 pages; 1,126 local references; 17 original essays and privacy copy preserved; errors: []

python3 scripts/check-seo.py --http-base http://127.0.0.1:8767
26 indexable pages; 242 img elements; 39 unique sitemap image URLs; errors: []
71 local HTTP responses checked, including every image and missing-page response.
All three sitemaps and RSS return application/xml; unknown page returns HTTP 404.

python3 scripts/test-seo.py
Ran 5 tests — OK
Covers environment/verification handling, 1,001-image splitting and cleanup,
real captions, exclusions, responsive sources, Git dates and fallback dates.

node --check js/noir.js / js/noir-theme.js / js/config.js
All three checked individually — no errors.
Python syntax: all scripts parsed with ast.parse — no errors.
git diff --check — no whitespace errors.

node scripts/test-contact.cjs
PASS: payload compatibility, both page sources, optional/selected budget,
$40k/$41k/$45k/$50k charge thresholds, keyboard updates, submission during
budget animation, required fields, success, HTTP/network/unconfigured failures.
No network used by the form regression test; no real enquiry submitted.
```

The actual curl response from the preview:

```xml
<?xml version='1.0' encoding='utf-8'?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://deepankar.xyz/page-sitemap.xml</loc><lastmod>2026-10-21</lastmod></sitemap>
  <sitemap><loc>https://deepankar.xyz/image-sitemap.xml</loc><lastmod>2026-10-21</lastmod></sitemap>
</sitemapindex>
```

```text
HTTP/1.0 200 OK
Content-type: application/xml; charset=utf-8
```

Lighthouse 13.5.0, default mobile simulated throttling, temporary headless Chrome
profiles against local production artifacts:

| Page | Performance | Accessibility | Best Practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Home | 92 | 100 | 100 | 100 |
| Sales-pipeline case study | 97 | 100 | 100 | 100 |

Both Lighthouse runs have zero run warnings, zero runtime errors and pass the
console-error audit. Both report CLS 0 and total blocking time 0ms. Before font
compression the home Performance score was 79; WOFF2 reduces the font from
658,596 to 189,472 bytes. Scores vary across runs and production hosting.
Full HTML/JSON audits are under `seo-reports/`. A repeat build produced identical
bytes for all 85 checked outputs (HTML, cards, XML, robots and manifest).

Google Rich Results Test, **code input** of the generated homepage and case study:

- Home: **No items detected**. Person/WebSite alone are not supported rich-result
  items. Local schema/field checks pass; no fabricated feature type was added.
- Project: **1 valid item detected — Breadcrumbs**.
- Exact Google result links and screenshots: `seo-reports/rich-results.json`.
  Code input validates structure; a public production crawl remains a release check.

16 responsive browser checks covered 1440, 1024, 768, 541, 390 and 320px layouts,
including touch, a keyboard portrait link, real query-string search and the root,
About, work, case study and article templates. No horizontal overflow or broken
loaded images were observed. One pre-existing native cross-document View
Transition abort was captured during rapid scripted navigation between pages;
that CSS feature predates these changes. Fresh Lighthouse navigation logs are
clean. Detailed evidence is `seo-reports/responsive-verification.json`.

## Assumptions and deviations

- Used the repo’s existing **deepankar.xyz**, not the `YOURDOMAIN.com` placeholder;
  environment configuration supports an approved domain change or local preview.
- The repo has four client automation cases, not NodeBuilder/Notetaker/OpSign
  product code. Only this portfolio was changed. No public demos, repositories,
  source languages or numerical outcome evidence were supplied, so these were
  not invented. CreativeWork is used rather than claiming published source code.
- Original image paths remain compatibility aliases for saved prototype versions.
  The active portfolio uses the new descriptive paths; originals are not extra
  sitemap entries. Only real photographs are used, with no AI alterations.
- Google deprecated image:title/image:caption and ignores sitemap priority and
  changefreq. Requested fields are preserved, without claiming ranking control.
  SearchAction describes the real archive search; Google’s retired sitelinks box
  is not promised. See official references in README.md.
- No production hosting configuration existed. `_headers` supports Netlify and
  Cloudflare Pages; equivalent XML/404 rules must be confirmed on the actual host
  after approval. Local HTTP behavior has been verified. No production release
  or crawl was attempted.
- Real Search Console verification values were not supplied. Hooks and the
  explicitly named placeholder exist; nothing is falsely marked verified.
  Owner UI steps are in SEO-MANUAL-STEPS.md.

## File inventory

The complete per-file list is in `seo-reports/changed-files.json`. In groups:

- Authoring/build: `content/seo.json`, project fields in `content/portfolio.json`,
  `scripts/build-noir.py`, `scripts/seo.py`, `requirements-build.txt`, `.env.example`.
- Shared presentation: targeted image/heading rules in `css/noir.css`; compressed
  `assets/fonts/archivo-variable.woff2`. No interaction script rewrite.
- Generated HTML: home, About, work index, four case studies, thoughts archive,
  17 articles, privacy and the new 404.
- Generated discovery: sitemap index, both children, robots.txt, projects.xml,
  per-page OG JPEG/WebP assets, descriptive public photo aliases, seo-build.json.
- Serving/verification: `scripts/preview.py`, `_headers`, and the noindexed
  `googleREPLACE_WITH_SEARCH_CONSOLE_TOKEN.html` placeholder.
- Checks/evidence: `scripts/check-site.py`, `scripts/check-seo.py`,
  `scripts/test-seo.py`, noir-verification.json, seo-verification.json,
  Lighthouse/Rich Results/responsive JSON/HTML/screenshots in seo-reports/.
- Documentation: README.md, SEO-MANUAL-STEPS.md and this report.

Unrelated pre-existing changes to `.claude/launch.json`, `.gitignore`, `.agents/`,
`js/vendor/` and `redesign/` were preserved and excluded from the local checkpoint.
