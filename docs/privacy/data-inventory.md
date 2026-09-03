# Inventário de dados do protótipo

| Categoria | Classificação | Origem | Exemplos | Finalidade | Retenção e eliminação |
| --- | --- | --- | --- | --- | --- |
| Plano financeiro | dado pessoal financeiro | usuário | idade, patrimônio, aporte, renda alvo, benefício esperado | calcular a projeção | local até exclusão pelo usuário ou navegador |
| Premissas | dado pessoal inferido para o plano | usuário | retorno real, taxa de retirada, idade de aposentadoria | executar cenários | local até exclusão pelo usuário ou navegador |
| Cenários | dado pessoal financeiro e metadado | usuário e aplicação | nome, data e cópia do plano | comparar alternativas | local até exclusão pelo usuário ou navegador |
| Preferências | dado de uso local | usuário e aplicação | ocultar valores, lembrete, período do gráfico | personalizar a interface | local até exclusão pelo usuário ou navegador |
| Metadados técnicos | dado técnico local | aplicação | versão, modo de demonstração, última atualização | validar e migrar o estado | local até exclusão pelo usuário ou navegador |

Nenhuma categoria é compartilhada pela aplicação. A eliminação usa as ações do perfil ou os controles do navegador.

## Chaves técnicas

- Atual: `aposenta-plus-state-v2`.
- Legada durante migração: `aposenta-plus-state-v1`.
- Marcador técnico sem dados financeiros: `aposenta-plus-deleted-v1`. Mantém a tela vazia após a exclusão até o usuário escolher carregar a demonstração.

O protótipo não coleta nome civil, CPF, e-mail, senha, dados do Meu INSS ou dados de Open Finance.
