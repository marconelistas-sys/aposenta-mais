# Sprint 10: extratos, prazos e previdência

## Objetivo

Reduzir digitação manual, representar contratos financeiros com prazo e tratar previdência complementar de forma coerente entre orçamento e patrimônio.

## Decisões

- O primeiro canal de importação é TXT local.
- O arquivo original não sai do navegador.
- Open Finance direto permanece fora desta entrega.
- A conexão futura exigirá instituição receptora participante, consentimento, autenticação e confirmação.
- Receitas e despesas recorrentes aceitam início e fim opcionais.
- Um item fora do período não entra nos totais atuais.
- Previdência complementar é saída recorrente e aporte patrimonial programado.
- O aporte livre continua separado para evitar dupla contagem.

## Formato TXT

Cabeçalho mínimo:

```text
data;descricao;valor
```

Cabeçalho completo:

```text
data;descricao;valor;moeda;categoria;tipo
```

- Separadores aceitos: ponto e vírgula e tabulação.
- Datas aceitas: `AAAA-MM-DD` e `DD/MM/AAAA`.
- Valores negativos representam despesa quando o tipo não é informado.
- Moedas aceitas: BRL, EUR, USD e CHF.
- Linhas sem categoria reconhecida usam Outras receitas ou Outras despesas.
- O limite atual é 100 lançamentos por estado local.

## Previdência complementar

A SUSEP descreve PGBL e VGBL como produtos com período de acumulação que podem gerar renda ou pagamento único. Por isso, a contribuição deve reduzir a disponibilidade mensal e aumentar os recursos destinados à aposentadoria.

O motor converte a taxa real anual em taxa mensal equivalente. Em cada mês ativo, ele aplica o rendimento ao saldo e adiciona o aporte livre e a contribuição previdenciária no fim do mês.

Tributação, carregamento, taxa de administração, tábua biométrica e regras específicas do produto não entram no cálculo atual.

## Próximas etapas

1. Mostrar prévia e permitir correção do mapeamento antes de importar. Concluído na Sprint 13.
2. Detectar duplicidades por data, valor e descrição. Concluído na Sprint 13 com inclusão de tipo e moeda.
3. Separar orçamento planejado e realizado. Concluído na Sprint 11.
4. Selecionar parceiro receptor para Open Finance.
5. Criar jornada de consentimento, revogação e renovação.
6. Modelar taxas, tributação e saldo existente de previdência por produto.
