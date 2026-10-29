#!/usr/bin/env python3
"""Converte o PDF exportado do AO3 para os 27 capítulos do leitor Custode.

Fonte editorial aprovada: "Enviando por email Custode (1).pdf" (Hospital São Peregrino).
O texto da autora não é revisado, reescrito, nem substituído: apenas refluído
para parágrafos HTML com tags em/negrito quando existentes no PDF.

Uso: python scripts/extract_chapters.py '/caminho/Enviando por email Custode (1).pdf'
Dependência: pip install pymupdf
"""
import html
import json
import re
import sys
from pathlib import Path
from collections import Counter
import fitz

OUT = Path(__file__).resolve().parents[1] / 'src/data/chapters'
EXPECTED = list(range(1, 28))
SOURCE_NAME = 'Enviando por email Custode (1).pdf'
CHAPTER_RE = re.compile(r'Chapter\s+(\d+)\s*:\s*Capítulo\s+(\d+)\s*', re.I)


def block_lines(block):
    return block.get('lines', [])


def visible_text(block):
    return '\n'.join(''.join(span['text'] for span in line['spans']) for line in block_lines(block)).strip()


def inline_html(block):
    """Serializa apenas texto e duas marcações permitidas, escapando HTML original."""
    spans = []
    for index, line in enumerate(block_lines(block)):
        if index:
            # Quebras de linha dentro do bloco são quebras VISUAIS de largura da página.
            # Não significam novos parágrafos da autora.
            last = visible_text({'lines': [block_lines(block)[index - 1]]})
            spans.append(('', '' if last.endswith('-') else ' '))
        for span in line['spans']:
            content = span['text']
            if not content:
                continue
            f = span.get('font', '').lower()
            is_bold = 'bold' in f
            is_italic = 'italic' in f or 'ital' in f
            tags = ('strong' if is_bold else '', 'em' if is_italic else '')
            spans.append((tags, content))
    combined = []
    # Merge consecutive spans with matching formatting, without changing content.
    for style, text in spans:
        if combined and combined[-1][0] == style:
            combined[-1] = (style, combined[-1][1] + text)
        else:
            combined.append((style, text))
    out = []
    for styles, text in combined:
        escaped = html.escape(text.replace('\u00a0', ' '), quote=False)
        if isinstance(styles, tuple):
            bold, italic = styles
            if italic:
                escaped = f'<em>{escaped}</em>'
            if bold:
                escaped = f'<strong>{escaped}</strong>'
        out.append(escaped)
    return ''.join(out).strip()


def normalization(text):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', '', text))).strip()


def extract(file_path):
    doc = fitz.open(file_path)
    chapters = {n: {'number': n, 'title': f'Capítulo {n}', 'blocks': [], 'chapterNotes': [], 'chapterSummary': [], 'endNotes': []} for n in EXPECTED}
    current = None
    mode = 'body'
    chapter_markers = []
    counts = Counter()
    last_block_page = None
    last_block_y = None
    source_parts = []
    last_source_part = None
    metadata = {'title': 'Custode', 'author': 'jmedev', 'sourceFile': SOURCE_NAME, 'ao3Url': 'https://archiveofourown.org/works/86801665'}
    metadata_mode = None

    for page_no, page in enumerate(doc):
        for block in sorted(page.get_text('dict')['blocks'], key=lambda b: (round(b['bbox'][1], 1), round(b['bbox'][0], 1))):
            if not block_lines(block):
                continue
            raw = visible_text(block)
            if not raw:
                continue
            if page_no == 569 and raw.startswith('Please drop by the Archive'):
                continue
            if page_no == 1 and raw in ('Summary', 'Notes'):
                metadata_mode = raw.lower()
                continue
            if page_no == 1 and metadata_mode in ('summary', 'notes') and block['bbox'][0] > 60:
                if metadata_mode == 'summary':
                    metadata['summary'] = normalization(inline_html(block))
                elif metadata_mode == 'notes':
                    metadata['introNotes'] = normalization(inline_html(block))
                metadata_mode = None
                continue
            match = CHAPTER_RE.fullmatch(raw)
            if match:
                n, label = map(int, match.groups())
                if n != label or n not in chapters:
                    raise ValueError(f'Título de capítulo inconsistente: {raw}')
                current = n
                chapter_markers.append(n)
                mode = 'body'
                last_block_page = last_block_y = None
                continue
            if current is None:
                continue
            if raw == 'See the end of the chapter for more notes':
                # Instrução de navegação adicionada pela exportação do AO3.
                continue
            if raw in ('Chapter Summary', 'Chapter Notes', 'Chapter End Notes'):
                mode = {'Chapter Summary': 'chapterSummary', 'Chapter Notes': 'chapterNotes', 'Chapter End Notes': 'endNotes'}[raw]
                last_block_page = last_block_y = None
                continue
            # No PDF exportado do AO3, as notas introdutórias estão recuadas em x=79,
            # enquanto o texto da história começa em x=66,5.
            if mode in ('chapterSummary', 'chapterNotes') and block['bbox'][0] < 74:
                mode = 'body'
                last_block_page = last_block_y = None
            if raw == '###':
                if mode == 'body':
                    chapters[current]['blocks'].append({'type':'separator'})
                    counts['separators'] += 1
                last_block_page = last_block_y = None
                continue
            markup = inline_html(block)
            if not markup:
                continue
            if mode == 'body':
                target = chapters[current]['blocks']
                # Parágrafo quebrado pela paginação: concatena quando a última
                # linha não terminou com pontuação final e ocupou a linha inteira.
                # Cada bloco nativo do Chromium corresponde a um parágrafo HTML.
                is_continuation = (
                    last_block_page is not None
                    and last_block_page == page_no - 1
                    and last_block_y is not None and last_block_y > 675
                    and block['bbox'][1] < 75
                    and target and target[-1]['type'] == 'paragraph'
                    and not re.search(r'[.!?…][\"”’)?\]]?\s*$', normalization(target[-1]['html']))
                )
                if is_continuation:
                    previous = target[-1]['html']
                    previous_raw = normalization(previous)
                    # Hífens impressos são mantidos; apenas não acrescentamos espaço.
                    sep = '' if previous_raw.endswith('-') else ' '
                    target[-1]['html'] = previous + sep + markup
                    counts['page_join'] += 1
                else:
                    target.append({'type': 'paragraph', 'html': markup})
                last_block_page = page_no
                last_block_y = block['bbox'][3]
            else:
                chapters[current][mode].append(markup)
                last_block_page = last_block_y = None
            counts['body_fragments' if mode=='body' else mode] += 1

    if chapter_markers != EXPECTED:
        raise ValueError(f'Capítulos encontrados: {chapter_markers}, esperados: {EXPECTED}')
    if 'summary' not in metadata:
        raise ValueError('A sinopse oficial não foi encontrada no PDF.')
    if not any('São Peregrino' in normalization(b.get('html','')) for c in chapters.values() for b in c['blocks']):
        raise ValueError('Fonte inesperada: não foi encontrado o hospital São Peregrino.')

    OUT.mkdir(parents=True, exist_ok=True)
    manifest=[]
    for n,c in chapters.items():
        if not c['blocks'] or c['blocks'][0]['type'] != 'paragraph' or c['blocks'][-1]['type'] != 'paragraph':
            raise ValueError(f'Capítulo {n} incompleto')
        path=OUT/f'chapter-{n:02d}.json'
        path.write_text(json.dumps(c, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        all_text = ' '.join(normalization(b['html']) for b in c['blocks'] if b['type']=='paragraph')
        manifest.append({'number':n, 'title':c['title'], 'words':len(all_text.split()), 'paragraphs':len([b for b in c['blocks'] if b['type']=='paragraph'])})
    (OUT/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    (OUT/'work.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n', encoding='utf-8')
    print('Fonte:',Path(file_path).name,'| páginas:',len(doc),'| capítulos:',len(manifest))
    print('Texto principal:',sum(s['words'] for s in manifest),'palavras |',sum(s['paragraphs'] for s in manifest),'parágrafos')
    print('Notas introdutórias:',sum(len(c['chapterNotes']) for c in chapters.values()),'| Notas finais:',sum(len(c['endNotes']) for c in chapters.values()))
    print('Separadores:',counts['separators'],'| Parágrafos unidos entre páginas:',counts['page_join'])
    for item in manifest:
        print(f"Capítulo {item['number']:02d}: {item['words']} palavras, {item['paragraphs']} parágrafos")

if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Uso: python scripts/extract_chapters.py "Enviando por email Custode (1).pdf"')
    extract(Path(sys.argv[1]))
