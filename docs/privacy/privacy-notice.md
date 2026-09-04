# Aviso de privacidade do protótipo

## Resumo

O Aposenta+ mantém o plano financeiro e o fluxo de caixa no armazenamento local do navegador. Quando a conta está ativada, o Supabase processa e-mail, credenciais, identificadores técnicos e sessão. Uma cópia do plano, fluxo de caixa e cenários só é enviada após uma ação manual e consentimento explícito. O login não envia o documento financeiro.

## O que é armazenado e por quê

- Idade, patrimônio, aporte, renda desejada e premissas para calcular projeções.
- Receitas recorrentes e eventuais, despesas, dívidas, gastos anuais e reserva de emergência para calcular o fluxo de caixa.
- Cenários para permitir comparações.
- Preferências de visibilidade, lembrete e gráfico para manter a experiência escolhida.
- E-mail e dados técnicos de autenticação para criar e proteger a conta quando o Supabase estiver configurado.
- Versão e data do consentimento para demonstrar a autorização da cópia remota.

## Onde e por quanto tempo

Plano, fluxo de caixa, cenários e preferências ficam no perfil do navegador usado. Permanecem até o usuário escolher “Apagar meus dados”, limpar os dados do site ou remover o perfil do navegador. A cópia financeira autorizada fica no PostgreSQL do Supabase até o usuário escolher “Excluir cópia remota” ou excluir a conta. Preferências visuais não entram na cópia remota.

## Controles do usuário

O perfil permite exportar uma cópia JSON, apagar os dados locais, criar ou atualizar uma cópia remota, restaurar essa cópia e excluí-la. Excluir dados locais não exclui a cópia remota. Excluir a cópia remota não altera os dados locais. O logout encerra a sessão, mas não exclui dados.

## Limites

Ocultar valores é uma escolha visual, não criptografia. Pessoas com acesso ao dispositivo, extensões e scripts executados na mesma origem podem alcançar o armazenamento local. Arquivos exportados ficam sob a guarda do usuário.

## Pendências antes de usuários reais

O controlador, o contato de privacidade, a validação da base legal, os prazos de retenção e o processo de atendimento aos direitos previstos na LGPD ainda devem ser definidos. A sincronização deve permanecer desativada publicamente até essa definição e a validação da migração hospedada. Esta documentação não declara conformidade integral com a lei.
