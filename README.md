# Custode — MVP de leitura

Leitor web para os 27 capítulos já publicados de **Custode**, por **jmedev (Juliana)**. Criado para oferecer às leitoras uma alternativa temporária durante a indisponibilidade do AO3.

## Fonte editorial: versão oficial com São Peregrino

**O conteúdo dos 27 capítulos neste projeto foi regenerado exclusivamente a partir de `Enviando por email Custode (1).pdf` (570 páginas)**, exportado do AO3 em 26/10/2026. Essa é a versão que usa o **Hospital São Peregrino**. O PDF alternativo `Custode CAP1 - CAP 27.pdf` **não foi usado nesta versão**.

- Preservamos a sinopse oficial da autora na página inicial.
- Preservamos os 27 textos, separadores de cena, itálicos, negritos, notas de abertura, resumos e notas finais da autora.
- Nenhum nome, frase, data ou diálogo foi corrigido ou reescrito. Apenas as quebras visuais de linhas e páginas do PDF foram refluídas em parágrafos web.
- A mensagem de navegação automática do AO3 (`See the end of the chapter for more notes`) não foi incorporada ao corpo da história. As próprias notas finais estão disponíveis após o texto.
- Validação automatizada: todos os caracteres não brancos dos textos e notas do PDF correspondem exatamente aos dados extraídos para o site; nenhum caractere do conteúdo foi perdido ou acrescentado.
- Ainda é necessária **revisão visual humana** no leitor, especialmente nas transições entre páginas, separadores e trechos em itálico. A conversão automática pode alterar limites de parágrafos.
- O PDF não contém imagens incorporadas. A indicação textual `***Foto em Anexo***`, no capítulo 21, foi mantida como está; confirme com a Ju se há imagem a adicionar posteriormente.

## Tecnologias e navegação

- Vite + React 18 + TypeScript + SCSS
- React Router com endereços diretos (`/capitulo/1`, `/capitulo/27` etc.)
- Carregamento sob demanda dos JSONs de capítulo
- Sem login, CMS, servidor próprio ou banco de dados
- Página inicial com sinopse e índice dos 27 capítulos
- Botões **Anterior** e **Próximo**, mais dropdown para qualquer capítulo
- Layout responsivo e identidade básica com o trevo da Custode

## Como rodar

Instale Node.js 20.19+ (ou 22.12+) e no terminal do VS Code:

```bash
npm install
npm run dev
```

Abra o endereço indicado pelo Vite, normalmente `http://localhost:5173`.

Para testar a compilação de produção:

```bash
npm run build
npm run preview
```

## Deploy na Vercel

1. Importe este projeto para um repositório Git acessível à Vercel.
2. Crie um projeto na Vercel com Framework Preset **Vite**.
3. Build command: `npm run build`. Output directory: `dist`.
4. Publique e confira as rotas `/`, `/capitulo/1` e `/capitulo/27` diretamente no navegador.
5. Teste navegação pelo dropdown, anterior/próximo, telas pequenas e leitura do texto antes de divulgar.

O arquivo `vercel.json` já contempla o rewrite necessário para links diretos nas rotas da aplicação.

## Organização

```text
src/
  components/           Cabeçalho e navegação entre capítulos
  pages/                Home e página de leitura
  services/             Importação sob demanda dos capítulos
  data/chapters/        chapter-01.json a chapter-27.json, manifest.json, work.json
  styles/               Estilos SCSS
public/                 Identidade visual fornecida pela usuária
scripts/                Extração do PDF oficial e adição de novo capítulo
```

## Regenerar os capítulos a partir do PDF correto

Necessita Python 3 e `pymupdf`:

```bash
pip install pymupdf
python scripts/extract_chapters.py "caminho/para/Enviando por email Custode (1).pdf"
```

O extrator valida que o PDF contém 27 capítulos numerados e menções ao Hospital São Peregrino antes de substituir os arquivos do projeto.

## Adicionar o capítulo 28

Se a autora enviar o texto final em `.txt`, com linhas em branco entre parágrafos:

```bash
python scripts/add_chapter.py 28 "caminho/para/capitulo-28.txt"
npm run build
```

O script adiciona o capítulo ao índice e impede sobrescrever arquivos existentes. A importação de `.txt` preserva texto simples e separadores `###`; itálicos, imagens e diagramações especiais exigem revisão.

## Antes de publicar

A Juliana deve validar o conteúdo e autorizar a divulgação do site. O PDF de origem está disponível no contexto desta conversa, mas não é incluído no repositório do site. O projeto foi preparado e seus capítulos foram auditados quanto à integridade textual; **o build não pôde ser executado neste ambiente porque as dependências npm não estavam instaladas e o acesso ao registry falhou**. Rode `npm install` e `npm run build` no seu computador antes do deploy.
