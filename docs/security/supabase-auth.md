# Configuração do Supabase Auth gratuito

## Escopo entregue

- Cadastro com e-mail e senha.
- Confirmação de e-mail por token de uso único.
- Login e logout.
- Recuperação e troca de senha.
- Renovação de sessão.
- Cookies `HttpOnly` e `SameSite=Lax`.
- Cookies `Secure` em produção.
- Verificação da identidade no Supabase em cada consulta de sessão.
- Verificação de origem e limite de tentativas em memória por endereço e hash SHA-256 do e-mail normalizado.
- Respostas genéricas para cadastro, recuperação e falha de login.
- Revogação global das sessões depois da troca de senha.

O plano, o fluxo de caixa e os cenários continuam locais por padrão. A Sprint 6 adiciona uma cópia financeira manual, separada do login e condicionada a consentimento explícito. Preferências visuais continuam somente no dispositivo.

## Criar o projeto gratuito

1. Crie um projeto no Supabase Free.
2. No painel do projeto, obtenha a Project URL e a chave publicável ou `anon`.
3. Copie `.env.example` para `.env`.
4. Preencha `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `APP_ORIGIN`.
5. Use `COOKIE_SECURE=true` em produção com HTTPS.

Valide a conexão sem criar uma conta. O comando carrega `.env` automaticamente:

```bash
npm run check:auth-config
```

O resultado deve confirmar `connected`, o provedor de e-mail e a exigência de confirmação. O comando não imprime a chave.

Nunca coloque a chave `service_role` neste projeto ou no navegador. A chave publicável identifica o projeto. Row Level Security continua obrigatória para qualquer tabela exposta.

## Ativar a cópia financeira

Execute `supabase/migrations/202609040001_sprint_6_financial_plans.sql` no SQL Editor do projeto. Como alternativa, vincule o Supabase CLI ao projeto e execute `supabase db push`.

Para validar o ambiente hospedado com duas contas confirmadas, configure `TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD`, `TEST_USER_B_EMAIL` e `TEST_USER_B_PASSWORD` somente no ambiente local. Execute `npm run test:rls`. O teste cria duas cópias sintéticas, verifica isolamento, restauração e exclusão e remove as duas linhas ao terminar.

Depois da migração, confira no painel:

- RLS habilitada e forçada em `public.financial_plans`.
- Quatro políticas para `select`, `insert`, `update` e `delete`.
- Ausência de permissão para `anon`.
- Acesso concedido somente ao papel `authenticated`.
- Uma conta não consegue consultar nem alterar a linha de outra conta.

## URLs permitidas

No Supabase Auth, configure:

- Site URL: a origem definida em `APP_ORIGIN`.
- Redirect URL local: `http://127.0.0.1:4173/api/auth/confirm`.
- Redirect URL de produção: `https://seu-dominio/api/auth/confirm`.

## Modelos de e-mail

O endpoint do backend espera `token_hash` e `type`. Ajuste os links dos modelos no painel do Supabase.

Confirmação de cadastro:

```html
<a href="{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Confirmar meu e-mail</a>
```

Recuperação de senha:

```html
<a href="{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/nova-senha">Criar nova senha</a>
```

## Variáveis

| Variável | Uso | Segredo |
| --- | --- | --- |
| `SUPABASE_URL` | endereço do projeto | não |
| `SUPABASE_ANON_KEY` | chave publicável para Auth | não, mas deve ficar em configuração |
| `APP_ORIGIN` | origem aceita pelo controle CSRF | não |
| `COOKIE_SECURE` | exige cookie sobre HTTPS | não |
| `LEGAL_BETA_APPROVED` | registra a aprovação humana da liberação | não |
| `LEGAL_CONTROLLER_NAME` | identifica o controlador aprovado | não |
| `LEGAL_PRIVACY_CONTACT` | define o canal monitorado de privacidade | não |
| `TEST_USER_A_*` e `TEST_USER_B_*` | credenciais locais do teste hospedado | sim |

## Limites antes da beta

- O limitador em memória não é compartilhado entre várias instâncias. Produção distribuída exige Redis ou controle equivalente.
- O envio padrão de e-mail serve para testes. Produção exige SMTP próprio e monitoramento de entrega.
- MFA por aplicativo autenticador permanece para uma Sprint posterior.
- Exclusão remota de conta exige uma função administrativa isolada e auditável.
- Controlador, contato, base legal e retenção precisam de aprovação jurídica.
- Em produção, `LEGAL_BETA_APPROVED=true`, `LEGAL_CONTROLLER_NAME` e `LEGAL_PRIVACY_CONTACT` são obrigatórios para habilitar contas e sincronização.
