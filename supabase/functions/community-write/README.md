# Community write — etapa 4B

Implementação isolada do leitor. A integração aguarda homologação. Não foram
alterados conteúdo editorial, animação, leitor ou `community-read`.

## Auditoria e banco

Conferidos: migration inicial, tipos gerados, leitura pública, utilitários,
testes SQL/HTTP, configuração e presença de variáveis no runtime, sem revelar valores.
Constraints reais reutilizadas: `unique(author_id, client_request_id)`,
`primary key(chapter_number, user_id)` e `unique(comment_id, reporter_id)`.

A migration incremental [20261103010000_community_write.sql](../../migrations/20261103010000_community_write.sql)
foi aplicada com `supabase migration up --local`, sem reset. A migration inicial
não foi alterada. Os tipos foram regenerados do banco local.

`community_private.rate_events` não está nos schemas da Data API. Nenhum acesso
de schema/tabela é concedido a anon, authenticated ou service_role. O RPC
`public.community_mutate(uuid,text,jsonb)` tem `SECURITY DEFINER`, `search_path=''`
e EXECUTE somente para service_role, além do proprietário. Preserva RLS, grants
existentes, FKs, auditoria e dados. O ator vem exclusivamente do JWT validado
no Auth pelo backend. Não há escrita direta concedida ao navegador.

Um lock transacional por identidade abrange duplicatas, cotas e inserções.
Só novas operações confirmadas consomem cota: intervalo de 30 segundos e
10 comentários/hora; 5 denúncias/hora (hora móvel). A migration inclui atividade
anterior recente na contagem inicial. Trevos usam a PK existente. Não há IP
armazenado nem ocultação automática por denúncias.

## Endpoint e contratos

`POST http://127.0.0.1:54321/functions/v1/community-write`

Headers: `Authorization: Bearer <JWT de usuário>`, `apikey: <chave pública local>`,
`Content-Type: application/json`. `OPTIONS` permite preflight sem sessão.
JWT obrigatório no gateway e validado novamente por `/auth/v1/user`.
Usuários Auth anônimos são aceitos. Campos desconhecidos são rejeitados,
inclusive `author_id`, `user_id`, `reporter_id`, `status` e dados de moderação.

Todo corpo contém `operation` e `captcha_token`: novo desafio por tentativa,
inclusive trevos e reenvios. Limite de corpo: 32 KiB, mesmo sem Content-Length.

| operation | Campos adicionais | Resposta HTTP 200 |
| --- | --- | --- |
| `comment` | `chapter_number` inteiro positivo, `pseudonym` texto 2–40 caracteres, `body` texto 1–5.000, `client_request_id` UUID | `operation`, `comment_id`, `created_at`, `replayed` |
| `clover` | `chapter_number` inteiro positivo | `operation`, `clover_count`, `already_left` |
| `report` | `comment_id` UUID, `reason_code`, `details` opcional até 2.000 caracteres | `operation`, `reported`, `already_reported` |

Comprimentos em caracteres Unicode após trim. HTML permanece texto literal:
a prévia usa interpolação React, sem `innerHTML`. Os futuros consumidores devem
preservar essa regra. Novos comentários sempre usam `published` e o ator validado.

Motivos: `spam`, `harassment`, `hate_or_discrimination`, `spoiler`,
`inappropriate_content`, `other`. Somente comentários publicados em capítulos
habilitados podem ser denunciados; outros retornam indisponível sem estado privado.
Repetir denúncia/trevo reconhece a operação existente sem nova linha/cota.

Mesmo UUID e mesmo comentário devolvem o mesmo ID, inclusive após timeout de
uma inserção confirmada. Conteúdo diferente com o mesmo UUID retorna 409.
Reenvios já confirmados são reconhecidos mesmo após desabilitação do capítulo
ou moderação. Sempre é necessária uma nova prova Turnstile.

Erros: `{ "error": { "code": "...", "message": "..." } }`.
400 `invalid_parameters`; 401 `unauthorized`; 403 `captcha_failed`;
404 `chapter_not_found`/`comment_not_found`; 409 `idempotency_conflict`;
413 `payload_too_large`; 415 `unsupported_media_type`;
429 `rate_limited` com header `Retry-After` em segundos;
503 `service_unavailable` para infraestrutura/configuração ou resultado incerto;
405 para métodos não suportados. Respostas não incluem IDs de autores ou
denunciantes, JWTs, provas ou credenciais. Não há logs sensíveis na função.

## Segredo Edge: configuração manual pendente

O segredo de Auth existente **não está disponível** no runtime Edge. A CLI
3.0.0 descarta nomes personalizados com prefixo `SUPABASE_` ao servir funções.
A função exige **`TURNSTILE_SECRET_KEY`**, obtido exclusivamente de `Deno.env.get`.
Nenhum segredo foi copiado do Auth ou de arquivos gerados.

Provisione `TURNSTILE_SECRET_KEY` no arquivo privado ignorado `supabase/.env`
(veja o [template sem credenciais](../../.env.example)), com o segredo real do
widget aprovado. Não use `VITE_`, não cole o valor no chat e não o versione.
Preserve a configuração de Auth existente. Reinicie só o servidor local de funções:

```powershell
npx supabase functions serve --env-file supabase/.env
```

Não use `--no-verify-jwt`. Não precisa parar/resetar o banco, substituir a
identidade ou acessar o projeto remoto. Sem a variável, retorna 503 sem mutação.
Cada mutação valida Siteverify oficial com `secret` e `response`, sem `remoteip`.
Falhas de configuração/provedor fecham a operação. O navegador não substitui
essa validação.

## Prévia e homologação

Abra [community-write-preview.html](../../../community-write-preview.html) no Vite:
`http://127.0.0.1:5173/community-write-preview.html`. Para recuperar a identidade
anterior, mantenha **a mesma origem** da homologação (hostname e porta).
O cliente existente persiste e renova a sessão. Não limpe storage nem faça logout.

O ambiente público existente aponta para outro destino e foi preservado. A
prévia bloqueia a importação do cliente se a URL não for Supabase local HTTP
na porta 54321; nenhum projeto remoto foi acessado. Inicie Vite sobrescrevendo
somente o ambiente do processo, com a chave pública local e a Site Key real:

```powershell
$env:VITE_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:VITE_SUPABASE_PUBLISHABLE_KEY = '<chave pública da stack local>'
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort
```

A prévia usa Turnstile real, sem bypass. Criar sessão exige ação explícita e
uma prova; cada escrita exige outra. Antes de enviar, preserva conteúdo e UUID
do comentário em sessionStorage, nunca tokens. Timeout/recarga permite reenviar
o mesmo payload. Em sucesso, remove o rascunho. Liberar edição abandona a
tentativa preservada; confirme resultado incerto antes de iniciar outro envio.
A leitura mantém comentários antigos primeiro e permite paginação.

Checklist manual pendente:

1. Provisionar o segredo Edge e confirmar aceitação real das três operações.
2. Recuperar a identidade na origem anterior; publicar, recarregar e confirmar
   um envio incerto, verificando publicação imediata sem duplicação.
3. Repetir trevo e denúncia; verificar total único e comentário ainda visível.
4. Conferir validação, Retry-After e HTML exibido literalmente.
5. Verificar rejeição de provas **reais** inválidas, expiradas e reutilizadas
   também pelo endpoint local diretamente com JWT válido.
6. Homologar a prévia antes de autorizar integração com o leitor.

## Validação executada

```powershell
npx supabase test db --local
node --experimental-transform-types supabase/functions/tests/community-write.local.mjs
node --experimental-strip-types supabase/functions/tests/community-read.local.mjs
node --test src/features/community/tests/anonymousSession.test.mjs
npm run build
git diff --check
```

Passaram: 189 asserções SQL em duas suítes com rollback; 64 verificações HTTP
de escrita; 34 HTTP de leitura; 12 testes de sessão; build. A concorrência
confirma uma única publicação, trevo e denúncia em oito chamadas simultâneas e
uma única aceitação ao disputar a última vaga das cotas de comentário/denúncia.

Auth, Data API e PostgreSQL são locais e reais nos testes de escrita. Identidades
são sintéticas e o Auth valida seus JWTs. O finally remove as fixtures e confere
o total anterior de usuários. O gateway real rejeita ausência/JWT inválido.
Siteverify bem-sucedido, expirado/reutilizado e timeout após commit são simulados
**apenas em servidor HTTP efêmero isolado por injeção de dependências**.
Não existe flag de teste em produção. A suíte verifica 403 real para prova
inválida quando há segredo Edge; sem ele verifica 503 e informa a pendência.
Isso não homologa aceitação ou expiração real Cloudflare. A prévia e leitura
dos totais foram conferidas no navegador com widget real; nenhuma nova sessão
foi criada nessa inspeção. Um reinício automático do runtime interrompeu a
primeira execução da regressão HTTP de leitura; a repetição completa passou.
