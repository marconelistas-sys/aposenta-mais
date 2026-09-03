# Sprint 4: cadastro e autenticação segura

## Objetivo

Definir e implementar a base de identidade do Aposenta+ sem enviar o plano financeiro ao servidor. A Sprint não deve armazenar senhas ou tokens de sessão no `localStorage`.

## Decisões P0

1. Provedor escolhido: Supabase Auth no plano Free para desenvolvimento e MVP inicial.
2. O backend Node acessa a API Auth. Tokens permanecem em cookies `HttpOnly`.
3. Definir controlador, contato de privacidade, base legal e termos aplicáveis.
4. Definir como dados locais serão migrados para uma conta somente após consentimento explícito.
5. Aprovar o modelo de ameaças para cadastro, login, sessão e recuperação de acesso.

## Histórias da Sprint

### US-001: criar conta

Como usuário, quero criar uma conta com e-mail verificado para proteger meu plano e permitir acesso futuro.

Critérios de aceite:

- O sistema valida e normaliza o e-mail no servidor.
- O cadastro não revela se um e-mail já existe além do necessário para o fluxo.
- O sistema exige verificação do endereço antes de liberar dados financeiros.
- Se a solução gerenciar senhas, usa hash resistente e parâmetros atuais. Senhas nunca são registradas em logs.
- O usuário aceita os termos e recebe acesso ao aviso de privacidade vigente.

### US-023: autenticar-se

Como usuário cadastrado, quero entrar com segurança e encerrar minhas sessões.

Critérios de aceite:

- A sessão usa cookie `HttpOnly`, `Secure` e `SameSite`, sem token no armazenamento local.
- O servidor aplica proteção contra CSRF quando necessária.
- Tentativas recebem limitação por conta e origem, com resposta que evita enumeração de usuários.
- O logout invalida a sessão no servidor e remove o cookie.
- A futura sincronização deverá verificar o proprietário em todo acesso a plano e cenário.

### US-024: recuperar acesso

Como usuário, quero recuperar o acesso sem expor minha conta.

Critérios de aceite:

- A resposta é a mesma para e-mails existentes e inexistentes.
- O token é aleatório, curto, de uso único e armazenado de forma protegida.
- A troca de senha invalida sessões anteriores conforme a política definida.
- Eventos relevantes entram na trilha de auditoria sem dados financeiros ou segredos.

### US-025: proteger a conta

Como usuário, quero acompanhar e reforçar a segurança da minha conta.

Critérios de aceite:

- O produto documenta autenticação multifator como bloqueador da beta.
- A gestão de múltiplas sessões fica registrada para a próxima etapa.
- Mudanças de e-mail, senha e MFA exigem confirmação reforçada.
- Alertas de segurança não expõem dados do plano.

## Requisitos técnicos mínimos

- TLS em todos os ambientes com dados reais.
- Segredos somente no servidor e em serviço próprio para segredos.
- Criptografia em repouso para banco e backups, com gestão de chaves documentada.
- Consultas e comandos parametrizados.
- Validação de entrada e autorização no servidor.
- Logs sem senha, token, cookie ou conteúdo financeiro.
- Retenção e exclusão cobrindo banco, auditoria e backups.
- Dependências verificadas e atualizadas por processo definido.

## Testes obrigatórios

- Cadastro, verificação, login, logout e recuperação.
- Autorização horizontal entre dois usuários quando o plano for sincronizado.
- Expiração, revogação e rotação de sessão.
- Limitação de tentativas e resistência a enumeração.
- CSRF, XSS e injeção nos pontos de entrada.
- Exclusão de conta e dados, incluindo tratamento de backups.
- Migração local somente após confirmação do usuário.

## Fora do escopo desta entrega

- Integração com Meu INSS ou Open Finance.
- Login social adicional.
- Recomendações financeiras personalizadas.
- Importação automática dos dados locais para uma conta.
- Sincronização do plano com PostgreSQL e autorização horizontal de dados financeiros.
- MFA e gestão de múltiplas sessões.
- Exclusão administrativa da conta Supabase.

## Resultado da implementação

- Cadastro, confirmação, login, logout, recuperação e troca de senha implementados.
- Sessão renovável em cookies protegidos, sem token no `localStorage`.
- Origem validada em operações mutáveis.
- Limitação de tentativas aplicada a cadastro, login e recuperação.
- Limitação combinada por endereço e hash SHA-256 do e-mail normalizado.
- Troca de senha encerra todas as sessões e exige novo login.
- Cookies malformados são descartados sem interromper a aplicação.
- Interface informa quando o Supabase ainda não foi configurado.
- Testes usam respostas simuladas e não exigem uma conta paga.

## Definition of Done

- Arquitetura e modelo de ameaças revisados.
- Contrato da API versionado.
- Testes automatizados aprovados em integração contínua.
- Revisão de segurança local sem achados críticos ou altos.
- Aviso de privacidade atualizado antes da coleta remota.
- Procedimento de incidentes, exclusão e recuperação documentado.
