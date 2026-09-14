# Duas sprints: interpretação, extratos e persistência local

## Sprint 1: entender o plano

Objetivo: explicar a sustentabilidade do orçamento familiar sem exigir leitura de várias tabelas.

- Resumo gráfico de hoje, aposentadoria e data-alvo.
- Situação, primeiro período de insuficiência e explicação sobre uso do patrimônio.
- Até três próximas ações, ligadas aos dados que faltam ou ao problema encontrado.
- Detalhes e indicadores secundários recolhidos. Preservação da privacidade e navegação por teclado.

Aceite: distinguir caixa negativo coberto por ativos, falta de liquidez e avaliação incompleta, com testes de renderização.

## Sprint 2: usar dados bancários e trabalhar sem nuvem

Objetivo: importar extratos e obter sugestões rastreáveis para revisar o plano, com persistência SQLite local.

- CSV, TXT e OFX, com prévia, datas e valores validados, duplicidades e exclusão de transferências na análise.
- Leitura dos meses completos, média de receitas e despesas, recorrências candidatas e capacidade observada de aporte.
- Comparação educativa com o aporte planejado para aposentadoria. Sugestões explícitas, sem modificar orçamento ou investimentos por inferência silenciosa.
- Contas locais com senhas protegidas, recuperação offline, sessões, isolamento por usuário e gravação do plano com controle de versão.
- SQLite como padrão, Supabase opcional. Banco fora dos arquivos públicos, scripts de inicialização e backup e documentação de migração.

Aceite: cadastro, login, recuperação e salvamento sem rede externa. Persistência após reabrir o banco. Conflitos entre versões e contas diferentes bloqueados. Extratos repetidos não criam sugestões ou lançamentos duplicados. Dados pessoais não entram nos fixtures.

Os dados existentes no navegador e no Supabase não serão apagados nem combinados automaticamente. A transferência para uma conta local pode usar o importador finapp existente ou a cópia explícita do plano de visitante. Backups SQLite restauram o banco completo. Não há migração automática de contas Supabase.

## Entrega

As duas sprints foram implementadas. A análise bancária compara a sobra histórica com o aporte e direciona para Simulações. Ela não altera automaticamente o plano nem guarda o arquivo bruto. O SQLite usa gravação manual pelo Perfil. A conferência visual foi feita por testes de HTML e acessibilidade estrutural, sem navegador automatizado disponível nesta sessão.
