# Sprint: dados familiares e gráficos do finapp

## Objetivo e prioridades

P0: conferir cobertura da extração financeira e combinar faltantes com o plano atual sem duplicar salários, previdência ou patrimônio inicial.

P1: aproximar a visualização dos gráficos ao finapp, com revisão do especialista em UX, sem alterar cálculos para melhorar artificialmente os resultados.

## Diagnóstico da importação

A leitura do SQLite é somente leitura e restrita às tabelas financeiras. Não consulta usuários, senhas ou tokens.

Foram identificados na origem: uma contribuição explicitamente atribuída à Iara, seu saldo previdenciário inicial vinculado e uma receita genérica de cônjuge, cuja titularidade o banco não informa. Não foi localizada uma receita futura explicitamente nomeada como benefício da Iara. Nenhum valor ou benefício ausente será inventado.

Esses três registros também constavam no arquivo completo de importação anterior disponível para conferência. A comparação daquele arquivo com o complemento novo resultou em três registros idênticos e zero inclusões. Isso não comprova presença na sessão ativa, apenas afasta omissão desses registros na extração anterior conferida.

O inventário completo reconcilia 58 registros da origem: 56 prontos e duas pendências. Os arquivos financeiros e seus inventários permanecem fora do repositório e da raiz servida por HTTP.

## Entrega da importação

- Modo Completar inclui somente IDs faltantes e mantém os registros existentes e premissas da conta.
- Mesmo ID com diferença aparece como conflito preservado. Nome e valores equivalentes com outro ID aparecem como possível duplicidade, sem inclusão automática.
- Arquivo complementar não pode executar substituição do plano.
- Prévia registro a registro mostra nome, grupo, ID de origem e resultado. A aplicação exige uma segunda ação após a conferência, com nova verificação da sessão e do estado.
- Backup local precede a aplicação. Não há envio automático ao Supabase.
- Exportador produz complemento completo e recorte familiar, com inventário e vínculos entre contribuição e saldo inicial. A titularidade de nomes genéricos continua sujeita a confirmação.

## Decisões com o especialista em UX

O finapp usa gráfico combinado com quatro barras, entradas, saídas como custos mais metas, contribuições e liberações, acompanhado da linha FCX. O Aposenta+ separava custos e metas em duas barras e usava SVG estreito sem tooltip compartilhado.

As telas anuais passam a agrupar custos e metas como na origem. A tabela de auditoria continua separando as parcelas para conferir os cálculos. Gráficos patrimoniais e faixas de Monte Carlo continuam separados do fluxo.

Prioridades aprovadas: altura legível, eixo zero claro, tooltip por ano com valores de todas as séries, controle de legenda, foco por teclado e adaptação para telas estreitas. Ocultar uma série não altera os saldos nem recalcula o plano.

O painel anual passa a ser a primeira visualização do dashboard. O gráfico antigo de aportes e a meta de renda ficam recolhidos como legado. O título principal deixa de exibir cobertura de 100% quando a meta de renda importada está zerada. O usuário vê orçamento e patrimônio antes dos indicadores de outro modelo.

## Critérios de aceite

1. Reimportar o complemento não duplica registros.
2. A soma familiar inclui receita e contribuição futuras, mas não duplica o saldo previdenciário inicial.
3. Conflitos e possíveis duplicidades ficam visíveis, sem apagar edições atuais.
4. A prévia e os gráficos respeitam a ocultação de valores e escapam conteúdo de origem.
5. Os gráficos anuais usam as mesmas séries e tipos da origem, com interação por ponteiro e teclado.
6. Testes financeiros, gráficos, importação e build passam.

## Conferência da conta ativa

Pendente de exportação JSON da conta atual ou acesso à sessão. A preparação dos arquivos não significa que os dados foram aplicados ao navegador ou ao Supabase. A soma real da conta só pode ser confirmada depois de reconciliar esse estado.

## Verificação da implementação

362 testes passaram e o build foi concluído. Os novos testes cobrem soma familiar, repetição idempotente, conflitos preservados, possíveis duplicidades, limites atômicos, prévia segura, destaque do painel anual e interações dos gráficos por ponteiro e teclado.

As comparações financeiras anteriores continuam aprovadas: quatro cenários sintéticos contra Python, além de 33 anos de fluxo e ativos financeiros, 72 células da matriz e 50 percursos de risco com os mesmos sorteios, usando premissas cambiais iguais.

Os módulos atuais de dashboard, gráficos, interações e prévia foram conferidos por HTTP no servidor local. Não houve inspeção visual no navegador da conta ativa. Testes de DOM simulado e verificação HTTP não comprovam essa etapa visual.
