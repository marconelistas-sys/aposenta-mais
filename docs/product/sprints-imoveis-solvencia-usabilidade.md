# Três sprints: imóveis e leitura da solvência

## Sprint 1: configurar os imóveis considerados

Salvar a escolha de incluir ou excluir imóveis na avaliação patrimonial. Permitir excluir um imóvel específico, por exemplo a residência que a família deseja preservar. Manter o patrimônio cadastrado e as dívidas integrais. Usar categoria explícita, sem inferir pelo nome. Valores e fluxos de caixa não devem mudar com esse filtro.

## Sprint 2: interpretar e explorar o gráfico

Exibir o filtro junto ao gráfico, identificar o patrimônio considerado e comparar com o total cadastrado. Mostrar a solvência separadamente da liquidez. Oferecer atalhos para o primeiro déficit, a primeira falta de liquidez e a data-alvo. Preservar o ano selecionado ao mudar o filtro ou a base de preços.

## Sprint 3: Dashboard e cadastro acessível

Usar a mesma escolha na visão geral e no fluxo de caixa. Mostrar quando o patrimônio considerado deixa de cobrir as dívidas, mesmo que o total com imóveis permaneça positivo. Dar acesso ao cadastro de bens pela tela Patrimônio, com indicação clara dos imóveis excluídos e dos bens sem classificação.

## Critérios de aceite

Testar persistência, restauração e isolamento entre contas, valores por moeda e ano, atualização nominal, consistência dos indicadores e privacidade. O filtro não presume venda, não cria receita e não remove dívidas. A sustentabilidade do orçamento continua dependendo dos recursos financeiros e da liquidez. Manter compatibilidade com planos anteriores, que incluem todos os imóveis por padrão.

## Entregas

As três sprints foram implementadas. O filtro geral aparece no fluxo anual, na avaliação detalhada, no Dashboard e na tela Patrimônio. A edição de cada bem permite definir sua categoria e excluir um imóvel individualmente. Os planos anteriores conservam a inclusão por padrão. Uma exclusão individual continua válida ao reativar o filtro geral.

A linha patrimonial e o resultado do ano usam o patrimônio considerado. A comparação expandida apresenta o total cadastrado, os imóveis excluídos, o patrimônio considerado e o patrimônio sem nenhum imóvel. Os gráficos de fluxo e patrimônio sincronizam a seleção anual por clique e teclado. Atalhos levam ao primeiro déficit, primeira falta de liquidez, primeira insuficiência patrimonial e data-alvo. A memória de cálculo fica recolhida, e consumo patrimonial com recursos suficientes não recebe a mesma marcação de insuficiência.

O cadastro de bens também está disponível em Patrimônio. Bens importados sem categoria são identificados como tipo não informado. O filtro não infere imóveis pelo nome. Para reconhecer esses imóveis, o usuário deve classificá-los no cadastro.

## Evidências e limites

`npm run validate` aprovado com 507 testes e build concluído. Foram adicionados 11 testes para classificação e seleção individual, moeda e crescimento anual, invariância do caixa e das dívidas, conversão nominal, exportação, preferência por conta, falha de armazenamento, edição, privacidade, marcos e interação entre gráficos. `git diff --check` sem erros.

A interface recebeu testes de HTML e eventos de interação com DOM simulado. A inspeção visual no navegador não foi realizada. Nenhum servidor foi iniciado, nenhum dado real foi alterado e nenhuma sincronização externa foi executada. Reinicie uma instância já aberta e recarregue a página para que o servidor também preserve os novos campos nas cópias salvas.

O filtro considera somente bens cadastrados com categoria Imóvel. Veículos, outros bens, investimentos e direitos de consórcio conservam seus valores. Todas as dívidas permanecem deduzidas. A solvência apresentada é uma comparação patrimonial nos fechamentos anuais. Não presume venda nem calcula custos de venda, e não substitui a avaliação separada de liquidez e sustentabilidade do orçamento.
