#!/usr/bin/env python3
"""Builds docs/changelog.html from CHANGELOG.md, adding the recorded demo
(docs/media/demo.webm) and the download link from the GitHub release."""
import html, os, re

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
DOCS = os.path.join(ROOT, 'docs')

def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)
    s = re.sub(r'`(.+?)`', r'<code>\1</code>', s)
    s = re.sub(r'\[(.+?)\]\((.+?)\)', r'<a href="\2">\1</a>', s)
    return s

RELEASES = 'https://github.com/Elfendrago87/the-endless-march-repo/releases/download'

def media(v):
    out = []
    base = 'media/demo'
    if os.path.exists(os.path.join(DOCS, base + '.webm')):
        out.append(f'<video controls preload="none" poster="{base}.jpg" src="{base}.webm"></video>'
                   f'<p class="muted" style="margin:6px 0 14px">Recorded demo.</p>')
    out.append(f'<p><a class="btn solid" href="{RELEASES}/v{v}/The-Endless-March-{v}.exe">Download The-Endless-March-{v}.exe</a></p>')
    return ''.join(out)

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
            elif line.startswith('  - '):
                if not in_list: notes.append('<ul>'); in_list = True
                notes.append(f'<li class="sub">{inline(line[4:])}</li>')
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
