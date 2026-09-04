# Aposenta+

MVP web para planejamento de aposentadoria. Ele transforma patrimônio, aporte, prazo e premissas financeiras em uma projeção clara de renda mensal.

## O que está pronto

- Painel responsivo com renda estimada, meta, patrimônio e fontes de renda.
- Plano com ajuste de aporte mensal.
- Simulador com cálculo instantâneo no navegador.
- Fluxo de caixa com receitas, despesas, provisão anual e reserva de emergência.
- Cálculo de saldo, taxa de poupança, comprometimento e aporte sustentável.
- Comparação entre aporte atual, sustentável e necessário para a meta.
- Área de conteúdos e preferências.
- Opção para ocultar valores e exportar os dados locais.
- Exclusão irreversível do plano, cenários e preferências armazenados localmente.
- Aviso de privacidade acessível pela aplicação.
- Política de Segurança de Conteúdo e cabeçalhos defensivos no servidor local.
- Cadastro, login, recuperação de senha e logout integrados ao Supabase Auth.
- Sessão em cookies `HttpOnly`, sem tokens no `localStorage`.
- Sincronização financeira manual e opcional após consentimento explícito.
- PostgreSQL com uma linha por usuário e políticas RLS para todas as operações.
- Restauração e exclusão independentes da cópia remota.
- Motor financeiro isolado da interface.
- Gráfico patrimonial calculado pelo mesmo motor da projeção.
- Estado local validado e versionado.
- Comparação de até três cenários salvos no dispositivo.
- Aplicação de uma simulação ao plano principal.
- Testes automatizados com o executor nativo do Node.js.
- Build estático sem dependências externas.

## Como executar

Você precisa do Node.js 20 ou superior.

```bash
npm run dev
```

Abra `http://127.0.0.1:4173`.

Para ativar o Supabase Auth no plano gratuito, copie `.env.example` para `.env` e preencha a URL e a chave publicável do projeto. O comando de desenvolvimento carrega o arquivo automaticamente.

```bash
npm run dev
```

Sem essas variáveis, a aplicação continua em modo de demonstração e informa que as contas ainda não foram configuradas. Consulte `docs/security/supabase-auth.md` para configurar URLs e modelos de e-mail.

Para ativar a cópia remota, aplique a migração da Sprint 6 no projeto Supabase:

```bash
supabase db push
```

Você também pode executar o arquivo `supabase/migrations/202609040001_sprint_6_financial_plans.sql` no SQL Editor do Supabase. A aplicação usa apenas a chave publicável e o token da sessão do usuário. Não configure uma chave `service_role` neste fluxo.

Para validar a URL e a chave publicável sem criar usuários:

```bash
npm run check:auth-config
```

Para validar todo o projeto:

```bash
npm run validate
```

Para gerar os arquivos de produção:

```bash
npm run build
```

O resultado fica em `dist/`.

## Estrutura

```text
aposenta-plus/
├── public/
│   └── favicon.svg
├── scripts/
│   ├── build.mjs
│   ├── dev-server.mjs
│   └── security-headers.mjs
├── src/
│   ├── app/
│   │   ├── layout.js
│   │   └── state.js
│   ├── data/
│   │   ├── mock-cash-flow.js
│   │   └── mock-plan.js
│   ├── domain/
│   │   ├── cash-flow.js
│   │   └── retirement.js
│   ├── features/
│   │   ├── content/
│   │   ├── cash-flow/
│   │   ├── dashboard/
│   │   ├── plan/
│   │   ├── profile/
│   │   ├── privacy/
│   │   └── simulations/
│   ├── server/
│   │   ├── auth/
│   │   └── data/
│   ├── shared/
│   │   ├── formatters.js
│   │   └── icons.js
│   ├── styles/
│   │   ├── app.css
│   │   ├── responsive.css
│   │   └── tokens.css
│   └── main.js
├── tests/
│   └── retirement.test.js
├── supabase/
│   └── migrations/
├── index.html
└── package.json
```

## Decisões técnicas

- A primeira versão não usa dependências. Isso reduz instalação, risco de pacote e tempo para iniciar.
- A regra de projeção fica em `src/domain`. A interface não contém fórmulas financeiras.
- O plano e o fluxo de caixa continuam em `localStorage` por padrão. O Supabase recebe uma cópia financeira somente após ação e consentimento explícitos.
- A sincronização é manual. O login consulta o estado da cópia, mas não envia o documento financeiro.
- A cópia remota não inclui preferências visuais, credenciais ou tokens.
- Receitas eventuais não financiam automaticamente compromissos recorrentes.
- A reserva de emergência fica separada do patrimônio de aposentadoria.
- O aporte atual não é descontado como despesa para evitar dupla contagem.
- Tokens de acesso e renovação ficam em cookies `HttpOnly` controlados pelo backend Node.
- Valores futuros usam retorno real. Isso mantém a leitura em poder de compra de hoje.
- O nome técnico do pacote usa `aposenta-plus`, pois o caractere `+` costuma exigir tratamento especial em URLs e ferramentas.

## Limites do MVP

O cálculo serve para educação e planejamento inicial. Ele não implementa regras oficiais do INSS, tributação, taxas de produtos ou recomendações personalizadas. Uma versão com dados reais deve incluir revisão jurídica, regras previdenciárias versionadas, controlador e contato de privacidade, base legal, consentimento quando aplicável e controles de segurança. O armazenamento local não é criptografado e pode ser acessado por pessoas, extensões ou scripts com acesso ao perfil do navegador.

## Próximas etapas sugeridas

1. Definir controlador, contato de privacidade, base legal e retenção antes da beta pública com conta.
2. Aplicar e validar a migração da Sprint 6 no projeto hospedado.
3. Separar valores planejados e realizados por mês.
4. Definir resolução de conflitos antes de uma sincronização automática.
5. Importar histórico de contribuições e versionar regras do INSS.
6. Verificar disponibilidade de marca e domínio para Aposenta+.
