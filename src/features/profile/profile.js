import { state } from '../../app/state.js'
import { icon } from '../../shared/icons.js'

export function renderProfile() {
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
            <p>Este MVP salva suas preferências apenas no navegador. Nenhuma informação é enviada para um servidor.</p>
          </div>
          <div class="data-actions">
            <button class="button button--secondary" type="button" data-export-data>${icon('download', 17)} Exportar meus dados</button>
            <button class="button button--danger-ghost" type="button" data-reset-data>Restaurar dados de exemplo</button>
          </div>
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
