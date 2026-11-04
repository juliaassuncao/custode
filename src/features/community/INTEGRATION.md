# Etapa 4C — comunidade no leitor

Publicação pública: integração baseada na main `2ac554e`, preservando capítulo 28,
imprensa e metadata editorial. A migration incremental
[cadastro do capítulo 28](../../../supabase/migrations/20261104000000_register_chapter_28.sql)
acrescenta somente o registro técnico. A migration e a Edge administrativas ficam
fora deste pacote, preservadas no backup `backup/custode-community-checkpoint`.

## Comportamento

[ChapterPage](../../pages/ChapterPage.tsx) carrega [ChapterCommunity](./ChapterCommunity.tsx)
por import dinâmico somente com o capítulo atual carregado, depois da navegação
inferior e do link para o índice. Suspense e [CommunityBoundary](./components/CommunityBoundary.tsx)
mantêm erros e indisponibilidade restritos à comunidade. O texto editorial, as
notas, os componentes de navegação e a animação da pasta não foram alterados.

O [trevo](./components/ChapterCloverButton.tsx) usa as quatro folhas do [SVG da marca](../../../public/custode-trevo.svg), sem o caule, no [componente SVG](./components/CloverIcon.tsx)
em contorno e preenchido. O estado ativo só é confirmado por resposta do servidor,
não pode ser removido e é recuperado em nova leitura autenticada. O contador é
global por capítulo; comentários não recebem trevos. Não há localStorage para
decidir se a identidade já deixou um trevo.

[Comentários](./components/CommunityComments.tsx) são texto simples, inicialmente
do mais recente ao mais antigo, com opção de mais antigos primeiro. A primeira
consulta sempre usa `desc`, sem recuperar preferências de ordenação. Ambas as
direções consultam o servidor e paginam por data/ID; trocar a ordem limpa o cursor.
A publicação usa o
status imediato já definido no backend. Após publicar, a primeira página é
revalidada, preservando a ordem; uma publicação nova pode estar em uma página
posterior. A [denúncia](./components/CommentReportForm.tsx) tem motivos padronizados,
detalhes opcionais e confirmação, sem ocultação automática.

[CommunityAction](./components/CommunityAction.tsx) reutiliza o hook e a autenticação
anônima existentes. O widget só monta por ação explícita. Quem ainda não tem sessão
usa uma prova para criá-la e outra para confirmar a mutação. Reenvios exigem prova
nova e mantêm o UUID/conteúdo do comentário. O payload é preservado em sessionStorage
antes da escrita, para recuperação após timeout/recarga, e removido ao confirmar.
Essa persistência não determina nenhum estado de trevo ou de moderação.

A continuidade agora é automática: ao solicitar publicar, deixar trevo ou denunciar,
o painel recupera a sessão existente. Se for necessário criá-la, o primeiro widget
é consumido exclusivamente pelo Auth e um widget novo obtém a prova da escrita.
Não há botão de autenticação nem outro clique de confirmação da ação original.
Uma sessão já existente requer apenas a prova da mutação. Falhas exigem repetição
explícita, sem loops de envio automático. O widget permanece montado durante o
consumo para que seu cleanup não invalide a prova antes de ela ser utilizada.

Há deduplicação de leituras em andamento (incluindo StrictMode), bloqueio de duplo
clique, descarte de respostas de componentes desmontados/trocados, validação de
respostas públicas, mensagens seguras, tempo de espera por Retry-After e repetição
explícita após falha. Falhas de rede não apagam o comentário pendente. A SDK continua
responsável por persistir/renovar a identidade. Não há acesso a tabelas no frontend.

## Extensão mínima de leitura

A [Edge de leitura](../../../supabase/functions/community-read/index.ts) expõe
personalização opcional: `has_left_clover: boolean`. Requisições públicas
continuam sem JWT obrigatório e retornam false. Com Authorization, o JWT é validado
por `/auth/v1/user` e a função faz uma consulta de existência usando exclusivamente
o ID validado. JWT inválido/expirado retorna 401; infraestrutura/Auth indisponível
retorna erro genérico. Não aceita identidade enviada por query/body e não expõe IDs.

Nenhum schema, migration, RLS, grant, tabela, regra de frequência ou função de
escrita foi alterado nesta etapa. A extensão usa os grants de leitura já existentes.
Os contratos de comentários, trevos e denúncias continuam os da etapa 4B.

`order=asc|desc` é opcional e usa ordenação determinística em ambos os campos
`created_at,id`. Os cursores ascendentes v1 continuam aceitos; os descendentes
v2 têm direção explícita. O servidor rejeita cursores cruzados entre direções.

## Refinamento visual e UX

A estrutura da comunidade permanece integrada ao leitor. Uma seção independente
de trevos aparece imediatamente antes do título “Comentários”, com as folhas
originais da marca em 58px, contador de 36px e ação com estados de participação.
Verificação e feedback permanecem dentro dessa seção. O formulário mantém sua superfície,
largura e espaçamento, com placeholders, pessoa/escudo, contador e acolhimento
“Com gentileza, para a autora e para quem lê.” Textos redundantes foram removidos.
Os campos usam bordas neutras verdes nos dois temas e foco da paleta; mensagens
de validação e `aria-invalid` identificam erros sem tingir as bordas de vermelho.

Comentários têm iniciais e tons verdes determinísticos, etiqueta “Anônimo”, data,
texto e bandeira em “Denunciar”. Não há imagens externas, votos em comentários
ou alteração de moderação. Confirmações pequenas com check aparecem junto da
ação, em região de status persistente e educada, e desaparecem após 8 segundos.
O foco volta ao controle de origem ou ao título, sem focar mensagens temporárias.

Novos auxiliares: [ícones](./components/CommunityIcon.tsx),
[feedback temporário](./components/CommunityFeedback.tsx) e
[iniciais/tom do avatar](./services/commentAvatar.ts).
Foram refinados [orquestração](./ChapterCommunity.tsx), [SCSS](./chapter-community.scss),
[trevo](./components/ChapterCloverButton.tsx), [SVG](./components/CloverIcon.tsx),
[formulário](./components/CommentComposer.tsx), [listagem](./components/CommunityComments.tsx),
[denúncia](./components/CommentReportForm.tsx), [continuidade](./components/CommunityAction.tsx),
[hook de sessão](./hooks/useAnonymousSession.ts), [hook de leitura](./hooks/useChapterCommunity.ts),
[serviço de leitura](./services/communityRead.ts) e [tipos](./types.ts).
A extensão necessária de ordenação está na [validação de cursor](../../../supabase/functions/_shared/validation.ts)
e [Edge de leitura](../../../supabase/functions/community-read/index.ts).
Os testes de serviços, navegador, layout, cleanup do widget e HTTP de leitura
listados abaixo foram atualizados. Não foram alterados leitor, conteúdo, credenciais,
arquivos de ambiente, configurações de produção, migrations ou regras de escrita.

## Visual e acessibilidade

[SCSS da feature](./chapter-community.scss) restrito à classe `.chapter-community`,
com tokens globais existentes: branco quente, verdes, serifas editoriais, linhas
de catálogo e um detalhe de costura/listras. Temas claro/escuro, campos com labels,
foco visível, status/alertas acessíveis, alvos de pelo menos 44px e widget compacto.
O painel de confirmação recebe foco; ao fechar, o foco retorna ao controle de origem.

O link da Home no Figma foi solicitado, mas não estava disponível durante a
implementação. A direção descrita e a Home existente orientaram a composição;
a comparação final com o arquivo de design permanece pendente.

## Arquivos desta etapa

Novos:

- [ChapterCommunity](./ChapterCommunity.tsx), [SCSS](./chapter-community.scss) e [tipos públicos](./types.ts).
- [Trevo](./components/ChapterCloverButton.tsx), [SVG](./components/CloverIcon.tsx),
  [compositor](./components/CommentComposer.tsx), [listagem](./components/CommunityComments.tsx),
  [denúncia](./components/CommentReportForm.tsx), [confirmação](./components/CommunityAction.tsx)
  e [barreira de falhas](./components/CommunityBoundary.tsx).
- [Hook da leitura](./hooks/useChapterCommunity.ts), [serviço de leitura](./services/communityRead.ts),
  [erros](./services/communityErrors.ts) e [rascunho/idempotência](./services/commentDraft.ts).
- [Testes de serviços](./tests/communityServices.test.mjs),
  [integração no navegador](./tests/community.browser.tsx),
  [layout](./tests/community-layout.browser.ts) e
  [personalização HTTP local](../../../supabase/functions/tests/community-viewer.local.mjs).
- Este documento.

Atualizados:

- [ChapterPage](../../pages/ChapterPage.tsx).
- [Serviço de escrita](./services/communityWrite.ts): resultados tipados, erros seguros e Retry-After estruturado.
- [Widget](./components/TurnstileChallenge.tsx) e [tipo da API](./services/turnstileScript.ts): tamanho compacto opcional; ciclo de segurança preservado.
- [Edge de leitura](../../../supabase/functions/community-read/index.ts),
  [contrato](../../../supabase/functions/community-read/README.md) e
  [regressão HTTP](../../../supabase/functions/tests/community-read.local.mjs).
- [README da feature](./README.md).

As alterações já existentes no Git foram preservadas. Nenhuma dependência nova.

## Verificações

```powershell
npm run build
node --test src/features/community/tests/anonymousSession.test.mjs src/features/community/tests/communityServices.test.mjs
node --experimental-strip-types supabase/functions/tests/community-read.local.mjs
node --experimental-strip-types supabase/functions/tests/community-viewer.local.mjs
node --experimental-transform-types supabase/functions/tests/community-write.local.mjs
npx supabase test db --local
git diff --check
```

As suítes locais usam fixtures sintéticas, com rollback/finally, preservando os
usuários e dados da homologação. O teste de leitura omite conteúdo existente dos logs.
Não use db reset. Os testes HTTP requerem as funções locais servidas com a
configuração privada já homologada. Não publique a extensão nesta etapa.

Harnesses no navegador, na Home de uma instância Vite local separada (sem comunidade
montada), pelo DevTools:

```js
await (await import('/src/features/community/tests/community.browser.tsx')).runChapterCommunityBrowserTests();
await (await import('/src/features/community/tests/community-layout.browser.ts')).runCommunityLayoutTests();
await (await import('/src/features/community/tests/turnstile.browser.tsx')).runCommunityBrowserTests();
```

O harness React simula exclusivamente transporte/Auth/widget e restaura os originais
no finally. Verifica leitura sem signup, StrictMode, texto HTML literal, cursor,
foco, provas separadas, duplo clique, trevo recuperado do servidor, denúncia visível,
timeout com recarga e mesmo UUID, limites e troca de capítulo. Não é prova de
aceitação real Cloudflare. O harness de layout usa iframes locais em 280, 320, 390,
768 e 1280px, ambos os temas, texto longo e estado ativo, validando ausência de
overflow e labels/alvos. Requer o comentário local de homologação no capítulo 1.

Resultados: 22 testes Node, 48 verificações HTTP de leitura, 11 de personalização,
64 de escrita e 189 asserções SQL passaram. O harness React passou nos 15 cenários
e o layout nas 10 combinações de largura/tema. A rejeição de prova inválida pelo
Siteverify real também foi confirmada pela regressão existente de escrita.
Build e TypeScript passaram. O teste de feedback verifica o prazo de oito segundos
com relógio controlado, além do posicionamento por ação. O teste React valida
continuidade sem clique adicional, provas diferentes para Auth/escrita, recuperação
de sessão sem nova criação, duplo clique, reenvio e preservação do UUID após falha.

## Homologação visual

- Comparar com a referência Figma quando o link estiver disponível.
- Na origem anterior da homologação, recuperar a mesma identidade e conferir o
  trevo preenchido após recarga. Uma porta/hostname diferente usa outro storage.
- Publicar e denunciar pela interface integrada com desafios reais, conferindo
  os textos de confirmação e erros de frequência. O backend já homologado foi
  reutilizado; os testes de interação automatizados usam provas simuladas.
- Revisar a composição em um dispositivo móvel e com leitor de tela real.

Sem commit, push ou deploy. Nenhuma funcionalidade administrativa incluída.
