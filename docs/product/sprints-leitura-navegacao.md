# Três sprints de usabilidade: valores e navegação

## Sprint 1: valores sem quebra de linha

Remover quebra interna dos indicadores monetários, incluindo cockpit, marcos, resultado anual, comparação patrimonial e valores dos gráficos. Manter moeda, sinal e centavos juntos. Ajustar a fonte à largura disponível sem abreviar nem alterar o valor. Quando o valor continuar maior que o espaço, permitir rolagem somente no próprio campo, com acesso por teclado. Preservar os cálculos e as máscaras de edição.

## Sprint 2: menu com ícones e nomes

Usar ícones no menu principal de desktop, mantendo os nomes das telas. Diferenciar Carteira, Fluxo de caixa e Patrimônio. Organizar o cabeçalho para que ícones adicionais não comprimam os controles de conta e privacidade. Manter a indicação de página atual e o foco visível.

## Sprint 3: navegação completa no celular

Adicionar menu expansível com telas principais e ferramentas, incluindo Contas, Extratos, Calendário, Consórcios, Viabilidade, Riscos, Câmbio e Perfil. Manter os atalhos inferiores do celular. Mostrar a tela atual, limitar a altura do menu à tela e permitir navegação por teclado. Escape fecha o menu e retorna o foco ao controle de abertura. Navegar ou mover o foco para fora também fecha o menu.

## Implementação e limites

As três sprints foram implementadas. O ajuste de valores acompanha redimensionamento, abertura de detalhes e conteúdo inserido na tela. Observadores e trabalho pendente são descartados ao trocar a página ou a conta. O modo de valores ocultos não inicia medições. O ajuste preserva os números completos e usa fonte mínima de 14 pixels para indicadores maiores, sem ampliar textos que já eram menores.

O menu usa uma expansão nativa com links comuns, ícones decorativos e rótulos visíveis. Em telas muito estreitas, o controle superior de abertura mantém apenas o ícone, com nome acessível. Os nomes das telas continuam visíveis dentro do menu. A navegação financeira continua indisponível quando o plano está fechado.

Nenhum servidor foi iniciado, nenhum dado financeiro foi alterado e nenhuma sincronização externa foi executada. A inspeção visual em navegador real permanece pendente. Os testes de interação usam DOM simulado.

## Validação

`npm run validate` aprovado, com 533 testes e build concluído. Oito testes novos cobrem ajuste de fonte, preservação do texto exato, rolagem por teclado, valores ocultos, descarte de observadores, abertura de detalhes, ícones e rótulos, acesso às telas, indicação da página atual e fechamento do menu. O plano fechado continua sem navegação financeira.
