import { articles } from '../../data/mock-plan.js'
import { icon } from '../../shared/icons.js'

export function renderContent() {
  return `
    <section class="page-heading page-heading--inner">
      <div>
        <p class="eyebrow">CONTEÚDOS</p>
        <h1>Decida com mais contexto.</h1>
        <p>Guias curtos para entender as variáveis do seu plano.</p>
      </div>
    </section>

    <section class="featured-guide">
      <div class="featured-guide__content">
        <span class="content-tag">GUIA ESSENCIAL</span>
        <h2>Os cinco números que sustentam seu plano de aposentadoria.</h2>
        <p>Renda, prazo, patrimônio, aporte e retorno. Aprenda a revisar cada um sem complicação.</p>
        <button class="button button--light" type="button" data-content-preview>
          Ler guia de 10 minutos ${icon('arrowRight', 18)}
        </button>
      </div>
      <div class="featured-guide__visual" aria-hidden="true">
        <div class="visual-orbit visual-orbit--one"></div>
        <div class="visual-orbit visual-orbit--two"></div>
        <div class="visual-core">A<span>+</span></div>
      </div>
    </section>

    <section class="content-section">
      <div class="section-title-row">
        <div>
          <p class="eyebrow">PARA COMEÇAR</p>
          <h2>Leituras recomendadas</h2>
        </div>
        <span>${articles.length} conteúdos</span>
      </div>
      <div class="articles-grid">
        ${articles.map((article, index) => `
          <article class="article-card">
            <div class="article-card__visual article-card__visual--${article.tone}">
              <span>0${index + 1}</span>
              ${icon(index === 0 ? 'target' : index === 1 ? 'calendar' : 'trendUp', 28)}
            </div>
            <div class="article-card__body">
              <div class="article-card__meta">
                <span>${article.category}</span>
                <span>${icon('clock', 14)} ${article.duration}</span>
              </div>
              <h3>${article.title}</h3>
              <p>${article.description}</p>
              <button type="button" class="article-link" data-content-preview>
                Ler conteúdo ${icon('arrowRight', 16)}
              </button>
            </div>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="help-banner">
      <div class="help-banner__icon">${icon('help', 24)}</div>
      <div><h2>Ficou com alguma dúvida?</h2><p>Veja respostas sobre cálculos, dados e premissas do Aposenta+.</p></div>
      <button class="button button--secondary" type="button" data-help>Consultar central de ajuda</button>
    </section>
  `
}
