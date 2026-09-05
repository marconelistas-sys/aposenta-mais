# Arquitetura inicial

O MVP usa uma SPA estática, um motor financeiro isolado da interface e um backend Node pequeno para autenticação, cópia remota e cotação pública.

## Princípios

- O motor financeiro é determinístico e testável.
- A inteligência artificial não produz os valores oficiais das projeções.
- Cada lançamento preserva BRL, EUR, USD ou CHF como moeda original.
- O dashboard converte totais para a moeda escolhida com taxa, fonte e data visíveis.
- O importador interpreta arquivos TXT no navegador, mantém a prévia em memória e não envia o arquivo original.
- O orçamento separa itens planejados e realizados por competência. O aporte sustentável usa apenas o planejado.
- Cada receita ou despesa pode ter início e fim. O motor considera somente itens ativos no mês calculado.
- Contribuições previdenciárias entram no orçamento como despesas e no patrimônio como aportes programados.
- A integração cambial ocorre no servidor e consulta somente o endpoint fixo do BCE.
- O cache de seis horas reduz dependência externa e a última taxa oficial permite operação degradada.
- Toda evolução futura da API deve versionar entradas, premissas e algoritmo.
- Dados financeiros permanecem locais por padrão.
- O login não dispara sincronização.
- A cópia remota depende de consentimento e ação explícitos.
- O token da sessão acessa o PostgREST e a RLS limita cada usuário à própria linha.
- A conexão direta ao Open Finance depende de uma instituição receptora participante e consentimento próprio.

## Evolução planejada

1. Validar a experiência e as fórmulas no navegador.
2. Usar o backend modular para autenticação e cópia opcional.
3. Validar PostgreSQL e RLS no projeto hospedado antes da ativação pública.
4. Definir conflitos e histórico antes de automatizar a sincronização.
5. Integrar serviços externos por adaptadores independentes de fornecedor.
6. Selecionar uma instituição receptora antes de oferecer conexão direta ao Open Finance.
