# Sprint 37: Correlação por par, câmbio na projeção e abas

## Origem

Pendências da [Sprint 36](sprint-36-abas-risco-exposicao.md) e correção relatada pelo usuário.

## Correção: categoria das provisões anuais

- Causa: provisões anuais não tinham campo de categoria. O motor gerava sempre "Outras despesas".
- Agora a provisão guarda `categoryId`. O diálogo do Orçamento e o cadastro em Calendário e dívidas oferecem as categorias de despesa, inclusive personalizadas.
- A categoria aparece no orçamento, na pressão dos gastos e nas composições anuais.
- Categoria inexistente ou de receita volta para "Outras despesas". A provisão nunca some do orçamento.
- Provisões antigas sem categoria continuam idênticas.

## Entregas

| Item | Entrega |
|---|---|
| F1 | Matriz de correlação por par de classes (caixa, renda fixa, previdência, fundos, ações, outros e novos saldos), editável e validada por Cholesky, nas simulações mensal e anual |
| F2 | Parcela exposta à moeda por investimento. Distribuição e alvos por moeda dividem o saldo entre a moeda estrangeira e a do plano. A simulação cambial parte dessa parcela |
| F3 | Tendência cambial real por moeda, opcional, aplicada à parcela exposta no retorno habitual. Afeta projeção, viabilidade e risco. Comparação "Sem a tendência cambial" no impacto dos rendimentos |
| U1 | Componente de abas reutilizável. Orçamento: Lançamentos, Pressão e acompanhamento, Importar extratos. Viabilidade e Após aposentadoria: Situação, Gráficos e conciliação, Ano a ano, Premissas |

## Decisões

- Referências de correlação são hipóteses educativas. Ações e fundos 0,7. Renda fixa e previdência 0,6. Caixa e ações 0.
- Correlações entre −0,95 e 0,95. Combinações incompatíveis são recusadas com mensagem clara.
- Planos salvos com a correlação única da sprint 36 viram matriz uniforme com o mesmo valor.
- Retorno com tendência = (1 + retorno líquido de custos) × (1 + tendência × parcela exposta) − 1.
- Retornos informados por ano não recebem custo nem tendência.
- Trocar a moeda do plano apaga as tendências, porque passam a medir outra relação.
- Nas páginas com abas novas, todos os painéis são renderizados e os inativos ficam ocultos. A troca é instantânea. Links de revisão abrem a aba certa antes de focar o campo.

## Validação

- 715 testes aprovados, 13 novos.
- `npm run check` e `npm run build` aprovados.
- Navegador: categoria da provisão alterada para Viagens e refletida na lista, abas do Orçamento e da Viabilidade com URL e teclado, atalho de importação abrindo a aba certa, exposição parcial na Carteira, tendência cambial no impacto, matriz de correlação e recusa de combinação incompatível.

## Pendências

1. Unificar as abas do Fluxo de caixa no componente reutilizável.
2. Tendência cambial também nos saldos de receitas e despesas em moeda estrangeira.
3. Categoria nas metas e dívidas do calendário.
4. Presets de correlação por perfil de carteira.
