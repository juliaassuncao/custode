# Custode Community — banco local

Esta publicação inclui somente a comunidade pública: leitura, escrita e cadastro
técnico dos capítulos 1–28. O backend administrativo permanece no checkpoint de
backup e não faz parte deste pacote.

A [migration inicial](./migrations/20261103000000_create_community.sql) cria seis
tabelas em uma transação. O registro técnico contém os números conferidos no
manifesto e nos 27 JSONs; não copia conteúdo editorial. Novos capítulos exigem
inserção explícita no registro. `enabled` será validado pelas futuras Edge Functions.

Todas as tabelas têm RLS, sem políticas. Privilégios de `PUBLIC`, `anon` e
`authenticated` são revogados. Usuários anônimos do Auth usam `authenticated`.
Somente `service_role` recebe leitura/inserção e atualização onde necessária;
não recebe DELETE/TRUNCATE nem UPDATE no histórico. O dono do banco continua
capaz de administrar o schema; esses grants não limitam um superusuário.

As futuras funções deverão validar JWT, identidade, moderador ativo e capítulo
habilitado, aplicar antispam e projetar respostas públicas sem IDs internos.
Uma ação de moderação e seu registro de auditoria precisam de uma única transação.
Não há automação de moderação por denúncia. Remoção de comentário é lógica.
FKs RESTRICT preservam histórico e impedem excluir identidades referenciadas;
limpeza de usuários anônimos exigirá política específica de retenção.

## Preparação e validação pendentes

Supabase CLI, Docker e psql não estavam disponíveis no PATH nesta etapa.
Nenhuma migration foi executada e os tipos TypeScript anteriores foram preservados.

Instale Docker Desktop e a CLI como ferramenta externa, pelo binário oficial ou
Scoop no Windows, seguindo a [documentação oficial](https://supabase.com/docs/guides/local-development/cli/getting-started).
Não instale a CLI nas dependências da aplicação. Confira `supabase --version`,
`docker version` e a compatibilidade da CLI com [config.toml](./config.toml).
Não execute `supabase init` sobre a configuração existente.

Antes de iniciar, confirme que os containers/volumes locais de
`custode-community` não contêm dados a preservar. Sem link ou flags de projeto remoto:

```powershell
supabase start
supabase migration up --local
supabase test db --local
```

`start` também pode aplicar migrations pendentes. Não execute `db reset`.
Os [testes pgTAP](./tests/community.test.sql) usam fixtures sintéticas em transação
com rollback. Validam tabelas, RLS, grants, unicidades, restrições e retenção.
Após executá-los, inspecione também índices e FKs no catálogo local e confira os
números do registro novamente contra o manifesto caso novos capítulos sejam publicados.

Somente após a validação local, gere os tipos oficiais sem truncar o arquivo atual
se a CLI falhar (execute na raiz, em PowerShell):

```powershell
$generatedTypes = & supabase gen types typescript --local --schema public
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar tipos; arquivo atual preservado.' }
$generatedTypes | Set-Content -Encoding utf8 src/lib/supabase/database.types.ts
npm run build
```

Nenhum comando remoto, concessão de moderador ou configuração de autenticação faz
parte desta etapa. A configuração local não replica os segredos do projeto hospedado.
