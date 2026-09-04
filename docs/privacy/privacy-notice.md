# Aviso de privacidade do protótipo

## Resumo

O Aposenta+ mantém o plano financeiro e o fluxo de caixa no armazenamento local do navegador. Quando a conta está ativada, o Supabase processa e-mail, credenciais, identificadores técnicos e sessão para cadastro, login, confirmação e recuperação de acesso. Dados financeiros não são enviados ao Supabase nesta Sprint.

## O que é armazenado e por quê

- Idade, patrimônio, aporte, renda desejada e premissas para calcular projeções.
- Receitas recorrentes e eventuais, despesas, dívidas, gastos anuais e reserva de emergência para calcular o fluxo de caixa.
- Cenários para permitir comparações.
- Preferências de visibilidade, lembrete e gráfico para manter a experiência escolhida.
- E-mail e dados técnicos de autenticação para criar e proteger a conta quando o Supabase estiver configurado.

## Onde e por quanto tempo

Plano, fluxo de caixa, cenários e preferências ficam no perfil do navegador usado. Permanecem até o usuário escolher “Apagar meus dados”, limpar os dados do site ou remover o perfil do navegador. Dados de identidade e autenticação ficam no projeto Supabase conforme a configuração de retenção do serviço. Não há sincronização de dados financeiros entre dispositivos nesta Sprint.

## Controles do usuário

O perfil permite exportar uma cópia JSON e apagar os dados locais. A exclusão local é irreversível. Restaurar a demonstração é uma ação separada. O logout encerra a sessão no navegador e solicita a revogação ao Supabase.

## Limites

Ocultar valores é uma escolha visual, não criptografia. Pessoas com acesso ao dispositivo, extensões e scripts executados na mesma origem podem alcançar o armazenamento local. Arquivos exportados ficam sob a guarda do usuário.

## Pendências antes de usuários reais

O controlador, o contato de privacidade, as bases legais, os prazos de retenção e o processo de atendimento aos direitos previstos na LGPD ainda devem ser definidos. A conta deve permanecer desativada publicamente até essa definição. Esta documentação não declara conformidade integral com a lei.
