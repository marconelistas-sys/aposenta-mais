# Sprint 12: edição segura de lançamentos

## Objetivo

Permitir correções no orçamento sem excluir e recriar lançamentos.

## Por que esta sprint vem agora

A Sprint 11 separou planejado e realizado. Essa classificação aumenta a necessidade de corrigir categoria, valor, data e natureza depois da importação ou do cadastro manual. A edição era a próxima prioridade funcional P1 do roadmap.

As prioridades P0 de privacidade e Supabase continuam antes da beta pública. Elas dependem de decisões do controlador e de acesso ao ambiente hospedado.

## Entrega

- Ação Editar em cada lançamento.
- Janela acessível com os valores atuais.
- Edição de categoria, descrição, valor, moeda, natureza, frequência e datas.
- Validação pelas mesmas regras usadas na inclusão e importação.
- Preservação do identificador e da posição do lançamento.
- Preservação da origem de itens importados.
- Itens importados permanecem realizados.
- Um realizado exige data e representa uma ocorrência eventual.
- Recalculo imediato do orçamento, comparativo e projeção.

## Critérios de aceite

1. Salvar uma edição não pode criar um segundo lançamento.
2. O identificador não pode mudar.
3. Um item importado não pode ser convertido em planejado.
4. Uma edição inválida não pode alterar o estado existente.
5. Cancelar deve fechar a janela sem salvar.
6. A interface deve funcionar em telas estreitas.

## Continuidade entregue

A Sprint 13 criou a etapa de revisão antes da importação. O usuário vê as colunas reconhecidas, corrige o mapeamento e remove duplicidades antes de confirmar os lançamentos.
