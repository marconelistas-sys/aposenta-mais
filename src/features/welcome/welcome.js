import { authState } from '../../app/auth-state.js'
export function renderWelcome() {
  return `<section class="panel welcome-card" aria-labelledby="welcome-title">
    <p class="eyebrow">SEU PLANEJAMENTO</p><h1 id="welcome-title">Do orçamento de hoje à aposentadoria.</h1>
    <p>Comece pelo que entra e sai, inclua o patrimônio que você já tem e confira o que pode investir para o futuro.</p>
    <ol class="planning-steps"><li><strong>Objetivo</strong><p>Defina quando pretende se aposentar e a renda desejada.</p></li><li><strong>Orçamento</strong><p>Informe receitas, despesas e quando elas começam ou terminam.</p></li><li><strong>Patrimônio inicial</strong><p>Inclua o que já acumulou e os aportes futuros, sem contar o mesmo saldo duas vezes.</p></li><li><strong>Visão completa</strong><p>Compare o orçamento com a projeção da aposentadoria.</p></li></ol>
    <div class="welcome-actions"><button class="button button--primary" type="button" data-start-guided>Construir meu plano passo a passo</button><button class="button button--secondary" type="button" data-open-local>Reabrir plano deste navegador</button></div>
    <p>${authState.authenticated ? 'Você abre somente o plano local da conta conectada. O plano de visitante fica separado.' : 'Modo visitante. O plano de visitante pode ser reaberto por quem usa este navegador.'}</p>
    ${authState.authenticated ? '<button type="button" class="button button--secondary" data-copy-guest>Copiar meu plano de visitante para esta conta</button>' : ''}
    <details><summary>Como meus dados são guardados?</summary><p>Cada conta possui um espaço local separado. Login não transfere o plano de visitante. A cópia exige confirmação e só ocorre se a conta ainda não tiver um plano próprio. Sair fecha a visualização e retira o plano da conta da memória da aplicação. Os arquivos locais não são cifrados. A separação pela interface não impede acesso aos arquivos do navegador em dispositivo compartilhado.</p><p>Para remover informações deste dispositivo, reabra o plano e use Perfil e dados para exportar e apagar os dados locais do espaço atual. A cópia remota e o plano de visitante têm exclusão separada.</p></details>
  </section>`
}
