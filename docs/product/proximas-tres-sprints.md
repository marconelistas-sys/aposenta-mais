# Ciclo de três sprints: revisão, cenários e cópias

## Sprint A: revisão acionável

Permitir confirmar saldos de abertura e origem das contribuições no ponto em que a verificação aparece. Exigir confirmação explícita e manter avisos informativos separados. Recalcular sem alterar valores ou prazos.

Aceite: confirmação reduz apenas a verificação correspondente. Texto explica a origem de financiamento selecionada. Privacidade continua ocultando os detalhes.

## Sprint B: cenários consistentes

Preservar todas as premissas familiares ao editar um cenário. Distribuir alterações de patrimônio e aporte pelos investimentos de forma consistente com a projeção e a persistência. Editar cenários salvos sem substituir o plano principal. Comparar premissas em tabela e respeitar a privacidade dos gráficos.

Aceite: cenário salvo e reaberto reproduz a simulação, mantém dados do cônjuge, taxas individuais e retornos anuais. Atualizar cenário não cria outra cópia nem altera o plano principal.

## Sprint C: conferência das cópias

Adicionar comparação explícita entre o plano do navegador e a cópia do destino selecionado, com diferenças por grupo de dados. Informar que a comparação não salva nem restaura. Impedir aplicação de resultados de comparação após troca de conta, destino ou dados locais.

Aceite: leitura não modifica plano nem cópia. Comparação cobre todo o conteúdo financeiro, ignora apenas metadados de atualização e preferências visuais. Privacidade não revela valores.

## Execução

Os testes usam dados sintéticos. A validação de interface usa HTML renderizado e testes de comportamento. Nenhuma instância de servidor será deixada aberta ao final.

## Resultado

As três entregas foram implementadas e integradas.

- Sprint A: as duas confirmações têm checkbox obrigatório, texto contextual e botão no Dashboard e na avaliação anual. Confirmar recalcula sem mudar valores ou marcar a outra premissa.
- Sprint B: cenário em edição tem contexto próprio de moeda e orçamento. Salvar atualiza seu identificador sem duplicar nem substituir o plano principal. O formulário conserva os dados familiares, taxas individuais e retornos anuais. Mudanças de patrimônio e aporte são distribuídas na carteira. Quando não havia distribuição de aporte, um item de aporte com taxa padrão mantém a hipótese do motor. O novo mês de aposentadoria acompanha o orçamento do cenário. Uma tabela compara patrimônio, aporte, idade e renda desejada. Gráficos e progressos deixam de ser renderizados com privacidade.
- Sprint C: o Perfil oferece Comparar com o plano deste navegador quando existe cópia salva. O resultado lista grupos diferentes, sem valores individuais. A assinatura compara os dados financeiros normalizados e ignora o timestamp principal e preferências visuais. A comparação é descartada se conta, destino ou dados locais mudarem durante a leitura. Atualizar, restaurar ou apagar a cópia limpa a comparação anterior.

Validação: 487 testes passaram, incluindo oito novos testes de confirmação, cenário, persistência, privacidade e respostas assíncronas. Sintaxe, build e `git diff --check` passaram. Não houve migração, troca de credenciais ou gravação em Supabase nesta entrega. Nenhum servidor foi iniciado nesta sessão.

A comparação é um retrato da cópia consultada, não sincronização contínua nem mesclagem automática. A validação da interface usou HTML e testes, sem inspeção em navegador.
