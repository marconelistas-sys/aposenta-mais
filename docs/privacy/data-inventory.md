# Inventário de dados do protótipo

| Categoria | Classificação | Origem | Exemplos | Finalidade | Retenção e eliminação |
| --- | --- | --- | --- | --- | --- |
| Plano financeiro | dado pessoal financeiro | usuário | idade, patrimônio, aporte, renda alvo, benefício esperado | calcular a projeção | local até exclusão pelo usuário ou navegador |
| Fluxo de caixa | dado pessoal financeiro | usuário | receitas, despesas, dívidas, gastos anuais e reserva de emergência | calcular saldo e aporte sustentável | local até exclusão pelo usuário ou navegador |
| Premissas | dado pessoal inferido para o plano | usuário | retorno real, taxa de retirada, idade de aposentadoria | executar cenários | local até exclusão pelo usuário ou navegador |
| Cenários | dado pessoal financeiro e metadado | usuário e aplicação | nome, data e cópia do plano | comparar alternativas | local até exclusão pelo usuário ou navegador |
| Preferências | dado de uso local | usuário e aplicação | ocultar valores, lembrete, período do gráfico | personalizar a interface | local até exclusão pelo usuário ou navegador |
| Metadados técnicos | dado técnico local | aplicação | versão, modo de demonstração, última atualização | validar e migrar o estado | local até exclusão pelo usuário ou navegador |
| Identidade | dado pessoal | usuário e Supabase Auth | e-mail, identificador de usuário, confirmação | criar e identificar a conta | projeto Supabase conforme política aprovada |
| Autenticação | credencial e metadado de segurança | usuário, aplicação e Supabase Auth | hash de senha no provedor, tokens, endereço de rede, eventos de acesso | autenticar, renovar e proteger a sessão | projeto Supabase conforme política aprovada |

O plano financeiro não é compartilhado. Quando a conta está configurada, identidade e autenticação são processadas pelo Supabase. A eliminação local usa as ações do perfil ou os controles do navegador. A exclusão da conta remota ainda precisa de um fluxo administrativo antes da beta.

## Chaves técnicas

- Atual: `aposenta-plus-state-v3`.
- Legadas durante migração: `aposenta-plus-state-v2` e `aposenta-plus-state-v1`.
- Marcador técnico sem dados financeiros: `aposenta-plus-deleted-v1`. Mantém a tela vazia após a exclusão até o usuário escolher carregar a demonstração.

O protótipo não coleta nome civil, CPF, dados do Meu INSS ou dados de Open Finance. A senha segue diretamente para o Supabase Auth pelo backend e nunca deve entrar nos logs da aplicação.
