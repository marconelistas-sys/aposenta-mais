# Arquitetura inicial

O MVP usa uma aplicação web estática com um motor financeiro isolado da interface. Essa estrutura permite validar o produto sem criar dependências operacionais prematuras.

## Princípios

- O motor financeiro é determinístico e testável.
- A inteligência artificial não produz os valores oficiais das projeções.
- Valores em reais de hoje são o padrão de apresentação.
- Toda evolução futura da API deve versionar entradas, premissas e algoritmo.
- Dados financeiros permanecem locais por padrão.
- O login não dispara sincronização.
- A cópia remota depende de consentimento e ação explícitos.
- O token da sessão acessa o PostgREST e a RLS limita cada usuário à própria linha.
- Open Finance fica fora do MVP inicial.

## Evolução planejada

1. Validar a experiência e as fórmulas no navegador.
2. Usar o backend modular para autenticação e cópia opcional.
3. Validar PostgreSQL e RLS no projeto hospedado antes da ativação pública.
4. Definir conflitos e histórico antes de automatizar a sincronização.
5. Integrar serviços externos por adaptadores independentes de fornecedor.
