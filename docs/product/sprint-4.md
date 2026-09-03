# Sprint 4: cadastro e autenticação segura

## Objetivo

Definir e implementar a base de identidade do Aposenta+ para que cada usuário acesse somente seus próprios dados. A Sprint não deve armazenar senhas ou tokens de sessão no `localStorage`.

## Decisões P0 antes da implementação

1. Escolher um provedor de identidade gerenciado ou justificar uma implementação própria.
2. Definir a API, o banco de dados, a hospedagem e a gestão de segredos.
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
- A autorização verifica o proprietário em todo acesso a plano e cenário.

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

- O produto oferece autenticação multifator ou documenta sua entrega como bloqueador da beta.
- O usuário visualiza e encerra sessões ativas.
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
- Autorização horizontal entre dois usuários.
- Expiração, revogação e rotação de sessão.
- Limitação de tentativas e resistência a enumeração.
- CSRF, XSS e injeção nos pontos de entrada.
- Exclusão de conta e dados, incluindo tratamento de backups.
- Migração local somente após confirmação do usuário.

## Fora do escopo até aprovação das decisões P0

- Integração com Meu INSS ou Open Finance.
- Login social adicional.
- Recomendações financeiras personalizadas.
- Importação automática dos dados locais para uma conta.

## Definition of Done

- Arquitetura e modelo de ameaças revisados.
- Contrato da API versionado.
- Testes automatizados aprovados em integração contínua.
- Revisão de segurança sem achados críticos ou altos.
- Aviso de privacidade atualizado antes da coleta remota.
- Procedimento de incidentes, exclusão e recuperação documentado.
