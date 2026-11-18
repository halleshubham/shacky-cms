#!/usr/bin/env python3
"""
Copies an Elementor-built WordPress site's pages and posts into a Shacky CMS instance.

Run wp-media-import.mjs first (incl. ROOT_PATHS for files outside the media library): this script rewrites
every image/file link to the paths that import stored and refuses to continue if a referenced file is
missing from it.

  WP_URL=https://example.org CMS_URL=https://cms.example.org CMS_EMAIL=… CMS_PASSWORD=… \
  MEDIA_STATE=./wp-media-import.state.json \
  python3 apps/api/scripts/wp-elementor-import.py

Env:
  MODE=dry              convert + report only (default pushes)
  SKIP_FILE=dedupe.json posts to leave out because they already exist elsewhere:
                        {"<wp post id>": {"status": "duplicate", "match": "<slug on other site>"}}
  SKIP_BASE_URL=https://janataweekly.org/articles/   where skipped posts' links should point
  STATIC_DIRS=books,pamphlets,social-media-logos     top-level folders imported with ROOT_PATHS
  DRAFT_SLUGS=a,b,c     pages imported as drafts (templates/demos) instead of published
  FRONT_PAGE=homepage-01  page whose blocks become the site homepage
  NEWSLETTER_CATEGORY=newsletter                  category shown by "latest posts" widgets
  PUSH=posts,pages,settings   which parts to push (default all); e.g. PUSH=pages,settings first, posts later
  SETTINGS_FILE=settings.json  site settings to apply (nav, footer, theme, homepage_sections ...)
  FORMS_FILE=forms.json  forms to create and the pages to place them on (see below)
  SPLIT_FILE=split.json  split long pages into a hub + section pages (see below)
  COVERS_FILE=covers.json  {download url: cover image url} applied to cards that have no cover
  OUT=converted.json    where the converted items are written

Pages and posts are upserted by slug (safe to re-run; edits made in the CMS to them are overwritten). Nothing
is deleted. Exit code 1 if assets are missing, API calls fail, or any page does not load afterwards.
"""
import collections
import concurrent.futures as cf
import html
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.parse

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('wp_elementor_convert', os.path.join(HERE, 'wp-elementor-convert.py'))
ec = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ec)
base = ec.base

E = os.environ.get
WP_URL = (E('WP_URL') or '').rstrip('/')
CMS_URL = (E('CMS_URL') or '').rstrip('/')
MODE = E('MODE', 'push')
if not WP_URL or (MODE != 'dry' and not (CMS_URL and E('CMS_EMAIL') and E('CMS_PASSWORD'))):
    sys.exit('Set WP_URL, CMS_URL, CMS_EMAIL, CMS_PASSWORD (only WP_URL needed with MODE=dry).')
base.configure(WP_URL)
STATIC_DIRS = {d for d in E('STATIC_DIRS', 'books,pamphlets,social-media-logos').split(',') if d}
DRAFT = {d for d in E('DRAFT_SLUGS', '').split(',') if d}
SKIP_BASE = E('SKIP_BASE_URL', 'https://janataweekly.org/articles/')
FRONT = E('FRONT_PAGE', '')
NEWS_CAT = E('NEWSLETTER_CATEGORY', 'newsletter')
plain = lambda h: re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', h or ''))).strip()
dec = urllib.parse.unquote


def curl(args, body=None, timeout=90):
    r = subprocess.run(['curl', '-sS', '-m', str(timeout), '-g', '-w', '\n%{http_code}', *args] + (['-d', '@-'] if body is not None else []),
                       input=body, capture_output=True, text=True)
    out, _, code = r.stdout.rpartition('\n')
    return int(code or 0), out


def wp_list(kind, fields):
    items, page, total = [], 1, 1
    with tempfile.TemporaryDirectory() as tmp:
        while page <= total:
            hdr, body = os.path.join(tmp, 'h'), os.path.join(tmp, 'b')
            subprocess.run(['curl', '-sS', '-m', '120', '-D', hdr, '-o', body, f'{WP_URL}/wp-json/wp/v2/{kind}?per_page=100&page={page}&_fields={fields}'], check=True)
            m = re.search(r'x-wp-totalpages:\s*(\d+)', open(hdr, errors='replace').read(), re.I)
            total = int(m.group(1)) if m else 1
            items += json.load(open(body, encoding='utf8'))
            page += 1
    return items


# ── inputs ──────────────────────────────────────────────────────────────────────
state = json.load(open(E('MEDIA_STATE', './wp-media-import.state.json')))['done']
uploads = {v['path'] for k, v in state.items() if not str(k).startswith('site:')}
static_paths = {'/' + v['path'] for k, v in state.items() if str(k).startswith('site:')}
media_by_wp_id = {str(k): v for k, v in state.items() if not str(k).startswith(('site:', 'extra-'))}

pages = wp_list('pages', 'id,slug,link,title,status,date_gmt,parent,content,excerpt')
posts = wp_list('posts', 'id,slug,link,title,status,date_gmt,categories,tags,featured_media,content,excerpt')
cats = {c['id']: c for c in wp_list('categories', 'id,name,slug')}
tags = {t['id']: t for t in wp_list('tags', 'id,name,slug')}
featured_ids = {p['featured_media'] for p in posts if p.get('featured_media')}
media_src = {}
if featured_ids:
    for m in wp_list('media', 'id,source_url'):
        media_src[m['id']] = m['source_url']

skip_info = json.load(open(E('SKIP_FILE'))) if E('SKIP_FILE') and os.path.exists(E('SKIP_FILE')) else {}
skipped_ids = {int(k) for k, v in skip_info.items() if v.get('status') == 'duplicate' and v.get('match')}
skipped_urls = {dec(p['slug']): SKIP_BASE + skip_info[str(p['id'])]['match'] for p in posts if p['id'] in skipped_ids}
migrate_posts = [p for p in posts if p['id'] not in skipped_ids and p['slug'] != 'hello-world']
page_slugs = {dec(p['slug']) for p in pages}
post_slugs = {dec(p['slug']) for p in migrate_posts}
print(f'WordPress: {len(pages)} pages, {len(posts)} posts ({len(skipped_ids)} skipped as duplicates -> {len(migrate_posts)} to migrate), '
      f'{len(uploads)} uploads + {len(static_paths)} site files imported')


def new_ctx():
    ctx = base.Ctx(uploads, page_slugs)
    ctx.rewrite = ec.make_rewrite(WP_URL, static_paths, post_slugs, skipped_urls, STATIC_DIRS, ctx)
    return ctx


def words_of(text):
    return collections.Counter(re.findall(r"[\w’']+", html.unescape(text).lower()))


def source_words(html_src, kind):
    """Words of real content in the source (no hidden <style>/<script> text, no header/footer chrome, no dynamic
    listings; post titles/authors/dates are stored in their own fields so those widgets are excluded for posts)."""
    soup = ec.BeautifulSoup(html_src, 'html.parser')
    for t in soup(['script', 'style', 'noscript']):
        t.decompose()
    if not soup.find(attrs={'data-widget_type': True}):
        return words_of(soup.get_text(' ', strip=True))
    ws, s, e = ec.split_chrome(soup)
    skip = set(ec.CHROME) | {'posts'}
    if kind == 'post':
        skip |= {'heading'}
    return words_of(' '.join(w.get_text(' ', strip=True) for w in ws[s:e] if ec.wtype(w) not in skip))


def sections_words(sections):
    parts = []

    def walk(b):
        c = b.get('config', b.get('nestedConfig', {})) if isinstance(b, dict) else {}
        t = b.get('type') or b.get('contentType')
        if t in (None, 'card'):
            parts.extend([b.get('title', ''), b.get('text', ''), b.get('buttonLabel', '')])
        elif t == 'heading_block':
            parts.extend([c.get('text', ''), c.get('subtext', '')])
        elif t == 'rich_text':
            parts.append(re.sub(r'<[^>]+>', ' ', c.get('html', '')))
        elif t == 'button_row':
            parts.extend(x['label'] for x in c.get('buttons', []))
        elif t in ('image_gallery', 'image_block'):
            parts.extend(i.get('caption', '') for i in c.get('images', [c]))
        elif t == 'columns_block':
            for col in c.get('columns', []):
                walk(col)

    for b in sections:
        walk(b)
    return words_of(' '.join(parts))


def lost_words(src, out):
    """-> (words missing entirely, total distinct source words, Counter of the missing ones).
    Counting repeats would flag intentional de-duplication (e.g. a flip-box showing its title on both sides)."""
    miss = collections.Counter({w: n for w, n in src.items() if w not in out})
    return len(miss), len(src), miss


# ── convert pages ───────────────────────────────────────────────────────────────
out_pages, problems, report, lost_detail = [], [], [], {}
def grid_cards(blocks, per_row, promote=None):
    """Elementor lays a catalogue out as a patchwork: one card per row here, a bare cover image there, a few cards in a
    row elsewhere. Make it one uniform grid: bare cover images that link to a document become cards (titles come from
    `promote`: {document url: {"title", "text"?}}, written by a person who looked at the cover), and consecutive card
    blocks are merged into a single block."""
    promote = promote or {}
    doc = re.compile(r'\.(pdf|docx?|pptx?)$', re.I)

    def is_cards(b):
        return b['type'] == 'columns_block' and all(c.get('contentType') in (None, 'card') for c in b['config']['columns'])

    label = next((c.get('buttonLabel') for b in blocks if b['type'] == 'columns_block' for c in b['config']['columns'] if c.get('buttonLabel')), 'Download')
    flat = []
    for b in blocks:
        imgs = b['config'].get('images') if b['type'] == 'image_gallery' else ([b['config']] if b['type'] == 'image_block' else None)
        if imgs and all(dec(i.get('linkUrl') or '').lower().endswith(('.pdf', '.doc', '.docx', '.ppt', '.pptx')) and i.get('linkUrl') in promote for i in imgs):
            cards = [{'contentType': 'card', 'title': promote[i['linkUrl']]['title'], **({'text': promote[i['linkUrl']]['text']} if promote[i['linkUrl']].get('text') else {}),
                      'buttonLabel': label, 'buttonUrl': i['linkUrl'], 'buttonVariant': 'primary', 'buttonNewTab': True,
                      'imageSrc': i['src'], 'imageAlt': promote[i['linkUrl']]['title'], 'imageLink': i['linkUrl'], 'imageDownload': True} for i in imgs]
            flat.append({**b, 'type': 'columns_block', 'config': {'columns': cards, 'columnsPerRow': per_row, 'textAlign': 'left'}})
        else:
            flat.append(b)
    out = []
    for b in flat:
        if is_cards(b) and out and is_cards(out[-1]):
            out[-1]['config']['columns'] += b['config']['columns']
        else:
            out.append(b)
    for b in out:
        if is_cards(b):
            b['config']['columnsPerRow'] = per_row if len(b['config']['columns']) > 2 else b['config'].get('columnsPerRow', per_row)
    return out


split_cfg = json.load(open(E('SPLIT_FILE'))) if E('SPLIT_FILE') else {}
covers = json.load(open(E('COVERS_FILE'))) if E('COVERS_FILE') and os.path.exists(E('COVERS_FILE')) else {}
news_grid = {'title': 'Latest', 'source': 'category', 'slug': NEWS_CAT, 'count': 3, 'columns': 3, 'size': 'default'}
for p in pages:
    slug, raw = dec(p['slug']), p['content']['rendered']
    title = plain(p['title']['rendered']) or slug
    if not plain(raw):
        report.append((slug, 'page', 'EMPTY in WordPress (listing/template page) — skipped'))
        continue
    bg = {}
    if 'elementor-widget-flip-box' in raw or 'flip-box' in raw:
        bg = ec.flipbox_backgrounds(p['link'])
    ctx = new_ctx()
    if slug in split_cfg:
        # one long page -> a hub that links to one page per section (instead of in-page jump buttons)
        cfg = split_cfg[slug]
        ranges, wlist = ec.section_ranges(raw, cfg['sections'])
        hub = [ec.mk(ctx, 'heading_block', {'text': title, 'level': 1, 'align': 'center'})]
        if cfg.get('intro'):
            hub.append(ec.mk(ctx, 'rich_text', {'html': cfg['intro']}))
        cards = []
        for sp in cfg['sections']:
            a, b = ranges[sp['slug']]
            n_items = sum(1 for w in wlist[a:b] if ec.wtype(w) == 'flip-box')
            sctx = new_ctx()
            sub = ec.convert_page(sctx, sp['title'], raw, bg, news_grid, widget_range=(a, b))
            back = ec.mk(sctx, 'button_row', {'align': 'left', 'buttons': [{'label': f'← {cfg.get("back_label", title)}', 'url': f'/{slug}', 'variant': 'outline'}]})
            sub = sub[:1] + [back] + grid_cards(sub[1:], cfg.get('columns', 3), sp.get('promote') or cfg.get('promote'))
            out_pages.append({'kind': 'page', 'wpId': p['id'], 'title': sp['title'], 'slug': sp['slug'], 'excerpt': f"{sp['title']} — {title}",
                              'sectionsJson': json.dumps(sub, ensure_ascii=False), 'sections': sub, 'publishedAt': p['date_gmt'] + 'Z', 'status': 'published'})
            for k, u in sctx.missing_assets:
                problems.append(f"{sp['slug']}: {k} not imported: {dec(u)}")
            cards.append({'contentType': 'card', 'title': sp['title'], 'text': f'{n_items} items' if n_items else sp.get('blurb', ''),
                          'buttonLabel': 'Browse', 'buttonUrl': f"/{sp['slug']}", 'buttonVariant': 'primary'})
        hub.append(ec.mk(ctx, 'columns_block', {'columns': cards, 'columnsPerRow': 3, 'textAlign': 'left'}))
        secs = hub
        sub_words = collections.Counter()
        for pg_ in out_pages[-len(cfg['sections']):]:
            sub_words += sections_words(pg_['sections'])
        lost, total, miss = lost_words(source_words(raw, 'page'), sections_words(secs) + sub_words)
    else:
        secs = ec.convert_page(ctx, title, raw, bg, news_grid)
        lost, total, miss = lost_words(source_words(raw, 'page'), sections_words(secs))
    out_pages.append({'kind': 'page', 'wpId': p['id'], 'title': title, 'slug': slug, 'excerpt': plain(p['excerpt']['rendered'])[:300],
                      'sectionsJson': json.dumps(secs, ensure_ascii=False), 'sections': secs, 'publishedAt': p['date_gmt'] + 'Z',
                      'status': 'draft' if slug in DRAFT else 'published'})
    for k, u in ctx.missing_assets:
        problems.append(f'{slug}: {k} not imported: {dec(u)}')
    flag = '  <-- CHECK' if lost > max(2, total * 0.01) else ''
    report.append((slug, 'page', f'{len(secs)} blocks, distinct words missing {lost}/{total}{flag}' + (f'  unhandled={sorted(ctx.unhandled)}' if ctx.unhandled else '')))
    if flag:
        lost_detail[slug] = miss.most_common(12)

# ── convert posts ───────────────────────────────────────────────────────────────
out_posts = []
for p in migrate_posts:
    slug = dec(p['slug'])
    title = plain(p['title']['rendered']) or slug
    ctx = new_ctx()
    fpath = None
    if p.get('featured_media') and media_src.get(p['featured_media']):
        fpath = '/wp-content/uploads/' + urllib.parse.quote(dec(media_src[p['featured_media']].split('/uploads/')[1]), safe='/')
    ex = ec.extract_post(ctx, p, fpath)
    lost, total, miss = lost_words(source_words(p['content']['rendered'], 'post'), words_of(re.sub(r'<[^>]+>', ' ', ex['html'])))
    out_posts.append({'kind': 'post', 'wpId': p['id'], 'title': title, 'slug': slug, 'html': ex['html'], 'authors': ex['authors'],
                      'excerpt': ec.plain_excerpt(ex['html']), 'publishedAt': p['date_gmt'] + 'Z',
                      'categories': [cats[c]['name'] for c in p['categories'] if c in cats],
                      'tags': [tags[t]['name'] for t in p.get('tags', []) if t in tags], 'featured_media': p.get('featured_media'),
                      'lost': lost, 'total': total, 'missing': miss.most_common(8) if lost else []})
    for k, u in ctx.missing_assets:
        problems.append(f'post {slug}: {k} not imported: {dec(u)}')

def apply_covers(secs):
    n = 0
    for b in secs:
        if b['type'] != 'columns_block':
            continue
        for col in b['config']['columns']:
            url = col.get('buttonUrl')
            if col.get('contentType') in (None, 'card') and url and not col.get('imageSrc') and url in covers:
                col['imageSrc'], col['imageAlt'] = covers[url], col.get('title', '')
                col['imageLink'], col['imageDownload'] = url, True
                n += 1
    return n


cover_n = 0
for pg_ in out_pages:
    cover_n += apply_covers(pg_['sections'])
    pg_['sectionsJson'] = json.dumps(pg_['sections'], ensure_ascii=False)
print(f'covers applied to {cover_n} cards')

# SEO-spam that got injected into the old site (paragraphs of nonsense linking to watch-replica / vape / jersey shops).
SPAM_HOST = re.compile(r'(vapes?(shop|stores?)|rickandmortyvape|watch(es)?\.|swisswatch|replica|jersey|tomford|tagheuer|franckmuller|jimmychoo|loewe|parissaintgermain)', re.I)
removed_spam = []


def strip_spam(secs, slug):
    """Drop every paragraph that links to a spam host (the surrounding sentences are machine-written filler)."""
    for b in list(secs):
        if b['type'] != 'rich_text':
            continue
        html = b['config'].get('html', '')
        parts = re.split(r'(?<=</p>)', html)
        kept = []
        for part in parts:
            hosts = re.findall(r'href="https?://([^/"]+)', part)
            if any(SPAM_HOST.search(h) for h in hosts):
                removed_spam.append((slug, hosts[:3]))
            else:
                kept.append(part)
        b['config']['html'] = ''.join(kept)
        if not plain(b['config']['html']):
            secs.remove(b)


for pg_ in out_pages:
    strip_spam(pg_['sections'], pg_['slug'])
if removed_spam:
    print(f'removed {len(removed_spam)} spam paragraph(s): ' + '; '.join(f"{s}:{h[0]}" for s, h in removed_spam))


def fix_heading_levels(secs):
    """Elementor lets every heading pick any level (h3 straight under the page title, several h1s). Make the outline
    well-formed: one h1 (the first heading, if it is one) and no level skipped going down."""
    prev, seen_h1 = 0, False
    for b in secs:
        if b['type'] != 'heading_block':
            continue
        lvl = b['config'].get('level', 2)
        if lvl == 1 and (seen_h1 or prev):
            lvl = 2
        seen_h1 = seen_h1 or lvl == 1
        lvl = min(lvl, prev + 1) if prev else min(lvl, 1 if not seen_h1 and lvl == 1 else 2)
        b['config']['level'] = lvl
        prev = lvl


for pg_ in out_pages:
    fix_heading_levels(pg_['sections'])
    pg_['sectionsJson'] = json.dumps(pg_['sections'], ensure_ascii=False)

# Forms (e.g. Contact Form 7) are not in the WordPress REST API, so they are described in FORMS_FILE:
#   {"forms": [{"name", "slug", "fields": [...], "successMessage", "notifyEmail", ...}],
#    "pages": {"<page slug>": {"form": "<form slug>", "remove_text": "<paragraphs containing this are dropped>"}}}
# Each listed page gets the form block appended (and template filler text removed). Pushed with PUSH=forms,pages.
forms_cfg = json.load(open(E('FORMS_FILE'))) if E('FORMS_FILE') else {}
for pg_ in out_pages:
    t = forms_cfg.get('pages', {}).get(pg_['slug'])
    if not t:
        continue
    for b in pg_['sections']:
        if b['type'] == 'rich_text' and t.get('remove_text'):
            b['config']['html'] = re.sub(r'<p>(?:(?!</p>).)*' + re.escape(t['remove_text']) + r'.*?</p>', '', b['config']['html'], flags=re.S)
    pg_['sections'] = [b for b in pg_['sections'] if not (b['type'] == 'rich_text' and not plain(b['config']['html']))]
    pg_['sections'].append(ec.mk(new_ctx(), 'form_block', {'slug': t['form'], 'showTitle': False}))
    pg_['sectionsJson'] = json.dumps(pg_['sections'], ensure_ascii=False)
    print(f"form '{t['form']}' placed on /{pg_['slug']}")

json.dump({'pages': out_pages, 'posts': out_posts, 'skipped': skipped_urls}, open(E('OUT', './converted.json'), 'w'), ensure_ascii=False)
for r in report:
    print(f'  {r[0][:34]:36}{r[1]:5} {r[2]}')
low = [x for x in out_posts if x['lost'] > max(2, x['total'] * 0.005)]
print(f"\nposts: {len(out_posts)} converted | distinct words checked: {sum(x['total'] for x in out_posts)}, missing: {sum(x['lost'] for x in out_posts)}"
      f" | posts with missing words: {len(low)} | with named authors: {sum(1 for x in out_posts if x['authors'])}")
for x in low[:10]:
    print(f"   {x['slug'][:48]:50} lost {x['lost']}/{x['total']}  e.g. {x['missing'][:5]}")
for slug, det in lost_detail.items():
    print(f'   page {slug}: lost words e.g. {det[:8]}')
print(f'\nunresolved assets: {len(problems)}')
for pr in problems[:25]:
    print('  ', pr)
if MODE == 'dry':
    sys.exit(1 if problems else 0)

# ── push ────────────────────────────────────────────────────────────────────────
import time

DEFAULT_AUTHOR = E('DEFAULT_AUTHOR', 'Editorial')
WANT = set(E('PUSH', 'posts,pages,settings').split(','))
JAR = './.wp-elementor-import.cookies'
_last = [0.0]


def api(method, path, body=None):
    """CMS API call, throttled to stay under the API's 200 requests/minute limit, retrying on 429."""
    for attempt in range(5):
        wait = 0.4 - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        args = ['-b', JAR, '-X', method, '-H', 'Content-Type: application/json', f'{CMS_URL}{path}']
        c, b = curl(args, json.dumps(body) if body is not None else None)
        if c == 429:
            time.sleep(20)
            continue
        try:
            return c, (json.loads(b) if b.strip() else {})
        except Exception:
            return c, {'raw': b[:200]}
    return 429, {}


def listing(path):
    c, d = api('GET', f'{path}{"&" if "?" in path else "?"}pageSize=1000')
    return (d.get('data') if isinstance(d, dict) else d) or []


c, _ = curl(['-c', JAR, '-H', 'Content-Type: application/json', f'{CMS_URL}/api/auth/login'],
            json.dumps({'email': E('CMS_EMAIL'), 'password': E('CMS_PASSWORD')}))
if c != 200:
    sys.exit(f'CMS login failed (HTTP {c})')
fails = []
try:
    if 'forms' in WANT and forms_cfg.get('forms'):
        have_f = {f['slug']: f['id'] for f in (api('GET', '/api/forms')[1] or [])}
        for f in forms_cfg['forms']:
            c, d = api('PATCH', f"/api/forms/{have_f[f['slug']]}", f) if f['slug'] in have_f else api('POST', '/api/forms', f)
            print(f"form {f['slug']}: {'updated' if f['slug'] in have_f else 'created'} (HTTP {c})")
            if c not in (200, 201):
                fails.append(f"form {f['slug']}: HTTP {c} {str(d)[:100]}")
    # authors (real bylines come from the article's author box; the WordPress user is just the uploader)
    push_posts = 'posts' in WANT
    have = {a['displayName'].lower(): a['id'] for a in listing('/api/authors')} if push_posts else {}
    for name in (sorted({n for x in out_posts for n in x['authors']} | {DEFAULT_AUTHOR}) if push_posts else []):
        if name.lower() not in have:
            c, d = api('POST', '/api/authors', {'displayName': name})
            if c in (200, 201):
                have[name.lower()] = d['id']
            else:
                fails.append(f'author {name!r}: HTTP {c} {str(d)[:100]}')
    author_id = have

    # categories
    have_c = {x['slug']: x['id'] for x in listing('/api/categories')} if push_posts else {}
    wanted_c = {}
    for x in (out_posts if push_posts else []):
        for n in x['categories']:
            wanted_c[n] = next((cc['slug'] for cc in cats.values() if cc['name'] == n), re.sub(r'\W+', '-', n.lower()).strip('-'))
    for n, sl in wanted_c.items():
        if sl not in have_c:
            c, d = api('POST', '/api/categories', {'name': html.unescape(n), 'slug': sl})
            if c in (200, 201):
                have_c[sl] = d['id']
            else:
                fails.append(f'category {n!r}: HTTP {c}')
    cat_id = {n: have_c.get(sl) for n, sl in wanted_c.items()}

    # tags (the endpoint is idempotent by slug)
    tag_id = {}
    for n in (sorted({t for x in out_posts for t in x['tags']}) if push_posts else []):
        c, d = api('POST', '/api/tags', {'name': html.unescape(n)})
        if c in (200, 201):
            tag_id[n] = d['id']
        else:
            fails.append(f'tag {n!r}: HTTP {c}')
    print(f'authors {len(author_id)}, categories {len(cat_id)}, tags {len(tag_id)} ready', flush=True)

    # posts
    created = updated = 0
    for x in (out_posts if push_posts else []):
        wm = media_by_wp_id.get(str(x['featured_media'])) if x['featured_media'] else None
        names = x['authors'] or [DEFAULT_AUTHOR]
        body = {'title': x['title'], 'slug': x['slug'], 'content': x['html'], 'excerpt': x['excerpt'] or None, 'status': 'published',
                'publishedAt': x['publishedAt'], 'authorIds': [author_id[n.lower()] for n in names if n.lower() in author_id],
                'categoryIds': [cat_id[n] for n in x['categories'] if cat_id.get(n)][:3], 'tagIds': [tag_id[t] for t in x['tags'] if t in tag_id]}
        if wm:
            body['featuredMediaId'] = wm['mediaId']
        c, d = api('POST', '/api/posts', body)
        if c == 409:                                              # already there: update in place
            c2, pub = curl([f'{CMS_URL}/api/public/posts/{urllib.parse.quote(x["slug"])}'])
            try:
                pid = json.loads(pub)['id']
                c, d = api('PATCH', f'/api/posts/{pid}', body)
                updated += c == 200
            except Exception:
                fails.append(f'post {x["slug"]}: exists but could not be looked up')
                continue
        elif c in (200, 201):
            created += 1
        if c not in (200, 201):
            fails.append(f'post {x["slug"]}: HTTP {c} {str(d)[:120]}')
    print(f'posts: {created} created, {updated} updated', flush=True)

    # pages
    have_p = {x['slug']: x['id'] for x in listing('/api/pages')} if 'pages' in WANT else {}
    pc = pu = 0
    for x in (out_pages if 'pages' in WANT else []):
        body = {k: x[k] for k in ('title', 'slug', 'excerpt', 'sectionsJson', 'status', 'publishedAt') if x.get(k)}
        body['content'] = ''
        if x['slug'] in have_p:
            c, d = api('PATCH', f'/api/pages/{have_p[x["slug"]]}', body)
            pu += c == 200
        else:
            c, d = api('POST', '/api/pages', body)
            pc += c == 201
        if c not in (200, 201):
            fails.append(f'page {x["slug"]}: HTTP {c} {str(d)[:120]}')
    print(f'pages: {pc} created, {pu} updated', flush=True)

    # site settings prepared by the caller (nav, footer, social, theme, homepage, redirects ...)
    if E('SETTINGS_FILE') and 'settings' in WANT:
        st = json.load(open(E('SETTINGS_FILE')))
        if FRONT and not st.get('homepage_sections'):
            fp = next((x for x in out_pages if x['slug'] == FRONT), None)
            if fp:
                st['homepage_sections'] = json.dumps([b for b in fp['sections'] if not (b['type'] == 'heading_block' and b['config'].get('level') == 1)], ensure_ascii=False)
        st['legacy_redirects'] = json.dumps(skipped_urls, ensure_ascii=False)
        c, d = api('PATCH', '/api/settings', {k: (v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)) for k, v in st.items()})
        print('settings:', c)
        if c != 200:
            fails.append(f'settings: HTTP {c}')
finally:
    if os.path.exists(JAR):
        os.remove(JAR)

# ── verify: every page and post loads; every file / internal link on them resolves ─────────
def fetch(u, head=False):
    return curl(['-L', '-o', '/dev/null' if head else '-', *(['-I'] if head else []), u], timeout=60)


def check(path):
    c, h = fetch(f'{CMS_URL}{path}')
    refs = set(re.findall(r'(?:src|href)="(/(?:wp-content/uploads|books|pamphlets|social-media-logos)/[^"]+)"', h))
    refs |= {l for l in re.findall(r'href="(/[^"#?]*)"', h) if l != '/' and not l.startswith(('/_next', '/api', '/s3', '/wp-content', '/books', '/pamphlets', '/social-media-logos'))}
    return path, c, refs


paths = ([f'/{urllib.parse.quote(x["slug"])}' for x in out_pages if x['status'] == 'published'] if 'pages' in WANT else []) + ([f'/articles/{urllib.parse.quote(x["slug"])}' for x in out_posts] if 'posts' in WANT else [])
with cf.ThreadPoolExecutor(6) as ex:
    results = list(ex.map(check, paths))
refs = set().union(*[r for _, _, r in results])
for path, c, _ in results:
    if c != 200:
        fails.append(f'{path}: HTTP {c}')
with cf.ThreadPoolExecutor(8) as ex:
    for u, (c, _) in zip(sorted(refs), ex.map(lambda r: fetch(CMS_URL + r, head=True), sorted(refs))):
        if c != 200:
            fails.append(f'broken reference {c}: {urllib.parse.unquote(u)}')
print(f'Verified {len(results)} pages/posts and {len(refs)} distinct file/page references.')
allp = problems + fails
print('\n'.join(allp) if allp else 'All pages and posts load and every reference resolves.')
sys.exit(1 if allp else 0)
