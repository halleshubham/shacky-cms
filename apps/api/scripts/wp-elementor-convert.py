#!/usr/bin/env python3
"""Convert Elementor-built WordPress pages and posts into Shacky CMS page-builder sections / article HTML.

Elementor's REST `content.rendered` is the whole page layout: a copy of the site header (logo + nav menu) at
the top, the real content as a sequence of widgets, and a copy of the site footer at the bottom. This module
walks the widgets in order and maps the real ones (heading, text, image, button, video, flip-box, gallery, map,
embed) to page-builder blocks, dropping the repeated chrome (nav, share buttons, related posts, post
navigation, social icons...). Anything it does not recognise is kept as cleaned rich text and reported.

Builds on wp-pages-convert.py (link rewriting, HTML sanitising). Pure functions; no CMS access.
Used by wp-elementor-import.py.
"""
import html as htmlmod
import importlib.util
import json
import os
import re
import subprocess
import sys
import urllib.parse

from bs4 import BeautifulSoup, Tag

sys.dont_write_bytecode = True
_here = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('wp_pages_convert', os.path.join(_here, 'wp-pages-convert.py'))
base = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(base)

mk, text_of, clean_html, fix_url = base.mk, base.text_of, base.clean_html, base.fix_url

CHROME = {'nav-menu', 'post-info', 'share-buttons', 'facebook-button', 'author-box', 'post-navigation',
          'social-icons', 'icon', 'menu-anchor', 'form', 'spacer', 'facebook-page', 'divider'}


def wtype(w):
    return (w.get('data-widget_type') or '').split('.')[0]


def container(w):
    """Content of a widget. For rich-text widgets the whole widget element is used: unbalanced pasted HTML can leave
    trailing text outside .elementor-widget-container (seen on real posts), and the widget element holds only
    the container plus such strays."""
    if wtype(w) in ('text-editor', 'html'):
        return w
    return w.select_one('.elementor-widget-container') or w


def widgets_of(soup):
    return [w for w in soup.find_all(attrs={'data-widget_type': True})]


# ── site-specific link rewriting ────────────────────────────────────────────────
def make_rewrite(host, static_paths, post_slugs, skipped, static_dirs, ctx):
    """Rules for URLs on the old site that the generic converter does not know about.

    static_paths : set of site-root paths that were imported (e.g. /books/x.pdf)
    post_slugs   : slugs of posts that exist in the CMS
    skipped      : {wp slug: other-site url} for posts deliberately not migrated (they exist elsewhere)
    """
    h = re.escape(re.sub(r'^https?://', '', host).strip('/').removeprefix('www.'))
    pat = re.compile(rf'^(?:https?:)?//(?:www\.)?{h}(/[^?#]*)?([?#].*)?$', re.I)

    def rewrite(u):
        m = pat.match(u)
        if not m:
            return None
        path = urllib.parse.unquote(m.group(1) or '/')
        tail = m.group(2) or ''
        top = path.strip('/').split('/')[0]
        if top in static_dirs:
            if path not in static_paths:
                ctx.missing_assets.append(('static', u))
            return urllib.parse.quote(path, safe='/')
        mm = re.match(r'^/(\d{4})/([^/]+)/?$', path)
        if mm:
            slug = mm.group(2)
            if slug in skipped:
                return skipped[slug]
            if slug in post_slugs:
                return f'/articles/{slug}'
            ctx.external_wp_links.append(u)
            return None
        mm = re.match(r'^/(tag|category)/([^/]+)/?$', path)
        if mm:
            return f'/{mm.group(1)}/{mm.group(2)}'
        if path.startswith('/index.php') or re.match(r'^/\d{4}(/\d{2}(/\d{2})?)?/?$', path) or path.startswith('/author/'):
            return ''      # legacy archive / author / plugin URLs with no equivalent: keep the text, drop the link
        return None

    return rewrite


# ── flip-box covers live in per-page CSS ────────────────────────────────────────
def curl_text(url, timeout=60):
    r = subprocess.run(['curl', '-sS', '-m', str(timeout), '-L', url], capture_output=True)
    return r.stdout.decode('utf8', 'replace')


def flipbox_backgrounds(page_url):
    """{element id: cover image url} read from the page's stylesheets (rules like
    .elementor-element-<id> .elementor-flip-box__front{background-image:url(...)})."""
    page = curl_text(page_url)
    css_urls = re.findall(r'href=["\']?([^"\'\s>]*/wp-content/cache/minify/[^"\'\s>]+\.css)', page)
    css_urls += re.findall(r'href=["\']?([^"\'\s>]*/uploads/elementor/css/[^"\'\s>]+\.css[^"\'\s>]*)', page)
    out = {}
    for u in dict.fromkeys(css_urls):
        css = curl_text(u, 120)
        for eid, url in re.findall(r'\.elementor-element-([0-9a-f]{7})\s+\.elementor-flip-box__front\{[^}]*?background-image:url\(["\']?([^"\')]+)', css):
            out[eid] = html_unescape(url)
    return out


def html_unescape(s):
    return htmlmod.unescape(s)


# ── widget → block(s) ───────────────────────────────────────────────────────────
def embed_html(src):
    return ('<div style="position:relative;width:100%;padding-top:56.25%">'
            f'<iframe src="{src}" loading="lazy" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe></div>')


def youtube_embed(url):
    u = htmlmod.unescape(url)
    m = re.search(r'(?:youtu\.be/|youtube\.com/(?:watch\?(?:[^#]*&)?v=|embed/|shorts/))([\w-]{11})', u)
    return f'https://www.youtube.com/embed/{m.group(1)}' if m else None


def handle_heading(ctx, w):
    t = w.select_one('.elementor-heading-title')
    if not t:
        return []
    txt = text_of(t)
    if not txt:
        return []
    if t.name in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6') and len(txt) <= 180:
        cfg = {'text': txt, 'level': 2 if t.name in ('h1', 'h2') else 3, 'align': base.align_of(w)}
        a = t.find('a')
        if a and a.get('href') and text_of(a) == txt:
            cfg['linkUrl'] = fix_url(ctx, a['href'])
        return [mk(ctx, 'heading_block', cfg)]
    h = clean_html(ctx, [t])
    return [mk(ctx, 'rich_text', {'html': f'<p>{h}</p>' if not h.startswith('<p') else h})] if h else []


def handle_text(ctx, w):
    h = clean_html(ctx, [container(w)])
    return [mk(ctx, 'rich_text', {'html': h})] if re.sub(r'<[^>]+>', '', h).strip() or '<img' in h else []


def image_item(ctx, w):
    img = w.find('img')
    if not img:
        return None
    src = img.get('data-lazy-src') or img.get('data-src') or img.get('src') or ''
    if not src or src.startswith('data:'):
        return None
    a = img.find_parent('a')
    cap = w.select_one('.widget-image-caption, figcaption')
    item = {'src': fix_url(ctx, src, 'img'), 'alt': img.get('alt') or ''}
    if cap and text_of(cap):
        item['caption'] = text_of(cap)
    if a and a.get('href') and not re.search(r'/(?:wp-content/uploads/.*-\d+x\d+)', a['href']):
        item['linkUrl'] = fix_url(ctx, a['href'])
        if a.get('target') == '_blank':
            item['linkNewTab'] = True
    return item


def handle_button(ctx, w):
    a = w.select_one('a.elementor-button') or w.find('a')
    if not a or not a.get('href'):
        return []
    label = text_of(a.select_one('.elementor-button-text') or a)
    if not label:
        return []
    d = {'label': label, 'url': fix_url(ctx, a['href']), 'variant': 'primary'}
    if a.get('target') == '_blank':
        d['newTab'] = True
    return [mk(ctx, 'button_row', {'buttons': [d], 'align': base.align_of(w, 'center')})]


def handle_video(ctx, w):
    raw = w.get('data-settings') or '{}'
    try:
        st = json.loads(htmlmod.unescape(raw))
    except Exception:
        st = {}
    src = youtube_embed(st.get('youtube_url', '')) if st.get('youtube_url') else None
    if not src and st.get('vimeo_url'):
        m = re.search(r'vimeo\.com/(\d+)', st['vimeo_url'])
        src = f'https://player.vimeo.com/video/{m.group(1)}' if m else None
    if not src:
        ifr = w.find('iframe')
        if ifr and (ifr.get('src') or ifr.get('data-lazy-src')):
            src = ifr.get('src') or ifr.get('data-lazy-src')
            yt = youtube_embed(src)
            src = yt or src
    if not src:
        hosted = (st.get('hosted_url') or {}).get('url') if isinstance(st.get('hosted_url'), dict) else None
        if hosted:
            return [mk(ctx, 'html_embed', {'label': 'Video', 'code': f'<video controls preload="none" style="width:100%" src="{fix_url(ctx, hosted)}"></video>'})]
        return []
    return [mk(ctx, 'html_embed', {'label': 'Video', 'code': embed_html(src)})]


def handle_embed_widget(ctx, w):
    """html / google_maps widgets: keep allow-listed iframes only."""
    out = []
    for ifr in w.find_all('iframe'):
        src = ifr.get('src') or ifr.get('data-lazy-src') or ''
        yt = youtube_embed(src)
        if yt:
            src = yt
        if re.match(r'^(?:https?:)?//(?:www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|google\.com/maps|maps\.google\.com)/', src, re.I):
            out.append(mk(ctx, 'html_embed', {'label': 'Embed', 'code': embed_html(('https:' + src) if src.startswith('//') else src)}))
        elif src:
            ctx.unhandled.add('iframe:' + re.sub(r'^https?://([^/]+).*', r'\1', src))
    if not out and not w.find('iframe'):
        return handle_text(ctx, w)
    return out


def flip_card(ctx, w, bg):
    """Flip-box -> card. Text can sit on either layer: some boxes have the cover image on the front and the title
    on the back; others carry the title on the front and the "download" wording on the back."""
    def layer(sel, cls):
        el = w.select_one(f'.elementor-flip-box__{sel} .elementor-flip-box__layer__{cls}')
        return text_of(el) if el else ''

    front_title, front_desc = layer('front', 'title'), layer('front', 'description')
    back_title, back_desc = layer('back', 'title'), layer('back', 'description')
    front_bg = bg.get(w.get('data-id'))
    title = front_title or back_title
    texts = []
    for t in (front_desc, back_title if front_title else '', back_desc):
        if t and t != title and t not in texts:
            texts.append(t)
    a = w.select_one('a.elementor-flip-box__button') or w.select_one('.elementor-flip-box__back a')
    card = {'contentType': 'card'}
    if front_bg:
        card['imageSrc'] = fix_url(ctx, front_bg, 'img')
        card['imageAlt'] = title
    if title:
        card['title'] = title
    if texts:
        card['text'] = ' — '.join(texts)
    if a and a.get('href'):
        url = fix_url(ctx, a['href'])
        card['buttonLabel'] = text_of(a) or 'Open'
        card['buttonUrl'] = url
        card['buttonVariant'] = 'primary'
        if a.get('target') == '_blank':
            card['buttonNewTab'] = True
        if front_bg and (base.FILE_EXT.search(url) or url.startswith(('/books/', '/pamphlets/'))):
            card['imageLink'] = url
            card['imageDownload'] = True
    return card


def bg_image(ctx, el):
    m = re.search(r'background-image:\s*url\(["\']?([^"\')]+)', (el.get('style') or '') if el else '')
    return fix_url(ctx, htmlmod.unescape(m.group(1)), 'img') if m else None


def cta_card(ctx, w):
    """call-to-action widget -> card (image, title, description, button)."""
    card = {'contentType': 'card'}
    img = bg_image(ctx, w.select_one('.elementor-cta__bg'))
    if img:
        card['imageSrc'] = img
        card['imageAlt'] = (w.select_one('.elementor-cta__bg') or {}).get('aria-label', '') if hasattr(w.select_one('.elementor-cta__bg'), 'get') else ''
    t, d = w.select_one('.elementor-cta__title'), w.select_one('.elementor-cta__description')
    if t and text_of(t):
        card['title'] = text_of(t)
    if d and text_of(d):
        card['text'] = text_of(d)
    a = w.select_one('a.elementor-cta__button') or w.select_one('a[href]')
    if a and a.get('href'):
        card.update(buttonLabel=text_of(a) or 'Open', buttonUrl=fix_url(ctx, a['href']), buttonVariant='primary')
    return card


def slide_cards(ctx, w):
    """slides widget -> one card per real slide (swiper clones are skipped)."""
    out = []
    for sl in w.select('.swiper-slide'):
        if 'swiper-slide-duplicate' in (sl.get('class') or []):
            continue
        card = {'contentType': 'card'}
        img = bg_image(ctx, sl.select_one('.swiper-slide-bg'))
        h, d = sl.select_one('.elementor-slide-heading'), sl.select_one('.elementor-slide-description')
        if img:
            card['imageSrc'] = img
            card['imageAlt'] = text_of(h) if h else ''
        if h and text_of(h):
            card['title'] = text_of(h)
        if d and text_of(d):
            card['text'] = text_of(d)
        a = sl.select_one('a.elementor-button') or sl.select_one('a[href]')
        if a and a.get('href'):
            card.update(buttonLabel=text_of(a) or 'Open', buttonUrl=fix_url(ctx, a['href']), buttonVariant='primary')
        if len(card) > 1:
            out.append(card)
    return out


def handle_gallery(ctx, w):
    items, seen = [], set()
    slides = [sl for sl in w.select('.swiper-slide') if 'swiper-slide-duplicate' not in (sl.get('class') or [])] or [w]
    for sl in slides:
        for img in sl.find_all('img'):
            src = img.get('data-lazy-src') or img.get('data-src') or img.get('src') or ''
            if not src or src.startswith('data:') or src in seen:
                continue
            seen.add(src)
            a = img.find_parent('a')
            cap = (img.find_parent('figure') or sl).select_one('figcaption, .elementor-image-carousel-caption, .elementor-carousel-image-overlay')
            it = {'src': fix_url(ctx, src, 'img'), 'alt': img.get('alt') or ''}
            if cap and text_of(cap):
                it['caption'] = text_of(cap)
            if a and a.get('href'):
                it['linkUrl'] = fix_url(ctx, a['href'])
            items.append(it)
    return base.gallery_blocks(ctx, items)


# ── page conversion ─────────────────────────────────────────────────────────────
def split_chrome(soup):
    """Returns (widgets, start, end): the slice of widgets that are real content."""
    ws = widgets_of(soup)
    types = [wtype(w) for w in ws]
    start = 0
    if 'nav-menu' in types[:8]:
        start = types.index('nav-menu') + 1
    end = len(ws)
    for i in range(start, len(ws)):
        t = text_of(ws[i])
        if (types[i] == 'heading' and re.search(r'subscribe to our mailing list', t, re.I)) or types[i] == 'form':
            end = i
            break
        if types[i] == 'heading' and re.fullmatch(r'important links', t.strip(), re.I):
            end = max(start, i - 2)
            break
    return ws, start, end


def convert_page(ctx, title, content_html, bg, post_grid=None, widget_range=None):
    """-> sections list (starts with an H1 of the page title). widget_range=(a, b) converts only widgets a..b-1 (indexes
    into widgets_of(soup)) — used to split one long page into several."""
    soup = BeautifulSoup(content_html, 'html.parser')
    if not soup.find(attrs={'data-widget_type': True}):
        return base.convert_page(ctx, title, content_html)         # plain (non-Elementor) content
    ws, start, end = split_chrome(soup)
    if widget_range:
        start, end = widget_range
    items = []          # list of ('block', [blocks]) | ('card', card) | ('img', item)
    for w in ws[start:end]:
        t = wtype(w)
        if t in CHROME and t != 'divider':
            continue
        if t == 'divider':
            items.append(('block', [mk(ctx, 'divider', {})]))
        elif t == 'heading':
            items.append(('block', handle_heading(ctx, w)))
        elif t == 'text-editor':
            items.append(('block', handle_text(ctx, w)))
        elif t == 'image':
            it = image_item(ctx, w)
            if it:
                items.append(('img', it))
        elif t == 'button':
            items.append(('block', handle_button(ctx, w)))
        elif t == 'video':
            items.append(('block', handle_video(ctx, w)))
        elif t in ('html', 'google_maps'):
            items.append(('block', handle_embed_widget(ctx, w)))
        elif t == 'flip-box':
            items.append(('card', flip_card(ctx, w, bg)))
        elif t in ('gallery', 'media-carousel', 'image-carousel'):
            items.append(('block', handle_gallery(ctx, w)))
        elif t == 'call-to-action':
            items.append(('card', cta_card(ctx, w)))
        elif t == 'slides':
            items.extend(('card', c) for c in slide_cards(ctx, w))
        elif t == 'posts':
            if post_grid:
                items.append(('block', [mk(ctx, 'post_grid', post_grid)]))
        else:
            ctx.unhandled.add('widget:' + t)
            items.append(('block', handle_text(ctx, w)))
    blocks, imgs, cards = [], [], []

    def flush_imgs():
        nonlocal imgs
        blocks.extend(base.gallery_blocks(ctx, imgs))
        imgs = []

    def flush_cards():
        nonlocal cards
        if cards:
            n = len(cards)
            blocks.append(mk(ctx, 'columns_block', {'columns': cards, 'columnsPerRow': 3 if n >= 3 else n, 'textAlign': 'left'}))
        cards = []

    for kind, v in items:
        if kind != 'img':
            flush_imgs()
        if kind != 'card':
            flush_cards()
        if kind == 'img':
            imgs.append(v)
        elif kind == 'card':
            cards.append(v)
        else:
            blocks.extend(v)
    flush_imgs()
    flush_cards()
    blocks = base.merge_adjacent(blocks)
    # merge consecutive single-button rows into one row
    merged = []
    for b in blocks:
        if merged and b['type'] == 'button_row' and merged[-1]['type'] == 'button_row':
            merged[-1]['config']['buttons'] += b['config']['buttons']
        else:
            merged.append(b)
    if merged and merged[0]['type'] == 'heading_block' and merged[0]['config']['text'].strip().lower() == title.strip().lower():
        merged.pop(0)
    return [mk(ctx, 'heading_block', {'text': title, 'level': 1, 'align': 'center'})] + merged


# ── posts ───────────────────────────────────────────────────────────────────────
def flatten_email_tables(soup):
    """Pasted Gmail newsletters are nested layout tables: turn cells into paragraphs, drop the grid."""
    for img in list(soup.find_all('img')):
        w, h = img.get('width'), img.get('height')
        if (w in ('1', '0') or h in ('1', '0')) or 'track' in (img.get('src') or '').lower():
            img.decompose()
    block = ('p', 'div', 'table', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote')
    for td in reversed(soup.find_all(['td', 'th'])):
        if td.get_text(strip=True) or td.find('img'):
            if not td.find(block):
                p = soup.new_tag('p')
                for c in list(td.contents):
                    p.append(c.extract())
                td.append(p)
        td.unwrap()
    for t in soup.find_all(['tr', 'tbody', 'thead', 'tfoot', 'table', 'center']):
        t.unwrap()


def extract_post(ctx, post, featured_path=None):
    """-> {'html': body html, 'authors': [names]}

    A WordPress post normally holds one article. A few hold several (title + byline + body repeated); the extra
    articles are appended under their own <h2> title and byline so no content is lost."""
    soup = BeautifulSoup(post['content']['rendered'], 'html.parser')
    ws = widgets_of(soup)
    if not ws:
        flatten_email_tables(soup)
        return {'html': clean_html(ctx, [soup]), 'authors': []}

    def names_of(w):
        raw = re.sub(r'\S+@\S+', '', text_of(w))
        out = []
        for name in re.split(r'\s*(?:,|&| and )\s*', raw):
            name = name.strip(' .;')
            if 2 < len(name) < 60 and name not in out:
                out.append(name)
        return out

    sections = [{'title': None, 'authors': [], 'parts': [], 'lead': [], 'seen_text': False}]
    last_heading = None
    for w in ws:
        t = wtype(w)
        cur = sections[-1]
        if t == 'heading':
            last_heading = w
        elif t == 'post-info' and cur['seen_text'] and last_heading is not None:
            # a new article starts: its title was the heading just before this byline widget
            sections.append({'title': text_of(last_heading), 'authors': [], 'parts': [], 'lead': [], 'seen_text': False})
        elif t == 'author-box':
            for n in names_of(w):
                if n not in cur['authors']:
                    cur['authors'].append(n)
        elif t == 'text-editor':
            cur['seen_text'] = True
            cur['parts'].append(container(w))
        elif t == 'image' and not cur['seen_text']:
            cur['lead'].append(w)
        elif t == 'flip-box' and cur['seen_text']:
            c = flip_card(ctx, w, {})
            bits = [f'<strong>{htmlmod.escape(c["title"])}</strong>' if c.get('title') else '', htmlmod.escape(c.get('text', ''))]
            link = f'<a href="{c["buttonUrl"]}">{htmlmod.escape(c.get("buttonLabel", "Download"))}</a>' if c.get('buttonUrl') else ''
            cur['parts'].append(BeautifulSoup(f'<p>{" — ".join(b for b in bits if b)} {link}</p>', 'html.parser'))
        elif t == 'html' and cur['seen_text'] and not w.find('iframe'):
            cur['parts'].append(container(w))                      # text/markup in an HTML widget
        elif t in ('video', 'html', 'google_maps') and cur['seen_text']:
            for b in (handle_video(ctx, w) if t == 'video' else handle_embed_widget(ctx, w)):
                if b['type'] == 'html_embed':
                    cur['parts'].append(BeautifulSoup(b['config']['code'], 'html.parser'))
    html_out, authors = '', []
    for i, sec in enumerate(sections):
        if not sec['parts'] and not sec['lead']:
            continue
        for part in sec['parts']:
            flatten_email_tables(part)
        lead = ''
        for w in sec['lead']:
            it = image_item(ctx, w)
            if it and it['src'] == featured_path and it.get('caption'):
                lead += f'<p><em>{htmlmod.escape(it["caption"])}</em></p>'      # the image itself is the featured image
            if it and it['src'] != featured_path:
                cap = f'<figcaption>{htmlmod.escape(it["caption"])}</figcaption>' if it.get('caption') else ''
                lead += f'<figure><img src="{it["src"]}" alt="{htmlmod.escape(it.get("alt", ""))}"/>{cap}</figure>'
        head = ''
        if i > 0:
            by = f'<p><em>By {htmlmod.escape(", ".join(sec["authors"]))}</em></p>' if sec['authors'] else ''
            head = f'<hr/><h2>{htmlmod.escape(sec["title"] or "")}</h2>{by}'
        html_out += head + lead + clean_html(ctx, sec['parts'])
        for n in sec['authors']:
            if n not in authors:
                authors.append(n)
    if not html_out.strip():
        flatten_email_tables(soup)
        html_out = clean_html(ctx, [soup])
    return {'html': html_out, 'authors': authors}


def plain_excerpt(html, n=240):
    t = re.sub(r'\s+', ' ', htmlmod.unescape(re.sub(r'<[^>]+>', ' ', html))).strip()
    return (t[:n].rsplit(' ', 1)[0] + '…') if len(t) > n else t


def section_ranges(content_html, specs):
    """Split one long page into sections. specs: [{"slug","title","starts": heading text prefix, "until": optional text of the
    widget that ends the section}]. Returns {slug: (first widget index, end index)} over widgets_of(soup); each section
    starts at its heading (plus any menu-anchor right before it) and runs to the next section's start."""
    soup = BeautifulSoup(content_html, 'html.parser')
    ws, start, end = split_chrome(soup)
    firsts = []
    for sp in specs:
        i = next((i for i in range(start, len(ws)) if wtype(ws[i]) == 'heading' and text_of(ws[i]).lower().startswith(sp['starts'].lower())), None)
        if i is None:
            raise ValueError(f"section heading not found: {sp['starts']!r}")
        while i - 1 >= start and wtype(ws[i - 1]) == 'menu-anchor':
            i -= 1
        firsts.append(i)
    order = sorted(range(len(specs)), key=lambda k: firsts[k])
    out = {}
    for n, k in enumerate(order):
        a = firsts[k]
        b = firsts[order[n + 1]] if n + 1 < len(order) else end
        until = specs[k].get('until')
        if until:
            stop = next((i for i in range(a, b) if text_of(ws[i]).lower().startswith(until.lower())), None)
            if stop is not None:
                b = stop
        out[specs[k]['slug']] = (a, b)
    return out, ws
