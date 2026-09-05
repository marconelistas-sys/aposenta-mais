# Aposenta+

MVP web para planejamento de aposentadoria. Ele transforma patrimônio, aporte, prazo e premissas financeiras em uma projeção clara de renda mensal.

## O que está pronto

- Cobertura da reserva em meses, sensibilidade das despesas e comparação de momentos da aposentadoria, adaptadas da análise do finapp.

- Mês de aposentadoria confirmado no orçamento e término de receitas vinculado a ele, com datas manuais preservadas.

- Guia inicial e evolução mensal de receitas, despesas e saldo previsto, com atalho para término salarial antes da aposentadoria estimada.

- Controle de conflitos por revisão na gravação remota e recuperação de três versões locais.
- Registro de até 50 operações de dados, consultável e exportável pelo Perfil.

- Painel responsivo com renda estimada, meta, patrimônio e fontes de renda.
- Plano com ajuste de aporte mensal.
- Carteira com saldo, aporte e retorno real por investimento.
- Retorno do plano usado como padrão dinâmico, com taxa específica opcional por investimento.
- Taxas reais, nominais, percentual do CDI e IPCA mais taxa convertidas para retorno real.
- Inflação esperada configurável para manter projeções em poder de compra atual.
- Comparação do impacto dos rendimentos e sensibilidade de menos 1 ponto percentual.
- Simulador com cálculo instantâneo no navegador.
- Fluxo de caixa por lançamento, com moeda, categoria, frequência e reserva de emergência.
- Cálculo de saldo, taxa de poupança, comprometimento e aporte sustentável.
- Comparação entre aporte atual, sustentável e necessário para a meta.
- Receitas e despesas em BRL, EUR, USD ou CHF, consolidadas na moeda da visão geral.
- Cotação pública do Banco Central Europeu com fonte, data e estado de atualização.
- Histórico cambial de 90 dias e simulação de variação entre -50% e 50% no orçamento, sem alterar o plano.
- Simulação cambial do patrimônio com parcela exposta informada por investimento e comparação dos saldos.
- Categorias comuns de internet banking e criação simplificada de novas categorias.
- Datas de início e fim para receitas, despesas e contribuições recorrentes.
- Importação local de até 100 lançamentos por arquivo TXT, com prévia, mapeamento e controle de duplicidades.
- Comparação mensal entre orçamento planejado e valores realizados.
- Edição de lançamentos sem exclusão, com preservação da origem importada.
- Contribuições de previdência complementar no orçamento e no patrimônio projetado.
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
- Estado de privacidade visível para uso local, conta e cópia remota.
- Motor financeiro isolado da interface.
- Gráfico patrimonial calculado pelo mesmo motor da projeção.
- Estado local validado e versionado.
- Comparação de até três cenários salvos no dispositivo com gráfico por retorno real.
- Restauração do plano, orçamento e moeda a partir de um cenário salvo.
- Testes automatizados com o executor nativo do Node.js.
- Build estático sem dependências de pacotes npm.

## Como executar

Você precisa do Node.js 20 ou superior.

```bash
./run-app.sh
```

Abra `http://127.0.0.1:4173`.

O script valida o Node.js, o npm, o arquivo `.env` e as variáveis do Supabase antes de iniciar o servidor. Como alternativa, execute `npm run dev` diretamente.

Para ativar o Supabase Auth no plano gratuito, copie `.env.example` para `.env` e preencha a URL e a chave publicável do projeto. O comando de desenvolvimento carrega o arquivo automaticamente.

```bash
npm run dev
```

Sem essas variáveis, a aplicação continua em modo de demonstração e informa que as contas ainda não foram configuradas. Consulte `docs/security/supabase-auth.md` para configurar URLs e modelos de e-mail.

Na visão geral, escolha BRL, EUR, USD ou CHF. A troca converte os valores do plano pela cotação exibida. Cada lançamento do orçamento mantém sua moeda original. Planos salvos antes dessa opção são migrados para BRL.

O servidor consulta a taxa diária oficial do Banco Central Europeu e mantém cache por seis horas. Quando a consulta falha, o dashboard identifica a última referência embutida como desatualizada. Nenhum dado financeiro é enviado ao BCE.

Para ativar a cópia remota, aplique a migração da Sprint 6 no projeto Supabase:

```bash
supabase db push
```

Você também pode executar o arquivo `supabase/migrations/202609040001_sprint_6_financial_plans.sql` no SQL Editor do Supabase. A aplicação usa apenas a chave publicável e o token da sessão do usuário. Não configure uma chave `service_role` neste fluxo.

Para validar a URL e a chave publicável sem criar usuários:

```bash
npm run check:auth-config
```

Para validar RLS, restauração e exclusão no projeto hospedado, configure duas contas confirmadas nas variáveis `TEST_USER_A_*` e `TEST_USER_B_*` e execute:

```bash
npm run test:rls
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
│   │   ├── investments/
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
- A projeção usa capitalização mensal equivalente à taxa real efetiva anual de cada cenário.
- Contribuições previdenciárias reduzem o saldo disponível do orçamento e entram como aportes programados no motor patrimonial.
- O importador TXT processa o arquivo no navegador, exige confirmação e não envia o extrato ao servidor.
- As taxas cambiais servem para planejamento. Elas não representam preço de compra ou venda de moeda.
- O nome técnico do pacote usa `aposenta-plus`, pois o caractere `+` costuma exigir tratamento especial em URLs e ferramentas.

## Limites do MVP

O cálculo serve para educação e planejamento inicial. Ele não implementa regras oficiais do INSS, tributação, taxas de produtos ou recomendações personalizadas. O armazenamento local não é criptografado e pode ser acessado por pessoas, extensões ou scripts com acesso ao perfil do navegador. As decisões e o bloqueio de publicação da beta estão em `docs/privacy/beta-readiness.md`.

## Próximas etapas sugeridas

1. Preencher o controlador e o contato reais, obter aprovação jurídica e só então definir `LEGAL_BETA_APPROVED=true`.
2. Validar a RLS da Sprint 6 com duas contas confirmadas no projeto hospedado.
3. Contratar ou integrar uma instituição receptora participante antes de conectar o Open Finance.
4. Definir resolução de conflitos antes de uma sincronização automática.
5. Importar histórico de contribuições e versionar regras do INSS.
6. Verificar disponibilidade de marca e domínio para Aposenta+.
