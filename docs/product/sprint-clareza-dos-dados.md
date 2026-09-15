# Sprint: clareza do plano e das cópias

## Objetivo

Permitir que a pessoa identifique os dados exibidos no aplicativo, confira a cópia do banco e compreenda a direção de salvar e restaurar.

## Avaliação do agente de UX

A avaliação considerou o código do Perfil, o fluxo de comparação e o relato de uso. Após recuperar uma base, a pessoa continuou vendo registros de demonstração no navegador. Também precisou de orientação para salvar no banco remoto.

O Perfil usa os rótulos “Plano ativo” e “Cópia Ativa”, com indicadores verdes, sem mostrar os registros de cada origem. Esses rótulos não esclarecem se as duas versões contêm os mesmos dados. A data da cópia informa quando ela foi salva, mas não comprova igualdade com o plano exibido.

A melhoria prioritária é apresentar as duas origens antes dos formulários de conta e sincronização. A contagem dos cadastros permite reconhecer situações como 6 lançamentos no navegador e 40 na cópia, sem expor valores monetários.

## Escolha da interface gráfica

Usar dois cartões com mostradores numéricos e títulos explícitos: plano deste navegador e cópia no destino selecionado. Cada número deve manter seu rótulo visível, com unidade de cadastro e hierarquia tipográfica clara.

Um gauge circular de completude precisaria de uma meta ou denominador confiável. A quantidade de registros não mede qualidade, correção ou segurança da cópia. Por isso, este sprint usa readouts numéricos. O estado da comparação aparece em texto, sem percentual arbitrário.

## Plano de implementação

1. Adicionar o painel no topo do Perfil, próximo ao título da página.
2. Mostrar contagens do plano atual: lançamentos cadastrados, investimentos, metas e bens.
3. Vincular os cadastros atuais às telas de Orçamento, Carteira, Calendário e Riscos.
4. Identificar o plano de demonstração quando essa informação estiver disponível no estado.
5. Identificar o destino selecionado como banco deste computador ou Supabase.
6. Consultar o conteúdo da cópia mediante ação explícita de comparação. Antes dessa consulta, informar que as contagens são desconhecidas.
7. Exibir as contagens da cópia e o resultado financeiro da comparação, preservando os controles existentes de sessão e validade.
8. Explicar que salvar envia o plano do navegador ao banco e restaurar traz a cópia do banco ao navegador.
9. Manter o salvamento associado ao formulário de consentimento existente. O painel não envia dados automaticamente.

## Acessibilidade e layout

- Usar títulos que identifiquem cada origem e marcação semântica para os pares de rótulo e valor.
- Manter a ordem de leitura: plano atual, destino da cópia, comparação e ações.
- Em telas estreitas, empilhar os cartões e preservar rótulos completos, sem rolagem horizontal.
- Não depender de cor ou ícones para informar igualdade, diferença ou indisponibilidade.
- Permitir navegação por teclado, com foco visível nos links e botões.
- Reservar anúncios de status para o resultado da consulta, evitando anunciar repetidamente todas as contagens.
- Distinguir zero registros de conteúdo ainda não consultado.
- Quando os valores estiverem ocultos, esconder também as contagens e diferenças nos textos e atributos acessíveis.

## Critérios de aceitação

- Um plano com 40 lançamentos e 8 investimentos apresenta essas contagens, mesmo com filtros anuais ativos em outras telas.
- Os números representam cadastros, sem sugerir quantidade de ocorrências ou pagamentos no ano.
- Os links levam às telas correspondentes e funcionam por teclado.
- O destino aparece com seu nome concreto, sem confundir provedor de login com banco selecionado.
- Antes da comparação, o cartão da cópia informa que o conteúdo ainda não foi consultado. Não apresenta zero como substituto de informação desconhecida.
- Uma cópia disponível não é apresentada como sincronizada apenas por existir ou ter data recente.
- A igualdade depende da assinatura do conteúdo financeiro. Contagens iguais com valores distintos continuam indicando diferença.
- Alterar o plano, trocar a conta ou trocar o destino invalida uma comparação anterior.
- Falha de consulta não produz indicação de igualdade nem apaga os dados atuais.
- No modo de valores ocultos, as contagens não ficam expostas em texto, títulos ou atributos ARIA.
- Salvar e restaurar mantêm a direção da transferência explícita. O salvamento preserva o consentimento existente.
- O painel não altera o plano, o destino de armazenamento ou a cópia salva por conta própria.

## Validação prevista

Verificar os estados de demonstração, plano preenchido, zero registros, cópia não consultada, cópia indisponível, conteúdo igual e conteúdo diferente. Cobrir também privacidade, mudança de sessão e comparação invalidada após edição.

Inspecionar a disposição em desktop e celular, foco por teclado, legibilidade dos mostradores e textos de origem e destino. Este documento define o plano e os critérios. Não registra testes como executados.
