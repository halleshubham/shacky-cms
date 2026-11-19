# Lokayat site — content audit: what has no meaningful content

Scope: all 35 published pages, the homepage's 35 sections, the menus and footer, plus what the CMS holds besides pages.
Method: for each page and section — real words vs. headings/buttons, images/videos/files, links in and out, near-duplicate text
(6-word shingle overlap), dates, placeholder/template text, dead links, and whether anything links to the page.
**Nothing has been removed or unpublished by this audit.** Every "remove" below is reversible if done as *draft* first.

A note on posts: the CMS has **0 posts** (the 34 Lokayat-only posts are not imported yet), so every list of posts is empty *for now*.
Those are marked "pending", not "junk".

## Pages

### Remove — nothing meaningful on them (8 pages)

| Page | Why |
|---|---|
| `inauguration` | 2017 website launch page: "Inauguration… at the hands of Dr. Shripal Sabnis, Justice Kolse-Patil", a dead "Days Hours Minutes Seconds" countdown and an "INAUGURATE" button that links to the homepage. 21 words. |
| `social-media` | A heading and two images, no links. The social links are already in the header and footer. 10 words. |
| `events-list-view` | One past event (a Gandhi music programme, October 2017) under the title "Events List View". |
| `lokayat-articles` | A heading and an empty "Recent Articles" list. Nothing links to it. 4 words. |
| `homepage-01` | The old homepage: 73–79% of its text is already on `/about-lokayat` and the new homepage; its newsletter list and "Older Newsletters!" heading are empty; points to a missing category. |
| `recent-issue` | Janata weekly's subscription blurb (Rs. 260 / 750) plus an empty list. Janata has its own site (it's in the "Our Friends" menu). Remove or redirect to janataweekly.org. |
| `cultural-videos` and `other-speakers` | **Identical twins**: the same 5 videos and the same text (97% overlap); nothing links to either. Three of the 5 videos are also on `c-videos` and one on `campaign`. **One video exists only here** — move it to `c-videos` before removing both. |

### Redirect (1 page)

| Page | Why |
|---|---|
| `contact-us` | A second "Contact Us" page (33 words + a form). The menu's real one is `/join`. Redirect `/contact-us` → `/join`, then delete the now-unused form "Get involved with Lokayat". |

### Review — real content, but not meaningful as it stands (4 pages)

| Page | Issue | Suggestion |
|---|---|---|
| `covid-19` (top-level menu item) | A 2021 relief-work appeal ("second wave… contribute… call Vishal / Shakuntala") that is long past; it still asks for donations and lists phone numbers. One section, "Petition – Corona Wealth Tax", has no link. | Archive it: take it out of the main menu (move under a "Past campaigns" item) and remove the donation appeal. Decide whether the numbers are still valid. |
| `corona-wealth-tax` | A May 2020 citizen's charter, 1,855 words, orphan. Its "Sign Citizen's Charter Here!" appears twice as a heading and both link to a petition (`bit.ly/coronawealthtax`) that is still live but nearly 6 years old. | Keep as an archive document; remove the duplicate sign-up headings if the petition is closed. |
| `about-janata` | History of Janata weekly (since 1946); orphan; duplicates what janataweekly.org says. | Redirect to janataweekly.org, or link it from "Our Friends". |
| `why-does-rss-bjp-not-like-these-hindu-monks` | A 1,100-word article imported as a **page** titled "Post", with a stray "Read more" and an empty block. Orphan. | Keep the text but make it a proper article (post) — and check whether janataweekly.org already has it (a quick search did not find it). |

### Keep, but link them (2 pages)

| Page | Why |
|---|---|
| `about-lokayat-marathi` | The Marathi "About Lokayat" (648 words). Real content, but nothing links to it — add a "मराठी" link on the English About page. |
| `rayatecha-raja` | "Gaatha Rayatechya Raajachi" — Shivaji songs with five MP3 files and a campaign banner. Real content, orphan — add it under Activities. |

### Core pages (20) — keep

`about-lokayat`, `about-abhivyakti`, `kafila`, `campaign`, `lock-down-campaigns`, `media`, `other-videos`, `neeraj-jain-videos`, `c-videos`,
`join`, `publication`, `pamphlets`, `english-booklets`, `marathi-booklets`, `hindi-booklets`, `lokayat-books`, `training-material`,
`punjabi-material`, `dr_brahme_books`, `causes-style-03` (Ram Puniyani books).
Thin but real and menu-linked: `punjabi-material` has one item and `training-material` two, `lokayat-books` three — you could fold the first two into one "Other languages and training" page; I haven't.

### Already taken offline in the UX pass (8 pages, drafts)

`sample-page`, `projects-boxed`, `projects-fullwidth`, `about-us`, `mbm-tax-grid-page-…`, `homepage-02`, `booksample`, `home` — template demos, raw shortcodes, or empty. They can now be deleted permanently if you agree.

## Sections inside pages (parts, not whole pages)

| Where | Section | Issue |
|---|---|---|
| Homepage | "Older newsletters" heading | Nothing under it. Remove, or put a "Browse all newsletters" button under it once posts exist. |
| Homepage | "Our recent activities" newsletter grid | Empty **until the 34 posts are imported** (pending, not junk). |
| `kafila` | "Follow Us On" | Heading with nothing under it (the icons did not survive). Remove — social links are in the footer. |
| `kafila` | "Contact Us / Tushar: 9994533221 / Alka: 4453675687" | Contact lines stored as three headings, not text. **"4453675687" does not look like a valid Indian mobile or landline — please verify.** |
| `about-abhivyakti` | "Join us on Socail Media" | Typo, and nothing under it. |
| `about-abhivyakti` | "Gallery" (last section) | Heading with nothing under it. |
| `covid-19` | "Petition – Corona Wealth Tax" | A heading with no link. |
| `corona-wealth-tax` | Two identical "Sign Citizen's Charter Here!" headings | Duplicate. |
| `why-does-rss…` | empty text block, "Read more" with nothing to open, empty newsletter list | Remove all three. |
| `pamphlets` | one card whose file does not exist (`pamphlet-marathi-budget-2017-18-2017-03-16.`) | The address ends in a full stop — dead at the original site too. Remove the card or find the file. |
| `campaign` | two cards whose PDFs do not exist (`pamphlet-bekari-v7…`, `pamphlet-black-is-beautiful-v2…`) | Dead at the original site too. Remove the cards or locate the files. |
| Video pages | 13 of the 50 videos appear on more than one page | `c-videos`, `other-videos`, `media`, `neeraj-jain-videos`, `homepage-01`, `covid-19` overlap. After removing the twins and `homepage-01`, 6 repeats remain (of 46 videos). |

## Things in the CMS that are not pages

| Item | Count | Verdict |
|---|---|---|
| Default categories: Culture, Economy, Environment, Politics, Society, Technology | 6, all empty | Remove — they came with the CMS install, not from Lokayat. |
| Form "Get involved with Lokayat" | 1, 0 entries | Remove after `/contact-us` is redirected. |
| Identical stock "placeholder" image (`2017/04–05/placeholder-N.jpg`) | 78 files, 4.1 MB | Safe to delete: all the same picture, and neither the pages nor the 34 pending posts use them. |
| Other media "not used by a page" | ~700 | **Do not bulk-delete.** Many belong to the 34 pending posts and to old addresses people may have shared. |

## What I would do, in order

1. Redirect `/contact-us` → `/join`; remove the 7 clear page removals above (after moving the one unique video to `c-videos`).
2. Take `covid-19` out of the main menu and drop its donation appeal.
3. Fix or remove the 9 empty sections and the 3 dead cards.
4. Import the 34 posts (this fills the empty lists and the `/category/newsletter` link), then remove the 6 default categories.
5. Link the two good orphans (`about-lokayat-marathi`, `rayatecha-raja`) and convert the "Post" page into an article.

I can do any of this as drafts (undoable) on request.
