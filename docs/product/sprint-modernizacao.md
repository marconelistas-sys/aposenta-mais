# Sprint de modernização

## Objetivo

Remover informações ilustrativas que poderiam contradizer o plano e permitir que o usuário trabalhe com dados próprios e cenários persistentes.

## Entregas

- Gráfico calculado a partir do motor financeiro.
- Estado local com versão, validação e recuperação segura.
- Banner para identificar dados de demonstração.
- Data real da última atualização.
- Simulação aplicável ao plano principal.
- Até três cenários persistentes para comparação.
- Lembrete local persistente.
- Confirmação antes de restaurar dados.
- Tratamento de divisões por zero e limites ARIA.

## Fora do escopo

- Autenticação.
- Backend e sincronização em nuvem.
- Open Finance e importação do CNIS.
- Recomendações de produtos financeiros.
- Monte Carlo.

## Critérios de aceite

- O gráfico termina no mesmo patrimônio calculado pelo motor.
- Dados inválidos no armazenamento não impedem a inicialização.
- O usuário pode salvar e excluir até três cenários.
- Uma simulação pode substituir o plano somente por ação explícita.
- Todos os testes e o build são aprovados.
- Nenhum arquivo da branch de origem é excluído.

