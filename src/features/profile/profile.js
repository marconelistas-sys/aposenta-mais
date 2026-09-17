import { migrationReview } from '../../domain/review-targets.js'
import { renderDataOverview } from './data-overview.js'
import { state } from '../../app/state.js'
import { dataHistory, operationLabels } from '../../app/data-history.js'
import { authState } from '../../app/auth-state.js'
import { syncState } from '../../app/sync-state.js'
import { escapeHtml, formatUpdateTime } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'
import { migrationStatus } from '../../domain/migration-review.js'

function renderFinappImport() {
  const migration = state.cashFlow.finappMigration
  return `<section class="panel settings-card"><h2>Importar arquivo de outro sistema</h2><p>No modo Adicionar: Não substitui registros existentes nem envia dados para a nuvem. No modo Substituir, remove do plano ativo os registros anteriores, contas, movimentos e cenários, mantendo uma versão de recuperação. Outras contas e a cópia salva da conta não são alteradas.</p><p>Use Completar para combinar os dados do casal: inclui faltantes, conserva edições atuais e não duplica automaticamente possíveis correspondências. Primeiro confira a tabela, depois confirme a aplicação. Exporte um backup e confira o LEIA-ME. Em Adicionar, registros idênticos são ignorados e conflitos bloqueiam a importação. Em Substituir, prevalece o arquivo, sem misturar os cadastros anteriores.</p>${authState.authenticated ? `<form data-finapp-import><label class="form-field"><span>Arquivo aposenta-finapp-import.json</span><input type="file" name="file" accept=".json,application/json" required /></label><label class="form-field"><span>Como importar</span><select name="mode"><option value="complete">Completar faltantes e preservar a conta atual</option><option value="merge">Adicionar e preservar registros existentes</option><option value="replace">Substituir registros pelo finapp</option><option value="horizon">Atualizar somente a idade-alvo do horizonte</option></select></label><div data-finapp-review></div><p data-finapp-status role="status">A prévia identifica a conta, as remoções e as pendências antes de confirmar.</p><button type="submit" class="button button--secondary">Conferir arquivo e importar</button></form>` : '<p>Entre na conta de destino para importar.</p>'}${migration ? `<h3>Revisão da migração</h3><p>Revise idade desejada e mês de aposentadoria, categorias e rendimentos no Plano. Metas anuais são provisões, não pagamentos confirmados. Bens restritos aparecem no gráfico de risco, sem gerar caixa.</p><a href="/plano" data-route>Revisar plano</a> · <a href="/calendario" data-route>Revisar metas</a> · <a href="/riscos" data-route>Revisar bens e gráfico</a><h3>Pendências sem efeito financeiro automático</h3>${(() => { const status = migrationStatus(state); return `<ul>${state.valuesHidden ? '<li>Mostre os valores para consultar os registros e os motivos da importação.</li>' : status.open.map(({ row, index }) => { const detail = migrationReview(row, index); return `<li id="${detail.anchor}" tabindex="-1"><strong>${escapeHtml(detail.label)}</strong><p>${escapeHtml(row.reason)}</p><p>Este registro ficou para revisão naquela importação. Compare com os cadastros atuais antes de incluir valores, para evitar duplicidade.</p><a href="${detail.destination}" data-route>Revisar cadastro de ${escapeHtml(detail.label)}</a> <button type="button" class="button button--secondary" data-resolve-migration="${escapeHtml(row.table)}:${row.id}">Já está no cadastro, marcar como resolvida</button>${!row.record || typeof row.record !== 'object' ? '' : `<details class="disclosure" data-migration-original><summary>Dados originais de ${escapeHtml(detail.label)}</summary><dl>${Object.entries(row.record).map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join('')}</dl></details>`}</li>` }).join('') || '<li>Nenhuma pendência aberta.</li>'}</ul>${status.resolved.length && !state.valuesHidden ? `<details class="disclosure"><summary>Pendências resolvidas (${status.resolved.length})</summary><ul>${status.resolved.map(({ row, index, how, note }) => { const detail = migrationReview(row, index); return `<li><strong>${escapeHtml(detail.label)}</strong><p>${escapeHtml(note)}</p>${how === 'manual' ? `<button type="button" class="text-button" data-reopen-migration="${escapeHtml(row.table)}:${row.id}">Reabrir pendência</button>` : ''}</li>` }).join('')}</ul></details>` : ''}` })()}` : ''}</section>`
}

export function renderProfile() {
  const history = dataHistory.read()
  const local = (authState.storageProvider || authState.provider) === 'local'
  const copy = local ? 'cópia no banco deste computador' : 'cópia remota'
  const historyLabel = operation => local ? ({ restore: 'Cópia do banco restaurada', upload: 'Cópia salva no banco', remote_delete: 'Cópia do banco excluída' }[operation] || operationLabels[operation]) : operationLabels[operation]
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
          ${authState.authenticated && syncState.exists ? `<button class="button button--secondary" type="button" data-sync-pull>Restaurar ${copy}</button>` : ''}
          ${authState.authenticated && syncState.exists ? `<button class="button button--danger-ghost" type="button" data-sync-delete>Excluir ${copy}</button>` : ''}
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

    ${renderDataOverview()}
    <section class="profile-layout">
      <aside class="panel profile-summary">
        <div class="profile-avatar">AP</div>
        <h2>${state.isDemo ? 'Plano de demonstração' : 'Meu plano'}</h2>
        <p>Plano pessoal</p>
        <span class="profile-status">Em uso neste navegador</span>
      </aside>

      <div class="profile-settings">
        <details class="disclosure" open><summary>Conta</summary>
        <section class="panel settings-card">
          <div class="panel__header">
            <div><p class="eyebrow">CONTA</p><h2>${authState.authenticated ? 'Sessão ativa' : local ? 'Conta neste computador' : 'Acesso entre dispositivos'}</h2></div>
            ${icon('user', 21, 'panel__header-icon')}
          </div>
          ${authState.authenticated ? `
            <div class="account-status">
              <div><strong>${escapeHtml(authState.user?.email || '')}</strong><p>${local ? 'Conta gerenciada neste computador. Use a seção de cópia abaixo para guardar seu plano no banco local. Mantenha seu código de recuperação em lugar seguro.' : 'Login gerenciado pelo nosso serviço de autenticação. Seus dados financeiros só são enviados quando você autoriza uma cópia remota.'}</p></div>
              <button class="button button--secondary" type="button" data-auth-logout>${icon('logout', 17)} Sair</button>
            </div>
          ` : `
            <div class="account-status">
              <div><strong>Nenhuma conta conectada</strong><p>${local ? 'Crie uma conta para salvar uma cópia do plano no banco deste computador e restaurá-la quando precisar.' : 'Crie uma conta grátis para acessar sua cópia em outros dispositivos. O cadastro não envia seus dados financeiros automaticamente.'}</p></div>
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

        ${authState.authenticated ? `<section class="panel settings-card"><h2>Banco de dados e login local</h2>
          <p>Seu acesso atual usa ${authState.provider === 'local' ? 'login local' : 'Supabase'}. A cópia do plano é manual e pode ser mantida neste computador.</p>
          ${authState.localEnabled ? `<form data-storage-provider-form><label>Sincronizar com <select name="provider"><option value="supabase" ${local ? '' : 'selected'} ${authState.provider === 'local' ? 'disabled' : ''}>Supabase</option><option value="local" ${local ? 'selected' : ''}>Banco local SQLite</option></select></label><button type="submit" class="button button--secondary">Usar banco selecionado</button></form><p>Login local habilitado. Na próxima entrada, selecione Login local. Para acessar a nuvem, entre novamente pelo Supabase.</p>` : authState.provider !== 'local' ? `<form data-enable-local-form><p>Ative uma senha local para esta mesma conta. Copiaremos seu plano salvo no Supabase. Se não existir uma cópia remota, usaremos o plano deste navegador.</p><label>Senha para login local<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><label>Confirmar senha local<input name="passwordConfirmation" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><label><input name="consent" type="checkbox" required> Autorizo copiar meu plano para o banco deste computador e habilitar login local.</label><button class="button button--primary" type="submit">Ativar banco e login locais</button></form>` : ''}
          <p data-local-settings-feedback role="status"></p></section>` : ''}
        ${authState.authenticated ? `
          <section class="panel settings-card sync-card">
            <div class="panel__header">
              <div><p class="eyebrow">${local ? 'CÓPIA NO COMPUTADOR' : 'SINCRONIZAÇÃO OPCIONAL'}</p><h2>${local ? 'Cópia no banco deste computador' : 'Cópia entre dispositivos'}</h2></div>
              ${icon('download', 21, 'panel__header-icon')}
            </div>
            ${syncState.loading || syncState.available === null ? `
              <p class="sync-message">Consultando sua ${copy}.</p>
            ` : syncState.available === false ? `
              <p class="sync-message sync-message--error">${escapeHtml(syncState.error || 'A sincronização ainda não está disponível.')}</p>
              <button class="button button--secondary sync-refresh" type="button" data-sync-refresh>Tentar novamente</button>
            ` : `
              <div class="sync-status">
                <div>
                  <strong>${syncState.exists ? (local ? 'Cópia disponível no banco deste computador' : 'Cópia remota disponível') : (local ? 'Nenhuma cópia no banco deste computador' : 'Nenhuma cópia remota')}</strong>
                  <p>${syncState.exists ? `Atualizada em ${formatUpdateTime(syncState.updatedAt)}.` : 'Seus dados continuam apenas neste navegador.'}</p>
                </div>
                <span class="profile-status">${syncState.exists ? 'Cópia disponível' : 'Sem cópia neste destino'}</span>
              </div>
              <form class="sync-consent-form" id="profile-save-copy" tabindex="-1" data-sync-consent-form>
                <button class="button button--secondary" type="button" data-sync-refresh>${local ? 'Consultar cópia no banco' : 'Consultar versão remota'}</button>
                <label class="checkbox-row">
                  <input name="acceptedSyncConsent" type="checkbox" required />
                  <span>${local ? 'Autorizo salvar uma cópia completa do plano financeiro, titularidade dos lançamentos, resumos de extratos, vínculos de pagamentos do calendário e dados importados no banco deste computador, vinculada à minha conta. Posso restaurar ou excluir essa cópia aqui. A cópia do banco e os dados deste navegador são separados.' : 'Autorizo enviar e armazenar na nuvem uma cópia do plano, inflação esperada, investimentos e suas taxas informadas, lançamentos manuais ou importados, sua titularidade, resumos de análises de extratos e recorrências, contas, conciliações e vínculos de pagamentos do calendário, dívidas, amortizações, consórcios, hipóteses de lances e risco, metas periódicas, bens não financeiros, dados financeiros pendentes de revisão da migração, prazos, categorias, cenários, moedas e cotação usada, vinculada à minha conta. Posso excluir essa cópia aqui. A exclusão remota não apaga os dados deste navegador.'}</span>
                </label>
                <button class="button button--primary" type="submit">${syncState.exists ? (local ? 'Atualizar cópia no banco' : 'Atualizar cópia remota') : (local ? 'Salvar cópia no banco' : 'Criar cópia remota')}</button>
              </form>
              ${syncState.exists ? `
                <div class="data-actions sync-actions">
                  <button class="button button--secondary" type="button" data-sync-pull>${local ? 'Restaurar do banco neste navegador' : 'Usar cópia remota neste dispositivo'}</button>
                  <button class="button button--danger-ghost" type="button" data-sync-delete>Excluir ${copy}</button>
                </div>
              ` : ''}
              <p class="privacy-shortcut">${local ? 'A cópia é manual. Apagar os dados do navegador não exclui a cópia do banco. Exporte também um arquivo para guardar fora deste computador.' : 'A sincronização é manual. Entrar na conta não envia seus dados automaticamente.'}</p>
            `}
          </section>
        ` : ''}
        </details>

        <details class="disclosure"><summary>Dados, histórico e importação</summary>
        ${renderFinappImport()}
        <section class="panel settings-card">
          <h2>Histórico e recuperação</h2>
          <p>Até três versões anteriores à restauração e 50 operações ficam neste navegador. A exclusão local também remove esse histórico.</p>
          <ul>${history.snapshots.map(item => `<li>${escapeHtml(formatUpdateTime(item.at))} <button class="button button--secondary" type="button" data-recover-version="${escapeHtml(item.id)}">Recuperar versão</button></li>`).join('') || '<li>Nenhuma versão para recuperar.</li>'}</ul>
          <h3>Operações de dados</h3>
          <p>Registro local de uso. Exportar prepara um arquivo, sem confirmar que ele foi salvo. Solicitações formais ao controlador continuam pendentes de canal definido.</p>
          <ul>${history.events.slice().reverse().map(event => `<li>${escapeHtml(formatUpdateTime(event.at))}: ${historyLabel(event.operation)} (${event.result === 'success' ? 'concluído' : 'falhou'})</li>`).join('') || '<li>Nenhuma operação registrada.</li>'}</ul>
          <a class="button button--secondary" href="/carteira" data-route>Corrigir investimentos</a>
          <a class="button button--secondary" href="/orcamento" data-route>Corrigir lançamentos</a>
          <button class="button button--secondary" type="button" data-clear-history>Apagar histórico e versões</button>
          <button class="button button--secondary" type="button" data-export-history>Exportar registro de operações</button>
        </section>
        <section class="panel settings-card">
          <div class="panel__header">
            <div><p class="eyebrow">PRIVACIDADE</p><h2>Seus dados</h2></div>
            ${icon('shield', 21, 'panel__header-icon')}
          </div>
          <div class="data-explanation">
            ${icon('lock', 21)}
            <p>${local ? 'O plano em uso fica neste navegador. Sua conta e a cópia que você salva pelo perfil ficam no banco deste computador. Apagar somente os dados do navegador preserva a cópia do banco.' : 'Por padrão, este MVP salva plano, lançamentos, categorias, cenários, moedas e preferências neste navegador. Criar uma conta envia dados de acesso ao nosso serviço de login, mas não envia o plano financeiro. A cópia remota depende de ação e consentimento explícitos.'}</p>
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
        </details>

        <details class="disclosure"><summary>Preferências e ajuda</summary>
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
        <section class="panel settings-card settings-card--compact">
          <div class="settings-row">
            <div class="settings-row__icon">${icon('help', 20)}</div>
            <div><strong>Ajuda e atendimento</strong><p>Encontre respostas sobre o seu plano.</p></div>
            <button class="icon-button" type="button" data-help aria-label="Abrir ajuda">${icon('chevronRight', 19)}</button>
          </div>
        </section>
        </details>
      </div>
    </section>
  `
}
