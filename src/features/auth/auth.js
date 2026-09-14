import { authState } from '../../app/auth-state.js'
import { escapeHtml } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'

function unavailableMessage() {
  return authState.configured === false
    ? '<div class="auth-notice" role="status">O serviço de login está indisponível. Confira se o aplicativo está em execução.</div>'
    : ''
}

function authShell(title, description, content, benefits = '') {
  return `
    <section class="auth-layout${benefits ? ' auth-layout--benefits' : ''}">
      <div class="panel auth-card">
        <div class="auth-card__icon">${icon('lock', 24)}</div>
        <p class="eyebrow">CONTA APOSENTA+</p>
        <h1>${title}</h1>
        <p class="auth-description">${description}</p>
        ${unavailableMessage()}
        ${content}
        <div class="auth-feedback" data-auth-feedback aria-live="polite"></div>
      </div>
      ${benefits}
    </section>
  `
}

export function renderLogin() {
  if (authState.authenticated) {
    return authShell('Você já está conectado.', `Sessão ativa para ${escapeHtml(authState.user?.email || '')}.`, '<a class="button button--primary button--full" href="/perfil" data-route>Abrir meu perfil</a>')
  }
  if (authState.provider === 'local' && authState.registrationRequired) {
    return authShell('Crie seu acesso local.', 'Ainda não existe uma conta neste computador. Contas do Supabase não são transferidas automaticamente.', '<a class="button button--primary button--full" href="/cadastro" data-route>Criar conta local</a><p>Você pode usar o mesmo e-mail. Defina a senha no cadastro e guarde o código de recuperação.</p>')
  }
  return authShell('Entre na sua conta.', authState.provider === 'local' ? 'Use o e-mail e a senha da conta criada neste computador.' : 'Use seu e-mail confirmado para acessar sua conta.', `
    <form class="auth-form" data-auth-form="login">
      ${authState.localAvailable ? `<label>Entrar com<select name="provider" data-login-provider><option value="supabase" ${authState.loginProvider !== 'local' ? 'selected' : ''}>Supabase</option><option value="local" ${authState.loginProvider === 'local' ? 'selected' : ''}>Login local</option></select></label><p>Login local funciona apenas para contas habilitadas no Perfil deste computador.</p>` : '<input type="hidden" name="provider" value="supabase">'}
      <label>E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required /></label>
      <label>Senha<input name="password" type="password" autocomplete="current-password" maxlength="128" required /></label>
      <button class="button button--primary button--full" type="submit">Entrar</button>
    </form>
    <div class="auth-links">
      <a href="/recuperar-senha" data-route>Esqueci minha senha</a>
      <a href="/cadastro" data-route>Criar conta</a>
    </div>
  `)
}

export function renderRegister() {
  const local = authState.provider === 'local'
  return authShell('Crie sua conta.', local ? 'Crie uma conta neste computador. O e-mail identifica seu acesso e não precisa de confirmação por mensagem.' : 'Você receberá um e-mail para confirmar o endereço.', `
    <form class="auth-form" data-auth-form="register">
      <label>E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required /></label>
      <label>Senha<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required aria-describedby="password-help" /></label>
      <p id="password-help" class="field-help">Use pelo menos 12 caracteres. Evite senhas reutilizadas.</p>
      <p class="registration-privacy">Leia o <a href="/privacidade" data-route>aviso de privacidade</a>. ${local ? 'Seu acesso fica no banco deste computador. Guarde o código de recuperação exibido após o cadastro. Ele será necessário se você esquecer a senha.' : 'O cadastro envia seu e-mail e dados de autenticação ao nosso serviço de login, mas não envia seu plano financeiro.'}</p>
      <label class="checkbox-row"><input name="acceptedTerms" type="checkbox" required /><span>Entendi que esta é uma versão experimental e desejo criar a conta.</span></label>
      <button class="button button--primary button--full" type="submit">Criar conta</button>
    </form>
    <div class="auth-links"><a href="/entrar" data-route>Já tenho uma conta</a></div>
  `, `
    <aside class="register-benefits" aria-labelledby="register-benefits-title">
      <span class="premium-badge">Conta gratuita</span>
      <p class="eyebrow">SEU PLANO COM CONTINUIDADE</p>
      <h2 id="register-benefits-title">Comece individual. Prepare o planejamento a dois.</h2>
      <ul>
        <li>${icon('download', 19)}<div><strong>${local ? 'Cópia no banco deste computador' : 'Cópia remota sob seu controle'}</strong><span>${local ? 'Salve e restaure o plano pelo perfil.' : 'Você decide quando enviar seus dados.'}</span></div></li>
        <li>${icon('user', 19)}<div><strong>${local ? 'Recuperação por código' : 'Acesso em outros dispositivos'}</strong><span>${local ? 'Guarde o código fora do aplicativo.' : 'Restaure sua cópia quando precisar.'}</span></div></li>
        <li>${icon('target', 19)}<div><strong>Pronto para o futuro Premium</strong><span>Planejamento familiar está em preparação.</span></div></li>
      </ul>
      <p class="premium-trust">${icon('shield', 16)} ${local ? 'A conta e a cópia do plano ficam neste computador.' : 'Criar conta não envia dados financeiros automaticamente.'}</p>
    </aside>
  `)
}

export function renderRecovery() {
  if (authState.provider === 'local' || authState.loginProvider === 'local') return authShell('Recupere seu acesso.', 'Use o código que você guardou ao criar a conta neste computador.', `
    <form class="auth-form" data-auth-form="recover">
      <label>E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required /></label>
      <label>Código de recuperação<input name="recoveryCode" type="password" autocomplete="off" spellcheck="false" autocapitalize="none" maxlength="256" required /></label>
      <label>Nova senha<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /></label>
      <label>Confirmar nova senha<input name="passwordConfirmation" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /></label>
      <button class="button button--primary button--full" type="submit">Redefinir senha</button>
    </form>
    <p>Este modo usa o código de recuperação, sem envio de e-mail.</p>
    <div class="auth-links"><a href="/entrar" data-route>Voltar ao login</a></div>
  `)
  return authShell('Recupere seu acesso.', 'Enviaremos instruções se o endereço estiver cadastrado.', `
    <form class="auth-form" data-auth-form="recover">
      <label>E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required /></label>
      <button class="button button--primary button--full" type="submit">Enviar instruções</button>
    </form>
    <div class="auth-links"><a href="/entrar" data-route>Voltar ao login</a></div>
  `)
}

export function renderNewPassword() {
  if (authState.provider === 'local') return renderRecovery()
  return authShell('Defina uma nova senha.', 'A sessão de recuperação precisa estar válida.', `
    <form class="auth-form" data-auth-form="password">
      <label>Nova senha<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /></label>
      <label>Confirmar senha<input name="passwordConfirmation" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /></label>
      <button class="button button--primary button--full" type="submit">Atualizar senha</button>
    </form>
  `)
}
