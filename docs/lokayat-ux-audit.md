# Lokayat site — UX audit and fixes

Audit of the Lokayat instance (`lokayat.103.212.120.129.sslip.io`), every published page, at desktop (1280px) and phone (390px) widths.
Method: a Playwright crawl measuring tap-target size, text contrast, heading structure, image attributes, text size and line-height
(including Devanagari), horizontal overflow, link text and page height, plus visual review of screenshots of each template.
Numbers below are *before* (first crawl, 52 URLs) vs *after* (same crawl re-run after the fixes) on the 37 pages that are still published.

## Research: what good looks like

| Practice | Source |
|---|---|
| Keep the main action (join/donate) one click away on every page; use plain labels; don't bury volunteer sign-up in menus | [Nielsen Norman Group – donations](https://www.nngroup.com/articles/donations-nonprofit-charity-online/), [CanadaHelps – UI/UX building blocks](https://www.canadahelps.org/en/charity-life/digital-marketing/the-ui-ux-building-blocks-of-a-high-performing-charity-website/), [Neon One](https://neonone.com/resources/blog/nonprofit-website-best-practices/) |
| Catalogues need one consistent grid, a predictable hierarchy and white space; avoid shifting layouts between sections | [Catalog design principles](https://madegooddesigns.com/catalog-design-principles/), [UWM digital library guidelines](https://sites.uwm.edu/guidelines/?p=468), [State Library NSW](https://www.sl.nsw.gov.au/node/183756) |
| Cards: uniform size, a hard boundary, the whole card tappable | [UX Tigers – card pattern](https://www.uxtigers.com/post/card-pattern) |
| Touch targets at least 1cm × 1cm (≈44px); WCAG 2.2 AA minimum 24×24 CSS px | [NN/g – touch target size](https://www.nngroup.com/articles/touch-target-size/), [WCAG 2.2 AA checklist](https://webability.io/blog/wcag-2-2-aa-checklist) |
| Skip link, visible focus (3:1 non-text contrast), keyboard navigation | [WCAG 2.2 checklist 2026](https://line25.com/articles/web-accessibility-checklist-2026/) |
| Devanagari needs more leading than Latin (≥1.5, ~1.6–1.8 for body), ≥16px body, relative units, tested with real text | [UX4G typography](https://www.ux4g.gov.in/foundations/typography), [Web Typography notes](https://docs.thottingal.in/web-typography), [W3C Devanagari layout requirements](https://www.w3.org/TR/2024/DNOTE-deva-lreq-20240709) |
| Core Web Vitals: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1; set image dimensions, don't lazy-load the first image, lazy-load the rest | [corewebvitals.io](https://corewebvitals.io/core-web-vitals) |

Caveats: most nonprofit-UX sources are vendor blogs; the "three clicks" rule is folklore, not research; the stricter 2026 Core Web Vitals
thresholds that circulate online are unconfirmed — the figures above are the widely documented ones.

## Results (site-wide)

| Metric | Before | After |
|---|---|---|
| Undersized tap targets on desktop (<24px) | 37 pages / 395 | 2 pages / 23 |
| Undersized tap targets on phone (<44px) | 37 pages / 535 | 3 pages / 26 |
| Pages with exactly one `<h1>` | 1 / 37 | 37 / 37 |
| Heading levels skipped (e.g. h1 → h3) | 17 pages / 17 | 4 pages / 4 |
| Pages scrolling sideways on a phone | 4 pages / 4 | 0 pages / 0 |
| Pages whose Devanagari text has line-height < 1.4 | 17 | 5 |
| Text under 14px (desktop) | 37 pages / 302 | 1 pages / 6 |
| Images not lazy-loaded | 21 pages / 182 | 12 pages / 32 |
| Images without width/height attributes | 20 pages / 181 | 20 pages / 181 |
| Images with empty alt text | 13 pages / 30 | 11 pages / 26 |
| Low-contrast text (WCAG AA) | 0 pages / 0 | 0 pages / 0 |

Page length (px, before → after):

| Page | Phone | Desktop |
|---|---|---|
| `/` | 15,622 → 9,248 | 12,929 → 8,658 |
| `/marathi-booklets` | 20,024 → 6,704 | 9,326 → 5,054 |
| `/english-booklets` | 16,287 → 5,500 | 6,615 → 3,959 |
| `/pamphlets` | 32,015 → 14,894 | 14,369 → 11,218 |
| `/kafila` | 6,269 → 3,973 | 7,084 → 6,153 |
| `/covid-19` | 8,968 → 8,817 | 12,227 → 12,181 |

## What was wrong and what was changed

**Catalogue pages (Marathi/English/Hindi booklets, pamphlets, books)** — the page you flagged. Books were laid out as a patchwork:
one card alone in a third-width row, then two giant uncaptioned cover images, then three cards, then another bare image, then twenty
cards in three columns of different heights. Three of the 27 Marathi booklets were bare images with no title and no alt text. Now: one uniform grid
(4 across on desktop, 2 on a phone), every cover in the same 3:4 frame, titles ≥ 16px with Devanagari-safe leading, a "PDF" tag on every
download button, and the whole card is one link (one tab stop instead of two per book). The three untitled booklets are now proper cards.

**Whole site**
- Two `<h1>` per page (a hidden one from the template and a visible one from the content) → exactly one; the homepage had none.
- Headings jumped levels (h1 → h3); the import now builds a well-formed outline.
- Keyboard focus ring was pale yellow on a near-white page (≈1.4:1) → a 3px dark ring (yellow on dark surfaces).
- Devanagari titles and buttons were set at line-height 1.12–1.3 → ≥1.45; body text 1.7.
- Tap targets: header icons, menu, footer links, social icons, buttons and form checkboxes raised to thumb size.
- Header search icon wrapped onto a second row on laptops → one row; the last menu item (Contact Us → the join form) is now the call-to-action button.
- Reading text pinned to the left half with an empty right side → held to a comfortable measure and centred; media and grids keep full width.
- Kafila: every button repeated the whole card's text → short "Join us" labels.
- Very long URLs/hashtags in text no longer push phone pages sideways.
- Download buttons now have a descriptive accessible name ("Download: <title>") instead of 70 identical "Download" links.
- Template leftovers removed from the public site (set to draft, not deleted — see below).
- **Spam removed.** The old WordPress pages had machine-written paragraphs injected into them linking to watch-replica, vape and jersey shops
  (found on `kafila` and on the unpublished `home` page). They are dropped on import; the importer prints what it removed. Worth a security check
  of the original WordPress site, since it was evidently compromised at some point.

**Homepage** — was a photo then ~600 words of text with no headline or action, four full-width video players stacked, and a long tail.
Now: one headline and sentence of context, three actions (Join Lokayat, Free publications, Watch videos), the photo, a short "Who we are" with
"Know more" (the full text is word-for-word on `/about-lokayat`), four quick-link tiles, publications and pamphlets in the new grid,
the four videos in a 2×2 grid, then Janata, subscribe and visit. Nothing was deleted.

## Pages set to draft (reversible: Admin → Pages → Status)

`sample-page`, `projects-boxed`, `projects-fullwidth`, `about-us` (all showed raw WordPress shortcodes such as `[kc_row …]` as text),
`mbm-tax-grid-page-…` (shows `[mbdb_tax_grid]`), `homepage-02` (placeholder text, 13 broken images), `booksample` (theme demo), `home` (empty).

## Per-page results
Phone/desktop: undersized tap targets, empty-alt images, heading skips, and what needs a human.

| Page | Status | Tap targets <44px (phone) | Empty-alt imgs | Heading skips | Phone sideways scroll | Note |
|---|---|---|---|---|---|---|
| `/` | 200 | 0 | 0 | 0 | no |  |
| `/about-abhivyakti` | 200 | 0 | 4 | 0 | no |  |
| `/about-janata` | 200 | 0 | 2 | 1 | no |  |
| `/about-lokayat` | 200 | 0 | 0 | 0 | no |  |
| `/about-lokayat-marathi` | 200 | 0 | 0 | 0 | no | Not linked from the menu |
| `/c-videos` | 200 | 0 | 0 | 0 | no |  |
| `/campaign` | 200 | 0 | 0 | 0 | no |  |
| `/causes-style-03` | 200 | 0 | 0 | 0 | no |  |
| `/contact-us` | 200 | 18 | 0 | 1 | no | Unlinked duplicate of the form page — decide: redirect to /join or remove |
| `/corona-wealth-tax` | 200 | 1 | 0 | 0 | no | Not linked from the menu |
| `/covid-19` | 200 | 0 | 6 | 0 | no |  |
| `/cultural-videos` | 200 | 0 | 0 | 0 | no |  |
| `/dr_brahme_books` | 200 | 0 | 0 | 0 | no |  |
| `/english-booklets` | 200 | 0 | 0 | 0 | no |  |
| `/events-list-view` | 200 | 0 | 1 | 1 | no | Past events (2018) — retire or move |
| `/hindi-booklets` | 200 | 0 | 0 | 0 | no |  |
| `/homepage-01` | 200 | 1 | 1 | 0 | no | Duplicate of the homepage content |
| `/inauguration` | 200 | 0 | 0 | 0 | no | 2018 countdown page — probably retire |
| `/join` | 200 | 9 | 0 | 0 | no | Join form (the menu's "Contact Us") |
| `/kafila` | 200 | 0 | 1 | 0 | no | All Join-us buttons go to one Google Form |
| `/lock-down-campaigns` | 200 | 2 | 6 | 0 | no |  |
| `/lokayat-articles` | 200 | 0 | 0 | 0 | no | Empty until posts are imported |
| `/lokayat-books` | 200 | 0 | 0 | 0 | no |  |
| `/marathi-booklets` | 200 | 0 | 0 | 0 | no |  |
| `/media` | 200 | 0 | 0 | 0 | no | Long raw URLs in text |
| `/neeraj-jain-videos` | 200 | 0 | 0 | 0 | no |  |
| `/other-speakers` | 200 | 0 | 0 | 0 | no |  |
| `/other-videos` | 200 | 0 | 0 | 0 | no |  |
| `/pamphlets` | 200 | 0 | 0 | 0 | no | Several first-page thumbnails are black scans — replace with real covers |
| `/publication` | 200 | 0 | 0 | 0 | no |  |
| `/punjabi-material` | 200 | 0 | 0 | 0 | no |  |
| `/rayatecha-raja` | 200 | 0 | 1 | 0 | no | Not linked from the menu |
| `/recent-issue` | 200 | 1 | 1 | 0 | no | Janata subscription info |
| `/search?q=lokayat` | 200 | 0 | 0 | 1 | no |  |
| `/social-media` | 200 | 0 | 2 | 0 | no | Almost empty — merge into footer/Contact |
| `/training-material` | 200 | 0 | 0 | 0 | no |  |
| `/why-does-rss-bjp-not-like-these-hindu-monks` | 200 | 0 | 1 | 0 | no |  |

## Still open — needs a decision or content from you

1. **Alt text**: images in galleries/pages without a description (counts above). A person has to write these; the script can't see what an image shows.
2. **Image dimensions**: images other than covers have no `width`/`height`, which can cause layout shift while loading. Fix = store each image's size in the CMS and emit it (a CMS change; covers already reserve their space).
3. **Pamphlet thumbnails**: some pamphlet first pages are black scans or plain text; real cover artwork would read better.
4. **Orphan pages** nothing links to (`about-lokayat-marathi`, `rayatecha-raja`, `corona-wealth-tax`, `inauguration`, `lokayat-articles`, `social-media`, `recent-issue`, `about-janata`, `other-speakers`, `cultural-videos`, `events-list-view`, `homepage-01`): link them from the menu or retire them.
5. **Language tags**: Marathi and Hindi text is not tagged `lang="mr"`/`lang="hi"` (screen readers read it with the English voice). Needs a per-page language setting.
6. **Newsletters**: the six newsletter articles and the "Recent activities" grid stay empty until the 34 Lokayat-only posts are imported.
7. **Search**: the search page is nearly empty because there are no posts yet.
8. **Videos**: pages with many embeds weigh 1MB+; YouTube embeds should load on click (a lightweight placeholder) — a CMS change.
