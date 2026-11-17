#!/usr/bin/env python3
"""
Gives every download card (book / booklet / pamphlet) a cover image, then writes a {download url: cover url} map for
wp-elementor-import.py (COVERS_FILE).

WordPress sites often define no cover at all for such cards, and file names are not a safe way to guess one (a Hindi
edition would get the Marathi cover). So covers come from evidence only, in this order:
  1. the first-page preview WordPress itself generated and stored for that exact PDF (media_details.sizes) — imported
     as-is at its original path;
  2. otherwise the first page of the PDF, rendered with poppler's pdftoppm (a booklet's first page is its cover),
     stored as /wp-content/uploads/_covers/<folder>-<file>.jpg.
Cards linking to non-PDF files (.doc etc.) get no cover. Optional COVER_OVERRIDES (json {download url: existing cover url})
is for covers matched by hand — e.g. artwork already in the media library that a person has checked against the PDF — and
wins over both tiers. Idempotent: re-running reuses covers.json and the CMS import
endpoint skips files it already has.

  WP_URL=https://example.org CMS_URL=https://cms.example.org CMS_EMAIL=… CMS_PASSWORD=… \
  CONVERTED=converted.json python3 apps/api/scripts/wp-book-covers.py

Needs: python3, pdftoppm (poppler-utils), curl. Env: OUT (covers.json), WIDTH (cover width in px, default 520), COVER_OVERRIDES (optional, see above).
"""
import concurrent.futures as cf
import glob
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.parse

E = os.environ.get
WP_URL, CMS_URL = (E('WP_URL') or '').rstrip('/'), (E('CMS_URL') or '').rstrip('/')
if not (WP_URL and CMS_URL and E('CMS_EMAIL') and E('CMS_PASSWORD')):
    sys.exit('Set WP_URL, CMS_URL, CMS_EMAIL, CMS_PASSWORD.')
CONVERTED, OUT, WIDTH = E('CONVERTED', 'converted.json'), E('OUT', 'covers.json'), int(E('WIDTH', '520'))
JAR = './.wp-book-covers.cookies'
dec = urllib.parse.unquote


def run(args, **kw):
    return subprocess.run(args, capture_output=True, **kw)


def download(url, dest, timeout=300):
    r = run(['curl', '-sS', '-m', str(timeout), '-L', '-f', '-o', dest, url])
    return r.returncode == 0 and os.path.getsize(dest) > 0


def upload(rel_path, file_path, area='uploads'):
    """-> public path of the stored file, or None. Fields precede the file (the API reads them first)."""
    args = ['curl', '-sS', '-m', '300', '-b', JAR, '-w', '\n%{http_code}', '-F', f'path={rel_path}', '-F', 'mimeType=image/jpeg']
    if area != 'uploads':
        args += ['-F', f'area={area}']
    r = run(args + ['-F', f'file=@{file_path};type=image/jpeg', f'{CMS_URL}/api/media/import'], text=True)
    code = int((r.stdout.rpartition('\n')[2] or '0'))
    return code in (200, 201)


# ── which cards need a cover ────────────────────────────────────────────────────
conv = json.load(open(CONVERTED))
need = {}
for p in conv['pages']:
    for b in json.loads(p['sectionsJson']):
        if b['type'] != 'columns_block':
            continue
        for col in b['config']['columns']:
            u = col.get('buttonUrl') or ''
            if col.get('contentType') in (None, 'card') and not col.get('imageSrc') and dec(u).lower().endswith('.pdf') and u.startswith('/'):
                need[u] = col.get('title', '')
covers = json.load(open(OUT)) if os.path.exists(OUT) else {}
overrides = json.load(open(E('COVER_OVERRIDES'))) if E('COVER_OVERRIDES') else {}
covers.update({u: c for u, c in overrides.items() if u in need})
todo = {u: t for u, t in need.items() if u not in covers}
print(f'{len(need)} distinct PDFs need a cover; {len(need) - len(todo)} already done; {len(todo)} to do')

# WordPress-generated previews, by PDF path under uploads/
previews = {}
page, total = 1, 1
while page <= total:
    hdr = tempfile.mktemp()
    body = subprocess.run(['curl', '-sS', '-m', '120', '-D', hdr, f'{WP_URL}/wp-json/wp/v2/media?per_page=100&page={page}&mime_type=application/pdf&_fields=source_url,media_details'],
                          capture_output=True, text=True).stdout
    m = re.search(r'x-wp-totalpages:\s*(\d+)', open(hdr, errors='replace').read(), re.I)
    total = int(m.group(1)) if m else 1
    os.remove(hdr)
    for it in json.loads(body):
        sizes = (it.get('media_details') or {}).get('sizes') or {}
        pick = sizes.get('large') or sizes.get('full') or sizes.get('medium')
        if pick and '/uploads/' in it['source_url']:
            rel = dec(it['source_url'].split('/uploads/')[1])
            previews[rel] = rel.rsplit('/', 1)[0] + '/' + pick['file'] if '/' in rel else pick['file']
    page += 1

c = run(['curl', '-sS', '-m', '60', '-c', JAR, '-H', 'Content-Type: application/json', '-w', '\n%{http_code}', '-d',
         json.dumps({'email': E('CMS_EMAIL'), 'password': E('CMS_PASSWORD')}), f'{CMS_URL}/api/auth/login'], text=True)
if c.stdout.rpartition('\n')[2] != '200':
    sys.exit('CMS login failed')


def make(item):
    u, title = item
    path = dec(u)
    with tempfile.TemporaryDirectory() as tmp:
        if path.startswith('/wp-content/uploads/'):
            rel = path[len('/wp-content/uploads/'):]
            prev = previews.get(rel)
            if prev:                                                    # tier 1: the preview WordPress stored
                f = os.path.join(tmp, 'p.jpg')
                if download(f'{WP_URL}/wp-content/uploads/' + urllib.parse.quote(prev), f) and upload(prev, f):
                    return u, '/wp-content/uploads/' + urllib.parse.quote(prev), 'wordpress-preview'
        src = os.path.join(tmp, 'in.pdf')                              # tier 2: render the PDF's first page
        if not download(WP_URL + urllib.parse.quote(path), src):
            return u, None, 'download failed'
        r = run(['pdftoppm', '-jpeg', '-jpegopt', 'quality=82', '-f', '1', '-l', '1', '-scale-to-x', str(WIDTH), '-scale-to-y', '-1', src, os.path.join(tmp, 'pg')], timeout=180)
        out = (glob.glob(os.path.join(tmp, 'pg*.jpg')) or [None])[0]
        if not out or os.path.getsize(out) < 2000:
            return u, None, 'could not render page 1'
        name = re.sub(r'[^A-Za-z0-9._-]+', '-', path.strip('/').replace('/', '-').rsplit('.', 1)[0])[:120] + '.jpg'
        if not upload('_covers/' + name, out):
            return u, None, 'upload failed'
        return u, '/wp-content/uploads/_covers/' + name, 'rendered'


stats = {'wordpress-preview': 0, 'rendered': 0}
failed = []
try:
    with cf.ThreadPoolExecutor(3) as ex:
        for i, (u, cover, how) in enumerate(ex.map(make, todo.items()), 1):
            if cover:
                covers[u] = cover
                stats[how] += 1
            else:
                failed.append((u, how))
            if i % 10 == 0:
                json.dump(covers, open(OUT, 'w'))
                print(f'  [{i}/{len(todo)}] {stats} failed={len(failed)}', flush=True)
finally:
    json.dump(covers, open(OUT, 'w'))
    if os.path.exists(JAR):
        os.remove(JAR)
print(f'done: {stats}, failed: {len(failed)}; {len(covers)} covers in {OUT}')
for u, why in failed[:15]:
    print('  FAILED', dec(u), '-', why)
sys.exit(1 if failed else 0)
