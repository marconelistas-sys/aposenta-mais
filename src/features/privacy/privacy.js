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
          <p>Plano, fluxo de caixa, cenários e preferências ficam no armazenamento local deste navegador por padrão. Uma cópia financeira só é enviada ao Supabase quando você autoriza e solicita o envio. Entrar na conta não envia o plano automaticamente.</p>
        </div>
      </article>

      <article class="panel privacy-card">
        <h2>Dados e finalidade</h2>
        <ul class="privacy-list">
          <li>Idade, patrimônio, aporte, renda desejada e premissas para calcular projeções.</li>
          <li>Receitas, despesas, dívidas e reserva de emergência para calcular o aporte sustentável.</li>
          <li>Cenários salvos para comparar alternativas.</li>
          <li>Preferências visuais e de lembrete para personalizar a experiência.</li>
          <li>Versão e data do consentimento quando você cria uma cópia remota.</li>
        </ul>
      </article>

      <article class="panel privacy-card">
        <h2>Armazenamento e retenção</h2>
        <p>Os dados locais permanecem até você usar “Apagar meus dados”, limpar o site ou remover o perfil do navegador. Uma cópia autorizada permanece no Supabase até você usar “Excluir cópia remota” ou excluir a conta.</p>
      </article>

      <article class="panel privacy-card">
        <h2>Limites importantes</h2>
        <p>Ocultar valores é apenas uma proteção visual, não criptografia. Extensões, pessoas com acesso ao dispositivo e scripts maliciosos podem alcançar o armazenamento do navegador. O arquivo exportado também fica sob sua responsabilidade.</p>
      </article>

      <article class="panel privacy-card">
        <h2>Seus controles</h2>
        <p>Você pode exportar ou apagar dados locais. Com uma conta, pode criar, restaurar e excluir uma cópia remota. Exclusão local e remota são controles independentes.</p>
        <a class="button button--secondary" href="/perfil" data-route>Gerenciar meus dados</a>
      </article>

      <article class="panel privacy-card">
        <h2>Próxima etapa do produto</h2>
        <p>Antes de ativar a sincronização para usuários reais, deverão ser definidos controlador, contato de privacidade, base legal, prazos, atendimento aos direitos da LGPD e validação da segurança no projeto hospedado.</p>
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
