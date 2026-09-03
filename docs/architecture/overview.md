# Arquitetura inicial

O MVP usa uma aplicação web estática com um motor financeiro isolado da interface. Essa estrutura permite validar o produto sem criar dependências operacionais prematuras.

## Princípios

- O motor financeiro é determinístico e testável.
- A inteligência artificial não produz os valores oficiais das projeções.
- Valores em reais de hoje são o padrão de apresentação.
- Toda evolução futura da API deve versionar entradas, premissas e algoritmo.
- Dados financeiros permanecem locais no MVP atual.
- Open Finance fica fora do MVP inicial.

## Evolução planejada

1. Validar a experiência e as fórmulas no navegador.
2. Introduzir uma API modular quando autenticação e persistência forem necessárias.
3. Adotar PostgreSQL como fonte principal dos dados persistentes.
4. Integrar serviços externos por adaptadores independentes de fornecedor.

