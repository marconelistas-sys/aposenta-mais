# Atualização dos rendimentos da carteira (10/11/2026)

Atualização única, aplicada direto no plano salvo no Supabase em 10/11/2026 às 05:54 UTC. Antes de gravar, o plano foi copiado para um backup local fora do repositório. A gravação só aconteceu depois de confirmar que o plano não tinha mudado desde o backup: mesmo `updated_at` e mesmo payload.

Até então, todos os investimentos usavam 5% real ao ano, um valor padrão herdado da importação do FinApp. Com os parâmetros abaixo, a média real ponderada no longo prazo passa de 5,00% para 1,88% ao ano.

## Critérios

- **Rendimento líquido.** Quando há imposto sobre o rendimento nominal, ele já está descontado do percentual do CDI: IR de 15% em aplicações acima de 2 anos e de 20% no curto prazo. Quando o produto tem taxa de administração, ela vai em `annualFee`.
- **Longo prazo, não o juro de hoje.** O CDI de 13,65% não serve para 30 anos. `indexAnnualRate` usa o CDI de longo prazo do Focus de 06/11/2026: Selic de 10,00% em 2030 menos 0,10 p.p., ou seja, 9,90%. Os anos mais próximos vêm da feature de indicadores de mercado ([indicadores-mercado.md](../product/indicadores-mercado.md)).
- **Ativos em CHF guardados em BRL.** O saldo está convertido em BRL, sem moeda própria. O retorno informado é o retorno real em CHF. Em termos reais, isso supõe paridade de poder de compra: o câmbio real fica constante.

## Valores gravados

| Investimento | Tipo | Parâmetros | Real (longo prazo) | Base pública |
| --- | --- | --- | --- | --- |
| BVK (Fundo de Pensão Suíço) | real | 1,5% | 1,50% | A BVK creditou 1,75% em 2024 e 2,25% em 2025. Em 2026, 2,5% no primeiro semestre e 3% a partir de julho. A taxa técnica é 2,0%. Inflação CHF de longo prazo ≈ 0,75%. |
| BB CDB DI | cdi | 76,5% do CDI de 9,90% | 3,44% | 90% do CDI bruto, menos IR de 15%. **[validar]** O percentual do contrato não é público. |
| BB RF LP High | cdi | 85% do CDI de 9,90%, taxa 0,35% | 3,88% | O FIC rendeu 13,99% em 12 meses, perto de 100% do CDI. Taxa de administração de 0,35%. IR de 15% (come-cotas). |
| Funpresp | ipca | IPCA + 4,0% | 4,00% | O referencial rendeu 8,98% em 12 meses até set/2026, com IPCA de 4,58%, ou seja, ≈ IPCA + 4,2%. A carteira rendeu 12,74%. |
| Poupança CEF | nominal | 6,8% | 2,69% | Com Selic acima de 8,5%, a poupança paga 0,5% ao mês + TR. Isso dá 6,17% mais a TR de longo prazo, ≈ 0,6%. É isenta de IR. |
| BB Rende Fácil | cdi | 64% do CDI de 9,90% | 2,25% | As aplicações automáticas do BB rendem 78–85% do CDI. Usei 80%, menos IR de 20% no curto prazo. **[validar]** |
| Direito sobre precatório | ipca | IPCA + 2,0% | 2,00% | EC 136/2025: correção pelo IPCA mais juros simples de 2% ao ano, limitada à Selic. Não considera o risco de atraso. |
| Saldo Suíça | real | −0,5% | −0,50% | A taxa do SNB é 0% e o SARON está em −0,04%. Contas de poupança em CHF pagam ≈ 0,1–0,25%. O IPC suíço subiu 0,99% em 12 meses (set/2026). |

A inflação do plano continuou em 4,0%, em linha com o Focus para 2028–2030 (4,0%, 4,0% e 3,9%).

## Fontes

- BCB, SGS: IPCA (433, 13522), CDI (4389), Selic meta (432), poupança (195), TR (226). Consultado em 10/11/2026.
- BCB, Focus: medianas anuais de IPCA e Selic de 06/11/2026.
- SNB data portal: `plkopr` (IPC) e `snbgwdzid` (taxa do SNB e SARON).
- [BVK, Verzinsung](https://bvk.ch/en/occupational-benefits-insurance/stages-of-your-life/joining-bvk/interest), [BVK Geschäftsbericht 2025](https://bvk.ch/fileadmin/dam/forms/Geschaeftsbericht_Kontext_Update/Geschaeftsbericht_2025.pdf), [RRB 2026/249](https://www.zh.ch/bin/zhweb/publish/regierungsratsbeschluss-unterlagen./2026/249/RRB-2026-0249.pdf)
- [Funpresp, 3º trimestre de 2026](https://www.funpresp.com.br/fique-por-dentro/noticias/carteira-de-investimentos-da-funpresp-rende-292-no-3o-trimestre-de-2026), [Investidor Institucional, setembro/26](https://investidorinstitucional.com.br/investidores/fundos-de-pensao/funpresp-exe-rende-109-em-setembro-abaixo-do-referencial)
- [BB RF LP High FIC (Investidor10)](https://investidor10.com.br/fundos/bb-rf-lp-high-fic-de-fi/)
- [Fundos automáticos do BB (numerando)](https://numerando.com.br/fundos/bb-renda-fixa-simples-agil-fundo-de-investimento-em-cotas-de-fif-resp-limitada-43617343000102)
- [CNJ, Provimento sobre a EC 136/2025](https://www.cnj.jus.br/provimento-orienta-tribunais-sobre-novas-regras-para-pagamento-de-precatorios/), [TRF6, EC 136/2025](https://portal.trf6.jus.br/emenda-constitucional-no-136-2025-altera-criterios-de-atualizacao-e-antecipa-prazo-para-inclusao-de-precatorios-na-proposta-orcamentaria/)

## Pendências

- Confirmar no extrato do BB o percentual do CDI do CDB DI e do Rende Fácil.
- Cadastrar BVK e Saldo Suíça com moeda CHF na Carteira. Assim a inflação CHF e o câmbio passam a ser aplicados a eles, em vez da hipótese de paridade.
- Se o navegador tiver alterações locais ainda não sincronizadas, o app vai mostrar um conflito de sincronização. Nesse caso, escolha a versão do servidor para manter os novos rendimentos.
