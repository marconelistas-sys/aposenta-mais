# Sprint: valores claros e transferências guiadas

## Planejamento

1. Padronizar a edição de dinheiro com duas casas, incluindo valores carregados após conversão e edição de registros existentes.
2. Aceitar colagem em formato brasileiro e valores decimais com ponto, preservar os limites dos campos e impedir que texto inválido seja convertido em zero.
3. Implementar a melhoria proposta pelo especialista de UX: transferências com campos contextuais, identificação das moedas e ajuda para valores recebidos.

## Implementação

Os campos de dinheiro usam teclado decimal e máscara brasileira ao perder o foco ou confirmar o formulário. A digitação não reposiciona o cursor a cada tecla. Valores com casas excedentes são arredondados para centavos, conforme a ajuda no campo. A camada de apresentação cobre abertura de formulários, edição, limpeza e leitura para salvamento. Taxas, câmbio, idades, quantidades e controles deslizantes mantêm seu tratamento.

Exemplos aceitos: `1.234,56`, `1234.56`, `R$ 1.234,56`, `-R$ 1.234,56` e `USD 1,234.56`. Pela convenção brasileira, `1.234` digitado representa mil duzentos e trinta e quatro. Para um valor decimal com casas excedentes, use vírgula, por exemplo `1,234`, que fica `1,23`. Números já armazenados são tratados como números, sem reinterpretar seus pontos decimais como milhares.

Vazio não equivale a zero nos campos obrigatórios. Limites mínimos e máximos continuam valendo, inclusive saldos negativos nos campos que os permitem. Campos desabilitados não bloqueiam a operação nem são enviados. A máscara não altera os dados persistidos ao abrir o formulário, nem arredonda os motores financeiros. A confirmação de edição salva o valor em centavos.

Reservas do orçamento e benefício do cônjuge deixam de exigir incrementos de 50. Saldos e movimentos bancários passam a usar centavos. A edição monetária abrange carteira, cenários, orçamento, contas, conciliação, metas, bens, dívidas, consórcios e sugestões de extratos.

## Transferências guiadas e revisão de UX

O especialista de UX propôs e revisou a melhoria. Entradas e saídas ocultam os campos de destino. Transferências mostram a moeda da origem e a moeda do valor recebido. Na mesma moeda, o valor recebido acompanha a origem e a interface explica por que não é editável. Em moedas diferentes, solicita o valor efetivamente recebido. A ajuda é associada ao campo e a configuração é reaplicada ao editar, limpar ou trocar o tipo.

Os textos de ajuda deixam explícito o arredondamento para centavos. A validação não depende apenas de cor. Campos monetários ocultos não recebem valores de edição no DOM.

## Validação

`npm run validate` aprovado com 525 testes e build concluído. Nove testes novos cobrem formatos monetários, arredondamento, entradas inválidas, classificação de campos, carregamento para edição, limites, campos desabilitados, eventos da máscara, privacidade e transferências. Os testes existentes de formulários continuam aprovados. `git diff --check` sem erros.

O especialista revisou a implementação no código. A interação foi testada com DOM simulado, sem inspeção visual no navegador. Nenhum servidor foi iniciado, nenhum dado real foi alterado e nenhuma sincronização externa foi executada nesta sprint. Recarregar a página aplica a nova interface.
