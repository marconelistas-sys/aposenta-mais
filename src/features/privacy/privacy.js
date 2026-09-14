import { authState } from '../../app/auth-state.js'
import { icon } from '../../shared/icons.js'

export function renderPrivacy() {
  const local = authState.provider === 'local'
  const copy = local ? 'cópia no banco deste computador' : 'cópia remota'
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
          <p>Você pode explorar o Aposenta+ sem informar sua identidade. Se criar uma conta, seu e-mail identifica esse acesso. Seu plano financeiro continua neste navegador até você autorizar e solicitar uma ${copy} vinculada à conta.</p>
        </div>
      </article>

      <article class="panel privacy-card">
        <h2>Dados e finalidade</h2>
        <ul class="privacy-list">
          <li>Idade, patrimônio, aporte, renda desejada e premissas para calcular projeções.</li>
          <li>Nome escolhido, classe, saldo, aporte, forma do rendimento e taxa informada de cada investimento para projetar a carteira.</li>
          <li>Lançamentos, titularidade familiar, descrições, moedas, categorias, frequências, prazos, mês de aposentadoria do orçamento e vínculos de término de receitas para calcular o aporte sustentável. Contas manuais incluem nomes, moedas, saldos iniciais, datas e movimentos.</li>
          <li>Até seis resumos de extratos, com período, moeda, totais mensais e recorrências, para acompanhar o orçamento. Sugestões aplicadas guardam referência ao resumo de origem. O arquivo bruto não é armazenado.</li>
          <li>Cenários salvos para comparar e restaurar plano, orçamento e moeda.</li>
          <li>Preferências visuais e de lembrete para personalizar a experiência.</li>
          <li>Cotação pública do BCE, com fonte e data, para converter totais na moeda da visão geral.</li>
          <li>Versão e data do consentimento quando você cria uma ${copy}.</li>
        </ul>
      </article>

      <article class="panel privacy-card">
        <h2>Armazenamento e retenção</h2>
        <p>O Perfil guarda até três versões anteriores à restauração e 50 registros de operações locais. Você pode exportar os registros ou apagar todo o histórico. Apagar dados deste navegador também elimina as versões e os registros.</p>
        <p>Os dados locais permanecem até você usar “Apagar dados deste navegador”, limpar o site ou remover o perfil do navegador. ${local ? 'A cópia autorizada permanece no banco deste computador até você excluí-la no Perfil. Apagar os dados do navegador não exclui a cópia do banco, e excluir a cópia não apaga a conta de acesso.' : 'Uma cópia autorizada permanece na nuvem até você usar “Excluir cópia remota”. A exclusão da conta ainda depende de um processo administrativo.'}</p>
      </article>

      <article class="panel privacy-card">
        <h2>Proteções implementadas</h2>
        <ul class="privacy-list">
          <li>Os cálculos financeiros são executados neste navegador.</li>
          <li>Arquivos TXT, CSV e OFX são lidos neste navegador. O arquivo original não é enviado ao servidor. Os lançamentos que você importar e os resumos que salvar passam a integrar seu plano e a cópia que você autorizar. Excluir um resumo não remove lançamentos já aplicados nem altera cópias anteriores automaticamente.</li>
          <li>O servidor consulta somente a cotação pública. Nenhum lançamento é enviado ao BCE.</li>
          <li>Criar uma conta não envia o plano financeiro.</li>
          <li>A sessão usa um cookie protegido que scripts do navegador não conseguem ler, sem tokens no localStorage.</li>
          <li>Planos e versões de recuperação locais ficam separados por conta. O espaço de visitante é independente e sua cópia para uma conta exige confirmação.</li>
          <li>A ${copy} exige login, ação manual e consentimento.</li>
          <li>${local ? 'O acesso à cópia no banco deste computador exige a sessão da conta correspondente. A recuperação da senha usa o código entregue no cadastro, sem envio de e-mail.' : 'O banco foi preparado para limitar cada conta à própria linha. A configuração hospedada ainda precisa de validação operacional.'}</li>
        </ul>
      </article>

      <article class="panel privacy-card">
        <h2>Limites importantes</h2>
        <p>Dados financeiros não são anônimos quando ficam vinculados a uma conta. Ocultar valores é uma proteção visual, não criptografia. Extensões, pessoas com acesso ao dispositivo e scripts maliciosos podem alcançar o armazenamento do navegador.${local ? ' O banco local também não é criptografado pelo aplicativo. Proteja o acesso ao computador e mantenha uma cópia de segurança fora dele.' : ''}</p>
      </article>

      <article class="panel privacy-card">
        <h2>Seus controles</h2>
        <p>Você pode exportar ou apagar dados locais. Com uma conta, pode criar, restaurar e excluir uma ${copy}. A exclusão dos dados do navegador e da cópia salva são controles independentes.</p>
        <a class="button button--secondary" href="/perfil" data-route>Gerenciar meus dados</a>
      </article>

      <article class="panel privacy-card">
        <h2>${local ? 'Continuidade do acesso' : 'Próxima etapa do produto'}</h2>
        <p>${local ? 'Guarde seu código de recuperação fora do aplicativo. Após redefinir a senha, guarde o novo código e descarte o anterior. A cópia do banco fica neste computador. Exporte seus dados pelo Perfil para guardá-los em outro local.' : 'Antes de ativar a sincronização para usuários reais, deverão ser definidos controlador, contato de privacidade, base legal, prazos, atendimento aos direitos da LGPD e validação da segurança no projeto hospedado.'}</p>
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
