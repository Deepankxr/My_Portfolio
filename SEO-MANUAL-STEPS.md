# Search Console checklist

Run this after approving and deploying the updated portfolio to
**https://deepankar.xyz**. Localhost cannot be crawled by Google. No DNS settings,
Search Console properties or sitemap submissions were changed by the code work.

- [ ] Open [Google Search Console](https://search.google.com/search-console/).
  Add a **Domain** property for `deepankar.xyz` (no scheme or path). Copy Google’s
  DNS TXT record to the domain’s DNS provider, wait for propagation, then verify.
  Keep the TXT record in place. [Google’s verification instructions](https://support.google.com/webmasters/answer/9008080).
- [ ] If DNS is unavailable, add a **URL-prefix** property for
  `https://deepankar.xyz/`. Choose HTML tag and put its `content` value in the
  hosting build environment as `GOOGLE_SITE_VERIFICATION`; rebuild and deploy,
  check View Source for the tag, then click Verify. Alternatively use the exact
  downloaded HTML filename via `GOOGLE_SITE_VERIFICATION_FILENAME`; the committed
  placeholder alone cannot verify ownership. A meta tag cannot verify a Domain property.
- [ ] Before submitting, open `/robots.txt`, `/sitemap.xml`, `/page-sitemap.xml`
  and `/image-sitemap.xml`. Confirm HTTP 200, correct domain/HTTPS URLs and XML
  MIME types. Check one portrait and each project’s OG image directly in a signed-out
  browser. Confirm unknown pages return HTTP 404, not a 200 rewrite.
- [ ] Open **Indexing → Sitemaps** and submit `sitemap.xml`. It discovers both
  children. For separate monitoring, also submit `page-sitemap.xml` and
  `image-sitemap.xml`. Check **Success**, last-read time and parsing/fetch errors.
  If generated shards replace the children, use the current index and names in
  `robots.txt`. [Sitemaps report](https://support.google.com/webmasters/answer/7451001).
- [ ] Use the top **URL Inspection** bar for the homepage and each case study.
  Run **Test live URL**, inspect the rendered page/resources, then **Request indexing**
  if eligible. An indexing request is not a guarantee of inclusion:
  - `https://deepankar.xyz/`
  - `https://deepankar.xyz/work/automated-sales-pipeline.html`
  - `https://deepankar.xyz/work/call-grading-system.html`
  - `https://deepankar.xyz/work/invoice-parsing-system.html`
  - `https://deepankar.xyz/work/finance-document-agent.html`
  [URL Inspection instructions](https://support.google.com/webmasters/answer/9012289).
- [ ] Run the deployed homepage and a case study through
  [Rich Results Test](https://search.google.com/test/rich-results).
  Homepage Person/WebSite markup is descriptive and may show **No items detected**;
  these types do not create a supported rich-result feature by themselves.
  Project pages should detect one valid BreadcrumbList. Also use
  [Schema.org Validator](https://validator.schema.org/) to inspect general schema
  types such as CreativeWork that Google’s rich-result test does not report.
- [ ] After traffic data starts appearing, open **Performance → Search results**,
  change **Search type → Image**, and inspect **Queries** and **Pages** for image
  impressions/clicks. This is the Images performance view; Search Console does not
  provide a general standalone “all images indexed” report.
  [Performance filters](https://support.google.com/webmasters/answer/7576553).
- [ ] In **Sitemaps**, compare discovered page counts and open **See page indexing**
  (or **Indexing → Pages**, filtered by the submitted sitemap) for indexed vs
  unindexed **pages**. These counts are not counts of indexed image files.
  The current build has 26 public pages and 39 distinct image URLs associated with
  them; repeating an image on multiple pages does not create a new unique image.
- [ ] If images are discovered but show no search performance, check their image
  URLs return 200, are not blocked by robots.txt/auth/CDN protection, have the right
  image Content-Type and are linked from an indexable canonical page. Inspect the
  containing page’s rendered HTML/resources, meaningful alt text, surrounding text,
  image quality and canonical. A social-card-only page may not generate much image
  traffic; sitemap discovery does not guarantee Google Images inclusion.
  [Google image SEO guidance](https://developers.google.com/search/docs/appearance/google-images).
- [ ] Allow days to weeks for image discovery, processing and search visibility;
  images can appear later than their pages. This is a practical expectation, not
  a promised Google indexing timeline. Check again after a few days and weekly;
  use persistent fetch/indexing errors as the signal to troubleshoot.
