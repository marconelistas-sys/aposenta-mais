import { state } from '../../app/state.js'
import { dataHistory, operationLabels } from '../../app/data-history.js'
import { authState } from '../../app/auth-state.js'
import { syncState } from '../../app/sync-state.js'
import { escapeHtml, formatUpdateTime } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'

function renderFinappImport() {
  const migration = state.cashFlow.finappMigration
  return `<section class="panel settings-card"><h2>Importar arquivo do finapp</h2><p>No modo Adicionar: Não substitui registros existentes nem envia dados ao Supabase. No modo Substituir, remove do plano ativo os registros anteriores, contas, movimentos e cenários, mantendo uma versão de recuperação. Outras contas e a cópia remota não são alteradas.</p><p>Exporte um backup e confira o LEIA-ME. Em Adicionar, registros idênticos são ignorados e conflitos bloqueiam a importação. Em Substituir, prevalece o arquivo, sem misturar os cadastros anteriores.</p>${authState.authenticated ? `<form data-finapp-import><label class="form-field"><span>Arquivo aposenta-finapp-import.json</span><input type="file" name="file" accept=".json,application/json" required /></label><label class="form-field"><span>Como importar</span><select name="mode"><option value="merge">Adicionar e preservar registros existentes</option><option value="replace">Substituir registros pelo finapp</option><option value="horizon">Atualizar somente a idade-alvo do horizonte</option></select></label><p data-finapp-status role="status">A prévia identifica a conta, as remoções e as pendências antes de confirmar.</p><button type="submit" class="button button--secondary">Conferir arquivo e importar</button></form>` : '<p>Entre na conta de destino para importar.</p>'}${migration ? `<h3>Revisão da migração</h3><p>Revise idade desejada e mês de aposentadoria, categorias e rendimentos no Plano. Metas anuais são provisões, não pagamentos confirmados. Bens restritos aparecem no gráfico de risco, sem gerar caixa.</p><a href="/plano" data-route>Revisar plano</a> · <a href="/calendario" data-route>Revisar metas</a> · <a href="/riscos" data-route>Revisar bens e gráfico</a><h3>Pendências sem efeito financeiro automático</h3><ul>${migration.pending.map(row => `<li>${escapeHtml(row.table)} #${row.id}: ${escapeHtml(row.reason)}${state.valuesHidden ? '' : `<details><summary>Dados originais</summary><pre>${escapeHtml(JSON.stringify(row.record, null, 2))}</pre></details>`}</li>`).join('') || '<li>Nenhuma pendência registrada.</li>'}</ul>` : ''}</section>`
}

export function renderProfile() {
  const history = dataHistory.read()
  if (state.dataDeleted) {
    return `
      <section class="empty-data panel">
        ${renderFinappImport()}
        ${icon('shield', 28)}
        <p class="eyebrow">DADOS APAGADOS</p>
        <h1>Este navegador não tem um plano salvo.</h1>
        <p>Seu plano, seu fluxo de caixa, seus cenários e suas preferências foram removidos. Carregue a demonstração somente se quiser explorar o produto novamente.</p>
        <div class="data-actions">
          <button class="button button--primary" type="button" data-reset-data>Carregar demonstração</button>
          ${authState.authenticated && syncState.exists ? '<button class="button button--secondary" type="button" data-sync-pull>Restaurar cópia remota</button>' : ''}
          ${authState.authenticated && syncState.exists ? '<button class="button button--danger-ghost" type="button" data-sync-delete>Excluir cópia remota</button>' : ''}
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
        ${renderFinappImport()}
        <section class="panel settings-card">
          <h2>Histórico e recuperação</h2>
          <p>Até três versões anteriores à restauração e 50 operações ficam neste navegador. A exclusão local também remove esse histórico.</p>
          <ul>${history.snapshots.map(item => `<li>${escapeHtml(formatUpdateTime(item.at))} <button class="button button--secondary" type="button" data-recover-version="${escapeHtml(item.id)}">Recuperar versão</button></li>`).join('') || '<li>Nenhuma versão para recuperar.</li>'}</ul>
          <h3>Operações de dados</h3>
          <p>Registro local de uso. Exportar prepara um arquivo, sem confirmar que ele foi salvo. Solicitações formais ao controlador continuam pendentes de canal definido.</p>
          <ul>${history.events.slice().reverse().map(event => `<li>${escapeHtml(formatUpdateTime(event.at))}: ${operationLabels[event.operation]} (${event.result === 'success' ? 'concluído' : 'falhou'})</li>`).join('') || '<li>Nenhuma operação registrada.</li>'}</ul>
          <a class="button button--secondary" href="/carteira" data-route>Corrigir investimentos</a>
          <a class="button button--secondary" href="/fluxo-caixa" data-route>Corrigir lançamentos</a>
          <button class="button button--secondary" type="button" data-clear-history>Apagar histórico e versões</button>
          <button class="button button--secondary" type="button" data-export-history>Exportar registro de operações</button>
        </section>
        <section class="panel settings-card">
          <div class="panel__header">
            <div><p class="eyebrow">CONTA</p><h2>${authState.authenticated ? 'Sessão ativa' : 'Acesso entre dispositivos'}</h2></div>
            ${icon('user', 21, 'panel__header-icon')}
          </div>
          ${authState.authenticated ? `
            <div class="account-status">
              <div><strong>${escapeHtml(authState.user?.email || '')}</strong><p>Autenticação gerenciada pelo Supabase. Seus dados financeiros só são enviados quando você autoriza uma cópia remota.</p></div>
              <button class="button button--secondary" type="button" data-auth-logout>${icon('logout', 17)} Sair</button>
            </div>
          ` : `
            <div class="account-status">
              <div><strong>Nenhuma conta conectada</strong><p>Crie uma conta grátis para acessar sua cópia em outros dispositivos. O cadastro não envia seus dados financeiros automaticamente.</p></div>
              <div class="account-actions">
                ${authState.configured === false ? '' : '<a class="button button--primary" href="/cadastro" data-route data-product-event="create_account_click">Criar conta grátis</a>'}
                <a class="button button--secondary" href="/entrar" data-route>Já tenho conta</a>
              </div>
            </div>
          `}
        </section>

        ${authState.authenticated ? `
          <section class="panel settings-card profile-premium-card">
            <div>
              <div class="premium-label-row">
                <p class="eyebrow">APOSENTA+ PREMIUM</p>
                <span class="premium-badge">Em breve</span>
              </div>
              <h2>Inclua quem planeja a vida financeira com você.</h2>
              <p>Organizem o orçamento da casa e comparem as metas do casal em um só painel.</p>
            </div>
            <a class="button button--secondary" href="/premium" data-route data-product-event="premium_view">Conhecer o Premium</a>
          </section>
        ` : ''}

        ${authState.authenticated ? `
          <section class="panel settings-card sync-card">
            <div class="panel__header">
              <div><p class="eyebrow">SINCRONIZAÇÃO OPCIONAL</p><h2>Cópia entre dispositivos</h2></div>
              ${icon('download', 21, 'panel__header-icon')}
            </div>
            ${syncState.loading || syncState.available === null ? `
              <p class="sync-message">Consultando sua cópia remota.</p>
            ` : syncState.available === false ? `
              <p class="sync-message sync-message--error">${escapeHtml(syncState.error || 'A sincronização ainda não está disponível.')}</p>
              <button class="button button--secondary sync-refresh" type="button" data-sync-refresh>Tentar novamente</button>
            ` : `
              <div class="sync-status">
                <div>
                  <strong>${syncState.exists ? 'Cópia remota disponível' : 'Nenhuma cópia remota'}</strong>
                  <p>${syncState.exists ? `Atualizada em ${formatUpdateTime(syncState.updatedAt)}.` : 'Seus dados continuam apenas neste navegador.'}</p>
                </div>
                <span class="profile-status"><i></i> ${syncState.exists ? 'Ativa' : 'Local'}</span>
              </div>
              <form class="sync-consent-form" data-sync-consent-form>
                <button class="button button--secondary" type="button" data-sync-refresh>Consultar versão remota</button>
                <label class="checkbox-row">
                  <input name="acceptedSyncConsent" type="checkbox" required />
                  <span>Autorizo enviar e armazenar no Supabase uma cópia do plano, inflação esperada, investimentos e suas taxas informadas, lançamentos manuais ou importados, contas e conciliações, dívidas, amortizações, consórcios, hipóteses de lances e risco, metas periódicas, bens não financeiros, dados financeiros pendentes de revisão da migração, prazos, categorias, cenários, moedas e cotação usada, vinculada à minha conta. Posso excluir essa cópia aqui. A exclusão remota não apaga os dados deste navegador.</span>
                </label>
                <button class="button button--primary" type="submit">${syncState.exists ? 'Atualizar cópia remota' : 'Criar cópia remota'}</button>
              </form>
              ${syncState.exists ? `
                <div class="data-actions sync-actions">
                  <button class="button button--secondary" type="button" data-sync-pull>Usar cópia remota neste dispositivo</button>
                  <button class="button button--danger-ghost" type="button" data-sync-delete>Excluir cópia remota</button>
                </div>
              ` : ''}
              <p class="privacy-shortcut">A sincronização é manual. Entrar na conta não envia seus dados automaticamente.</p>
            `}
          </section>
        ` : ''}

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
            <p>Por padrão, este MVP salva plano, lançamentos, categorias, cenários, moedas e preferências neste navegador. Criar uma conta envia dados de acesso ao Supabase, mas não envia o plano financeiro. A cópia remota depende de ação e consentimento explícitos.</p>
          </div>
          <div class="data-actions">
            <button class="button button--secondary" type="button" data-export-data>${icon('download', 17)} Exportar meus dados</button>
            <button class="button button--danger-ghost" type="button" data-reset-data>Restaurar dados de exemplo</button>
          </div>
          <div class="danger-zone">
            <div>
              <strong>Apagar dados deste navegador</strong>
              <p>Você pode exportar uma cópia antes de remover plano, lançamentos, categorias, cenários, moedas e preferências deste navegador.</p>
            </div>
            <button class="button button--danger" type="button" data-delete-data>Apagar dados deste navegador</button>
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
