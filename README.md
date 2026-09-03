# Aposenta+

MVP web para planejamento de aposentadoria. Ele transforma patrimônio, aporte, prazo e premissas financeiras em uma projeção clara de renda mensal.

## O que está pronto

- Painel responsivo com renda estimada, meta, patrimônio e fontes de renda.
- Plano com ajuste de aporte mensal.
- Simulador com cálculo instantâneo no navegador.
- Área de conteúdos e preferências.
- Opção para ocultar valores e exportar os dados locais.
- Motor financeiro isolado da interface.
- Testes automatizados com o executor nativo do Node.js.
- Build estático sem dependências externas.

## Como executar

Você precisa do Node.js 20 ou superior.

```bash
npm run dev
```

Abra `http://127.0.0.1:4173`.

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
│   └── dev-server.mjs
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
│   │   └── simulations/
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
- O estado usa `localStorage`. Nenhum dado sai do navegador.
- Valores futuros usam retorno real. Isso mantém a leitura em poder de compra de hoje.
- O nome técnico do pacote usa `aposenta-plus`, pois o caractere `+` costuma exigir tratamento especial em URLs e ferramentas.

## Limites do MVP

O cálculo serve para educação e planejamento inicial. Ele não implementa regras oficiais do INSS, tributação, taxas de produtos ou recomendações personalizadas. Uma versão com dados reais deve incluir revisão jurídica, regras previdenciárias versionadas, consentimento e controles de segurança.

## Próximas etapas sugeridas

1. Criar onboarding e cadastro do perfil previdenciário.
2. Importar histórico de contribuições.
3. Versionar regras do INSS por vigência.
4. Salvar e comparar cenários.
5. Adicionar autenticação e API com controles de privacidade.
6. Verificar disponibilidade de marca e domínio para Aposenta+.
