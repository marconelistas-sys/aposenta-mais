# Inventário de dados do protótipo

| Categoria | Classificação | Origem | Exemplos | Finalidade | Retenção e eliminação |
| --- | --- | --- | --- | --- | --- |
| Plano financeiro | dado pessoal financeiro | usuário | idade, patrimônio, aporte, renda alvo, benefício esperado | calcular a projeção | local até exclusão pelo usuário ou navegador |
| Carteira de investimentos | dado pessoal financeiro | usuário | nome escolhido, classe, saldo, aporte, tipo de taxa, rendimento e referência do CDI por investimento | calcular a projeção de cada saldo e explicar o impacto dos rendimentos | local e na cópia remota até a exclusão correspondente |
| Fluxo de caixa | dado pessoal financeiro | usuário | lançamentos planejados ou realizados, descrições, valores, moedas, categorias, frequências, prazos, mês consultado, mês de aposentadoria confirmado, vínculos de término de receitas e reserva | calcular saldo, desvios e aporte sustentável | local até exclusão pelo usuário ou navegador |
| Arquivo de extrato | dado pessoal financeiro | usuário | texto com datas, descrições e valores | revisar e criar lançamentos locais | lido na memória do navegador até confirmar ou cancelar, sem upload ou retenção do arquivo original |
| Premissas | dado pessoal inferido para o plano | usuário | retorno real, inflação esperada, taxa de retirada e idade de aposentadoria | converter taxas e executar cenários | local até exclusão pelo usuário ou navegador |
| Cenários | dado pessoal financeiro e metadado | usuário e aplicação | nome, data, plano, orçamento e moeda | comparar e restaurar alternativas | local até exclusão pelo usuário ou navegador |
| Moedas e categorias | dado financeiro contextual | usuário | BRL, EUR, USD, CHF e categorias personalizadas | classificar e consolidar montantes | local e na cópia remota até a exclusão correspondente |
| Cotação cambial | dado público | Banco Central Europeu | taxa, data, fonte e horário de consulta | converter totais para a moeda da visão geral | cache no servidor por seis horas e cópia junto ao estado financeiro |
| Preferências | dado de uso local | usuário e aplicação | ocultar valores, lembrete, período do gráfico | personalizar a interface | local até exclusão pelo usuário ou navegador |
| Metadados técnicos | dado técnico local | aplicação | versão, modo de demonstração, última atualização | validar e migrar o estado | local até exclusão pelo usuário ou navegador |
| Identidade | dado pessoal | usuário e Supabase Auth | e-mail, identificador de usuário, confirmação | criar e identificar a conta | projeto Supabase conforme política aprovada |
| Autenticação | credencial e metadado de segurança | usuário, aplicação e Supabase Auth | hash de senha no provedor, tokens, endereço de rede, eventos de acesso | autenticar, renovar e proteger a sessão | projeto Supabase conforme política aprovada |
| Cópia financeira remota | dado pessoal financeiro | usuário e aplicação | moedas, cotação, categorias, plano, fluxo de caixa e até três cenários | permitir restauração manual em outro dispositivo | PostgreSQL do Supabase até exclusão remota; exclusão da conta ainda depende de processo administrativo |
| Consentimento de sincronização | metadado de conformidade | usuário e aplicação | versão e data do consentimento | registrar a autorização da cópia remota | mesma linha da cópia financeira até exclusão remota ou da conta |

O Supabase processa identidade, autenticação e a cópia financeira autorizada como fornecedor técnico. O documento financeiro não contém e-mail, senha ou token, mas fica vinculado ao identificador da conta e não é anônimo. A cópia depende de consentimento explícito. A eliminação local e a exclusão remota são ações separadas. O servidor consulta somente o arquivo público de cotações do BCE. Ele não encaminha lançamentos, identificadores de conta ou conteúdo financeiro.

## Chaves técnicas

- Histórico local: `aposenta-plus-data-history-v1`, até três documentos financeiros sanitizados e 50 eventos contendo operação, resultado e data. Não enviado na sincronização. Removido na exclusão local ou pelo controle de histórico no Perfil.

- Atual: `aposenta-plus-state-v9`.
- Legadas durante migração: `aposenta-plus-state-v8`, `aposenta-plus-state-v7`, `aposenta-plus-state-v6`, `aposenta-plus-state-v5`, `aposenta-plus-state-v4`, `aposenta-plus-state-v3`, `aposenta-plus-state-v2` e `aposenta-plus-state-v1`.
- Marcador técnico sem dados financeiros: `aposenta-plus-deleted-v1`. Mantém a tela vazia após a exclusão até o usuário escolher carregar a demonstração.

O protótipo não coleta nome civil, CPF, dados do Meu INSS ou dados por API do Open Finance. O importador lê o TXT no navegador, mostra a prévia e persiste apenas os lançamentos confirmados. A senha passa pelo backend, que a encaminha ao Supabase Auth sem persistir ou registrar seu conteúdo no código atual.
