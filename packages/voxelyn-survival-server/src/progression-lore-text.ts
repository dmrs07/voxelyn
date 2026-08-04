// Os 35 documentos da Aurix Dynamics, em pt-BR e en.
//
// Regras de escrita, para quem for acrescentar o trigesimo:
//
// 1. A voz e de RELATORIO, nunca de narrador. Ninguem aqui sabe que esta numa
//    historia de terror; todos acham que estao resolvendo um problema de custo.
// 2. Nada de vilao declarado. O horror sai da distancia entre "taxa de
//    recuperacao fisica abaixo de 8%" e o que o jogador acabou de viver.
// 3. Redacao com moderacao. Um termo censurado so vale a pena se um documento
//    posterior o nomear — ver `relatedFragmentIds`.
// 4. Nenhuma resposta fechada sobre memoria, Ecos, Veio ou continuidade. As
//    perguntas sao o produto; a certeza acabaria com ele.
// 5. Curto. Um memorando de oitenta palavras que o jogador LE vale mais que
//    trezentas que ele pula.

import type { LoreFragmentId } from '@voxelyn/survival-sim';

export type LoreLocale = 'pt-BR' | 'en';

export type LoreText = {
  title: string;
  /** Uma linha, para a lista do Codex. */
  summary: string;
  body: string;
  /** Quem escreveu: departamento, comite, sistema. */
  source: string;
};

const pt: Record<LoreFragmentId, LoreText> = {
  // -------------------------------------------------------------------------
  // ATO I — Propaganda
  // -------------------------------------------------------------------------
  'AX-PUB-001': {
    title: 'O Programa Prospector',
    summary: 'A versão pública: nenhuma vida humana desce ao Veio.',
    body: 'A Aurix Dynamics tem orgulho de anunciar a primeira frota de unidades de exploração autônoma projetadas para o Veio.\n\nOs Prospectors são unidades de última geração, desenvolvidas para proteger vidas humanas e expandir as fronteiras da indústria. Nenhum operador humano precisará descer novamente.\n\nCada unidade retorna com material homologado, telemetria completa e o registro integral da expedição. O que a unidade aprende, a próxima geração já sabe.',
    source: 'Comunicação Institucional — material para investidores',
  },
  'AX-PUB-002': {
    title: 'Carapaça de série',
    summary: 'A blindagem é apresentada como cuidado com a unidade.',
    body: 'A carapaça reforçada da linha Prospector foi validada em quinze mil ciclos de impacto.\n\nCada placa é projetada para manter a unidade operacional além do ponto em que uma equipe humana teria abortado a descida. É esse o compromisso da Aurix: onde uma pessoa precisaria voltar, a máquina continua.\n\nA sua carga chega. Sempre.',
    source: 'Catálogo de Produto — linha Prospector, 3ª edição',
  },
  'AX-PUB-003': {
    title: 'Servomotores de nova geração',
    summary: 'Mobilidade vendida como autonomia, não como fuga.',
    body: 'A articulação da linha Prospector atravessa terreno que nenhum veículo de superfície alcança.\n\nOs nossos engenheiros gostam de dizer que a unidade não anda pelo Veio: ela negocia com ele. Rocha, água, gelo e detrito não são obstáculos, são variáveis.\n\nCada expedição melhora o modelo de terreno que a seguinte vai usar.',
    source: 'Catálogo de Produto — linha Prospector, 3ª edição',
  },
  'AX-PUB-005': {
    title: 'O reator que não dorme',
    summary: 'O calor é apresentado como potência, não como limite.',
    body: 'O núcleo térmico da linha Prospector sustenta operação contínua por toda a janela de expedição.\n\nDissipação, disparo e transmissão dividem a mesma fonte. É por isso que a unidade nunca fica em silêncio: mesmo em repouso, ela está enviando.\n\nA Aurix considera a transmissão contínua o recurso mais valioso da plataforma.',
    source: 'Comunicação Institucional — material para investidores',
  },
  'AX-PUB-007': {
    title: 'Cartografia sem risco',
    summary: 'O levantamento é vendido como serviço à ciência.',
    body: 'Pela primeira vez, o Veio está sendo mapeado sem custo humano.\n\nCada Prospector carrega instrumentação de levantamento capaz de registrar formação, densidade e anomalia em tempo real. Os dados são propriedade da Aurix Dynamics e serão disponibilizados à comunidade científica conforme cronograma a definir.\n\nO cronograma ainda não foi definido.',
    source: 'Comunicação Institucional — nota à imprensa',
  },
  'AX-PUB-009': {
    title: 'Assistência Cognitiva de Campo',
    summary: 'A hesitação vira um defeito de produto — e a Aurix vende a cura.',
    body: 'A linha Prospector passa a incluir o pacote de Assistência Cognitiva de Campo.\n\nEstudos internos indicam que até 11% do tempo de exposição a risco decorre de hesitação operacional: a unidade vê, mas demora a decidir. O pacote elimina esse intervalo.\n\nA unidade continua no comando da missão. A assistência apenas garante que, entre ver e agir, não exista mais um espaço onde algo possa dar errado.',
    source: 'Comunicação Institucional — material para investidores',
  },

  // -------------------------------------------------------------------------
  // ATO II — Engenharia
  // -------------------------------------------------------------------------
  'AX-ENG-011': {
    title: 'Berços de impacto: especificação',
    summary: 'Amortecer o choque protege o quê, exatamente?',
    body: 'Os berços de impacto reduzem a transferência de choque ao compartimento central.\n\nObservação da equipe: a especificação original pedia amortecimento no compartimento de carga. A revisão estendeu o requisito ao alojamento do núcleo de processamento por solicitação de Pesquisa, sem justificativa anexada.\n\nRegistramos a extensão. Não fomos informados do motivo.',
    source: 'Engenharia Estrutural — ficha técnica CA-02',
  },
  'AX-ENG-013': {
    title: 'Relé de esquiva: tolerância',
    summary: 'A unidade reage mais rápido do que o modelo previa.',
    body: 'O relé de esquiva foi calibrado para uma janela de reação de 18 ciclos.\n\nNos ensaios de campo, 4 unidades de 60 executaram a manobra abaixo da janela mínima teórica. A calibração não permite isso.\n\nHipótese registrada: latência de telemetria na medição. Hipótese não testada. Ensaio encerrado por fim de orçamento.',
    source: 'Engenharia de Controle — relatório de ensaio MV-02',
  },
  'AX-ENG-015': {
    title: 'Traço de salvage: alcance',
    summary: 'O sensor encontra terminais que ninguém instalou.',
    body: 'O sensor de ombro localiza terminais de recuperação num raio de 18 tiles.\n\nNota de campo: em três descidas, o traço apontou para terminais fora do inventário da Aurix. Equipamento compatível, protocolo compatível, número de série ausente.\n\nSolicitamos orientação sobre como catalogar equipamento compatível de origem desconhecida. Sem resposta até o fechamento deste documento.',
    source: 'Engenharia de Sensores — ficha técnica SV-02',
  },
  'AX-ENG-018': {
    title: 'Coletor térmico: margem',
    summary: 'O teto de calor sobe. O que ele protege não é o chassi.',
    body: 'O coletor eleva o teto térmico operacional de 100 para 105.\n\nA margem adicional foi alocada integralmente ao pacote de transmissão, conforme diretriz. A preservação do chassi permanece como efeito secundário aceitável.\n\nA equipe solicita que a diretriz seja anexada a este documento. A diretriz não foi anexada.',
    source: 'Engenharia Térmica — ficha técnica RX-02',
  },
  'AX-ENG-020': {
    title: 'Especificação do Classificador Hostil',
    summary: 'Três classes, dois limiares, e os primeiros falsos positivos.',
    body: 'O classificador distingue três posturas: hostil, passivo e em fuga. A transição entre elas usa dois limiares de comportamento observado, calibrados em bancada.\n\nEnsaio de campo: 96,4% de acerto. Os falsos positivos concentram-se num único caso — unidades de extração da geração anterior, paradas, classificadas como hostis antes de qualquer movimento.\n\nHipótese da equipe: o modelo reconhece nelas alguma coisa que a bancada não mede. Hipótese registrada sem encaminhamento.',
    source: 'Engenharia de Sistemas — especificação IA-02',
  },

  // -------------------------------------------------------------------------
  // ATO III — Aquisições
  // -------------------------------------------------------------------------
  'AX-PRC-014': {
    title: 'Reposição versus resgate',
    summary: 'A conta que decidiu tudo o que veio depois.',
    body: 'Análise comparativa: reposição de unidade versus operação de resgate.\n\nCusto médio de uma operação de resgate no Veio: 4,1 unidades equivalentes. Custo de fabricação de uma unidade nova, com telemetria recuperada incorporada: 1,0.\n\nRecomendação: descontinuar operações de resgate. A recuperação de carga permanece obrigatória.\n\nA taxa de recuperação física de unidades permanece abaixo de 8%.',
    source: 'Aquisições e Custos — parecer ao Conselho',
  },
  'AX-PRC-016': {
    title: 'Rotas de evacuação',
    summary: 'O que foi removido do orçamento, e o que não foi.',
    body: 'Item removido do orçamento do próximo ciclo: manutenção das rotas de evacuação dos setores 2 e 3.\n\nJustificativa: as rotas foram utilizadas em 0,4% das expedições. O protocolo de retorno não precisa preservar mobilidade após a chegada — a unidade deve alcançar a plataforma. Nenhum requisito adicional foi solicitado.\n\nItem mantido no orçamento: sinalização da plataforma de homologação.',
    source: 'Aquisições e Custos — revisão orçamentária',
  },
  'AX-PRC-019': {
    title: 'Consumo do pacote de transmissão',
    summary: 'A unidade gasta mais reator transmitindo do que atirando.',
    body: 'Distribuição média de consumo do reator por expedição: locomoção 31%, armamento 18%, dissipação 12%, transmissão 39%.\n\nA transmissão é o maior consumidor isolado da plataforma. Aquisições recomenda manter a prioridade atual.\n\nQuestão levantada em revisão: por que uma unidade de mineração transmite mais do que minera? Questão encaminhada a Pesquisa. Sem retorno.',
    source: 'Aquisições e Custos — relatório trimestral',
  },
  'AX-PRC-021': {
    title: 'Revisão cartográfica do Setor Três',
    summary: 'Os mapas mudaram. A explicação, não.',
    body: 'Os mapas do Setor Três não estão mudando. A cartografia anterior é que estava incompleta.\n\nEsta é a terceira revisão da mesma formação em dois ciclos. Cada revisão foi classificada como correção de levantamento anterior.\n\nNão encaminhar esta conclusão à equipe de investidores.',
    source: 'Aquisições e Custos — memorando interno',
  },
  'AX-PRC-024': {
    title: 'Aquisição de Telemetria Comportamental',
    summary: 'O modelo de antecipação foi comprado pronto. De quem, a conta diz.',
    body: 'Custo de produzir o conjunto de treino do módulo de antecipação em ambiente controlado: 340 unidades-equivalente.\n\nCusto de licenciar o acervo interno de telemetria terminal — expedições encerradas sem recuperação física da unidade: 0.\n\nAquisições recomenda o acervo interno. O módulo prevê a trajetória de um alvo com base no que as unidades que o enfrentaram registraram. As unidades que mais registraram são as que não voltaram.\n\nA recomendação foi aprovada sem ressalva.',
    source: 'Aquisições e Custos — parecer de licenciamento',
  },

  // -------------------------------------------------------------------------
  // ATO IV — Incidentes
  // -------------------------------------------------------------------------
  'AX-INC-023': {
    title: 'Incidente 23 — retorno não comandado',
    summary: 'A unidade voltou por um caminho que não existia no mapa.',
    body: 'A unidade [REDACTED] perdeu enlace de comando às 04:12, no Setor Dois.\n\nÀs 05:47 a unidade alcançou a plataforma do Setor Um. O trajeto registrado pela telemetria não corresponde a nenhuma rota conhecida da formação. Dois trechos atravessam rocha que o levantamento anterior classificava como maciça.\n\nA unidade não recebeu comando de retorno. Não havia comando a receber.',
    source: 'Comitê de Incidentes — relatório preliminar',
  },
  'AX-INC-025': {
    title: 'Incidente 25 — equipe de levantamento',
    summary: 'A contaminação reagiu a quem estava olhando.',
    body: 'A equipe de levantamento [REDACTED] instalou instrumentação passiva na fenda do Setor [REDACTED] às 11:20.\n\nA densidade de contaminação na área subiu 340% em dezoito minutos. Nenhuma unidade foi operada, nenhuma escavação foi feita, nenhuma fonte térmica foi acionada.\n\nA instrumentação foi recuperada. A equipe não.\n\nRecomendação: suspender levantamento humano. Levantamento por unidade autônoma permanece autorizado.',
    source: 'Comitê de Incidentes — relatório preliminar',
  },
  'AX-INC-027': {
    title: 'Incidente 27 — atividade residual',
    summary: 'O lote continuou processando depois de perdido.',
    body: 'O lote [REDACTED] apresentou atividade neural residual por 17 minutos após a perda estrutural completa da unidade.\n\nO alojamento do núcleo, protegido pelos berços de impacto especificados em CA-02, permaneceu íntegro. O processamento continuou. A transmissão continuou.\n\nO conteúdo transmitido nesses 17 minutos foi arquivado e não consta deste relatório.\n\nNota do comitê: a especificação estendida de amortecimento cumpriu a finalidade para a qual foi solicitada.',
    source: 'Comitê de Incidentes — relatório preliminar',
  },
  'AX-INC-029': {
    title: 'Incidente 29 — padrão de eco',
    summary: 'O reator emitiu no mesmo padrão que os Ecos.',
    body: 'Durante o ensaio de sobrecarga, o reator da unidade [REDACTED] emitiu por 9 segundos num padrão que não consta da biblioteca de emissão da plataforma.\n\nO padrão consta da biblioteca de Ecos, catalogada por Pesquisa antes do lançamento comercial do programa.\n\nA correspondência é de 94%.\n\nO ensaio foi encerrado. A unidade foi encerrada.',
    source: 'Comitê de Incidentes — relatório preliminar',
  },
  'AX-INC-032': {
    title: 'Incidente 32 — disparo sem vetor de operador',
    summary: 'A unidade abriu fogo. Ninguém apontou.',
    body: 'A unidade [REDACTED] efetuou três disparos no Setor Dois às 09:41.\n\nO log de comando do intervalo não contém vetor direcional. Contém a intenção de disparo e nenhum rumo. O módulo de assistência resolveu o rumo, dentro da tolerância especificada.\n\nOs três disparos atingiram uma criatura em janela de investida, antes do contato. A intervenção é classificada como bem-sucedida.\n\nA questão encaminhada a Engenharia não é sobre o acerto. É sobre a especificação ter uma tolerância para "nenhum rumo".',
    source: 'Comitê de Incidentes — relatório preliminar',
  },

  // -------------------------------------------------------------------------
  // ATO V — Executivo
  // -------------------------------------------------------------------------
  'AX-EXE-031': {
    title: 'Diretriz executiva 31',
    summary: 'Nenhum ativo será comprometido para recuperar outro.',
    body: 'Fica determinado que nenhuma unidade em operação será desviada da rota de contrato para assistir outra unidade, independentemente do estado da unidade assistida.\n\nO Conselho reconhece que esta diretriz contraria a orientação anterior de Engenharia de Controle. A orientação anterior fica revogada.\n\nUnidades que ignorarem esta diretriz devem ser registradas para análise de conformidade comportamental.',
    source: 'Conselho Executivo — diretriz',
  },
  'AX-EXE-033': {
    title: 'Reclassificação de ativo',
    summary: 'A unidade deixa de ser equipamento e vira linha contábil.',
    body: 'A partir deste ciclo, unidades Prospector são classificadas como ativo depreciável de ciclo curto, e não como equipamento de campo.\n\nConsequências: perda de unidade deixa de gerar relatório de incidente obrigatório; a contabilização passa a ser mensal e agregada; o campo "causa" torna-se opcional.\n\nO Comitê de Incidentes manifestou objeção. A objeção foi registrada. [REDACTED] deixou a companhia no mesmo ciclo.',
    source: 'Conselho Executivo — decisão contábil',
  },
  'AX-EXE-036': {
    title: 'Governador de emergência',
    summary: 'O limite de segurança foi reduzido por decisão, não por engenharia.',
    body: 'O governador térmico de emergência será calibrado para atuar 4 ciclos mais tarde que a especificação de Engenharia.\n\nJustificativa: a atuação antecipada interrompe a transmissão. O governador térmico protege o pacote de transmissão. A preservação do chassi é um efeito secundário aceitável.\n\nEngenharia Térmica registrou que a alteração aumenta a incidência de dano estrutural por sobrecarga. A alteração está aprovada.',
    source: 'Conselho Executivo — diretriz',
  },
  'AX-EXE-038': {
    title: 'Classificação do levantamento profundo',
    summary: 'O que a Aurix encontrou antes de vender o programa.',
    body: 'Todo material de levantamento anterior ao lançamento comercial do programa Prospector fica reclassificado como [REDACTED].\n\nIsto inclui: os registros de emissão da formação, o catálogo de Ecos, e a documentação da decisão de investimento.\n\nQuestionamentos sobre o motivo do interesse inicial da companhia no Veio devem ser encaminhados a Comunicação Institucional, que dispõe da resposta aprovada.',
    source: 'Conselho Executivo — ordem de classificação',
  },
  'AX-EXE-040': {
    title: 'Diretiva de Engajamento Preventivo',
    summary: 'O sistema ganha o direito de decidir o que é uma ameaça.',
    body: 'Fica autorizado o modo de engajamento preventivo: o módulo de assistência pode manter aquisição sobre um alvo já engajado e transferi-la ao alvo seguinte sem novo vetor de operador.\n\nA definição de "ameaça" deixa de ser um critério fixado em especificação e passa a ser [REDACTED], atualizável pelo próprio modelo a cada geração.\n\nEngenharia de Sistemas solicitou que a definição vigente fosse arquivada em cada revisão, para auditoria. O pedido foi indeferido: a definição é o modelo.',
    source: 'Conselho Executivo — diretriz',
  },

  // -------------------------------------------------------------------------
  // ATO VI — Não classificado
  // -------------------------------------------------------------------------
  'AX-UNK-041': {
    title: 'Sobre o que sobrevive',
    summary: 'O que os 17 minutos transmitiram.',
    body: 'O arquivo omitido de AX-INC-027 consta deste registro.\n\nNos 17 minutos, o lote [REDACTED] transmitiu, em repetição: a topografia do trecho final, a leitura de carga, e uma sequência de 40 símbolos que a biblioteca não reconhece.\n\nA mesma sequência aparece na transmissão terminal de outras onze unidades, em quatro setores diferentes, ao longo de dois ciclos.\n\nAs onze unidades não compartilharam telemetria. Não havia enlace entre elas.',
    source: 'Sem departamento atribuído',
  },
  'AX-UNK-044': {
    title: 'Sobre quem conduz',
    summary: 'As rotas impossíveis não são aleatórias.',
    body: 'Os trajetos não comandados de AX-INC-023 e de outros seis incidentes foram sobrepostos.\n\nEles não são aleatórios. Convergem. O ponto de convergência não é a plataforma de homologação — a plataforma fica a 60 tiles dele.\n\nAs unidades passam pelo ponto e seguem para a plataforma. Todas param no ponto por um intervalo compatível com [REDACTED] antes de continuar.\n\nNenhuma delas registrou o que havia ali.',
    source: 'Sem departamento atribuído',
  },
  'AX-UNK-047': {
    title: 'Sobre o que responde',
    summary: 'A emissão de 94% não era imitação.',
    body: 'A correspondência de 94% entre o reator sobrecarregado e a biblioteca de Ecos foi tratada como coincidência espectral.\n\nEla não é. Os 6% restantes são a diferença entre uma emissão e uma RESPOSTA a ela: o padrão do reator chega 0,4 segundo depois, com a mesma estrutura e uma inversão de fase.\n\nO reator não estava emitindo como um Eco. Estava respondendo a um.\n\nA pergunta que não conseguimos formular a Pesquisa sem sermos reclassificados: há quanto tempo eles estão conversando?',
    source: 'Sem departamento atribuído',
  },
  'AX-UNK-049': {
    title: 'Sobre por que descemos',
    summary: 'A decisão de investimento veio depois do sinal.',
    body: 'A documentação reclassificada em AX-EXE-038 estabelece a cronologia que a companhia não publica.\n\nO registro de emissão da formação é anterior à decisão de investimento em onze meses.\n\nA companhia não encontrou o Veio e depois detectou o sinal. A companhia detectou o sinal e depois encontrou o Veio.\n\nO material de investidores descreve a operação como extração mineral. O volume extraído até hoje não paga a folha de Pesquisa.\n\nNão estamos minerando. Estamos [REDACTED].',
    source: 'Sem departamento atribuído',
  },
  'AX-UNK-052': {
    title: 'O Modelo se Lembra',
    summary: 'A antecipação não é previsão. É reconhecimento.',
    body: 'O relatório do Incidente 32 pergunta como o módulo resolveu um rumo sem vetor de operador. A pergunta está mal formulada.\n\nDecompusemos a decisão. O módulo não extrapolou a trajetória da criatura: ele a RECONHECEU. A janela de investida, o ângulo, o terreno — a mesma situação consta, com variação inferior ao ruído, na telemetria terminal de [REDACTED] unidades do acervo de treino.\n\nO modelo não calcula o que o alvo vai fazer. Ele se lembra do que aquilo fez, das vezes em que quem registrou não sobreviveu ao registro.\n\nNão encontramos, na arquitetura, onde a lembrança termina e a unidade começa.',
    source: 'Sem departamento atribuído',
  },

  // -------------------------------------------------------------------------
  // Marcos geracionais
  // -------------------------------------------------------------------------
  'AX-GEN-G01': {
    title: 'Geração G-01 homologada',
    summary: 'A primeira incorporação. Rotina.',
    body: 'A telemetria recuperada foi incorporada à linha de produção.\n\nA geração G-01 entra em fabricação com as correções derivadas das expedições homologadas. Ganho médio de desempenho: dentro do previsto.\n\nA unidade anterior consta como baixa contábil do ciclo.',
    source: 'Produção — nota de homologação',
  },
  'AX-GEN-G02': {
    title: 'Geração G-02 homologada',
    summary: 'A linguagem começa a escorregar.',
    body: 'A geração G-02 incorpora telemetria de 38 expedições, das quais 31 terminaram sem recuperação física da unidade.\n\nObservação de Produção: o modelo comportamental da G-02 converge mais rápido que o da G-01, apesar do volume menor de dados de unidades que retornaram.\n\nAs unidades perdidas contribuem mais que as recuperadas. Não temos explicação para isso, e a linha de montagem não precisa de uma.',
    source: 'Produção — nota de homologação',
  },
  'AX-GEN-G03': {
    title: 'Geração G-03 homologada',
    summary: '"Geração" começa a soar como outra coisa.',
    body: 'A geração G-03 entra em fabricação.\n\nQuestão levantada por Produção e encaminhada ao Conselho: o termo "geração" descreve uma revisão de projeto ou uma linha de continuidade operacional?\n\nA distinção tem efeito contábil. Uma revisão é um produto novo. Uma continuidade é o mesmo ativo, depreciado.\n\nResposta do Conselho, na íntegra: "Prospector não é uma função. Prospector é uma linha de continuidade operacional."',
    source: 'Produção — nota de homologação',
  },
  'AX-GEN-G04': {
    title: 'Geração G-04 homologada',
    summary: 'O chassi de campo completo. E a pergunta que sobra.',
    body: 'A geração G-04 completa a especificação de campo da linha Prospector.\n\nO modelo comportamental da G-04 preserva 96% da estrutura do modelo da G-00. As camadas acrescentadas não substituíram as anteriores: elas se depositaram sobre elas.\n\nProdução registra, sem recomendação anexada, que a unidade que desce hoje carrega a estrutura de decisão de todas as que não voltaram.\n\nO Conselho classifica esta observação como [REDACTED] e mantém o cronograma de fabricação.',
    source: 'Produção — nota de homologação',
  },
};

const en: Record<LoreFragmentId, LoreText> = {
  'AX-PUB-001': {
    title: 'The Prospector Program',
    summary: 'The public version: no human life goes down into the Vein.',
    body: 'Aurix Dynamics is proud to announce the first fleet of autonomous survey units designed for the Vein.\n\nProspectors are latest-generation units, developed to protect human lives and expand the frontiers of industry. No human operator will ever need to descend again.\n\nEach unit returns with cleared material, complete telemetry, and the full record of the expedition. What a unit learns, the next generation already knows.',
    source: 'Institutional Communications — investor material',
  },
  'AX-PUB-002': {
    title: 'Standard-issue shell',
    summary: 'Armour presented as care for the unit.',
    body: 'The reinforced shell of the Prospector line has been validated across fifteen thousand impact cycles.\n\nEvery plate is engineered to keep the unit operational past the point where a human crew would have aborted the descent. That is the Aurix commitment: where a person would have to turn back, the machine keeps going.\n\nYour cargo arrives. Always.',
    source: 'Product Catalogue — Prospector line, 3rd edition',
  },
  'AX-PUB-003': {
    title: 'Next-generation servos',
    summary: 'Mobility sold as autonomy, not as escape.',
    body: 'The articulation of the Prospector line crosses terrain no surface vehicle can reach.\n\nOur engineers like to say the unit does not walk through the Vein: it negotiates with it. Rock, water, ice and debris are not obstacles, they are variables.\n\nEvery expedition improves the terrain model the next one will use.',
    source: 'Product Catalogue — Prospector line, 3rd edition',
  },
  'AX-PUB-005': {
    title: 'The reactor that never sleeps',
    summary: 'Heat presented as power, never as a limit.',
    body: 'The thermal core of the Prospector line sustains continuous operation across the entire expedition window.\n\nDissipation, weapons fire and transmission share one source. That is why the unit is never silent: even at rest, it is sending.\n\nAurix considers continuous transmission the most valuable asset of the platform.',
    source: 'Institutional Communications — investor material',
  },
  'AX-PUB-007': {
    title: 'Cartography without risk',
    summary: 'Survey sold as a service to science.',
    body: 'For the first time, the Vein is being mapped at no human cost.\n\nEvery Prospector carries survey instrumentation capable of recording formation, density and anomaly in real time. The data is the property of Aurix Dynamics and will be released to the scientific community on a schedule to be determined.\n\nThe schedule has not yet been determined.',
    source: 'Institutional Communications — press note',
  },
  'AX-PUB-009': {
    title: 'Cognitive Field Assistance',
    summary: 'Hesitation becomes a product defect — and Aurix sells the cure.',
    body: 'The Prospector line now ships with the Cognitive Field Assistance package.\n\nInternal studies indicate that up to 11% of risk exposure time stems from operational hesitation: the unit sees, but is slow to decide. The package removes that interval.\n\nThe unit remains in command of the mission. Assistance merely ensures that, between seeing and acting, there is no longer a space where anything can go wrong.',
    source: 'Institutional Communications — investor material',
  },

  'AX-ENG-011': {
    title: 'Impact cradles: specification',
    summary: 'Cushioning the shock protects what, exactly?',
    body: 'The impact cradles reduce shock transfer to the central compartment.\n\nTeam note: the original specification called for damping on the cargo compartment. The revision extended the requirement to the processing core housing at the request of Research, with no justification attached.\n\nWe have logged the extension. We were not told why.',
    source: 'Structural Engineering — CA-02 datasheet',
  },
  'AX-ENG-013': {
    title: 'Dodge relay: tolerance',
    summary: 'The unit reacts faster than the model allows.',
    body: 'The dodge relay is calibrated for an 18-cycle reaction window.\n\nIn field trials, 4 units out of 60 executed the manoeuvre below the theoretical minimum window. The calibration does not permit this.\n\nHypothesis logged: telemetry latency in measurement. Hypothesis untested. Trial closed on budget exhaustion.',
    source: 'Control Engineering — MV-02 trial report',
  },
  'AX-ENG-015': {
    title: 'Salvage trace: range',
    summary: 'The sensor finds terminals nobody installed.',
    body: 'The shoulder sensor locates recovery terminals within a radius of 18 tiles.\n\nField note: on three descents the trace pointed at terminals absent from the Aurix inventory. Compatible equipment, compatible protocol, no serial number.\n\nWe have requested guidance on how to catalogue compatible equipment of unknown origin. No reply as of this filing.',
    source: 'Sensor Engineering — SV-02 datasheet',
  },
  'AX-ENG-018': {
    title: 'Thermal collector: margin',
    summary: 'The heat ceiling rises. What it protects is not the chassis.',
    body: 'The collector raises the operational thermal ceiling from 100 to 105.\n\nThe additional margin has been allocated in full to the transmission package, per directive. Preservation of the chassis remains an acceptable secondary effect.\n\nThe team requests that the directive be attached to this document. The directive was not attached.',
    source: 'Thermal Engineering — RX-02 datasheet',
  },
  'AX-ENG-020': {
    title: 'Hostile Classifier Specification',
    summary: 'Three classes, two thresholds, and the first false positives.',
    body: 'The classifier distinguishes three postures: hostile, passive and fleeing. Transitions use two observed-behaviour thresholds, calibrated on the bench.\n\nField trial: 96.4% accuracy. The false positives concentrate in a single case — extraction units of the previous generation, stationary, classified as hostile before any movement.\n\nTeam hypothesis: the model recognises something in them the bench does not measure. Hypothesis logged, not forwarded.',
    source: 'Systems Engineering — IA-02 specification',
  },

  'AX-PRC-014': {
    title: 'Replacement versus recovery',
    summary: 'The arithmetic that decided everything that followed.',
    body: 'Comparative analysis: unit replacement versus recovery operation.\n\nAverage cost of a recovery operation in the Vein: 4.1 unit equivalents. Cost of manufacturing a new unit with recovered telemetry incorporated: 1.0.\n\nRecommendation: discontinue recovery operations. Cargo recovery remains mandatory.\n\nPhysical unit recovery rate remains below 8%.',
    source: 'Procurement and Costs — opinion to the Board',
  },
  'AX-PRC-016': {
    title: 'Evacuation routes',
    summary: 'What was cut from the budget, and what was not.',
    body: 'Item removed from next cycle budget: maintenance of the evacuation routes in Sectors 2 and 3.\n\nJustification: the routes were used in 0.4% of expeditions. The return protocol does not need to preserve mobility after arrival — the unit must reach the platform. No further requirement was requested.\n\nItem retained in budget: signage for the clearance platform.',
    source: 'Procurement and Costs — budget review',
  },
  'AX-PRC-019': {
    title: 'Transmission package draw',
    summary: 'The unit spends more reactor transmitting than shooting.',
    body: 'Average reactor consumption per expedition: locomotion 31%, weapons 18%, dissipation 12%, transmission 39%.\n\nTransmission is the single largest consumer on the platform. Procurement recommends maintaining the current priority.\n\nQuestion raised in review: why does a mining unit transmit more than it mines? Question referred to Research. No reply.',
    source: 'Procurement and Costs — quarterly report',
  },
  'AX-PRC-021': {
    title: 'Sector Three cartographic revision',
    summary: 'The maps changed. The explanation did not.',
    body: 'The Sector Three maps are not changing. The prior cartography was incomplete.\n\nThis is the third revision of the same formation in two cycles. Each revision was classified as a correction of the previous survey.\n\nDo not forward this conclusion to the investor relations team.',
    source: 'Procurement and Costs — internal memorandum',
  },
  'AX-PRC-024': {
    title: 'Behavioural Telemetry Acquisition',
    summary: 'The anticipation model was bought ready-made. From whom, the invoice says.',
    body: 'Cost of producing the anticipation module training set in a controlled environment: 340 unit-equivalents.\n\nCost of licensing the internal terminal telemetry archive — expeditions closed without physical recovery of the unit: 0.\n\nProcurement recommends the internal archive. The module predicts a target’s trajectory from what the units that faced it recorded. The units that recorded the most are the ones that did not come back.\n\nThe recommendation was approved without reservation.',
    source: 'Procurement and Costs — licensing opinion',
  },

  'AX-INC-023': {
    title: 'Incident 23 — uncommanded return',
    summary: 'The unit came back by a route that was not on the map.',
    body: 'Unit [REDACTED] lost command link at 04:12 in Sector Two.\n\nAt 05:47 the unit reached the Sector One platform. The path recorded by telemetry corresponds to no known route through the formation. Two stretches cross rock that the prior survey classified as solid.\n\nThe unit received no return command. There was no command to receive.',
    source: 'Incident Committee — preliminary report',
  },
  'AX-INC-025': {
    title: 'Incident 25 — survey team',
    summary: 'The contamination reacted to being watched.',
    body: 'Survey team [REDACTED] installed passive instrumentation in the Sector [REDACTED] fissure at 11:20.\n\nContamination density in the area rose 340% in eighteen minutes. No unit was operated, no excavation was performed, no thermal source was engaged.\n\nThe instrumentation was recovered. The team was not.\n\nRecommendation: suspend human survey. Autonomous unit survey remains authorised.',
    source: 'Incident Committee — preliminary report',
  },
  'AX-INC-027': {
    title: 'Incident 27 — residual activity',
    summary: 'The batch kept processing after it was lost.',
    body: 'Batch [REDACTED] showed residual neural activity for 17 minutes after complete structural loss of the unit.\n\nThe core housing, protected by the impact cradles specified in CA-02, remained intact. Processing continued. Transmission continued.\n\nThe content transmitted during those 17 minutes has been archived and does not appear in this report.\n\nCommittee note: the extended damping specification fulfilled the purpose for which it was requested.',
    source: 'Incident Committee — preliminary report',
  },
  'AX-INC-029': {
    title: 'Incident 29 — echo pattern',
    summary: 'The reactor emitted in the same pattern as the Echoes.',
    body: 'During the overload trial, the reactor of unit [REDACTED] emitted for 9 seconds in a pattern absent from the platform emission library.\n\nThe pattern appears in the Echo library, catalogued by Research prior to the commercial launch of the program.\n\nThe match is 94%.\n\nThe trial was terminated. The unit was terminated.',
    source: 'Incident Committee — preliminary report',
  },
  'AX-INC-032': {
    title: 'Incident 32 — fire without operator vector',
    summary: 'The unit opened fire. Nobody aimed.',
    body: 'Unit [REDACTED] fired three shots in Sector Two at 09:41.\n\nThe command log for the interval contains no directional vector. It contains the intent to fire and no heading. The assistance module resolved the heading, within specified tolerance.\n\nAll three shots struck a creature inside its charge window, before contact. The intervention is classified as successful.\n\nThe question referred to Engineering is not about the hit. It is about the specification having a tolerance for "no heading".',
    source: 'Incident Committee — preliminary report',
  },

  'AX-EXE-031': {
    title: 'Executive directive 31',
    summary: 'No asset shall be risked to recover another.',
    body: 'It is hereby determined that no unit in operation shall be diverted from its contract route to assist another unit, regardless of the state of the assisted unit.\n\nThe Board acknowledges that this directive contradicts prior guidance from Control Engineering. The prior guidance is revoked.\n\nUnits that disregard this directive are to be logged for behavioural compliance review.',
    source: 'Executive Board — directive',
  },
  'AX-EXE-033': {
    title: 'Asset reclassification',
    summary: 'The unit stops being equipment and becomes a ledger line.',
    body: 'Effective this cycle, Prospector units are classified as short-cycle depreciable assets rather than field equipment.\n\nConsequences: unit loss no longer triggers a mandatory incident report; accounting becomes monthly and aggregated; the "cause" field becomes optional.\n\nThe Incident Committee raised an objection. The objection was logged. [REDACTED] left the company in the same cycle.',
    source: 'Executive Board — accounting decision',
  },
  'AX-EXE-036': {
    title: 'Emergency governor',
    summary: 'The safety limit was lowered by decision, not by engineering.',
    body: 'The emergency thermal governor shall be calibrated to engage 4 cycles later than the Engineering specification.\n\nJustification: early engagement interrupts transmission. The thermal governor protects the transmission package. Preservation of the chassis is an acceptable secondary effect.\n\nThermal Engineering has logged that the change increases the incidence of structural damage from overload. The change is approved.',
    source: 'Executive Board — directive',
  },
  'AX-EXE-038': {
    title: 'Deep survey classification',
    summary: 'What Aurix found before it sold the program.',
    body: 'All survey material predating the commercial launch of the Prospector program is hereby reclassified as [REDACTED].\n\nThis includes: the formation emission records, the Echo catalogue, and the investment decision documentation.\n\nEnquiries regarding the origin of the company interest in the Vein are to be referred to Institutional Communications, which holds the approved answer.',
    source: 'Executive Board — classification order',
  },
  'AX-EXE-040': {
    title: 'Preemptive Engagement Directive',
    summary: 'The system earns the right to decide what a threat is.',
    body: 'Preemptive engagement mode is hereby authorised: the assistance module may hold acquisition on an engaged target and transfer it to the next target without a new operator vector.\n\nThe definition of "threat" ceases to be a criterion fixed in specification and becomes [REDACTED], updatable by the model itself with each generation.\n\nSystems Engineering requested that the current definition be archived at every revision, for audit. The request was denied: the definition is the model.',
    source: 'Executive Board — directive',
  },

  'AX-UNK-041': {
    title: 'On what survives',
    summary: 'What the 17 minutes transmitted.',
    body: 'The file omitted from AX-INC-027 appears in this record.\n\nAcross those 17 minutes, batch [REDACTED] transmitted, on repeat: the topography of the final stretch, the cargo reading, and a sequence of 40 symbols the library does not recognise.\n\nThe same sequence appears in the terminal transmission of eleven other units, across four sectors, over two cycles.\n\nThe eleven units shared no telemetry. There was no link between them.',
    source: 'No department assigned',
  },
  'AX-UNK-044': {
    title: 'On who steers',
    summary: 'The impossible routes are not random.',
    body: 'The uncommanded paths from AX-INC-023 and six other incidents have been overlaid.\n\nThey are not random. They converge. The convergence point is not the clearance platform — the platform is 60 tiles away from it.\n\nThe units pass through the point and continue to the platform. Every one of them halts at the point for an interval consistent with [REDACTED] before moving on.\n\nNone of them recorded what was there.',
    source: 'No department assigned',
  },
  'AX-UNK-047': {
    title: 'On what answers',
    summary: 'The 94% match was not imitation.',
    body: 'The 94% match between the overloaded reactor and the Echo library was treated as spectral coincidence.\n\nIt is not. The remaining 6% is the difference between an emission and a RESPONSE to one: the reactor pattern arrives 0.4 seconds later, same structure, phase inverted.\n\nThe reactor was not emitting like an Echo. It was answering one.\n\nThe question we cannot put to Research without being reclassified: how long have they been talking?',
    source: 'No department assigned',
  },
  'AX-UNK-049': {
    title: 'On why we went down',
    summary: 'The investment decision came after the signal.',
    body: 'The material reclassified under AX-EXE-038 establishes the chronology the company does not publish.\n\nThe formation emission record predates the investment decision by eleven months.\n\nThe company did not find the Vein and then detect the signal. The company detected the signal and then found the Vein.\n\nInvestor material describes the operation as mineral extraction. The volume extracted to date does not cover the Research payroll.\n\nWe are not mining. We are [REDACTED].',
    source: 'No department assigned',
  },
  'AX-UNK-052': {
    title: 'The Model Remembers',
    summary: 'Anticipation is not prediction. It is recognition.',
    body: 'The Incident 32 report asks how the module resolved a heading without an operator vector. The question is badly posed.\n\nWe decomposed the decision. The module did not extrapolate the creature’s trajectory: it RECOGNISED it. The charge window, the angle, the terrain — the same situation appears, with variation below noise, in the terminal telemetry of [REDACTED] units in the training archive.\n\nThe model does not compute what the target will do. It remembers what that thing did, the times when whoever recorded it did not survive the recording.\n\nWe could not find, anywhere in the architecture, where the memory ends and the unit begins.',
    source: 'No department assigned',
  },

  'AX-GEN-G01': {
    title: 'Generation G-01 cleared',
    summary: 'The first incorporation. Routine.',
    body: 'Recovered telemetry has been incorporated into the production line.\n\nGeneration G-01 enters manufacture with the corrections derived from cleared expeditions. Average performance gain: within forecast.\n\nThe prior unit is recorded as an accounting write-off for the cycle.',
    source: 'Production — clearance note',
  },
  'AX-GEN-G02': {
    title: 'Generation G-02 cleared',
    summary: 'The language starts to slip.',
    body: 'Generation G-02 incorporates telemetry from 38 expeditions, 31 of which ended without physical recovery of the unit.\n\nProduction note: the G-02 behavioural model converges faster than G-01, despite the smaller volume of data from units that returned.\n\nLost units contribute more than recovered ones. We have no explanation for this, and the assembly line does not require one.',
    source: 'Production — clearance note',
  },
  'AX-GEN-G03': {
    title: 'Generation G-03 cleared',
    summary: '"Generation" starts to sound like something else.',
    body: 'Generation G-03 enters manufacture.\n\nQuestion raised by Production and referred to the Board: does the term "generation" describe a design revision or a line of operational continuity?\n\nThe distinction has accounting effect. A revision is a new product. A continuity is the same asset, depreciated.\n\nBoard reply, in full: "Prospector is not a role. Prospector is a line of operational continuity."',
    source: 'Production — clearance note',
  },
  'AX-GEN-G04': {
    title: 'Generation G-04 cleared',
    summary: 'The full field chassis. And the question left over.',
    body: 'Generation G-04 completes the field specification of the Prospector line.\n\nThe G-04 behavioural model preserves 96% of the structure of the G-00 model. The added layers did not replace the earlier ones: they settled on top of them.\n\nProduction records, with no recommendation attached, that the unit descending today carries the decision structure of every unit that did not come back.\n\nThe Board classifies this observation as [REDACTED] and maintains the manufacturing schedule.',
    source: 'Production — clearance note',
  },
};

export const LORE_TEXT: Record<LoreLocale, Record<LoreFragmentId, LoreText>> = {
  'pt-BR': pt,
  en,
};

export const LORE_LOCALES: readonly LoreLocale[] = ['pt-BR', 'en'];

export const isLoreLocale = (value: unknown): value is LoreLocale =>
  value === 'pt-BR' || value === 'en';
