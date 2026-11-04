# Acesso administrativo da Comunidade

Rotas: `/admin/login`, `/admin/recover`, `/admin/reset` e `/admin` (privada).
O cliente exclusivo usa a chave de armazenamento `custode-community-admin-auth-v1`.
Não importa nem altera o cliente anônimo das leitoras. Não existe cadastro ou
concessão de acesso pela interface. Todas as moderadoras ativas têm o mesmo fluxo;
nenhum e-mail ou UUID de conta é fixado no frontend.

A área privada oferece um dashboard com comentários, denúncias e
histórico, além do logout. As consultas usam exclusivamente GET de `community-admin`,
com filtros por capítulo e estado (estado não se aplica ao histórico), vinte
registros por página e navegação pelo cursor opaco retornado pelo backend.
Comentários publicados podem ser ocultados com motivo obrigatório e comentários
ocultos podem ser restaurados. Denúncias abertas podem ser resolvidas ou descartadas
sem alterar o comentário. Todas as ações exigem confirmação e usam POST do mesmo
backend, com a versão recebida na leitura e UUID próprio por intenção. Um envio
incerto mantém o payload bloqueado para retry, inclusive ao trocar abas/páginas
durante a mesma sessão do dashboard. Não recarregue a página enquanto aguarda
confirmação: os envios pendentes são mantidos apenas em memória. Conflitos não são
reenviados automaticamente; atualize os registros antes de uma nova ação.
Textos são renderizados como texto, e identificadores privados das leitoras não
são exibidos. Não existe remoção definitiva na interface.
Uma sessão Auth por si só não libera acesso: `community-admin` precisa responder
com sucesso, validando a associação ativa no banco. A verificação ocorre na entrada,
nos eventos de sessão, ao retornar à janela, a cada minuto e antes de salvar uma
nova senha. Falhas de rede, função ausente e autorização negada bloqueiam a área.
As operações administrativas passam sempre pelo backend autorizado.

## Testar localmente

1. Configure as variáveis públicas de [.env.example](../../../.env.example) em um
   arquivo local de ambiente: URL e chave pública do Supabase **local** e a chave
   pública Turnstile, se o CAPTCHA estiver habilitado no Auth.
2. Use um ambiente local previamente preparado com a migration administrativa,
   a função `community-admin` disponível, envio de e-mail local e contas permanentes
   de teste já vinculadas a `community_moderators` com `active=true`. Esta etapa
   não provisiona contas, aplica migrations ou inicia serviços do Supabase.
3. O Auth deve aceitar o redirecionamento exato
   `http://localhost:5173/admin/reset`. Se não estiver permitido, a configuração
   local precisa ser preparada separadamente; nenhum ajuste remoto é necessário.
4. Execute `npm run dev` e abra `http://localhost:5173/admin/login`. Entre com
   uma conta de teste autorizada. Deve aparecer o painel de moderação. Repita
   com a segunda conta ativa: ambas devem ter o mesmo acesso.
5. Uma conta sem vínculo ativo deve receber acesso negado. Sem sessão, `/admin`
   deve redirecionar ao login. Backend desligado deve bloquear o acesso com opção
   de tentar novamente. Use “Sair da conta” para encerrar a sessão administrativa.
6. Em “Esqueci minha senha”, solicite o e-mail e abra o link do correio local no
   mesmo navegador/perfil. O fluxo PKCE depende do verificador armazenado nesse
   navegador. Defina e confirme a nova senha (mínimo de oito caracteres e política
   adicional do Auth). Ao salvar, a sessão é encerrada: entre com a nova senha.
   Link inválido, expirado ou reutilizado deve oferecer uma nova solicitação.
7. Mantenha uma sessão de leitora aberta em outra aba e confira que login,
   recuperação e logout administrativos não mudam sua identidade nem seu storage.

Não use contas reais ou credenciais `service_role` no navegador.
Se o backend ainda não estiver instalado no ambiente de teste, o acesso fica
bloqueado por projeto; isso não impede testar os formulários e os testes sintéticos.

## Verificações sem serviços externos

```sh
node --test src/features/community-admin/tests/adminAuth.test.mjs
node --test src/features/community-admin/tests/adminRead.test.mjs
node --test src/features/community-admin/tests/adminMutate.test.mjs
npm run build
```

Os testes usam Auth e HTTP sintéticos. Não acessam banco, e-mail ou Supabase remoto.
A recuperação segue o [fluxo documentado pelo Supabase](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).
