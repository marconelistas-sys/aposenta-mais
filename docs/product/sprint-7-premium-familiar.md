# Sprint 7: aquisição e proposta Premium familiar

## Objetivo

Apresentar o valor de uma conta gratuita e a proposta do Premium familiar depois que a pessoa entende o resultado do próprio planejamento. O produto deve explicar a futura visão conjunta do orçamento doméstico sem afirmar que compartilhamento, assinatura ou cobrança já estão disponíveis.

## Hipótese

Uma proposta contextual, exibida após o resultado e a projeção financeira, deve gerar interesse sem competir com a tarefa principal. A mensagem conecta o planejamento de aposentadoria com decisões mensais da casa e preserva o acesso gratuito aos cálculos.

## Decisão de experiência

- O visitante pode calcular e consultar os resultados sem criar conta.
- O dashboard apresenta uma versão compacta do planejamento a dois depois da projeção detalhada.
- O header diferencia “Entrar” de “Criar conta”.
- O perfil oferece cadastro gratuito como ação principal para visitantes.
- A página Premium informa que recursos, preço e cobrança ainda estão em preparação.
- Nenhum CTA usa urgência, desconto, assinatura ou teste fictício.

## Histórias

- Como visitante, quero entender por que criar uma conta antes de fornecer meu e-mail.
- Como pessoa que já preencheu seus dados, quero conhecer a proposta familiar sem perder acesso aos resultados.
- Como casal, quero entender como orçamento, metas e aposentadoria poderão aparecer em uma visão conjunta.
- Como usuário, quero saber o que existe agora e o que ainda está planejado.
- Como produto, quero medir o funil sem coletar e-mail ou valores financeiros nos eventos.

## Critérios de aceite

- Visitantes encontram cadastro no header e no perfil.
- O card familiar aparece após a projeção e não bloqueia resultados.
- Conta gratuita e Premium familiar aparecem como ofertas distintas.
- Usuários autenticados não veem CTA de cadastro no dashboard.
- A página `/premium` usa o estado “Em breve” e não oferece checkout.
- O preview do casal usa rótulos ilustrativos e nenhum valor do usuário.
- Criar uma conta não sincroniza dados financeiros automaticamente.
- Os CTAs aceitam teclado, preservam foco visível e têm pelo menos 44 px de altura.
- O layout funciona a partir de 320 px.
- Eventos de produto usam apenas nomes permitidos e não incluem dados pessoais ou financeiros.
- O rodapé informa corretamente quando existe uma cópia remota.

## Eventos preparados

- `couple_promo_view`
- `create_account_click`
- `premium_view`
- `register_success`

Os eventos são emitidos apenas dentro do navegador. Esta sprint não conecta uma plataforma externa de analytics.

## Entrega iniciada

- Componente responsivo de promoção no dashboard.
- CTA de cadastro no header e no perfil.
- Contexto de benefícios na tela de cadastro.
- Página informativa do Premium familiar.
- Variante para demonstração, dados próprios, conta autenticada e Supabase indisponível.
- Mensagem dinâmica sobre armazenamento local e cópia remota.
- Testes de renderização e privacidade dos eventos.

## Fora do escopo

- Cobrança, preço, período de teste ou checkout.
- Plano de assinatura persistido na conta.
- Household, convite e vínculo entre usuários.
- Permissões por pessoa ou campo financeiro.
- Sincronização automática e resolução de conflitos.
- Envio de eventos para serviço externo.

## Próximo incremento técnico

Definir modelo de household, papéis, consentimento granular, convite seguro, cancelamento, preço total, periodicidade e provedor de pagamentos antes de oferecer assinatura.
