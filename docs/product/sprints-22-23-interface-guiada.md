# Sprints 22 e 23: entrada, privacidade de tela e plano guiado

## Sprint 22

- Botão Adicionar ocupa uma linha própria alinhada à direita no desktop e largura completa no celular.
- Entrada sem valores financeiros explica objetivo, orçamento, patrimônio e resultado.
- Plano local começa fechado em cada carregamento. Rotas diretas, Perfil e navegação de retorno respeitam a barreira de visualização.
- Logout fecha o plano. Outras abas recebem o evento de fechamento. Fechar plano local também está disponível sem logout.
- Login não assume que o plano do navegador pertence à conta conectada. Reabertura exige ação explícita.

A barreira não cifra o armazenamento e não exige senha para reabrir. A interface informa esse limite. Não apagar automaticamente evita perder dados sem cópia remota. Exportação e exclusão continuam disponíveis no Perfil após reabertura explícita.

## Sprint 23

Fluxo guiado em quatro etapas: objetivo, orçamento, patrimônio inicial e revisão com dashboard. Cada etapa valida antes de salvar. Dados existentes são preservados e investimentos detalhados não são somados novamente ao patrimônio agregado. Novos planos não herdam receitas, despesas ou saldos demonstrativos.

## Próximas sprints

1. Sprint 24: contas manuais, saldo inicial e transferências sem dupla contagem.
2. Sprint 25: projeção patrimonial com aportes variáveis e prazo comum com o orçamento.
3. Sprint 26: armazenamento financeiro por conta e modo de dispositivo compartilhado com política explícita de retenção e migração dos dados locais.

## Validação e integração

Testes unitários, verificação sintática, build e revisão de diff antes do merge. Sem validação visual nesta sessão: o mecanismo Node REPL exigido pela skill browser não está disponível. Nenhuma credencial de teste ou aprovação jurídica utilizada. O bloqueio de produção continua ativo.

Sprint 22 validada com 170 testes. Sprint 23 validada com 175 testes, incluindo início sem demonstração, preservação de planos existentes, rejeição de objetivo inválido, patrimônio inicial no motor e na persistência, não duplicação de investimentos e estrutura de alinhamento CSS. O teste CSS verifica regras, não pixels renderizados.

O wizard salva a cada etapa, não mantém um rascunho transacional. O cadastro simplificado adiciona itens mensais. Datas, categorias e vínculo salarial ficam disponíveis nele. Frequências adicionais, exclusão, edição e moedas individuais continuam no cadastro completo, com caminho de retorno ao wizard. O dashboard final inclui evolução mensal e explicita a limitação atual de aportes constantes.
