# Aviso de privacidade do protótipo

## Resumo

O Aposenta+ mantém o plano financeiro e o fluxo de caixa no armazenamento local do navegador. A pessoa pode usar os cálculos sem informar nome, CPF ou e-mail. Isso não torna os dados anônimos. Quando uma conta é criada, o Supabase processa e-mail, credenciais, identificadores técnicos e sessão. Uma cópia financeira só é enviada após ação manual e consentimento explícito.

## O que é armazenado e por quê

- Idade, patrimônio, aporte, renda desejada e premissas para calcular projeções.
- Nome escolhido, classe, saldo, aporte, forma do rendimento e taxa informada de cada investimento para calcular a carteira e explicar o impacto dos rendimentos.
- Lançamentos de receitas e despesas com descrição, valor, moeda, categoria, frequência e prazo para calcular o fluxo de caixa.
- Dados reconhecidos em extratos TXT escolhidos pelo usuário. O arquivo é lido localmente e não é enviado ao servidor.
- Cenários com plano, orçamento e moeda para permitir comparação e restauração.
- Taxa pública, fonte e data do Banco Central Europeu para converter os totais na visão geral.
- Categorias personalizadas para organizar o orçamento.
- Preferências de visibilidade, lembrete e gráfico para manter a experiência escolhida.
- E-mail e dados técnicos de autenticação para criar e proteger a conta quando o Supabase estiver configurado.
- Versão e data do consentimento para demonstrar a autorização da cópia remota.

## Onde e por quanto tempo

Plano, fluxo de caixa, cenários, moedas, categorias e preferências ficam no perfil do navegador usado. Permanecem até o usuário escolher “Apagar dados deste navegador”, limpar os dados do site ou remover o perfil do navegador. A cópia financeira autorizada fica no PostgreSQL do Supabase até o usuário escolher “Excluir cópia remota”. A exclusão da conta ainda depende de processo administrativo. Preferências visuais não entram na cópia remota.

O servidor consulta o arquivo público de taxas do BCE. Nenhum lançamento ou identificador de conta é enviado nessa consulta. A fotografia cambial usada no cálculo acompanha a exportação e a cópia remota para permitir conferência.

Não existe conexão direta com Open Finance nesta versão. Uma integração futura deverá iniciar no ambiente da instituição receptora, informar a finalidade e obter consentimento antes do compartilhamento.

## Controles do usuário

O perfil permite exportar uma cópia JSON, apagar os dados deste navegador, criar ou atualizar uma cópia remota, restaurar essa cópia e excluí-la. Excluir dados locais não exclui a cópia remota. Excluir a cópia remota não altera os dados locais. O logout encerra a sessão, mas não exclui dados.

Pedidos de confirmação, acesso, correção, portabilidade, revogação ou exclusão serão recebidos pelo canal público do controlador. A declaração completa de acesso será fornecida em até 15 dias. O procedimento operacional está em `docs/privacy/beta-readiness.md`.

## Limites

Ocultar valores é uma escolha visual, não criptografia. Pessoas com acesso ao dispositivo, extensões e scripts executados na mesma origem podem alcançar o armazenamento local. Quando existe cópia remota, ela é vinculada ao identificador da conta e não é anônima. O Supabase processa autenticação e cópia remota como fornecedor técnico. Arquivos exportados ficam sob a guarda do usuário.

## Pendências antes de usuários reais

As bases legais, a retenção e o processo de direitos foram propostos em `docs/privacy/beta-readiness.md`. O controlador, o canal de privacidade e a aprovação jurídica ainda exigem decisão do responsável. A produção bloqueia contas e sincronização até essa aprovação e a validação da migration hospedada. Esta documentação não declara conformidade integral com a lei.
