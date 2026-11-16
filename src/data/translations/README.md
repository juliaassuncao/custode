# Traduções do leitor

O capítulo original continua em [chapter-30.json](../chapters/chapter-30.json), intacto. As duas traduções integrais estão aprovadas para publicação beta assistida por IA por Julia Assunção (@itsxulia), responsável pelo portal. Essa autorização não certifica revisão linguística nativa nem aprovação integral das traduções pela autora. Os avisos editoriais de revisão em andamento e o formulário de feedback permanecem ativos.

O único ajuste editorial posterior à incorporação foi o tratamento de Eduarda para Lorena: 15 vocativos e uma referência narrativa em cada idioma, usando `babe` / `Babe` em inglês e `mi hermosa` / `Mi hermosa` em espanhol. Descrições comuns, pontuação, HTML, notas finais e demais passagens foram preservados. O registro contém os hashes desses arquivos finais e a data/hora real da aprovação de publicação beta.

Arquivos integrais incluídos:

- [en-US/chapter-30.json](./en-US/chapter-30.json)
- [es-419/chapter-30.json](./es-419/chapter-30.json)

Use o mesmo tipo [Chapter](../../types.ts): `number`, `title`, `blocks` e, quando presentes no original, `chapterSummary`, `chapterNotes` e `endNotes`. O número deve ser 30. Preserve a ordem, os tipos e a quantidade de blocos e a quantidade de parágrafos em cada seção de notas/resumo. Use somente o HTML inline permitido: `em`, `i`, `strong`, `b`, `span` e `br`, sem atributos. Separadores vazios são permitidos. Não inserir o aviso editorial nas notas da autora ou na narrativa: ele é acrescentado pelo leitor e pelas exportações.

## Publicação

1. Incluir os JSONs integrais nos caminhos finais. Manter `status: 'draft'` no [registro](./registry.ts) enquanto houver trechos pendentes ou exemplos.
2. Revisar a tradução inteira, incluindo título, narrativa e todas as notas/resumos presentes. A validação estrutural não comprova fidelidade nem integralidade semântica; essa aprovação é humana.
3. Calcular o SHA-256 dos bytes exatos de cada arquivo aprovado, por exemplo com `shasum -a 256 src/data/translations/en-US/chapter-30.json` a partir da raiz do projeto (repetir para espanhol).
4. Substituir somente a entrada aprovada no registro por um objeto com `status: 'approved'`, `complete: true`, `approvedBy` (responsável real), `approvedAt` (data real em ISO 8601) e `sha256` (hash real de 64 caracteres). Não preencher esses campos antes da aprovação.
5. Validar o leitor e os downloads; publicar o código e os JSONs pelo processo habitual do projeto. O catálogo virtual do Vite inclui em produção somente arquivos registrados como aprovados; qualquer alteração de publicação exige uma nova versão.

Em produção e no leitor comum, o idioma só aparece habilitado se o arquivo existir, a aprovação estiver preenchida, o hash conferir e a estrutura estiver íntegra. Alterar qualquer byte do JSON exige atualizar a revisão e a aprovação. Remover a aprovação ou voltar a `draft` bloqueia a versão. Arquivos de amostra devem ficar fora dos caminhos finais e nunca receber aprovação.

## Prévia local para homologação

Iniciar o servidor de desenvolvimento na raiz do projeto:

```sh
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

- Inglês: [prévia en-US](http://127.0.0.1:4173/capitulo/30?lang=en-US&preview=translations).
- Espanhol: [prévia es-419](http://127.0.0.1:4173/capitulo/30?lang=es-419&preview=translations).

O parâmetro `preview=translations` só funciona com `import.meta.env.DEV`. A prévia não é persistida como preferência: retirar o parâmetro volta ao fluxo normal, que bloqueia rascunhos. O seletor e a navegação entre capítulos preservam o parâmetro enquanto a prévia estiver ativa. O leitor mostra um aviso de rascunho e permite baixar PDF/EPUB para homologação, usando o mesmo capítulo validado.

Só entradas registradas, com arquivo presente e estrutura integral válida, podem ser visualizadas. A prévia não altera `status`, não cria aprovação e não ignora a validação de conteúdo. A conferência do hash aprovado continua obrigatória para publicações; rascunhos ainda não possuem esse hash de aprovação.

Há duas barreiras para produção: o carregador ignora `previewDrafts` quando `DEV` é falso, e o plugin em [vite.config.ts](../../../vite.config.ts) exclui os JSONs em `draft` dos assets do build. `npm run preview` serve o build de produção e também não habilita rascunhos, mesmo com o parâmetro na URL.

O carregador é reutilizável para capítulos comuns: registrar outro número exige o mesmo processo. Capítulos com blocos especiais que incorporam conteúdo externo em português permanecem indisponíveis para tradução até existir suporte explícito a esses blocos.

## Comportamento do leitor

- Links diretos: `/capitulo/30?lang=en-US` e `/capitulo/30?lang=es-419`. `pt-BR` também é aceito.
- O parâmetro da URL prevalece sobre a preferência salva. Sem parâmetro, usa-se `custode:reader-language:v1` no armazenamento local; sem preferência válida, português.
- Versões indisponíveis retornam o original em português com aviso, sem apresentar uma tradução parcial. Parâmetros de idioma desconhecidos também usam português.
- A navegação mantém o idioma solicitado, mesmo ao passar por capítulos disponíveis apenas em português.
- O progresso português mantém a chave legada `custode:reading-progress:v1:<capítulo>`. Traduções usam `custode:reading-progress:v2:<capítulo>:<idioma>`. O idioma efetivamente exibido determina a posição salva; nenhuma posição é copiada entre idiomas.
- Comentários, rascunhos, trevos e requisições da comunidade continuam identificados exclusivamente pelo capítulo. Apenas a interface é localizada; o texto publicado pelas leitoras é preservado.
- Downloads recebem o capítulo selecionado e o idioma efetivo. Traduções são novamente verificadas antes da exportação; incluem o aviso editorial e têm nomes com sufixo de idioma. EPUBs também identificam o idioma e usam identificadores próprios. Português conserva os nomes, o conteúdo e a identificação originais.

## Feedback

O formulário [Tally](https://tally.so/r/Eqlzvr) está configurado em `translationFeedbackUrls` para os dois idiomas no [registro](./registry.ts). O CTA aparece somente nas traduções, inclusive na prévia, e abre em nova aba. Sem endereço válido, permanece oculto. Os avisos editoriais são os textos fornecidos pela autora, mantidos em [editorial.ts](../../i18n/editorial.ts).

## Histórico da validação técnica em draft

- Os arquivos fornecidos e as cópias no projeto são idênticos byte a byte. O original em português foi preservado.
- Cada versão tem 362 blocos, com a mesma sequência de tipos do original: 359 parágrafos e 3 separadores. Os separadores ocupam as posições 64, 192 e 336 (contagem a partir de 1).
- HTML inline balanceado, sem tags ou atributos incompatíveis, nos 359 parágrafos e na nota final de cada versão. As notas finais estão presentes; as seções iniciais vazias correspondem às do original.
- Os links diretos para inglês e espanhol foram verificados no navegador: ambos retornam português com aviso e mantêm as opções de tradução desabilitadas. O carregador oferece somente `pt-BR` enquanto o registro estiver em rascunho.
- A API pública de download rejeita PDF e EPUB das duas traduções em `draft`.
- Os exportadores foram verificados isoladamente em memória, sem mudar o registro ou publicar as traduções: PDF nos três idiomas, EPUB nas duas traduções. Nos EPUBs, foram conferidos os 359 parágrafos com texto e ordem exatos, os 3 separadores, a nota final, o idioma e o aviso editorial. Os PDFs foram concluídos com cabeçalho e marcador final válidos; o modelo usado inclui o aviso somente nas traduções.
- Nomes de download verificados: português sem sufixo e traduções com `-en-US` ou `-es-419`.
- `npm run build` e `git diff --check` passaram. O Vite emitiu somente o aviso de tamanho do chunk de PDF.
- Corrigidas chaves React duplicadas entre a comunidade e o botão de voltar ao topo; nenhuma narrativa foi alterada.

Hashes finais dos arquivos autorizados para publicação beta:

| Idioma | SHA-256 |
| --- | --- |
| en-US | `001bebc876ea972dd9d972bc9fc44c81cc65b27b578674c960e1ead584f1d088` |
| es-419 | `36600936c8894833c3b7f06a331cf01e27f04f080eb3381e8ecc695912aa76af` |

## Histórico da conferência da prévia em draft

- Inglês e espanhol completos renderizam com 359 parágrafos, 3 separadores, aviso editorial exato antes da narrativa e CTA apontando para o Tally informado.
- Troca de idiomas preserva ajustes de fonte, tamanho, entrelinha, tema, parâmetro de prévia e o formulário não enviado da comunidade.
- Conferidos os dois idiomas nos temas claro e escuro, nas larguras de 390 e 1280 pixels, com fonte em 24 px e entrelinha em 2,15: sem rolagem horizontal da página. Isso não substitui a homologação visual em dispositivos reais.
- Progresso individual verificado por troca de idioma e recarga, incluindo a compatibilidade com a chave legada do português. Os dados locais usados nos testes foram restaurados.
- Comunidade compartilhada verificada com uma resposta de leitura simulada somente no navegador: os três idiomas mantiveram o mesmo capítulo, comentário sem tradução e contagem de trevos. Nenhuma operação de escrita no backend foi feita. O envio real e a persistência remota precisam do ambiente Supabase configurado.
- Os botões do leitor geraram PDF e EPUB nos três idiomas em prévia. Foram conferidos os nomes, a conclusão dos PDFs e o texto/ordem exatos, separadores, notas, aviso e metadados dos EPUBs.
- Sem o parâmetro de prévia, o leitor de desenvolvimento e a API de exportação continuam bloqueando rascunhos.
- O build de produção foi servido localmente com os mesmos links e manteve ambos os idiomas desabilitados. Os assets não contêm os JSONs em rascunho.

## Homologação visual pendente

Conferir desktop e celular nos temas claro e escuro: legibilidade e espaçamento do aviso, CTA do Tally, quebras e alinhamento dos controles traduzidos, fonte no tamanho máximo, separadores e notas finais. Abrir os PDFs e EPUBs em leitores reais para conferir paginação, margens, acentos, itálicos e sumário. Validar o formulário do Tally e o fluxo real da comunidade no ambiente configurado. A revisão linguística e editorial continua humana.

O [registro](./registry.ts) está com `status: 'approved'` e `complete: true` para as duas versões beta do capítulo 30. `complete` indica que o capítulo integral está presente; a aprovação é de publicação beta, sem atribuição de revisão nativa ou endosso linguístico integral pela autora. O acesso público usa somente `?lang=en-US` ou `?lang=es-419`, sem depender da prévia local.

## Arquivos desta implementação

Alterados:

- [ChapterPage.tsx](../../pages/ChapterPage.tsx)
- [useReadingProgress.ts](../../hooks/useReadingProgress.ts)
- [BackToTop.tsx](../../components/reader/BackToTop.tsx)
- [ChapterDownloads.tsx](../../components/reader/ChapterDownloads.tsx)
- [ChapterNavigation/index.tsx](../../components/reader/ChapterNavigation/index.tsx)
- [ReadingControls.tsx](../../components/reader/ReadingControls.tsx)
- [SceneSeparator/index.tsx](../../components/reader/SceneSeparator/index.tsx)
- [ChapterCommunity.tsx](../../features/community/ChapterCommunity.tsx)
- [ChapterCloverButton.tsx](../../features/community/components/ChapterCloverButton.tsx)
- [CommentComposer.tsx](../../features/community/components/CommentComposer.tsx)
- [CommentReportForm.tsx](../../features/community/components/CommentReportForm.tsx)
- [CommunityAction.tsx](../../features/community/components/CommunityAction.tsx)
- [CommunityBoundary.tsx](../../features/community/components/CommunityBoundary.tsx)
- [CommunityComments.tsx](../../features/community/components/CommunityComments.tsx)
- [CommunityFeedback.tsx](../../features/community/components/CommunityFeedback.tsx)
- [TurnstileChallenge.tsx](../../features/community/components/TurnstileChallenge.tsx)
- [chapterExport/index.ts](../../services/chapterExport/index.ts)
- [chapterExport/content.ts](../../services/chapterExport/content.ts)
- [chapterExport/pdf.ts](../../services/chapterExport/pdf.ts)
- [chapterExport/epub.ts](../../services/chapterExport/epub.ts)
- [main.scss](../../styles/main.scss)

Criados:

- [loadTranslation.ts](../../services/loadTranslation.ts)
- [useReaderLanguage.ts](../../hooks/useReaderLanguage.ts)
- [ReaderLanguageSelector.tsx](../../components/reader/ReaderLanguageSelector.tsx)
- [TranslationEditorialNotice.tsx](../../components/reader/TranslationEditorialNotice.tsx)
- [locales.ts](../../i18n/locales.ts)
- [messages.ts](../../i18n/messages.ts)
- [ReaderLocaleContext.tsx](../../i18n/ReaderLocaleContext.tsx)
- [editorial.ts](../../i18n/editorial.ts)
- [registry.ts](./registry.ts)
- [README.md](./README.md)
- [en-US/.gitkeep](./en-US/.gitkeep)
- [es-419/.gitkeep](./es-419/.gitkeep)
- [en-US/chapter-30.json](./en-US/chapter-30.json)
- [es-419/chapter-30.json](./es-419/chapter-30.json)
