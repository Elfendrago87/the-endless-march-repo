#!/usr/bin/env python3
"""Builds docs/changelog.html from CHANGELOG.md, adding each version's demo,
a link to play it, and its downloads (from docs/media and docs/downloads)."""
import html, os, re

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
DOCS = os.path.join(ROOT, 'docs')

def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)
    s = re.sub(r'`(.+?)`', r'<code>\1</code>', s)
    s = re.sub(r'\[(.+?)\]\((.+?)\)', r'<a href="\2">\1</a>', s)
    return s

def human(n):
    return f'{n / 1048576:.1f} MB' if n >= 1048576 else f'{max(1, round(n / 1024))} KB'

KIND = [
    ('Windows.zip', 'Windows (zip: launcher + game folder)'),
    ('.exe', 'Windows (single .exe)'),
    ('Android.apk', 'Android (.apk)'),
    ('-web.zip', 'Web build (zip of the game files)'),
    ('.html', 'Single HTML file'),
]

def downloads(v):
    d = os.path.join(DOCS, 'downloads', v)
    if not os.path.isdir(d):
        return ''
    items = []
    for name in sorted(os.listdir(d)):
        label = next((l for k, l in KIND if name.endswith(k)), 'Download')
        size = human(os.path.getsize(os.path.join(d, name)))
        items.append(f'<li><a href="downloads/{v}/{name}">{html.escape(name)}</a><br><span class="muted">{label}, {size}</span></li>')
    return '<ul class="downloads">' + ''.join(items) + '</ul>'

def media(v):
    out = []
    for suffix, cap in (('', ''), ('-mobile', ' (phone, touch controls)')):
        base = f'media/demo-{v}{suffix}'
        if os.path.exists(os.path.join(DOCS, base + '.webm')):
            out.append(f'<video controls preload="none" poster="{base}.jpg" src="{base}.webm"></video>'
                       f'<p class="muted" style="margin:6px 0 14px">Recorded demo{cap}.</p>')
    if os.path.exists(os.path.join(DOCS, 'play', v, 'index.html')):
        out.append(f'<p><a class="btn" href="play/{v}/index.html">Play {v} in the browser</a></p>')
    return ''.join(out) + downloads(v)

def main():
    md = open(os.path.join(ROOT, 'CHANGELOG.md'), encoding='utf-8').read()
    intro, *blocks = re.split(r'\n## ', md)
    intro_html = ''.join(f'<p>{inline(p.strip())}</p>' for p in intro.split('\n\n')[1:] if p.strip() and p.strip() != '---')
    sections = []
    for b in blocks:
        head, _, body = b.partition('\n')
        m = re.match(r'([\d.]+) \(([\d-]+)\): (.+)', head.strip())
        v, date, title = m.group(1), m.group(2), m.group(3)
        notes, in_list = [], False
        for line in body.strip().split('\n'):
            line = line.rstrip()
            if line in ('', '---'):
                if in_list: notes.append('</ul>'); in_list = False
                continue
            if line.startswith('### '):
                if in_list: notes.append('</ul>'); in_list = False
                notes.append(f'<h3>{inline(line[4:])}</h3>')
            elif line.startswith('- '):
                if not in_list: notes.append('<ul>'); in_list = True
                notes.append(f'<li>{inline(line[2:])}</li>')
            else:
                if in_list: notes.append('</ul>'); in_list = False
                notes.append(f'<p>{inline(line)}</p>')
        if in_list: notes.append('</ul>')
        latest = ' <span class="tag solid">Latest</span>' if not sections else ''
        sections.append(f'''
  <article class="version" id="v{v}">
    <header><h2>{v}</h2><span class="tag">{html.escape(date)}</span><b>{inline(title)}</b>{latest}</header>
    <div class="body">
      <div class="notes">{''.join(notes)}</div>
      <div class="media">{media(v)}</div>
    </div>
  </article>''')
    toc_items = []
    for b in blocks:
        first = b.split('\n')[0]
        ver = re.match(r'[\d.]+', first).group(0)
        toc_items.append('<li><a href="#v' + ver + '">' + inline(first) + '</a></li>')
    toc = ''.join(toc_items)
    page = open(os.path.join(os.path.dirname(__file__), 'changelog.template.html'), encoding='utf-8').read()
    page = page.replace('{{INTRO}}', intro_html).replace('{{TOC}}', toc).replace('{{VERSIONS}}', ''.join(sections))
    open(os.path.join(DOCS, 'changelog.html'), 'w', encoding='utf-8').write(page)
    print('wrote docs/changelog.html with', len(blocks), 'versions')

main()
