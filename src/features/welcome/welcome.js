export function renderWelcome() {
  return `<section class="panel welcome-card" aria-labelledby="welcome-title">
    <p class="eyebrow">SEU PLANEJAMENTO</p><h1 id="welcome-title">Do orçamento de hoje à aposentadoria.</h1>
    <p>Comece pelo que entra e sai, inclua o patrimônio que você já tem e confira o que pode investir para o futuro.</p>
    <ol class="planning-steps"><li><strong>Objetivo</strong><p>Defina quando pretende se aposentar e a renda desejada.</p></li><li><strong>Orçamento</strong><p>Informe receitas, despesas e quando elas começam ou terminam.</p></li><li><strong>Patrimônio inicial</strong><p>Inclua o que já acumulou e os aportes futuros, sem contar o mesmo saldo duas vezes.</p></li><li><strong>Visão completa</strong><p>Compare o orçamento com a projeção da aposentadoria.</p></li></ol>
    <div class="welcome-actions"><button class="button button--primary" type="button" data-start-guided>Construir meu plano passo a passo</button><button class="button button--secondary" type="button" data-open-local>Reabrir plano deste navegador</button></div>
    <details><summary>Como meus dados são guardados?</summary><p>O plano local pertence a este navegador, não à conta conectada. Login não transfere nem substitui o plano. Sair da conta fecha a visualização, mas não apaga os dados. Reabrir o plano exige uma ação explícita e não uma senha. Isso não protege os arquivos do navegador em um dispositivo compartilhado.</p><p>Para remover informações deste dispositivo, reabra o plano e use Perfil e dados para exportar e apagar os dados locais. A cópia remota tem exclusão separada.</p></details>
  </section>`
}
