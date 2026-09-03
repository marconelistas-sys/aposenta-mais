import { authState } from '../../app/auth-state.js'
import { escapeHtml } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'

function unavailableMessage() {
  return authState.configured === false
    ? '<div class="auth-notice" role="status">O Supabase Free ainda precisa ser conectado pelas variáveis do servidor.</div>'
    : ''
}

function authShell(title, description, content) {
  return `
    <section class="auth-layout">
      <div class="panel auth-card">
        <div class="auth-card__icon">${icon('lock', 24)}</div>
        <p class="eyebrow">CONTA APOSENTA+</p>
        <h1>${title}</h1>
        <p class="auth-description">${description}</p>
        ${unavailableMessage()}
        ${content}
        <div class="auth-feedback" data-auth-feedback aria-live="polite"></div>
      </div>
    </section>
  `
}

export function renderLogin() {
  if (authState.authenticated) {
    return authShell('Você já está conectado.', `Sessão ativa para ${escapeHtml(authState.user?.email || '')}.`, '<a class="button button--primary button--full" href="/perfil" data-route>Abrir meu perfil</a>')
  }
  return authShell('Entre na sua conta.', 'Use seu e-mail confirmado para acessar sua conta.', `
    <form class="auth-form" data-auth-form="login">
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
  return authShell('Crie sua conta.', 'Você receberá um e-mail para confirmar o endereço.', `
    <form class="auth-form" data-auth-form="register">
      <label>E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required /></label>
      <label>Senha<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required aria-describedby="password-help" /></label>
      <p id="password-help" class="field-help">Use pelo menos 12 caracteres. Evite senhas reutilizadas.</p>
      <label class="checkbox-row"><input name="acceptedTerms" type="checkbox" required /><span>Li o <a href="/privacidade" data-route>aviso de privacidade</a> e aceito os termos desta versão.</span></label>
      <button class="button button--primary button--full" type="submit">Criar conta</button>
    </form>
    <div class="auth-links"><a href="/entrar" data-route>Já tenho uma conta</a></div>
  `)
}

export function renderRecovery() {
  return authShell('Recupere seu acesso.', 'Enviaremos instruções se o endereço estiver cadastrado.', `
    <form class="auth-form" data-auth-form="recover">
      <label>E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required /></label>
      <button class="button button--primary button--full" type="submit">Enviar instruções</button>
    </form>
    <div class="auth-links"><a href="/entrar" data-route>Voltar ao login</a></div>
  `)
}

export function renderNewPassword() {
  return authShell('Defina uma nova senha.', 'A sessão de recuperação precisa estar válida.', `
    <form class="auth-form" data-auth-form="password">
      <label>Nova senha<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /></label>
      <label>Confirmar senha<input name="passwordConfirmation" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /></label>
      <button class="button button--primary button--full" type="submit">Atualizar senha</button>
    </form>
  `)
}
