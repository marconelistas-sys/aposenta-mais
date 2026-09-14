# Uso local e análise de extratos

## Primeiro acesso e ativação local

Requer Node.js 24 ou superior. Execute `npm run dev` ou `./run-app.sh` e abra http://127.0.0.1:4173. Configure `SUPABASE_URL` e `SUPABASE_ANON_KEY` no `.env`. O primeiro acesso usa Supabase. SQLite fica disponível para ativação pelo Perfil, sem chave administrativa e sem instalar serviços externos. `APP_STORAGE` não seleciona mais o modo de acesso.

O banco fica em `.data/aposenta.sqlite`, excluído do Git e do acesso HTTP. `LOCAL_DB_PATH` permite escolher outro destino. O servidor escuta apenas no loopback. A configuração é para uso neste computador.

Entre pelo Supabase e abra Perfil, Banco de dados e login local. Defina e confirme uma senha local e autorize a cópia. A ativação copia o plano salvo no Supabase. Se a conta não tiver cópia remota, usa o plano atual do navegador. Falha de leitura da nuvem cancela a ativação. Guarde o código de recuperação exibido.

Depois da ativação, selecione o destino da sincronização no Perfil. As cópias Supabase e SQLite são independentes, com gravação e restauração manuais. Para entrar sem rede, selecione Login local na tela de acesso. Uma sessão local só acessa SQLite. Para voltar à sincronização na nuvem, entre novamente pelo Supabase. Recuperar senha local exige o código e gera um substituto.

O trabalho continua sendo salvo no navegador. No Perfil, autorize a cópia no banco deste computador e pressione Salvar. Essa cópia é manual, não automática. Restaurar traz a versão salva para o navegador. Contas diferentes têm cópias separadas. Gravações concorrentes exigem revisão da versão atual.

## Backup e dados anteriores

`npm run db:init` cria as tabelas se necessário, sem apagar contas. `npm run db:backup` cria uma cópia consistente em `.data/backups/`. Para escolher destino: `npm run db:backup -- /caminho/backup.sqlite`. O comando recusa sobrescrever arquivos existentes.

Para restaurar um banco completo, pare o servidor e aponte `LOCAL_DB_PATH` para uma cópia do backup, preservando o banco atual. Reinicie o servidor. Não copie somente o arquivo principal de um banco aberto, pois pode haver transações no arquivo WAL. Backups contêm dados financeiros e credenciais protegidas por hash, sem criptografia do arquivo inteiro.

A ativação pelo Perfil preserva o identificador e o e-mail da conta Supabase. Contas locais anteriores com mesmo e-mail e identificador diferente bloqueiam a ativação, para evitar misturar dados. Nenhum plano existente é substituído. O importador administrativo continua disponível como alternativa documentada em `migracao-supabase-sqlite.md`.

A recuperação local não redefine a senha de uma conta Supabase antiga. Para essa conta, continua necessário recuperar o acesso ao serviço original.

## Extratos e interpretação

Em Fluxo de caixa, use Importar extrato CSV, TXT ou OFX para revisar colunas e selecionar movimentos realizados. O orçamento mantém o limite de 100 lançamentos no total. A prévia sinaliza cortes, erros e possíveis duplicidades antes de importar.

Use Analisar extratos, no Dashboard ou Fluxo de caixa, para avaliar até 2.000 movimentos e 1 MB sem gravar o arquivo bruto ou alterar o orçamento automaticamente. O resumo é salvo no histórico ao clicar em Analisar e salvar resumo. CSV/TXT usam colunas `data`, `descricao`, `valor` e opcionalmente `moeda`. Datas aceitas: `AAAA-MM-DD` e `DD/MM/AAAA`. Despesas têm valor negativo. OFX bancário aceita SGML ou XML simples. Declarações externas XML são rejeitadas. PDF e imagens não são aceitos.

Informe a cobertura e confirme que o arquivo representa todas as receitas e despesas familiares, sem transferências próprias, aplicações, resgates ou despesas duplicadas de cartão. A classificação automática exclui algumas descrições identificáveis, mas não detecta todos os casos. Movimentos possivelmente duplicados e moedas diferentes bloqueiam a análise até revisão.

O cálculo usa somente meses completos dentro do período, com pelo menos dois meses. Meses completos sem movimentos entram como zero. A sobra média é receita menos despesa, comparada ao aporte mensal configurado. O gráfico mostra receitas e despesas na mesma escala. Recorrências candidatas exigem presença em pelo menos dois meses e 60% dos meses analisados. As médias incluem todos os meses completos, evitando inflar a recorrência ao ignorar meses vazios.

Esses resultados descrevem o histórico fornecido, sem garantir renda futura ou sustentabilidade da aposentadoria. A tela direciona para revisar orçamento e testar aportes em Simulações. A sustentabilidade até a data-alvo permanece no Dashboard, calculada pelas premissas anuais. Nenhuma recorrência ou novo aporte é aplicado sem edição do usuário. O histórico guarda até seis resumos com 2 a 24 meses completos. Você pode reabrir, comparar períodos sem sobreposição na mesma moeda e excluir resumos. As recorrências selecionadas podem ser adicionadas ao orçamento após revisar valor, categoria, titularidade e datas. A cópia manual no Perfil inclui o histórico.
