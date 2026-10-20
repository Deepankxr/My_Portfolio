# Deepankar’s portfolio

Static portfolio at **https://deepankar.xyz**. The Noir redesign is on
`codex/noir-redesign`. Deployment and Search Console submission wait for the
owner’s approval; these instructions do not deploy anything.

## Stack and build

HTML, CSS and vanilla JavaScript, with GSAP 3.12.5 and native scrolling.
`scripts/build-noir.py` generates routes from shared Python templates and
`content/portfolio.json`; full essays remain in `content/essays/`.
`css/noir.css` defines the existing Archivo/charcoal/coral design.
There is no frontend framework, package.json, TypeScript compiler or lint command.

Python 3.11+ and Pillow are build tools only. Install the small image-rendering
dependency if needed, then build:

```sh
python3 -m pip install -r requirements-build.txt
python3 scripts/build-noir.py
python3 scripts/check-site.py
python3 scripts/check-seo.py
python3 scripts/test-seo.py
node --check js/noir.js
node scripts/test-contact.cjs
```

The build produces 26 indexable routes, a noindexed `404.html`, social cards,
XML sitemaps, `robots.txt`, an RSS feed and `seo-build.json`. It uses no network.
Generated HTML is committed so the portfolio can still be served directly.

For previewing the production output:

```sh
python3 scripts/preview.py
# Open http://127.0.0.1:8767/
python3 scripts/check-seo.py --http-base http://127.0.0.1:8767
curl -sS -D - http://127.0.0.1:8767/sitemap.xml
```

To build a separate preview with local canonical URLs and `noindex` on every page:

```sh
BUILD_ENV=preview SITE_URL=http://127.0.0.1:8767 python3 scripts/build-noir.py
# Restore production artifacts before any release:
BUILD_ENV=production SITE_URL=https://deepankar.xyz python3 scripts/build-noir.py
```

`SITE_URL` is the static generator’s canonical/metadata base, not an HTML `<base>`
tag. Production requires HTTPS and an origin without a path. Production defaults
to the repo’s existing `https://deepankar.xyz`; the brief’s `YOURDOMAIN.com` was a
placeholder. Preview defaults to localhost. No `.env` files are read automatically.

## SEO authoring

Edit `content/seo.json` for route-specific titles, descriptions, social-card
headings, existing sitemap priorities and confirmed social profiles. Every public
route must have a unique title under 60 characters and description of 140–160
characters; the build rejects invalid lengths. It never guesses a GitHub profile.

`scripts/seo.py` extends the existing generator. It reads rendered content images
and real figure captions, takes the largest modern responsive source, adds each
page’s unique 1200×630 OG image and excludes small/decorative/icon assets.
Titles come from alt text, with humanised filenames as fallback. Real captions
are retained; invented captions are not added. Logos and byline avatars are excluded.

- `/sitemap.xml`: index of the generated child sitemaps.
- `/page-sitemap.xml`: all public routes with the original priorities and images.
- `/image-sitemap.xml`: image-bearing pages, priority `0.3`, monthly change frequency.
- `/projects.xml`: RSS of the four case studies, linked in every page’s head.

The generator splits **both** sitemap types when a file would exceed 1,000 image
associations, updates the index/robots entries, and removes obsolete generated
shards. The image-only shards become `image-sitemap-1.xml`, `-2.xml`, etc.
`lastmod` uses the latest Git commit affecting a page or its rendering/content
sources; changed/untracked sources and builds without Git use the build date.
`BUILD_DATE=YYYY-MM-DD` can make an export reproducible.

Google ignores sitemap `priority`/`changefreq`; a separate lower priority sitemap
does not control image rankings. `image:title` and `image:caption` remain in the
XML as requested, although Google deprecated them. The supported discovery field
is `image:loc`. See [Google’s image sitemap reference](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps)
and [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

Homepage JSON-LD contains Person and WebSite. The existing essay search supports
`thoughts.html?q=...`, so SearchAction points there. Google retired the sitelinks
search box; the action describes the real search and does not promise that feature.
Projects use CreativeWork and BreadcrumbList. No public repositories or confirmed
implementation languages were supplied for these client systems, so those fields
and demo links are omitted rather than fabricated. The case studies explicitly
label unmeasured outcomes. Original article bodies and attribution are retained.

Active photos use descriptive filenames and native WebP sources with JPEG
fallbacks. Original asset paths are retained as compatibility aliases for saved
prototype versions; they are not separate sitemap image entries. Per-page OGs are
original, deterministic typographic cards, shipped as JPEG for sharing plus WebP.
The same full Archivo font is served as WOFF2 (189,472 bytes rather than 658,596);
its original font and OFL license remain. No typography or page layout is redesigned.

## Search Console verification

DNS verification is preferred. For the meta-tag fallback, set
`GOOGLE_SITE_VERIFICATION` in the deployment build environment. Only the token,
not a whole `<meta>` tag, is expected. The build escapes it and emits it in all
page heads. Leave it unset to omit the tag. No real token is stored in this repo.

For Google’s HTML-file method, set `GOOGLE_SITE_VERIFICATION_FILENAME` to the exact
Google-issued `googleTOKEN.html` filename. The generator writes the required
`google-site-verification: googleTOKEN.html` response at the static root.
The committed **`googleREPLACE_WITH_SEARCH_CONSOLE_TOKEN.html`** is a noindexed
placeholder explaining setup; it does not verify anything. Meta and file tokens
are different values: do not derive one from the other.

Keep real verification values in the hosting environment and produce artifacts in
the deployment build. Do not commit token-bearing generated HTML/files. Do not
delete an existing verification method after verification; Google may recheck it.
The local server permits verification files but never serves `.env`, source data,
tooling, directory listings or the prior AI video experiments.

## Serving

The root is the static publish directory. `scripts/preview.py` sends XML as
`application/xml; charset=utf-8` and serves the custom missing-page body with HTTP
404 and `X-Robots-Tag: noindex`. Root `404.html` also has a noindex meta tag and is
excluded from all sitemaps. All image URLs are public and need no auth/cookies.

`_headers` provides XML MIME and 404 directives for hosts supporting that format
(Netlify/Cloudflare Pages). No hosting configuration was present in the repository,
so production behavior must be checked after an approved release. Other hosts
must map `.xml` to `application/xml` and unknown paths to `404.html` with status
404, not a 200 SPA rewrite. For Nginx, use `error_page 404 /404.html` and an XML
MIME mapping; for GitHub Pages, keep the root `404.html` and check response headers.

Manual ownership, sitemap submission and indexing steps are in
[SEO-MANUAL-STEPS.md](SEO-MANUAL-STEPS.md). Build/audit evidence and the full file
inventory are in [SEO-IMPLEMENTATION.md](SEO-IMPLEMENTATION.md) and `seo-reports/`.
