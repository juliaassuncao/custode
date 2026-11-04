# Fundação administrativa da Comunidade

Backend sem dashboard e sem provisionamento de contas reais. A migration nova
[community_admin](../../migrations/20261103020000_community_admin.sql) é incremental;
as migrations anteriores e os contratos públicos permanecem intactos.

## Autorização

`community-admin` aceita Bearer token de uma conta permanente do Supabase Auth.
O handler consulta `/auth/v1/user`, exige `role=authenticated` e
`is_anonymous=false`, e deriva `p_actor` exclusivamente dessa resposta.
Todas as consultas e mutações passam por RPCs que consultam
`community_moderators.active=true` e revalidam a identidade não anônima em
`auth.users`. Locks compartilhados mantêm essa autorização válida durante a
transação, inclusive em retries. Não há autorização por metadata, e-mail enviado
pelo cliente, nem `moderator_id` no corpo aceito.

As RPCs `SECURITY DEFINER` têm `search_path=''`, nomes qualificados e EXECUTE
somente para `service_role`. O helper privado não tem EXECUTE para os papéis de
aplicação. O padrão do gateway exige JWT para funções novas; o handler também
valida Auth independentemente. Nenhuma alteração de configuração foi necessária.

`service_role` perde UPDATE direto em comentários e denúncias e INSERT direto
em auditoria. A RPC pública `community_mutate` mantém seu owner e seus privilégios
de definer, portanto publicar, denunciar e deixar trevos continuam funcionando.
Owner/superusuário continuam sendo a fronteira de confiança do banco.

## HTTP

Base: `/functions/v1/community-admin`. Headers: `Authorization: Bearer ...`;
para POST, `Content-Type: application/json`; usar a chave pública no header
`apikey` quando exigida pelo gateway. Nunca enviar service_role ao navegador.
OPTIONS só responde ao preflight e não consulta dados.

### POST

```json
{
  "operation": "hide_comment",
  "target_id": "UUID do comentário ou denúncia",
  "request_id": "UUID gerado uma vez para esta intenção",
  "expected_version": 0,
  "note": "Motivo da ocultação"
}
```

| Operação | Estado exigido | Estado final | Observação |
| --- | --- | --- | --- |
| `hide_comment` | published | hidden | `note` obrigatória, não branca |
| `restore_comment` | hidden | published | `note` opcional |
| `resolve_report` | open | resolved | `note` opcional |
| `dismiss_report` | open | dismissed | `note` opcional |

`note`: até 2.000 caracteres após trim. `expected_version`: valor de
`moderation_version` recebido na consulta, inteiro entre 0 e 2147483646.
Não há remoção definitiva ou restauração de registros `removed` nesta versão.
Resolver/descartar denúncia nunca altera o comentário associado.

Sucesso: `{audit_id,target_id,state,replayed}`. `state` contém o resultado
original da ação, inclusive em replay; buscar o registro novamente para obter
o estado atual, que pode ter sido alterado por outra ação.

UUID de requisição é único por moderadora. Reutilizar exatamente o mesmo UUID,
operação, alvo, versão e observação após timeout ou duplo clique. Payload
normalizado diferente com a mesma chave retorna 409 `idempotency_conflict`.
Uma nova intenção baseada em dados antigos retorna 409 `state_conflict`.
O frontend futuro deve preservar UUID e payload até esclarecer o resultado.

### GET

| `resource` | Conteúdo | Filtro `status` |
| --- | --- | --- |
| `comments` | Texto, pseudônimo, capítulo, estado e dados de moderação | published / hidden / removed |
| `reports` | Motivo, detalhes, resolução e comentário associado, inclusive oculto/removido | open / resolved / dismissed |
| `history` | Moderadora, ação, alvo, motivo, horário e estados antes/depois | não aceito |

Todas as consultas aceitam `chapter` opcional, `limit` de 1 a 50 (default 20),
e `cursor` opaco. Sem filtro, todos os estados/capítulos são consultados,
inclusive capítulos desabilitados. Exemplo:
`?resource=reports&status=open&chapter=1&limit=20`.

Resposta: `{items,next_cursor}`. Ordem descendente por `(created_at,id)`;
cursor base64url vinculado a resource/status/chapter, versão 1, timestamp com
microssegundos preservados e UUID. Pode mudar o limite entre páginas, mas não
os filtros. É listagem viva, não snapshot: moderação entre páginas pode mudar a
participação no filtro. Não existem offsets nem filtros PostgREST do cliente.

As projeções excluem author_id, reporter_id, client_request_id, sessões,
credenciais e dados do Auth das leitoras. Histórico expõe UUIDs das moderadoras
para atribuição de responsabilidade, mas não e-mails. Metadata de requisição
não é devolvida no histórico. Textos continuam sendo dados não confiáveis;
o dashboard deverá renderizá-los como texto, sem HTML.

Erros: 400 parâmetros, 401 token, 403 autorização, 404 alvo, 409 conflito,
413 tamanho, 415 formato, 503 indisponibilidade/resultado incerto. Erros internos
não expõem mensagens do PostgreSQL, tokens nem stack traces.

## Transação, auditoria e concorrência

Cada mutação bloqueia a chave moderadora/request_id por advisory lock e depois
o alvo por `SELECT FOR UPDATE`. Versão e estado são conferidos após o bloqueio.
Versão evita também ações atrasadas após um ciclo ocultar/restaurar. A versão
incrementa apenas no sucesso. Um índice unique parcial em
`moderation_audit(moderator_id,request_id)` reforça a deduplicação.

UPDATE e INSERT da auditoria acontecem na mesma chamada PostgreSQL, sem captura
de exceção da escrita: falha de auditoria reverte estado, versão e responsável.
Metadata registra `before`, `after` e o payload normalizado de `request`, sem
identidades de autor/denunciante. Eventos são comment_hidden, comment_restored,
report_resolved e report_dismissed. Eventos antigos podem ter request_id nulo.

Uma tentativa repetida com UUID novo é outra intenção: retorna conflito quando
o estado/versão já mudou, em vez de inventar uma auditoria de sucesso.

## Validação local segura

Não usar db reset, ambiente remoto ou contas reais. Primeiro conferir migrations
pendentes e aplicar somente no local. Executar **sequencialmente** as suítes de
banco e HTTP: o teste antigo de schema exige exatamente os 27 capítulos e pode
enxergar capítulos temporários de outra suíte paralela.

```powershell
.\node_modules\.bin\supabase.cmd migration list --local
.\node_modules\.bin\supabase.cmd migration up --local
.\node_modules\.bin\supabase.cmd test db --local
node --experimental-transform-types --test supabase/functions/tests/community-admin.test.mjs
node --experimental-transform-types supabase/functions/tests/community-admin.local.mjs
node --test src/features/community/tests/anonymousSession.test.mjs src/features/community/tests/communityServices.test.mjs
node --experimental-transform-types supabase/functions/tests/community-write.local.mjs
node --experimental-strip-types supabase/functions/tests/community-read.local.mjs
node --experimental-strip-types supabase/functions/tests/community-viewer.local.mjs
```

O teste SQL usa UUIDs novos e rollback, incluindo o trigger de falha de auditoria.
O teste HTTP usa capítulo 2147483500 somente se estiver vazio, UUIDs novos e
cleanup restrito aos registros desta execução; não remove fixtures preexistentes.
Usa Auth, PostgREST e PostgreSQL reais locais com o handler de produção.
Para incluir o gateway/Deno, executar a mesma suíte com `--gateway` depois de
servir `community-admin` no runtime local. Esse modo exige 200 e testa leitura e
retry pela Edge real; não ignora um 404. O runtime já em execução pode ter uma
lista de funções anterior à criação do arquivo. Não reiniciá-lo descartando os
secrets existentes só para executar esse teste. O helper local de
credenciais existente depende do Docker e do JWT legado HS256; não é código de
produção. Nunca imprimir saídas de inspect ou credenciais durante a execução.
Uma interrupção abrupta pode deixar fixtures: não apagar dados pelo pseudônimo
ou capítulo sem antes comprovar sua origem.

Validação desta implementação: 239 asserções SQL (50 administrativas), 9 testes
do handler, 27 verificações administrativas com Auth/banco reais, 22 testes Node
de sessão/serviços públicos, 64 verificações HTTP de escrita, 48 de leitura e 11
de personalização passaram. TypeScript do handler passou sem emitir arquivos.
Auditoria foi forçada a falhar para comentários e denúncias; ambos reverteram.
Concorrência incluiu oito retries, disputa entre duas moderadoras e perda de
resposta depois de commit real. Fixtures desta execução foram removidas.

Pendente: gateway/Deno da função administrativa. A tentativa com `--gateway`
retornou 404 no runtime já em execução; ele foi preservado para não perder sua
configuração privada. Suítes de browser e login por e-mail/senha não fazem parte
desta validação. Os tipos gerados usados pelo leitor foram preservados; atualizar
os tipos administrativos quando for integrar o dashboard, sem truncar o arquivo
existente caso a geração falhe.

## Próxima etapa

Preparar login por e-mail/senha e dashboard com cliente Auth e storageKey próprios,
sem alterar o singleton anônimo. Provisionar as duas contas reais e seus vínculos
por procedimento privado separado, em uma etapa autorizada. Não há cadastro público
de moderadoras, função de concessão de acesso ou hierarquia de permissões aqui.
O bloqueio do cadastro permanente no Auth hospedado precisa ser definido sem
desabilitar o signup anônimo das leitoras.
