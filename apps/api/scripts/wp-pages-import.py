#!/usr/bin/env python3
"""
Copies a WordPress site's pages (and optionally posts) into a Shacky CMS instance as
page-builder pages, with a verification crawl. Run wp-media-import.mjs FIRST: this script
rewrites every image/file link to the site-relative /wp-content/uploads/... path and
checks it against the files that import actually stored.

  WP_URL=https://example.org CMS_URL=https://cms.example.org \
  CMS_EMAIL=admin@example.org CMS_PASSWORD='…' \
  MEDIA_STATE=./wp-media-import.state.json \
  python3 apps/api/scripts/wp-pages-import.py

Needs: python3, beautifulsoup4 (pip install beautifulsoup4), curl.

Env:  MODE=dry       convert and report only (default is to push)
      INCLUDE_POSTS=1  also import published WordPress posts as pages (same URL), e.g. when
                     the menu links to posts. The default "Hello world" post is skipped.
      OUT=converted-pages.json   where the converted pages are written.

Pages are upserted by slug (so it is safe to re-run and edits made in the CMS to these
pages are overwritten on re-run). Nothing is ever deleted. Prints, and exits non-zero on:
assets referenced but missing from the imported media, failed API calls, or pages that do
not load afterwards.
"""
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

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('wp_pages_convert', os.path.join(HERE, 'wp-pages-convert.py'))
conv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(conv)

E = os.environ.get
WP_URL = (E('WP_URL') or '').rstrip('/')
CMS_URL = (E('CMS_URL') or '').rstrip('/')
MODE = E('MODE', 'push')
if not WP_URL or (MODE != 'dry' and not (CMS_URL and E('CMS_EMAIL') and E('CMS_PASSWORD'))):
    sys.exit('Set WP_URL, CMS_URL, CMS_EMAIL, CMS_PASSWORD (only WP_URL needed with MODE=dry).')
conv.configure(WP_URL)


def curl(args, body=None, timeout=90):
    r = subprocess.run(['curl', '-sS', '-m', str(timeout), '-g', '-w', '\n%{http_code}', *args] + (['-d', '@-'] if body is not None else []),
                       input=body, capture_output=True, text=True)
    out, _, code = r.stdout.rpartition('\n')
    return int(code or 0), out


def wp_list(kind):
    items, page, total = [], 1, 1
    fields = 'id,slug,link,title,status,date_gmt,excerpt,content,yoast_head_json'
    with tempfile.TemporaryDirectory() as tmp:
        while page <= total:
            hdr, body = os.path.join(tmp, 'h'), os.path.join(tmp, 'b')
            subprocess.run(['curl', '-sS', '-m', '90', '-D', hdr, '-o', body,
                            f'{WP_URL}/wp-json/wp/v2/{kind}?per_page=100&page={page}&_fields={fields}'], check=True)
            m = re.search(r'x-wp-totalpages:\s*(\d+)', open(hdr, errors='replace').read(), re.I)  # robust to proxy header blocks
            total = int(m.group(1)) if m else 1
            items += json.load(open(body, encoding='utf8'))
            page += 1
    return items


plain = lambda h: re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', h or ''))).strip()

state = json.load(open(E('MEDIA_STATE', './wp-media-import.state.json')))
imported = {v['path'] for v in state['done'].values()}
items = [('page', p) for p in wp_list('pages')]
if E('INCLUDE_POSTS'):
    items += [('post', p) for p in wp_list('posts') if p['slug'] != 'hello-world']
slugs = {urllib.parse.unquote(p['slug']) for _, p in items}

out, problems = [], []
for kind, p in items:
    slug, raw = urllib.parse.unquote(p['slug']), p['content']['rendered']
    title = plain(p['title']['rendered'])
    if not title:
        m = re.search(r'<h[1-4][^>]*>(.*?)</h[1-4]>', raw, re.S)
        title = plain(m.group(1)) if m else slug
    ctx = conv.Ctx(imported, slugs)
    secs = conv.convert_page(ctx, title, raw)
    y = p.get('yoast_head_json') or {}
    page = {'kind': kind, 'wpId': p['id'], 'title': title, 'slug': slug, 'excerpt': plain(p['excerpt']['rendered'])[:300],
            'sectionsJson': json.dumps(secs, ensure_ascii=False), 'status': 'published', 'publishedAt': p['date_gmt'] + 'Z',
            'seoDescription': (y.get('description') or y.get('og_description') or None)}
    out.append(page)
    for k, u in ctx.missing_assets:
        problems.append(f'{slug}: {k} not in imported media: {urllib.parse.unquote(u)}')
    print(f'{slug[:40]:42}{kind:5}{len(raw):7}ch -> {len(secs):3} blocks {conv.stats(secs)}')

json.dump(out, open(E('OUT', './converted-pages.json'), 'w'), ensure_ascii=False)
print(f'\n{len(out)} items converted.')
if MODE == 'dry':
    print('\n'.join(problems) or 'No unresolved assets.')
    sys.exit(1 if problems else 0)

# ── push ────────────────────────────────────────────────────────────────────────
jar = './.wp-pages-import.cookies'
c, _ = curl(['-c', jar, '-H', 'Content-Type: application/json', f'{CMS_URL}/api/auth/login'],
            json.dumps({'email': E('CMS_EMAIL'), 'password': E('CMS_PASSWORD')}))
if c != 200:
    sys.exit(f'CMS login failed (HTTP {c})')
try:
    c, b = curl(['-b', jar, f'{CMS_URL}/api/pages?pageSize=1000'])
    d = json.loads(b)
    existing = {p['slug']: p['id'] for p in (d['data'] if isinstance(d, dict) else d)}
    created = updated = 0
    for p in out:
        body = {k: p[k] for k in ('title', 'slug', 'excerpt', 'sectionsJson', 'status', 'publishedAt') if p.get(k)}
        body['content'] = ''
        if p.get('seoDescription'):
            body['seoDescription'] = p['seoDescription'][:300]
        if p['slug'] in existing:
            c, b = curl(['-b', jar, '-X', 'PATCH', '-H', 'Content-Type: application/json', f"{CMS_URL}/api/pages/{existing[p['slug']]}"], json.dumps(body))
        else:
            c, b = curl(['-b', jar, '-X', 'POST', '-H', 'Content-Type: application/json', f'{CMS_URL}/api/pages'], json.dumps(body))
        if c in (200, 201):
            created += c == 201
            updated += c == 200
        else:
            problems.append(f"{p['slug']}: API returned HTTP {c}: {b[:120]}")
finally:
    if os.path.exists(jar):
        os.remove(jar)
print(f'Pushed: {created} created, {updated} updated.')

# ── verify: every page loads, and every file / internal link on it resolves ─────
def fetch(u, head=False):
    return curl(['-L', '-o', '/dev/null' if head else '-', *(['-I'] if head else []), u], timeout=60)

def check_page(p):
    c, h = fetch(f"{CMS_URL}/{urllib.parse.quote(p['slug'])}")
    refs = set(re.findall(r'(?:src|href)="(/wp-content/uploads/[^"]+)"', h)) | \
           {l for l in re.findall(r'href="(/[^"#?]*)"', h) if l != '/' and not l.startswith(('/_next', '/api', '/s3'))}
    return p['slug'], c, refs

with cf.ThreadPoolExecutor(6) as ex:
    results = list(ex.map(check_page, out))
refs = set().union(*[r for _, _, r in results])
for slug, c, _ in results:
    if c != 200:
        problems.append(f'{slug}: page returned HTTP {c}')
with cf.ThreadPoolExecutor(8) as ex:
    for u, (c, _) in zip(sorted(refs), ex.map(lambda r: fetch(CMS_URL + r, head=True), sorted(refs))):
        if c != 200:
            problems.append(f'broken reference {c}: {urllib.parse.unquote(u)}')
print(f'Verified {len(results)} pages and {len(refs)} distinct file/page references.')
print('\n'.join(problems) if problems else 'All pages load and every reference resolves.')
sys.exit(1 if problems else 0)
