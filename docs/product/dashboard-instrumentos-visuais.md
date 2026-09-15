# Dashboard com instrumentos visuais

## Decisão de UX

O especialista em UX revisou a proposta e o código. A aparência usa escalas, marcações e números legíveis, com quatro instrumentos. Não há score financeiro agregado nem velocímetro de probabilidade.

1. Cobertura até a data-alvo: uma faixa por ano, com o primeiro fechamento com insuficiência e a contagem dos fechamentos sem insuficiência.
2. Orçamento vigente: receitas e despesas em barras na mesma escala, com saldo mensal equivalente e referência ao mês consultado. Valores anuais são distribuídos por 12 meses.
3. Menor liquidez projetada: valor mínimo, ano e evolução, com o menor ponto destacado e referência zero.
4. Patrimônio considerado na data-alvo: valor líquido de todas as dívidas, evolução e indicação dos imóveis excluídos.

## Hierarquia

O veredito de sustentabilidade aparece antes dos instrumentos. O filtro de imóveis e o gráfico principal continuam visíveis. Marcos, comparação patrimonial, próximos passos e valores cadastrados ficam em seções recolhidas. A meta de renda complementar exige apenas uma expansão.

Cada instrumento tem texto equivalente ao visual e um link para revisar os dados correspondentes. O layout usa quatro colunas no desktop, duas em telas intermediárias e uma no celular. Não há animações contínuas.

## Cálculos e interpretação

Os instrumentos anuais reutilizam o mesmo resultado de `finappViability` exibido no veredito. O orçamento usa `calculateMultiCurrencyCashFlow` para a data atual, com lançamentos planejados, sem conciliação de saldos bancários.

Déficit mensal não implica insolvência. Patrimônio com imóveis não equivale a dinheiro disponível. A menor liquidez é o mínimo entre os fechamentos anuais, não entre todos os meses. O estado favorável da cobertura exige avaliação completa. Pendências mantêm o estado de revisão mesmo quando nenhum fechamento calculado apresenta insuficiência.

O filtro de imóveis afeta o instrumento patrimonial e preserva os instrumentos de orçamento e liquidez. As faixas temporais não representam probabilidade de sucesso. Períodos sem insuficiência após uma recuperação são contados como fechamentos individuais, sem esconder o primeiro ano de insuficiência.

## Privacidade e validação

Valores ocultos impedem a renderização dos instrumentos, incluindo proporções, trajetórias, anos críticos e estados financeiros. Os SVGs são decorativos e não substituem o texto. Os links têm alvo mínimo de 44 pixels e usam o foco visível do aplicativo.

A revisão de UX foi realizada no código. A inspeção visual e a navegação por teclado em navegador real não foram realizadas, pois a ferramenta de navegador não está disponível nesta sessão. Nenhum servidor foi iniciado e nenhum dado do usuário foi alterado nesta entrega.

`npm run validate` aprovado: 516 testes, sem falhas, e build concluído. Nove testes novos cobrem mínimo anual, déficit coberto, premissas incompletas, insuficiência financeira ou de liquidez, recuperação posterior, orçamento ausente, filtro de imóveis, escalas, privacidade, ausência de projeção e integração do Dashboard. `git diff --check` sem erros.
