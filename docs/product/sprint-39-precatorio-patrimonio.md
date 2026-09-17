# Sprint 39: Precatório e patrimônio visual

## Pedido

- Precatório de R$ 400.000, direito líquido e certo, parcela única até 31 de dezembro de 2027, já cadastrado como Fundos. O alerta da importação não é mais necessário.
- Tela de Patrimônio com gráficos que mostrem a distribuição.

## Diagnóstico

- O alerta vinha da pendência `one_time_flows` da importação do finapp: "Conversão de patrimônio em liquidez, não receita nova". Pendências importadas não tinham forma de resolução, então o aviso aparecia para sempre na Viabilidade e na Visão geral.
- A avaliação anual já libera saldos restritos no ano informado. A simulação mensal de risco ignorava esse ano e tratava o precatório como restrito para sempre.
- A tela de Patrimônio listava totais sem mostrar liquidez, direitos a receber, consórcios ou peso de cada item.

## Entregas

| Item | Entrega |
|---|---|
| P1 | Resolução automática: pendência de conversão de liquidez fica resolvida quando um investimento restrito tem ano de liberação. Mensagem registra qual investimento representa a conversão |
| P2 | Botão "Já está no cadastro, marcar como resolvida" em cada pendência do Perfil, com lista de resolvidas e opção de reabrir. A evidência original continua guardada |
| P3 | Viabilidade e Visão geral só mostram pendências abertas |
| P4 | Simulação mensal de risco libera o saldo em dezembro do ano informado |
| P5 | Diagnóstico da Carteira aponta saldo restrito, fora de previdência, sem ano de liberação |
| V1 | Patrimônio: número principal, bens e direitos, dívidas e disponível, barra de composição por liquidez com legenda de valor e percentual |
| V2 | "Quando vira dinheiro": barras por ano com o disponível hoje e cada liberação somada, mais cartão do direito a receber |
| V3 | Investimentos por classe em rosca, com a mesma cor por classe na Carteira e no Patrimônio |
| V4 | Ranking dos maiores itens com barra na cor do grupo de liquidez, e tabela completa recolhida |
| V5 | Consórcio (cota paga) e contas entram na composição |

## Como deixar o precatório correto no seu plano

1. Carteira, editar "Direito sobre precatório".
2. Liquidez: Restrita ou com prazo.
3. Ano previsto de liberação: 2027.
4. Salvar. A pendência da importação some e o Patrimônio mostra a liberação em 2027.

Se preferir não informar o ano, marque a pendência como resolvida no Perfil. Sem o ano, o plano não usa esse dinheiro para pagar despesas.

## Decisões

- Grupos de liquidez com ordem e cor fixas: disponível, a receber com data, previdência, restrito sem data, bens, consórcio.
- A liberação conta no fechamento do ano, igual à avaliação anual. Para "até 31/12/2027" é a leitura conservadora.
- Resolução manual não apaga a pendência importada. É uma marca reversível.

## Validação

- 725 testes aprovados, 4 novos.
- `npm run check` e `npm run build` aprovados.
- Navegador, desktop e celular, com carteira semelhante à do usuário: composição, liberação de 2027, rosca por classe, ranking e ausência do alerta na Viabilidade.
