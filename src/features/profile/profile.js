import { state } from '../../app/state.js'
import { authState } from '../../app/auth-state.js'
import { escapeHtml } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'

export function renderProfile() {
  if (state.dataDeleted) {
    return `
      <section class="empty-data panel">
        ${icon('shield', 28)}
        <p class="eyebrow">DADOS APAGADOS</p>
        <h1>Este navegador não tem um plano salvo.</h1>
        <p>Seu plano, seu fluxo de caixa, seus cenários e suas preferências foram removidos. Carregue a demonstração somente se quiser explorar o produto novamente.</p>
        <div class="data-actions">
          <button class="button button--primary" type="button" data-reset-data>Carregar demonstração</button>
          <a class="button button--secondary" href="/privacidade" data-route>Ver aviso de privacidade</a>
        </div>
      </section>
    `
  }

  return `
    <section class="page-heading page-heading--inner">
      <div>
        <p class="eyebrow">PERFIL E DADOS</p>
        <h1>Suas preferências, em um só lugar.</h1>
        <p>Controle a experiência e os dados salvos neste dispositivo.</p>
      </div>
    </section>

    <section class="profile-layout">
      <aside class="panel profile-summary">
        <div class="profile-avatar">AP</div>
        <h2>${state.isDemo ? 'Plano de demonstração' : 'Meu plano'}</h2>
        <p>Plano pessoal</p>
        <span class="profile-status"><i></i> Plano ativo</span>
      </aside>

      <div class="profile-settings">
        <section class="panel settings-card">
          <div class="panel__header">
            <div><p class="eyebrow">CONTA</p><h2>${authState.authenticated ? 'Sessão ativa' : 'Acesso entre dispositivos'}</h2></div>
            ${icon('user', 21, 'panel__header-icon')}
          </div>
          ${authState.authenticated ? `
            <div class="account-status">
              <div><strong>${escapeHtml(authState.user?.email || '')}</strong><p>Autenticação gerenciada pelo Supabase. O plano e o fluxo de caixa continuam locais nesta Sprint.</p></div>
              <button class="button button--secondary" type="button" data-auth-logout>${icon('logout', 17)} Sair</button>
            </div>
          ` : `
            <div class="account-status">
              <div><strong>Nenhuma conta conectada</strong><p>Entre ou crie uma conta. Seus dados financeiros não serão enviados ao Supabase nesta Sprint.</p></div>
              <a class="button button--primary" href="/entrar" data-route>Entrar</a>
            </div>
          `}
        </section>

        <section class="panel settings-card">
          <div class="panel__header">
            <div><p class="eyebrow">EXPERIÊNCIA</p><h2>Preferências</h2></div>
          </div>
          <div class="settings-row">
            <div class="settings-row__icon">${icon(state.valuesHidden ? 'eyeOff' : 'eye', 20)}</div>
            <div><strong>Ocultar valores por padrão</strong><p>Proteja seus números quando abrir o aplicativo.</p></div>
            <button class="switch ${state.valuesHidden ? 'is-active' : ''}" type="button" role="switch" aria-checked="${state.valuesHidden}" data-toggle-values aria-label="Ocultar valores por padrão"><span></span></button>
          </div>
          <div class="settings-row">
            <div class="settings-row__icon">${icon('bell', 20)}</div>
            <div><strong>Preferência de lembrete</strong><p>Salve sua escolha neste dispositivo. As notificações entram em uma próxima etapa.</p></div>
            <button class="switch ${state.reminderEnabled ? 'is-active' : ''}" type="button" role="switch" aria-checked="${state.reminderEnabled}" data-reminder aria-label="Ativar lembrete mensal"><span></span></button>
          </div>
        </section>

        <section class="panel settings-card">
          <div class="panel__header">
            <div><p class="eyebrow">PRIVACIDADE</p><h2>Seus dados</h2></div>
            ${icon('shield', 21, 'panel__header-icon')}
          </div>
          <div class="data-explanation">
            ${icon('lock', 21)}
            <p>Este MVP salva seu plano, seu fluxo de caixa, seus cenários e suas preferências apenas neste navegador. Nenhuma informação financeira é enviada para um servidor de aplicação.</p>
          </div>
          <div class="data-actions">
            <button class="button button--secondary" type="button" data-export-data>${icon('download', 17)} Exportar meus dados</button>
            <button class="button button--danger-ghost" type="button" data-reset-data>Restaurar dados de exemplo</button>
          </div>
          <div class="danger-zone">
            <div>
              <strong>Apagar meus dados</strong>
              <p>Você pode exportar uma cópia antes de remover plano, fluxo de caixa, cenários e preferências deste navegador.</p>
            </div>
            <button class="button button--danger" type="button" data-delete-data>Apagar meus dados</button>
          </div>
          <p class="privacy-shortcut"><a href="/privacidade" data-route>Leia o aviso de privacidade</a> antes de usar dados reais.</p>
        </section>

        <section class="panel settings-card settings-card--compact">
          <div class="settings-row">
            <div class="settings-row__icon">${icon('help', 20)}</div>
            <div><strong>Ajuda e atendimento</strong><p>Encontre respostas sobre o seu plano.</p></div>
            <button class="icon-button" type="button" data-help aria-label="Abrir ajuda">${icon('chevronRight', 19)}</button>
          </div>
        </section>
      </div>
    </section>
  `
}
