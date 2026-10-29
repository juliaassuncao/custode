#!/usr/bin/env python3
"""Adiciona um capítulo a partir de texto simples mantendo os parágrafos em branco.
Uso: python scripts/add_chapter.py 28 ./capitulo-28.txt
"""
import sys
import json
import html
import re
from pathlib import Path

FOLDER = Path(__file__).resolve().parents[1] / 'src/data/chapters'

if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Uso: python scripts/add_chapter.py 28 capitulo-28.txt')
    number = int(sys.argv[1])
    source = Path(sys.argv[2])
    file = FOLDER / f'chapter-{number:02d}.json'
    if file.exists():
        raise SystemExit(f'O arquivo já existe: {file.name}. Para evitar sobrescrita, revise manualmente.')
    manifest_file = FOLDER / 'manifest.json'
    manifest = json.loads(manifest_file.read_text(encoding='utf8'))
    if number != len(manifest) + 1:
        raise SystemExit(f'O próximo capítulo precisa ser {len(manifest) + 1}.')
    raw = source.read_text(encoding='utf8').replace('\r\n','\n').strip()
    paragraphs = re.split(r'\n\s*\n',raw)
    blocks = []
    for paragraph in paragraphs:
        if paragraph.strip() == '###':
            blocks.append({'type':'separator'})
        else:
            # Quebras internas não correspondem necessariamente a novos parágrafos;
            # preservar como espaços para não quebrar frases.
            text = re.sub(r'\s*\n\s*', ' ',paragraph).strip()
            blocks.append({'type':'paragraph','html':html.escape(text,quote=False)})
    words = len(raw.split())
    file.write_text(json.dumps({'number':number,'title':f'Capítulo {number}','blocks':blocks},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    manifest.append({'number':number,'title':f'Capítulo {number}','words':words,'paragraphs':sum(b['type']=='paragraph' for b in blocks)})
    manifest_file.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(f'Capítulo {number} adicionado com sucesso ({words} palavras). Rode npm run build e confira o texto.')
