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

O plano, os cenários e as preferências continuam locais. Esta Sprint não sincroniza dados financeiros.

## Criar o projeto gratuito

1. Crie um projeto no Supabase Free.
2. No painel do projeto, obtenha a Project URL e a chave publicável ou `anon`.
3. Copie `.env.example` para `.env`.
4. Preencha `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `APP_ORIGIN`.
5. Use `COOKIE_SECURE=true` em produção com HTTPS.

Carregue o arquivo e valide a conexão sem criar uma conta:

```bash
set -a
source .env
set +a
npm run check:auth-config
```

O resultado deve confirmar `connected`, o provedor de e-mail e a exigência de confirmação. O comando não imprime a chave.

Nunca coloque a chave `service_role` neste projeto ou no navegador. A chave publicável identifica o projeto. Row Level Security continua obrigatória para qualquer tabela exposta.

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

## Limites antes da beta

- O limitador em memória não é compartilhado entre várias instâncias. Produção distribuída exige Redis ou controle equivalente.
- O envio padrão de e-mail serve para testes. Produção exige SMTP próprio e monitoramento de entrega.
- MFA por aplicativo autenticador permanece para uma Sprint posterior.
- Exclusão remota de conta exige uma função administrativa isolada e auditável.
- Controlador, contato, base legal e retenção precisam de aprovação jurídica.
