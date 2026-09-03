# Aposenta+

MVP web para planejamento de aposentadoria. Ele transforma patrimônio, aporte, prazo e premissas financeiras em uma projeção clara de renda mensal.

## O que está pronto

- Painel responsivo com renda estimada, meta, patrimônio e fontes de renda.
- Plano com ajuste de aporte mensal.
- Simulador com cálculo instantâneo no navegador.
- Área de conteúdos e preferências.
- Opção para ocultar valores e exportar os dados locais.
- Exclusão irreversível do plano, cenários e preferências armazenados localmente.
- Aviso de privacidade acessível pela aplicação.
- Política de Segurança de Conteúdo e cabeçalhos defensivos no servidor local.
- Cadastro, login, recuperação de senha e logout integrados ao Supabase Auth.
- Sessão em cookies `HttpOnly`, sem tokens no `localStorage`.
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

Para ativar o Supabase Auth no plano gratuito, copie `.env.example` para `.env`, preencha a URL e a chave publicável do projeto e carregue as variáveis antes de iniciar o servidor. O Node.js não lê o arquivo `.env` automaticamente.

```bash
set -a
source .env
set +a
npm run dev
```

Sem essas variáveis, a aplicação continua em modo de demonstração e informa que as contas ainda não foram configuradas. Consulte `docs/security/supabase-auth.md` para configurar URLs e modelos de e-mail.

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
│   │   └── mock-plan.js
│   ├── domain/
│   │   └── retirement.js
│   ├── features/
│   │   ├── content/
│   │   ├── dashboard/
│   │   ├── plan/
│   │   ├── profile/
│   │   ├── privacy/
│   │   └── simulations/
│   ├── server/
│   │   └── auth/
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
├── index.html
└── package.json
```

## Decisões técnicas

- A primeira versão não usa dependências. Isso reduz instalação, risco de pacote e tempo para iniciar.
- A regra de projeção fica em `src/domain`. A interface não contém fórmulas financeiras.
- O plano financeiro continua em `localStorage` nesta Sprint. O Supabase recebe somente dados de identidade e autenticação quando configurado.
- Tokens de acesso e renovação ficam em cookies `HttpOnly` controlados pelo backend Node.
- Valores futuros usam retorno real. Isso mantém a leitura em poder de compra de hoje.
- O nome técnico do pacote usa `aposenta-plus`, pois o caractere `+` costuma exigir tratamento especial em URLs e ferramentas.

## Limites do MVP

O cálculo serve para educação e planejamento inicial. Ele não implementa regras oficiais do INSS, tributação, taxas de produtos ou recomendações personalizadas. Uma versão com dados reais deve incluir revisão jurídica, regras previdenciárias versionadas, controlador e contato de privacidade, base legal, consentimento quando aplicável e controles de segurança. O armazenamento local não é criptografado e pode ser acessado por pessoas, extensões ou scripts com acesso ao perfil do navegador.

## Próximas etapas sugeridas

1. Definir requisitos jurídicos e de segurança antes de criar contas ou servidor.
2. Importar histórico de contribuições.
3. Versionar regras do INSS por vigência.
4. Salvar e comparar cenários.
5. Adicionar autenticação e API com controles de privacidade.
6. Verificar disponibilidade de marca e domínio para Aposenta+.
