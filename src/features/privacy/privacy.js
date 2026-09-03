import { icon } from '../../shared/icons.js'

export function renderPrivacy() {
  return `
    <section class="page-heading page-heading--inner">
      <div>
        <p class="eyebrow">PRIVACIDADE</p>
        <h1>Seus dados ficam sob seu controle.</h1>
        <p>Entenda o que este protótipo guarda, por quê e como remover tudo.</p>
      </div>
    </section>

    <section class="privacy-grid">
      <article class="panel privacy-card privacy-card--highlight">
        ${icon('shield', 24)}
        <div>
          <h2>Resumo direto</h2>
          <p>O Aposenta+ não possui cadastro, login, servidor de aplicação, API ou banco de dados. Plano, cenários e preferências ficam no armazenamento local deste navegador e não são enviados pela aplicação.</p>
        </div>
      </article>

      <article class="panel privacy-card">
        <h2>Dados e finalidade</h2>
        <ul class="privacy-list">
          <li>Idade, patrimônio, aporte, renda desejada e premissas para calcular projeções.</li>
          <li>Cenários salvos para comparar alternativas.</li>
          <li>Preferências visuais e de lembrete para personalizar a experiência.</li>
        </ul>
      </article>

      <article class="panel privacy-card">
        <h2>Armazenamento e retenção</h2>
        <p>Os dados permanecem no perfil deste navegador até você usar “Apagar meus dados”, limpar os dados do site ou remover o perfil do navegador. Não há sincronização entre dispositivos.</p>
      </article>

      <article class="panel privacy-card">
        <h2>Limites importantes</h2>
        <p>Ocultar valores é apenas uma proteção visual, não criptografia. Extensões, pessoas com acesso ao dispositivo e scripts maliciosos podem alcançar o armazenamento do navegador. O arquivo exportado também fica sob sua responsabilidade.</p>
      </article>

      <article class="panel privacy-card">
        <h2>Seus controles</h2>
        <p>Você pode exportar uma cópia ou apagar plano, cenários e preferências na tela Perfil. A exclusão local é irreversível neste dispositivo.</p>
        <a class="button button--secondary" href="/perfil" data-route>Gerenciar meus dados</a>
      </article>

      <article class="panel privacy-card">
        <h2>Próxima etapa do produto</h2>
        <p>Antes de uma versão com contas ou servidor de aplicação, deverão ser definidos controlador, contato de privacidade, base legal, prazos e processo para atender direitos previstos na LGPD.</p>
      </article>
    </section>
  `
}

export function renderDeletedState() {
  return `
    <section class="empty-data panel">
      ${icon('shield', 28)}
      <p class="eyebrow">SEM DADOS LOCAIS</p>
      <h1>Comece quando você quiser.</h1>
      <p>Este navegador não tem um plano salvo. Você pode carregar dados de demonstração para explorar o produto sem inserir informações pessoais.</p>
      <div class="data-actions">
        <button class="button button--primary" type="button" data-reset-data>Carregar demonstração</button>
        <a class="button button--secondary" href="/privacidade" data-route>Entender a privacidade</a>
      </div>
    </section>
  `
}
