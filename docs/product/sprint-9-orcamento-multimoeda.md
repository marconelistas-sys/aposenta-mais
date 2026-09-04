# Sprint 9: orçamento multimoeda e projeções por cenário

## Objetivo

Permitir que pessoas e casais registrem receitas e despesas nas moedas em que elas acontecem, mantendo uma visão consolidada e verificável.

## Decisões de produto

- Cada lançamento preserva valor, moeda, categoria e frequência.
- A moeda da visão geral define os totais do dashboard.
- O BCE é a fonte inicial por publicar taxas de referência e API pública.
- O dashboard mostra fonte, data, taxas cruzadas e estado de atualização.
- Taxas servem para planejamento e não representam preço de uma operação cambial.
- Cenários preservam plano, orçamento e moeda para restauração completa.
- O gráfico compara o saldo final de cada cenário na mesma moeda.

## Modelo financeiro

- Taxas do BCE são quantidades de moeda por EUR.
- Conversão entre duas moedas usa `valor / taxa_origem × taxa_destino`.
- Gastos anuais entram no fluxo mensal como provisão dividida por 12.
- Receitas eventuais ficam fora do aporte sustentável.
- Retorno real anual vira taxa mensal equivalente por `(1 + taxa_anual)^(1/12) - 1`.
- Aportes entram no fim de cada mês.
- A série detalhada separa capital aportado e rendimento real composto.

## Categorias iniciais

Receitas incluem salário, trabalho autônomo, benefício, aluguéis, rendimentos, reembolsos e outras receitas.

Despesas incluem moradia, mercado, transporte, saúde, educação, família, seguros, restaurantes, compras, assinaturas, lazer, viagens, impostos, dívidas, doações e outras despesas.

Categorias personalizadas recebem tratamento conservador. Novas despesas entram como variáveis. Novas receitas entram como eventuais.

## Critérios de aceite

- Um lançamento aceita BRL, EUR, USD ou CHF.
- O lançamento mantém sua moeda após troca da moeda da visão geral.
- Totais usam uma única fotografia cambial.
- Fonte, data e estado da cotação aparecem no dashboard.
- Falha de rede usa a última referência oficial identificada como desatualizada.
- Usuário pode criar até 30 categorias personalizadas.
- Usuário pode salvar e restaurar até três cenários.
- Comparação mostra taxa real e saldo projetado de cada cenário.
- Exportação e cópia remota preservam moedas, cotação e categorias.

## Continuação do roadmap

1. Editar lançamentos existentes. Concluído na Sprint 12.
2. Separar valores planejados e realizados por competência.
3. Exibir histórico de taxas e análise de sensibilidade cambial.
4. Permitir cenários probabilísticos com faixas e hipóteses visíveis.
5. Versionar tributos, taxas de produtos e regras previdenciárias.
6. Definir household, permissões e consentimento para o painel do casal.
