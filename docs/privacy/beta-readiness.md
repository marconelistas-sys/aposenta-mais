# Prontidão jurídica da beta

## Decisões de tratamento

| Operação | Dados | Finalidade | Base adotada | Retenção |
| --- | --- | --- | --- | --- |
| Uso local | plano, orçamento, cenários e preferências | executar cálculos e manter o estado escolhido | execução do serviço solicitado pelo usuário | até exclusão no navegador |
| Conta | e-mail, credencial, identificadores e sessão | criar e proteger o acesso | execução de contrato ou procedimento solicitado pelo titular, art. 7º, V, da LGPD | até exclusão administrativa da conta, observadas obrigações legais |
| Cópia financeira | plano, orçamento, moeda e cenários | permitir restauração manual | consentimento específico, art. 7º, I, da LGPD | até exclusão remota ou revogação do consentimento |
| Segurança | eventos estritamente necessários de autenticação e incidente | prevenir abuso e responder a incidentes | legítimo interesse sujeito a teste de balanceamento e obrigação legal quando aplicável | registro de incidente por pelo menos cinco anos |

A cópia remota não é requisito para usar os cálculos. O login não envia dados financeiros. A revogação do consentimento deve resultar na exclusão da cópia financeira, salvo obrigação legal documentada.

## Processo de direitos

1. Receber o pedido no canal público do controlador.
2. Confirmar a identidade com o mínimo de dados necessário.
3. Registrar tipo, data, responsável e conclusão do pedido.
4. Atender confirmação e acesso simplificado imediatamente quando possível.
5. Fornecer declaração completa em até 15 dias.
6. Executar correção, portabilidade, revogação ou exclusão conforme o pedido e informar o resultado.
7. Excluir a conta pelo painel administrativo do Supabase. A linha financeira é removida por cascata.

## Incidentes

O responsável deve conter o incidente, preservar evidências, avaliar risco ou dano relevante e registrar a decisão. Quando houver risco ou dano relevante, deve comunicar a ANPD e os titulares em até três dias úteis. Os registros do incidente ficam preservados por pelo menos cinco anos.

## Bloqueio técnico

Em produção, contas e sincronização permanecem indisponíveis até que todas estas variáveis existam:

- `LEGAL_BETA_APPROVED=true`
- `LEGAL_CONTROLLER_NAME` com o nome real do controlador
- `LEGAL_PRIVACY_CONTACT` com um canal monitorado

O sinal de aprovação só pode ser ativado após inserir esses dados no aviso público, confirmar o processo de direitos, revisar os termos aplicáveis e validar a migration e a RLS no projeto hospedado.

## Itens que exigem decisão do responsável

- Identidade civil ou razão social e dados de contato do controlador.
- Canal monitorado de privacidade.
- Confirmação jurídica das bases adotadas e dos termos de uso.
- Procedimento interno e responsável por pedidos de titulares.
- Confirmação dos prazos de descarte em backups do Supabase.

## Referências oficiais

- [Lei Geral de Proteção de Dados Pessoais](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)
- [Direitos dos titulares, ANPD](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares)
- [Guia de agentes de tratamento e encarregado, ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-para-definicoes-dos-agentes-de-tratamento-de-dados-pessoais-e-do-encarregado)
- [Regulamento de comunicação de incidente, ANPD](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-aprova-o-regulamento-de-comunicacao-de-incidente-de-seguranca)
