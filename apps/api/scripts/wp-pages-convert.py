#!/usr/bin/env python3
"""Convert WordPress (Gutenberg) page HTML into Shacky CMS page-builder sections.

Call configure("your-site.org") once before converting. Used by wp-pages-import.py.

Pure functions + a CLI that writes converted pages to a JSON file. No network access.
Asset links are rewritten to the site-relative /wp-content/uploads/... path (the CMS serves
imported files at the same path) and checked against the set of files actually imported.
"""
import html as htmlmod
import json
import re
import sys
import urllib.parse
from bs4 import BeautifulSoup, NavigableString, Tag

HOST_RE = CDN_RE = None


def configure(host):
    """Set the WordPress site host (e.g. "example.org") whose absolute URLs get rewritten."""
    global HOST_RE, CDN_RE
    h = re.escape(re.sub(r'^https?://', '', host).strip('/').removeprefix('www.'))
    HOST_RE = rf'(?:https?:)?//(?:www\.)?{h}'
    CDN_RE = rf'(?:https?:)?//i\d\.wp\.com/(?:www\.)?{h}'

FILE_EXT = re.compile(r'\.(pdf|docx?|pptx?|xlsx?|zip|mp3|mp4|aac)(\?|#|$)', re.I)

ALLOWED_TAGS = {'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3', 'h4', 'h5', 'h6',
                'img', 'figure', 'figcaption', 'audio', 'source', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'sup', 'sub', 'small', 'mark'}
UNWRAP_TAGS = {'div', 'span', 'section', 'article', 'font', 'center', 'main', 'header', 'footer', 'aside', 'abbr', 'cite', 'code', 'label'}
ALLOWED_ATTRS = {'a': {'href', 'target', 'rel', 'title'}, 'img': {'src', 'alt', 'title', 'width', 'height'},
                 'audio': {'src', 'controls', 'preload'}, 'source': {'src', 'type'}, 'td': {'colspan', 'rowspan'}, 'th': {'colspan', 'rowspan'}}


class Ctx:
    """Per-page conversion context: id counter + problems found."""

    def __init__(self, imported_paths, page_slugs):
        self.imported = imported_paths      # set of decoded paths under uploads/, e.g. '2025/07/foo.pdf'
        self.page_slugs = page_slugs        # set of decoded slugs that will exist as CMS pages
        self.n = 0
        self.missing_assets = []            # (kind, original url)
        self.external_wp_links = []         # links to the WP site we can't map to a page/upload
        self.rewritten = 0
        self.unhandled = set()

    def bid(self, t):
        self.n += 1
        return f'{t}-{self.n}'


# ── URL handling ────────────────────────────────────────────────────────────────
def resolve_upload(ctx, path):
    """path: decoded path after /wp-content/uploads/. Returns (resolved_path, ok)."""
    if path in ctx.imported:
        return path, True
    base = re.sub(r'-(?:scaled|\d+x\d+)(\.[A-Za-z0-9]+)$', r'\1', path)   # WP resized variants -> original
    if base in ctx.imported:
        return base, True
    return path, False


def fix_url(ctx, url, kind='link'):
    if not url:
        return url
    u = htmlmod.unescape(url.strip())
    hook = getattr(ctx, 'rewrite', None)       # site-specific rules, set by e.g. wp-elementor-convert.py
    if hook:
        r = hook(u)
        if r is not None:
            ctx.rewritten += 1
            return r
    m = re.match(rf'^(?:{CDN_RE}|{HOST_RE})(/wp-content/uploads/[^?#]+)(?:[?#].*)?$', u, re.I)
    if m:
        decoded = urllib.parse.unquote(m.group(1)[len('/wp-content/uploads/'):])
        res, ok = resolve_upload(ctx, decoded)
        if not ok:
            ctx.missing_assets.append((kind, u))
        ctx.rewritten += 1
        return '/wp-content/uploads/' + urllib.parse.quote(res, safe='/')
    m = re.match(rf'^{HOST_RE}(/[^?#]*)?([?#].*)?$', u, re.I)
    if m:
        path = urllib.parse.unquote((m.group(1) or '/').strip('/'))
        tail = m.group(2) or ''
        if path == '':
            return '/' + tail
        if path.split('/')[0] in ctx.page_slugs:
            ctx.rewritten += 1
            return '/' + path.lower() + tail if path.lower() in ctx.page_slugs else '/' + path + tail
        ctx.external_wp_links.append(u)
        return u
    return u


# ── Helpers ─────────────────────────────────────────────────────────────────────
def text_of(node):
    return re.sub(r'\s+', ' ', node.get_text(' ', strip=True).replace('\xa0', ' ')).strip()


def is_blank(node):
    if isinstance(node, NavigableString):
        return not str(node).replace('\xa0', ' ').strip()
    if not isinstance(node, Tag):
        return True
    if node.find(['img', 'audio', 'iframe', 'video', 'a']):
        return False
    return not node.get_text().replace('\xa0', ' ').strip()


def classes(node):
    return set(node.get('class') or []) if isinstance(node, Tag) else set()


def clean_html(ctx, node_or_list):
    """Serialise node(s) to sanitised HTML limited to ALLOWED_TAGS, with URLs rewritten."""
    nodes = node_or_list if isinstance(node_or_list, list) else [node_or_list]
    wrapper = BeautifulSoup('<div></div>', 'html.parser').div
    for n in nodes:
        wrapper.append(BeautifulSoup(str(n), 'html.parser'))
    for el in list(wrapper.find_all(True)):
        if el.name in ('script', 'style', 'noscript', 'form', 'button', 'input', 'svg'):
            el.decompose()
    for el in list(wrapper.find_all(True)):
        if el.name == 'iframe':
            continue
        if el.name in UNWRAP_TAGS:
            el.unwrap()
        elif el.name not in ALLOWED_TAGS:
            ctx.unhandled.add(el.name)
            el.unwrap()
    new_tag = BeautifulSoup('', 'html.parser').new_tag
    for el in list(wrapper.find_all('iframe')):
        src = el.get('src') or el.get('data-src') or ''
        # `<iframe .../>` is not self-closing in HTML: parsers nest everything after it inside the iframe.
        # Rescue that content before deciding what to do with the embed itself.
        for kid in reversed(list(el.contents)):
            el.insert_after(kid.extract())
        if not re.match(r'^(?:https?:)?//(?:www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|google\.com/maps|maps\.google\.com)/', src, re.I):
            if src.startswith(('http://', 'https://', '//')):
                host = re.sub(r'^(?:https?:)?//([^/]+).*', r'\1', src)
                p = new_tag('p')
                a = new_tag('a', href=('https:' + src) if src.startswith('//') else src)
                a.string = f'Embedded content: {host}'
                p.append(a)
                el.replace_with(p)
            else:
                el.decompose()
            continue
        for a_ in list(el.attrs):
            if a_ not in ('width', 'height', 'allowfullscreen', 'title'):
                del el.attrs[a_]
        el['src'] = ('https:' + src) if src.startswith('//') else src
        el['loading'] = 'lazy'
        el['style'] = 'width:100%;aspect-ratio:16/9;border:0'
    for el in wrapper.find_all(True):
        if el.name == 'iframe':
            continue
        keep = ALLOWED_ATTRS.get(el.name, set())
        for a in list(el.attrs):
            if a not in keep:
                del el.attrs[a]
        for a in ('href', 'src'):
            if el.get(a):
                v = el[a].strip()
                if re.match(r'^\s*(javascript|data):', v, re.I):
                    del el.attrs[a]
                else:
                    el[a] = fix_url(ctx, v, 'img' if el.name == 'img' else 'link')
        if el.name == 'a' and not (el.get('href') or '').strip():
            el.unwrap()
            continue
        if el.name == 'a' and el.get('target') == '_blank':
            el['rel'] = 'noopener noreferrer'
    for el in list(wrapper.find_all(['p', 'li'])):
        if not el.get_text().replace('\xa0', ' ').strip() and not el.find(['img', 'audio', 'a']):
            el.decompose()
    out = wrapper.decode_contents().strip()
    return re.sub(r'\n{2,}', '\n', out)


# ── Block builders ──────────────────────────────────────────────────────────────
def mk(ctx, t, cfg):
    return {'id': ctx.bid(t), 'type': t, 'config': cfg}


def align_of(node, default='left'):
    c = classes(node)
    for k in ('center', 'right', 'left'):
        if f'has-text-align-{k}' in c or f'is-content-justification-{k}' in c or f'is-horizontally-aligned-{k}' in c:
            return k
    return default


def image_item(ctx, fig):
    img = fig.find('img')
    if not img or not (img.get('src') or img.get('data-src')):
        return None
    a = img.find_parent('a')
    cap = fig.find('figcaption')
    src = fix_url(ctx, img.get('src') or img.get('data-src'), 'img')
    link = fix_url(ctx, a.get('href'), 'link') if a and a.get('href') else None
    # a "link to the media file itself" is just the image; keep it as the click-through download
    item = {'src': src, 'alt': img.get('alt') or ''}
    if cap and text_of(cap):
        item['caption'] = text_of(cap)
    if link:
        item['linkUrl'] = link
        if a.get('target') == '_blank':
            item['linkNewTab'] = True
    return item


def gallery_blocks(ctx, items):
    if not items:
        return []
    if len(items) == 1:
        it = items[0]
        cfg = {'src': it['src'], 'alt': it.get('alt', ''), 'align': 'center'}
        for k in ('caption', 'linkUrl', 'linkNewTab'):
            if k in it:
                cfg[k] = it[k]
        return [mk(ctx, 'image_block', cfg)]
    n = len(items)
    cols = 2 if n == 2 else (4 if n >= 8 else 3)
    return [mk(ctx, 'image_gallery', {'images': items, 'columns': cols, 'showCaptions': any('caption' in i for i in items)})]


def button_row(ctx, node):
    btns = []
    for b in node.select('.wp-block-button'):
        a = b.find('a')
        if not a or not a.get('href'):
            continue
        label = text_of(a)
        if not label:
            continue
        d = {'label': label, 'url': fix_url(ctx, a['href'], 'link'),
             'variant': 'outline' if 'is-style-outline' in classes(b) else 'primary'}
        if a.get('target') == '_blank':
            d['newTab'] = True
        btns.append(d)
    if not btns:
        return []
    return [mk(ctx, 'button_row', {'buttons': btns, 'align': align_of(node)})]


def heading_block(ctx, node):
    t = text_of(node)
    if not t:
        return []
    lvl = 2 if node.name in ('h1', 'h2') else 3
    cfg = {'text': t, 'level': lvl, 'align': align_of(node)}
    a = node.find('a')
    if a and a.get('href') and text_of(a) == t:
        cfg['linkUrl'] = fix_url(ctx, a['href'])
        if a.get('target') == '_blank':
            cfg['linkNewTab'] = True
    return [mk(ctx, 'heading_block', cfg)]


def spacer_block(ctx, node):
    m = re.search(r'height:\s*(\d+)', node.get('style', ''))
    h = max(8, min(96, int(m.group(1)))) if m else 24
    return [mk(ctx, 'spacer', {'height': h})]


def embed_block(ctx, node):
    return [mk(ctx, 'html_embed', {'label': 'Embed', 'code': str(node)})]


class Flow:
    """Accumulates loose content into rich_text / galleries, flushing in document order."""

    def __init__(self, ctx):
        self.ctx, self.out, self.rich, self.imgs = ctx, [], [], []

    def flush_rich(self):
        if self.rich:
            h = clean_html(self.ctx, self.rich)
            if re.sub(r'<[^>]+>', '', h).strip() or '<img' in h or '<audio' in h:
                self.out.append(mk(self.ctx, 'rich_text', {'html': h}))
            self.rich = []

    def flush_imgs(self):
        if self.imgs:
            self.out += gallery_blocks(self.ctx, self.imgs)
            self.imgs = []

    def flush(self):
        self.flush_imgs()
        self.flush_rich()

    def emit(self, blocks):
        self.flush()
        self.out += blocks


def convert_nodes(ctx, nodes):
    f = Flow(ctx)
    for node in nodes:
        if isinstance(node, NavigableString):
            if str(node).strip():
                f.flush_imgs()
                f.rich.append(node)
            continue
        if not isinstance(node, Tag):
            continue
        c = classes(node)
        name = node.name
        if name in ('script', 'style'):
            continue
        if is_blank(node) and not (name == 'hr' or 'wp-block-separator' in c or 'wp-block-spacer' in c):
            continue
        if name == 'figure' and ('wp-block-image' in c or (node.find('img') and not node.find(['audio', 'iframe']))):
            if 'wp-block-gallery' in c or node.select('figure.wp-block-image'):
                for fig in node.select('figure.wp-block-image') or [node]:
                    it = image_item(ctx, fig)
                    if it:
                        f.flush_rich(); f.imgs.append(it)
            else:
                it = image_item(ctx, node)
                if it:
                    f.flush_rich(); f.imgs.append(it)
            continue
        if name == 'img':
            f.flush_rich(); f.imgs.append({'src': fix_url(ctx, node.get('src'), 'img'), 'alt': node.get('alt') or ''})
            continue
        if name in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            f.emit(heading_block(ctx, node)); continue
        if 'wp-block-buttons' in c or ('wp-block-button' in c and name != 'a'):
            f.emit(button_row(ctx, node)); continue
        if name == 'hr' or 'wp-block-separator' in c:
            f.emit([mk(ctx, 'divider', {})]); continue
        if 'wp-block-spacer' in c:
            f.emit(spacer_block(ctx, node)); continue
        if name == 'iframe' or node.find('iframe') and not node.find(['p', 'ul']):
            f.emit(embed_block(ctx, node)); continue
        if 'wp-block-columns' in c:
            f.emit(columns_blocks(ctx, node)); continue
        if name in ('div', 'section') and (c & {'wp-block-group', 'wp-block-group__inner-container', 'nfd-container', 'entry-content'} or
                                          node.find(['div', 'figure', 'h1', 'h2', 'h3', 'h4'], recursive=False)):
            # structural wrapper -> recurse, preserving order
            f.flush()
            f.out += convert_nodes(ctx, list(node.children))
            continue
        # everything else is loose rich content (p, ul, ol, blockquote, audio, tables...)
        f.flush_imgs()
        f.rich.append(node)
    f.flush()
    return f.out


def card_from_blocks(ctx, blocks):
    """Map [image?, heading?, rich_text?, button_row(1)?] to a card ColumnItem, else None."""
    kinds = [b['type'] for b in blocks]
    allowed_order = ['image_block', 'heading_block', 'rich_text', 'button_row']
    idx = [allowed_order.index(k) if k in allowed_order else -1 for k in kinds]
    if -1 in idx or idx != sorted(idx) or len(set(kinds)) != len(kinds):
        return None
    card = {'contentType': 'card'}
    for b in blocks:
        cfg = b['config']
        if b['type'] == 'image_block':
            card.update(imageSrc=cfg['src'], imageAlt=cfg.get('alt', ''))
            if cfg.get('linkUrl'):
                card['imageLink'] = cfg['linkUrl']
                if cfg.get('linkNewTab'):
                    card['imageLinkNewTab'] = True
                if FILE_EXT.search(cfg['linkUrl']) or '/wp-content/uploads/' in cfg['linkUrl']:
                    card['imageDownload'] = True
            if cfg.get('caption'):
                card['text'] = cfg['caption']
        elif b['type'] == 'heading_block':
            card['title'] = cfg['text']
        elif b['type'] == 'rich_text':
            if re.search(r'<(a|ul|ol|li|img|audio|blockquote|table)\b', cfg['html']):
                return None
            card['text'] = (card.get('text', '') + ' ' + text_of(BeautifulSoup(cfg['html'], 'html.parser'))).strip()
        elif b['type'] == 'button_row':
            if len(cfg['buttons']) != 1:
                return None
            bt = cfg['buttons'][0]
            card.update(buttonLabel=bt['label'], buttonUrl=bt['url'], buttonVariant=bt['variant'])
            if bt.get('newTab'):
                card['buttonNewTab'] = True
    return card


def columns_blocks(ctx, node):
    cols = [c for c in node.find_all('div', class_='wp-block-column', recursive=False)]
    per = [convert_nodes(ctx, list(c.children)) for c in cols]
    per_nonempty = [p for p in per if p]
    if len(per_nonempty) <= 1:
        return [b for p in per for b in p]            # nothing side-by-side: just stack
    if len(per_nonempty) > 4:
        return [b for p in per for b in p]
    items = []
    for blocks in per_nonempty:
        if len(blocks) == 1 and blocks[0]['type'] not in ('columns_block',):
            items.append({'contentType': blocks[0]['type'], 'nestedConfig': blocks[0]['config']})
            continue
        card = card_from_blocks(ctx, blocks)
        if card is None:
            return [b for p in per for b in p]        # can't represent losslessly -> stack in order
        items.append(card)
    return [mk(ctx, 'columns_block', {'columns': items, 'columnsPerRow': len(items), 'textAlign': 'left'})]


# ── Page level ──────────────────────────────────────────────────────────────────
def merge_adjacent(blocks):
    """Merge consecutive rich_text blocks and consecutive button rows; drop adjacent duplicate dividers."""
    out = []
    for b in blocks:
        if out and b['type'] == 'divider' and out[-1]['type'] == 'divider':
            continue
        if out and b['type'] == 'rich_text' and out[-1]['type'] == 'rich_text':
            out[-1]['config']['html'] += '\n' + b['config']['html']
            continue
        out.append(b)
    while out and out[0]['type'] == 'divider':
        out.pop(0)
    while out and out[-1]['type'] == 'divider':
        out.pop()
    return out


def convert_page(ctx, title, content_html):
    soup = BeautifulSoup(content_html, 'html.parser')
    blocks = merge_adjacent(convert_nodes(ctx, list(soup.children)))
    # drop a leading heading that just repeats the page title (we add our own H1)
    if blocks and blocks[0]['type'] == 'heading_block' and text_of(BeautifulSoup(blocks[0]['config']['text'], 'html.parser')) == title:
        blocks.pop(0)
    head = mk(ctx, 'heading_block', {'text': title, 'level': 1, 'align': 'center'})
    return [head] + blocks


def stats(blocks):
    c = {}
    for b in blocks:
        c[b['type']] = c.get(b['type'], 0) + 1
        if b['type'] == 'columns_block':
            for col in b['config']['columns']:
                k = 'col:' + col.get('contentType', 'card')
                c[k] = c.get(k, 0) + 1
    return c
