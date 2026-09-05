import { icon } from '../../shared/icons.js'

export function renderPrivacy() {
  return `
    <section class="page-heading page-heading--inner">
      <div>
        <p class="eyebrow">PRIVACIDADE</p>
        <h1>Seus dados ficam sob seu controle.</h1>
        <p>Entenda o que fica no navegador, o que identifica sua conta e quando uma cópia é enviada.</p>
      </div>
    </section>

    <section class="privacy-grid">
      <article class="panel privacy-card privacy-card--highlight">
        ${icon('shield', 24)}
        <div>
          <h2>Resumo direto</h2>
          <p>Você pode explorar o Aposenta+ sem informar sua identidade. Se criar uma conta, seu e-mail identifica esse acesso. Seu plano financeiro continua local até você autorizar e solicitar uma cópia remota vinculada à conta.</p>
        </div>
      </article>

      <article class="panel privacy-card">
        <h2>Dados e finalidade</h2>
        <ul class="privacy-list">
          <li>Idade, patrimônio, aporte, renda desejada e premissas para calcular projeções.</li>
          <li>Nome escolhido, classe, saldo, aporte, forma do rendimento e taxa informada de cada investimento para projetar a carteira.</li>
          <li>Lançamentos, descrições, moedas, categorias, frequências, prazos, mês de aposentadoria do orçamento e vínculos de término de receitas para calcular o aporte sustentável.</li>
          <li>Cenários salvos para comparar e restaurar plano, orçamento e moeda.</li>
          <li>Preferências visuais e de lembrete para personalizar a experiência.</li>
          <li>Cotação pública do BCE, com fonte e data, para converter totais na moeda da visão geral.</li>
          <li>Versão e data do consentimento quando você cria uma cópia remota.</li>
        </ul>
      </article>

      <article class="panel privacy-card">
        <h2>Armazenamento e retenção</h2>
        <p>O Perfil guarda até três versões anteriores à restauração e 50 registros de operações locais. Você pode exportar os registros ou apagar todo o histórico. Apagar dados deste navegador também elimina as versões e os registros.</p>
        <p>Os dados locais permanecem até você usar “Apagar dados deste navegador”, limpar o site ou remover o perfil do navegador. Uma cópia autorizada permanece no Supabase até você usar “Excluir cópia remota”. A exclusão da conta ainda depende de um processo administrativo.</p>
      </article>

      <article class="panel privacy-card">
        <h2>Proteções implementadas</h2>
        <ul class="privacy-list">
          <li>Os cálculos financeiros são executados neste navegador.</li>
          <li>O arquivo TXT é lido localmente. O arquivo original não é enviado ao servidor.</li>
          <li>O servidor consulta somente a cotação pública. Nenhum lançamento é enviado ao BCE.</li>
          <li>Criar uma conta não envia o plano financeiro.</li>
          <li>A sessão usa cookies HttpOnly, sem tokens no localStorage.</li>
          <li>A cópia remota exige login, ação manual e consentimento.</li>
          <li>O banco foi preparado para limitar cada conta à própria linha. A configuração hospedada ainda precisa de validação operacional.</li>
        </ul>
      </article>

      <article class="panel privacy-card">
        <h2>Limites importantes</h2>
        <p>Dados financeiros não são anônimos quando ficam vinculados a uma conta. Ocultar valores é uma proteção visual, não criptografia. Extensões, pessoas com acesso ao dispositivo e scripts maliciosos podem alcançar o armazenamento do navegador.</p>
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
