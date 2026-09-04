# Sprint 8: confiança, home simples e moeda base

## Objetivo

Simplificar a primeira leitura do dashboard, comunicar privacidade com fatos verificáveis e permitir que o plano opere em BRL, EUR, USD ou CHF.

## Decisão de produto

- A mensagem central prioriza resultado, próximo passo e estado dos dados.
- A home mostra três indicadores essenciais em vez de quatro.
- A proposta Premium familiar aparece depois da projeção financeira.
- O produto não chama dados identificáveis de anônimos.
- A interface diferencia uso local, conta sem cópia e cópia remota ativa.
- A moeda selecionada define formato e interpretação dos montantes.
- Trocar a moeda não converte números existentes.

## Histórias

- Como visitante, quero entender meu resultado antes de ver detalhes e ofertas.
- Como usuário cuidadoso, quero saber onde meus dados estão e quando são enviados.
- Como pessoa sem conta, quero usar o cálculo sem informar minha identidade.
- Como pessoa com conta, quero entender que meu e-mail identifica o acesso.
- Como usuário internacional, quero planejar em BRL, EUR, USD ou CHF.
- Como usuário com cópia remota, quero preservar a moeda junto aos dados financeiros.

## Critérios de aceite

- A primeira área contém um resultado principal, uma ação principal e uma secundária.
- O dashboard mostra três indicadores essenciais.
- O estado de privacidade corresponde a local, conta sem cópia ou cópia ativa.
- Cadastro e login não criam cópia financeira.
- Nenhum texto afirma que dados vinculados a uma conta são anônimos.
- Recursos do casal permanecem marcados como planejados ou “Em breve”.
- BRL, EUR, USD e CHF funcionam em cards, formulários, gráfico e valores ocultos.
- Planos antigos migram para BRL sem alterar montantes.
- A troca de moeda informa que não ocorreu conversão.
- Exportação, cópia remota e restauração preservam a moeda.
- O contrato remoto aceita somente os quatro códigos ISO previstos.
- Nenhuma cotação externa é consultada nesta sprint.
- A interface continua funcional a partir de 320 px.

## Riscos e limites

- Armazenamento local não é criptografia.
- A cópia remota fica vinculada ao identificador da conta.
- A validação operacional das políticas RLS no projeto hospedado continua pendente.
- Conversão entre moedas exige taxa, fonte e data. Ela não faz parte desta sprint.
- O futuro painel familiar não deve consolidar moedas diferentes sem regras de conversão auditáveis.

## Entrega

- Home reorganizada com hierarquia reduzida.
- Status de privacidade contextual.
- Conteúdo de privacidade revisado.
- Seletor persistente de moeda base.
- Migração do estado local para a versão 4.
- Moeda incluída na exportação e na cópia remota.
- Contrato OpenAPI atualizado.
- Testes de formatação, migração e comunicação.
