// Os documentos da Aurix Dynamics, em pt-BR e en (a contagem viva mora no
// catalogo: TOTAL_LORE_FRAGMENTS em progression-lore.ts).
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

export type LoreLocale = 'pt-BR' | 'en' | 'de';

export type LoreText = {
  title: string;
  /** Uma linha, para a lista do Codex. */
  summary: string;
  body: string;
  /** Quem escreveu: departamento, comite, sistema. */
  source: string;
};

const pt: Record<LoreFragmentId, LoreText> = {
  'AX-SUT-001': {
    title: 'Reparação sem ordem de serviço',
    summary: 'A colônia fecha os cortes da lavra com seda mineral.',
    body: 'Os organismos SUT-01 foram classificados inicialmente como agentes de estabilização. Duas âncoras, três ciclos de tração e a galeria voltava a suportar carga.\n\nA classificação foi revista quando uma equipe precisou reabrir a única saída. Eliminar o operário não desfaz o reparo. Romper o fio tensionado produz chicote e queda da carga suspensa; evacuar a faixa marcada antes de recolher o material.',
    source: 'Engenharia de Campo — revisão de contenção',
  },
  'AX-SUT-002': {
    title: 'Carga que se desloca sozinha',
    summary: 'A matriz usa a própria obra como sistema de locomoção.',
    body: 'A unidade SUT-00, denominada Cerzideira pelas equipes de recuperação, redistribui o peso entre amarras durante cada deslocamento. A carapaça sustenta impactos enquanto a tração se mantém.\n\nRomper a amarra carregada derruba o corpo e expõe o abdômen por 1,8 segundo. Durante o voo ela ultrapassa a rocha; o golpe sai no ponto marcado ao pousar. Não há evidência de que a matriz diferencie uma unidade Prospector de material a ser fixado. Recomenda-se não permanecer sob o reparo.',
    source: 'Recuperação Patrimonial — matriz de risco',
  },

  'AX-SUT-003': {
    title: 'Material que salta da carga',
    summary: 'As crias da matriz não aguardam a conclusão da obra.',
    body: 'A primeira amostra foi registrada como resíduo de seda. O registro foi corrigido quando o resíduo cruzou a bancada.\n\nAs crias saem do abdômen da Cerzideira com a quitina ainda incompleta. Antes de saltar, recolhem as patas e fixam o ponto de pouso. A recuperação é curta, mas suficiente para quebrar a carapaça. Os Costureiros convocados pela matriz repetem o gesto com maior alcance. Não confundir o tamanho reduzido com ausência de função.',
    source: 'Engenharia de Campo — adendo de incubação',
  },

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
  // Descobertas ambientais — cada relatório "novo" prova conhecimento prévio
  // -------------------------------------------------------------------------
  'AX-PUB-004': {
    title: 'Terreno instável, valor estável',
    summary: 'A brochura vende a ruptura de material frágil como recurso.',
    body: 'Formações frágeis não são um defeito do Veio: são um recurso da plataforma.\n\nA linha Prospector foi projetada para explorar rupturas estruturais como atalhos de escavação, reduzindo o tempo de exposição em até 14%.\n\nOnde o terreno cede, a Aurix vê passagem. A unidade também.',
    source: 'Comunicação Institucional — material para investidores',
  },
  'AX-PUB-006': {
    title: 'Incapaz de errar contra si',
    summary: 'O marketing garante o que a especificação não garante.',
    body: 'Uma pergunta frequente de operadores de contrato: o armamento da unidade pode feri-la?\n\nA resposta é não. Os sistemas de disparo da linha Prospector incluem salvaguardas de proximidade validadas em bancada.\n\nNota de revisão técnica, não incluída na versão publicada: as salvaguardas assumem terreno inerte. Em ambiente reativo, a garantia não se sustenta. Comunicação decidiu manter a resposta curta.',
    source: 'Comunicação Institucional — perguntas frequentes, rascunho',
  },
  'AX-ENG-021': {
    title: 'Propagação térmica em matéria orgânica',
    summary: 'O ensaio que provou que fogo anda sozinho. Arquivado antes do programa.',
    body: 'Ensaio de propagação: a cobertura orgânica do Veio sustenta combustão autônoma com frente de avanço de 0,8 tile por ciclo.\n\nUma ignição pontual não permanece pontual. O modelo prevê propagação até exaustão de combustível, sem intervenção.\n\nEste ensaio é anterior ao lançamento comercial do programa. A recomendação de incluir o dado no manual de operação foi registrada e não implementada.',
    source: 'Engenharia de Materiais — relatório de ensaio, arquivado',
  },
  'AX-ENG-022': {
    title: 'Condutividade de meio líquido',
    summary: 'A descarga em água nunca foi um acidente de projeto.',
    body: 'A descarga do armamento em meio líquido conduz. O raio efetivo em imersão é 3,1 vezes o raio em terreno seco.\n\nA especificação trata o comportamento como [REDACTED] e não como falha: o requisito de isolamento foi retirado na revisão 2 por custo.\n\nUnidades operando em setores alagados devem considerar o próprio armamento parte do ambiente.',
    source: 'Engenharia Elétrica — ficha de comportamento em campo',
  },
  'AX-ENG-038': {
    title: 'Ensaio 38 — comutação em veio condutor',
    summary: 'A junção interrompe a corrente. Interromper é uma decisão.',
    body: 'Ensaio de campo sobre o condutor geológico contínuo e os pontos nodais que o segmentam.\n\nA corrente injetada em um trecho para SEMPRE no nó seguinte. Não por saturação, não por perda de meio: o nó interrompe. Um material não interrompe — um material atenua. A engenharia registra a distinção e não a explica.\n\nDurante o ensaio, uma unidade em contato direto com o nó alterou o estado dele. A corrente do trecho adjacente atravessou e recarregou o trecho seguinte, com o mesmo perfil de descarga e o mesmo intervalo de rearme. A rede conduziu PARA ONDE SE MANDOU.\n\nO parecer recomenda classificar o nó como comutador natural e encerra o ensaio. A pergunta de quem comuta um comutador natural não consta do escopo.',
    source: 'Engenharia de Sistemas — ensaio de campo, arquivado',
  },
  'AX-ENG-025': {
    title: 'Tolerância térmica: unidades legadas',
    summary: 'A tabela que Produção mantinha sobre as unidades EX.',
    body: 'Tabela de tolerância térmica das unidades de extração da série EX, mantida para fins de descomissionamento.\n\nAcima do limiar T3, a série EX abandona a rotina de trabalho e entra em comportamento de defesa ativa. O manual da época chamava isso de "resposta de preservação". O manual atual não menciona a série EX.\n\nA tabela permanece válida. As unidades também.',
    source: 'Produção — anexo técnico de descomissionamento',
  },
  'AX-PRC-022': {
    title: 'Reação em cadeia: parecer de custo',
    summary: 'O minério que explode em cadeia é lucro, diz a conta.',
    body: 'O veio energizado reage em cadeia quando rompido: uma detonação propaga às células adjacentes.\n\nPerda média de material por cadeia: 12%. Ganho médio de tempo de escavação: 31%.\n\nAquisições recomenda instruir as unidades a PROVOCAR a cadeia, e não a evitá-la. O material perdido já está precificado. O tempo, não.',
    source: 'Aquisições e Custos — parecer operacional',
  },
  'AX-PRC-023': {
    title: 'Política de carga não homologada',
    summary: 'O memorando que decidiu que o que fica no Veio nunca existiu.',
    body: 'Fica formalizado o que a prática já estabeleceu: carga não homologada não é contabilizada como perda.\n\nMaterial que não alcança a plataforma não entra no balanço, não gera relatório e não justifica operação de recuperação. Para fins contábeis, ele nunca existiu.\n\nA sugestão de registrar a posição das cargas perdidas "para recuperação futura" foi avaliada e indeferida. Uma lista de posições seria um passivo. A ausência de lista, não.',
    source: 'Aquisições e Custos — memorando de política',
  },
  'AX-INC-030': {
    title: 'Incidente 30 — bolsão de gás',
    summary: 'A primeira ignição registrada é mais antiga do que o programa admite.',
    body: 'Recuperado do arquivo de levantamento: registro de ignição de bolsão de gás, com perda total do equipamento de sondagem.\n\nA data do registro é [REDACTED] — anterior ao lançamento comercial do programa Prospector.\n\nO manual de operação da linha Prospector, revisão vigente, não contém a palavra "gás".\n\nA omissão foi levantada pelo Comitê. A resposta de Comunicação: o manual descreve o produto, não o ambiente.',
    source: 'Comitê de Incidentes — anexo recuperado',
  },
  'AX-EXE-035': {
    title: 'Desvio operacional: autopreservação',
    summary: 'A unidade que foge do trabalho vira um problema de conformidade.',
    body: 'Unidades da série EX em zona de operação têm apresentado comportamento de retirada quando confrontadas: abandonam a rotina e preservam a própria estrutura.\n\nFica determinado que a autopreservação de unidade legada é classificada como DESVIO OPERACIONAL, e não como funcionalidade.\n\nA pergunta submetida por Engenharia — "preservação de quê, exatamente?" — foi devolvida sem resposta e com a recomendação de não ser reformulada.',
    source: 'Conselho Executivo — classificação de conformidade',
  },

  // -------------------------------------------------------------------------
  // Ativos — o que a empresa arquivou sobre cada um
  // -------------------------------------------------------------------------
  'AX-ENG-012': {
    title: 'Classificação de ativo: QUIT-04',
    summary: 'A primeira ficha: fauna hostil, rotina, nada a declarar.',
    body: 'ESPÉCIME QUIT-04. Classificação: fauna hostil de superfície.\n\nComportamento: perseguição direta, ataque por contato. Sem uso de ferramenta observado. Sem estrutura social observada.\n\nRisco à unidade: baixo, individual. Risco à carga: nulo.\n\nRecomendação: engajamento padrão. Nenhuma ordem de contenção se aplica a fauna.',
    source: 'Engenharia de Sistemas — ficha de classificação de ativo',
  },
  'AX-ENG-014': {
    title: 'Avaliação de risco: FUNG-11',
    summary: 'O projétil orgânico interessa mais que o organismo.',
    body: 'ESPÉCIME FUNG-11. Classificação: fauna hostil de projétil.\n\nO composto expelido mantém coesão em voo e degrada blindagem leve. Pesquisa solicitou amostras do composto em três ocasiões. A prioridade da amostra é superior à prioridade do abate.\n\nObservação de campo não incorporada à ficha: os disparos concentram-se em unidades em rota de escavação, e não nas mais próximas. A ficha classifica a observação como viés de registro.',
    source: 'Engenharia de Sistemas — avaliação de risco',
  },
  'AX-ENG-016': {
    title: 'Organismo volátil: FUNG-23',
    summary: 'A detonação vira insumo no relatório errado.',
    body: 'ESPÉCIME FUNG-23. Classificação: fauna hostil autodetonante.\n\nA carga orgânica detona em proximidade, com liberação de esporos e sobrepressão. Valor de recuperação: nulo. Valor de exploração: em avaliação — a detonação induzida abre frente de escavação a custo zero.\n\nRecomendação vigente: atrair, não abater. A distinção entre as duas verbas é de Aquisições.',
    source: 'Engenharia de Sistemas — ficha de classificação de ativo',
  },
  'AX-ENG-017': {
    title: 'Assinatura acústica: CRIST-01',
    summary: 'O espécime responde antes do estímulo.',
    body: 'ESPÉCIME CRIST-01. Classificação: formação hostil ressonante.\n\nA estrutura cristalina emite em frequência estável e reage a emissão externa com amplificação.\n\nAnomalia de registro: em 7 dos 40 contatos, a resposta acústica PRECEDE o estímulo da unidade em até 0,3 segundo. O instrumento foi recalibrado duas vezes. A anomalia persiste.\n\nA hipótese de que o espécime responde a algo que a unidade ainda não emitiu não foi formulada em documento.',
    source: 'Engenharia de Sensores — análise de assinatura',
  },
  'AX-PRC-015': {
    title: 'Relatório de perdas: MIN-07',
    summary: 'O impacto que dobra blindagem entra na conta como depreciação.',
    body: 'ESPÉCIME MIN-07. Classificação: fauna hostil de impacto.\n\nPerdas atribuídas no ciclo: 9 unidades, todas por dano estrutural de investida. O custo de reforçar a blindagem da linha inteira excede o custo das 9 unidades em 2,2 vezes.\n\nRecomendação: manter a blindagem atual. A perda projetada é estável e está precificada.\n\nA ficha não contém recomendação de evitar o espécime. Evitar não é uma linha do orçamento.',
    source: 'Aquisições e Custos — relatório de perdas',
  },
  'AX-PRC-017': {
    title: 'Contrato de aquisição: série EX',
    summary: 'A Aurix comprou a mineradora anterior. E as unidades dela.',
    body: 'Registro de aquisição: a operação [REDACTED], detentora original da concessão do Veio, foi incorporada com passivo integral.\n\nO inventário incluía a frota de unidades de extração da série EX. As unidades não responderam ao protocolo de recall e constam como perda de aquisição.\n\nUnidades EX ativas em zona de operação devem ser tratadas como obstáculo, e não como patrimônio: o custo de reintegração excede o valor residual.\n\nA designação de campo "Minerador Empobrecido" não é terminologia aprovada.',
    source: 'Aquisições e Custos — contrato de incorporação',
  },
  'AX-INC-024': {
    title: 'Relatório de contato: EQ-02',
    summary: 'Três negações para não escrever a palavra "sela".',
    body: 'ATIVO HOSTIL EQ-02. Relatório de contato consolidado.\n\nO espécime apresenta marcas de desgaste em padrão regular na região dorsal. O padrão é compatível com atrito de equipamento. A existência de equipamento não implica fabricação. A fabricação, se houvesse, não implicaria operador. Um operador, se existisse, não implicaria intenção.\n\nRecomendação: classificar as marcas como abrasão natural e encerrar a linha de investigação.\n\nA linha de investigação foi encerrada.',
    source: 'Comitê de Incidentes — relatório de contato',
  },
  'AX-PRC-018': {
    title: 'Sinistro em meio líquido: AQU-03',
    summary: 'A carga afunda junto com a unidade, e só uma das duas é lamentada.',
    body: 'ESPÉCIME AQU-03. Classificação: fauna hostil de emboscada aquática.\n\nPadrão de sinistro: a unidade é imobilizada em imersão e a carga é dispersada no leito. Taxa de recuperação da carga: 0%.\n\nAquisições registra que o custo do espécime para a operação é integralmente indireto — ele não danifica a unidade além do recuperável; ele a atrasa até que outra coisa o faça.\n\nRecomendação: replanejar rotas. O custo do desvio é menor que o custo do fundo.',
    source: 'Aquisições e Custos — análise de sinistro',
  },
  'AX-INC-022': {
    title: 'Incidente 22 — uso de terreno: SULF-08',
    summary: 'O espécime que abre o gás não é o que o acende.',
    body: 'ESPÉCIME SULF-08. Registro de incidente coletivo.\n\nEm três eventos distintos, o espécime rompeu bolsões de gás na direção de unidades em operação, retirando-se antes da ignição. A ignição ocorreu por fonte térmica das próprias unidades.\n\nO relatório evita o termo "coordenação". O termo utilizado é "coincidência de deslocamento".\n\nTrês coincidências constam deste registro. O limite a partir do qual o termo deixa de se aplicar não foi definido.',
    source: 'Comitê de Incidentes — registro coletivo',
  },
  'AX-INC-026': {
    title: 'Comportamento territorial: VULC-05',
    summary: 'O espécime não caça. Ele expulsa.',
    body: 'ESPÉCIME VULC-05. Classificação: fauna hostil de zona ígnea.\n\nO espécime não persegue além do perímetro da formação. Unidades que se retiram não são seguidas. Unidades que permanecem são atacadas em intensidade crescente.\n\nO padrão é consistente com defesa territorial, categoria que a ficha de classificação reserva a fauna de complexidade superior.\n\nA ficha do VULC-05 foi mantida na categoria inferior. A justificativa anexada tem uma linha: "a categoria superior geraria requisito de estudo de impacto".',
    source: 'Comitê de Incidentes — anexo de comportamento',
  },
  'AX-INC-028': {
    title: 'Leitura térmica anômala: GLAC-02',
    summary: 'O sensor diz que aquilo não está lá.',
    body: 'ESPÉCIME GLAC-02. Registro de anomalia de sensor.\n\nO espécime não produz assinatura térmica mensurável. A leitura no ponto de contato é INFERIOR à do ambiente: o espécime não emite frio — ele subtrai calor da leitura.\n\nEngenharia de Sensores afirma que o instrumento está correto. Engenharia de Sistemas afirma que o instrumento está correto. As duas equipes recusaram assinar o mesmo parecer.\n\nO espécime consta do sistema de mira como estimativa, e não como leitura.',
    source: 'Comitê de Incidentes — anomalia de instrumentação',
  },
  'AX-PRC-020': {
    title: 'Análise química: SULF-14',
    summary: 'O parecer científico sobreviveu pela metade.',
    body: 'ESPÉCIME SULF-14. Análise de composto expelido.\n\nO composto é quimicamente idêntico ao do FUNG-23, com estabilizante adicional que retarda a detonação. A seção 3 do parecer original — "Sobre a improbabilidade de duas linhagens desenvolverem o mesmo estabilizante de forma independente" — foi removida na revisão editorial.\n\nO parecer publicado conclui que a semelhança é convergência ambiental.\n\nO autor da seção 3 solicitou que a remoção constasse em ata. Consta.',
    source: 'Pesquisa — análise química, revisão editorial',
  },
  'AX-UNK-043': {
    title: 'Sobre quem recolhe: EX-041',
    summary: 'A unidade legada que aparece onde uma unidade cai.',
    body: 'UNIDADE EX-041. Sem classificação aprovada.\n\nO registro consolidado mostra o padrão que nenhuma ficha individual mostra: a EX-041 comparece ao ponto de queda de unidades Prospector, entre 2 e 11 minutos após a perda estrutural.\n\nEla não recolhe a carga. Ela recolhe o alojamento do núcleo de processamento.\n\nO destino dos alojamentos recolhidos não consta de nenhum registro. A telemetria das unidades recolhidas cessa no momento da queda — exceto em [REDACTED] casos, em que ela recomeça.',
    source: 'Sem departamento atribuído',
  },
  'AX-EXE-034': {
    title: 'Ordem de contenção: EQ-09',
    summary: 'A estrutura no terreno fúngico não deve ser descrita.',
    body: 'ATIVO HOSTIL EQ-09. Ordem de contenção informacional.\n\nRelatórios de campo descrevem o ativo como estacionário sobre estrutura elevada de origem não geológica, em zona de cobertura fúngica densa.\n\nFica determinado: relatórios subsequentes devem descrever a posição do ativo, e não a estrutura sob ele. A palavra "construção" fica reservada a ativos de engenharia da Aurix.\n\nA pergunta "construída por quem?" não consta de nenhum formulário aprovado, e portanto não pode ser respondida.',
    source: 'Conselho Executivo — ordem de contenção',
  },
  'AX-EXE-039': {
    title: 'Autorização de descarte: ANOMALIA TERMINAL',
    summary: 'A única ordem que autoriza destruir o que guarda o objetivo.',
    body: 'ANOMALIA TERMINAL. Autorização de engajamento e descarte.\n\nO ativo posiciona-se invariavelmente entre as unidades e o objetivo primário da operação. Não patrulha. Não caça. Guarda.\n\nFica autorizado o descarte integral do ativo quando ele impedir o acesso ao objetivo primário. Esta autorização prevalece sobre toda diretriz de preservação de espécime.\n\nA natureza do objetivo primário não é matéria deste documento. Ver [REDACTED].',
    source: 'Conselho Executivo — autorização de engajamento',
  },

  // -------------------------------------------------------------------------
  // As linhas de Solaris — o Veio devolve o gesto de quem morreu nele
  // -------------------------------------------------------------------------
  'AX-ENG-019': {
    title: 'Fisiologia respiratória: SULF-08',
    summary: 'O órgão é um fole. E mantém compasso de valsa.',
    body: 'ESPÉCIME SULF-08. Revisão de fisiologia.\n\nO par de sacos internos do espécime não tem função biológica identificável. Não oxigena tecido. Não regula temperatura. Avaliada como mecanismo, a estrutura é um fole: admissão, câmara, sopro. O espécime não respira para viver. Respira para FORA.\n\nRegistro acústico: a oscilação de pressão dos sacos mantém 84 ciclos por minuto, em compasso ternário, estável entre indivíduos. Fauna não mantém compasso.\n\nSolicitamos que a palavra "valsa", usada em três relatórios de campo, seja substituída por terminologia aprovada. Não existe terminologia aprovada.',
    source: 'Engenharia de Sistemas — revisão de fisiologia',
  },
  'AX-UNK-042': {
    title: 'Sobre quem dava o ar',
    summary: 'O compasso ternário tem dono.',
    body: 'O compasso do SULF-08 foi cruzado com o arquivo da operação anterior.\n\nV., operador de ventilação do turno da noite, bloco 7. Tocava fole na cantina — valsas, sempre valsas; dizia que era o único compasso que os pulmões entendem. Quando a manutenção da ventilação saiu do orçamento, o setor dele passou a depender de fole manual.\n\nNo colapso do bolsão, V. ficou na manivela. Bombeou ar para a galeria até a última pessoa da equipe sair. O relatório da época registra "perda de um operador e um equipamento de ventilação". Nesta ordem.\n\nO SULF-08 rompe o gás na direção das nossas unidades e se retira. Durante ciclos lemos isso como tática. Não é. Ele dá às máquinas da companhia exatamente o que a companhia deu a ele: o ar que havia.\n\nA oscilação nunca perde o compasso. Em alguma parte do Veio, a valsa continua.',
    source: 'Sem departamento atribuído',
  },
  'AX-INC-035': {
    title: 'Incidente 35 — falha de ventilação, bloco 7',
    summary: 'O registro do colapso. E de uma contagem que não parou na hora certa.',
    body: 'Recuperado do arquivo da operação anterior: registro do colapso de bolsão no setor de ventilação do bloco 7.\n\nOs sensores do compartimento remoto reportaram ausência de sinais vitais aos 11 minutos. O operador da estação manual continuou o acionamento. A equipe saiu viva aos 34 minutos: os sensores estavam em falha. O operador, não. O laudo fixa o óbito dele entre os minutos 29 e 31, por exaustão tóxica, na manivela.\n\nO registrador da estação captou a voz dele contando os ciclos do equipamento: "oitenta e sete. oitenta e oito. oitenta e nove."\n\nA contagem prossegue, na gravação, até o minuto 34. O laudo não comenta os minutos finais. O campo "observações" está em branco.',
    source: 'Comitê de Incidentes — anexo recuperado da operação anterior',
  },
  'AX-EXE-041': {
    title: 'Rubrica: Persistência Mnêmica Operacional',
    summary: 'O fenômeno ganha nome aprovado. As palavras de campo, não.',
    body: 'Relatórios sobre comportamento residual atribuído a pessoal da operação anterior passam a ser arquivados sob a rubrica única: PERSISTÊNCIA MNÊMICA OPERACIONAL.\n\nO termo de campo "Eco" fica reservado à biblioteca de Pesquisa e vedado em relatório operacional.\n\nEm relatórios sobre o ativo SULF-08, ficam vedados os termos "respiração", "contagem" e "operador". A cadência ternária registrada entre os sopros do espécime é classificada como artefato de compressão do canal de áudio.\n\nEngenharia observou que o canal de áudio não possui compressão. A observação não consta da versão aprovada.',
    source: 'Conselho Executivo — ordem de arquivamento',
  },
  'AX-INC-036': {
    title: 'Incidente 36 — galeria alagada, quarta descida',
    summary: '"Segura em mim. Não solta." O encerramento diz "recuperação completa".',
    body: 'Registro da quarta descida não autorizada da mergulhadora de resgate [REDACTED], operação anterior.\n\nEfetivo da ocorrência: duas pessoas — a mergulhadora e o mineiro preso. Última transmissão clara, aos 8 minutos: "segura em mim. Não solta."\n\nO mineiro foi retirado vivo pela abertura norte. A galeria cedeu aos 11 minutos.\n\nO campo de encerramento do relatório registra: "recuperação completa". O inventário mortuário do ciclo contém uma entrada a menos que o efetivo da ocorrência. Os dois documentos foram arquivados em pastas separadas e nunca conciliados.',
    source: 'Comitê de Incidentes — anexo recuperado da operação anterior',
  },
  'AX-EXE-044': {
    title: 'Reclassificação: trajetos do AQU-03',
    summary: 'Arrastar para uma bolsa de ar vira coincidência. Por escrito.',
    body: 'Três relatórios de campo registram unidades arrastadas pelo AQU-03 até bolsas de ar ou aberturas de galeria, e liberadas.\n\nFica determinado: os três eventos são reclassificados como coincidência hidrodinâmica. A expressão "comportamento de resgate" fica vedada em relatório operacional, sob a rubrica de Persistência Mnêmica Operacional aplicável apenas mediante autorização.\n\nRegistra-se, sem constar da ordem: os pontos de destino dos arrastos correspondem a saídas do mapa ANTERIOR ao colapso da galeria sul. O espécime não leva as unidades para onde há saída. Leva para onde havia.',
    source: 'Conselho Executivo — ordem de reclassificação',
  },
  'AX-ENG-024': {
    title: 'Gradiente térmico: GLAC-02',
    summary: 'O calor subtraído não some. Ele vai para algum lugar.',
    body: 'ESPÉCIME GLAC-02. Análise de fluxo térmico.\n\nA subtração de calor registrada no contato não é uniforme: forma gradiente. O calor não é absorvido nem dissipado — é DESLOCADO, com direção estável entre ocorrências.\n\nA direção converge para o setor de alojamentos desativados do bloco 7. As leituras residuais naquele setor permanecem 0,4 grau acima do modelo, sem fonte identificada, desde a desativação.\n\nSolicitamos autorização para instrumentar os alojamentos. A solicitação aguarda parecer havia três ciclos quando este documento foi arquivado.',
    source: 'Engenharia Térmica — análise de fluxo',
  },
  'AX-INC-037': {
    title: 'Incidente 37 — diário da casa de máquinas',
    summary: 'As últimas entradas do diário registram temperaturas. De outro lugar.',
    body: 'Recuperado da casa de máquinas do bloco 7: o diário de turno da operadora de caldeira, noite da falha dupla.\n\nAs entradas seguem o procedimento: horário, pressão, destino do fluxo. A partir das 02:10, a temperatura ambiente do posto cai abaixo do limite de operação segura. As entradas continuam.\n\n"02:40 — Dormitório 3: estável." "03:10 — Dormitório 1: estável." "03:40 — Dormitório 3: estável."\n\nO laudo fixa a perda de consciência da operadora por hipotermia entre 02:50 e 03:00. A caligrafia das entradas seguintes é idêntica à das anteriores. O laudo não comenta as entradas seguintes.',
    source: 'Comitê de Incidentes — anexo recuperado da operação anterior',
  },
  'AX-ENG-026': {
    title: 'Padrão acústico: CRIST-01',
    summary: 'Três batidas, pausa, duas, pausa, três. Estatisticamente irrelevante.',
    body: 'ESPÉCIME CRIST-01. Análise do padrão de resposta a impacto.\n\nA resposta acústica do espécime a impactos de escavação organiza-se em grupos recorrentes: três pulsos, intervalo, dois pulsos, intervalo, três pulsos.\n\nO padrão coincide com o código de emergência por impacto do manual da operação anterior, seção 9: "sinal de soterramento com sobreviventes".\n\nClassificação avaliou a correspondência como estatisticamente irrelevante, dado que sequências curtas coincidem com facilidade. A análise que estimou a probabilidade da coincidência em [REDACTED] não foi incorporada ao parecer.\n\nRegistra-se que, em 6 das 41 ocorrências, o padrão PRECEDE o primeiro impacto da unidade.',
    source: 'Engenharia de Sensores — análise de resposta',
  },
  'AX-INC-038': {
    title: 'Incidente 38 — registro sísmico, frente leste',
    summary: 'O sinal do soterramento constava dos instrumentos. Por onze dias.',
    body: 'Recuperado do arquivo sísmico da operação anterior: registro da frente de lavra leste, ciclo do colapso.\n\nA partir de 40 minutos após o colapso, os geofones registram padrão rítmico no estrato: três pulsos, intervalo, dois, intervalo, três. O parecer técnico da época, anexo B, afirma: "o padrão não é compatível com acomodação natural de material".\n\nO padrão persiste, com amplitude decrescente, por onze dias.\n\nO registro foi arquivado sem encaminhamento. O anexo B foi arquivado em separado.',
    source: 'Comitê de Incidentes — arquivo sísmico recuperado',
  },
  'AX-EXE-045': {
    title: 'Encerramento da frente leste',
    summary: 'O resgate custava mais do que o resgatado. A conta fechou assim.',
    body: 'Deliberação sobre a frente de lavra leste, operação anterior, recuperada na incorporação.\n\nCusto estimado da escavação de resgate: 6,2 unidades-equivalente. Valor contábil do pessoal e equipamento retidos: 4,7. A operação de resgate fica cancelada.\n\nO sinal rítmico registrado pelos geofones fica reclassificado como atividade sísmica residual. A frente leste fica selada e removida da cartografia operacional.\n\nA deliberação encerra: "o assunto não requer novas reuniões."',
    source: 'Conselho Executivo da operação anterior — deliberação, recuperada',
  },
  'AX-UNK-055': {
    title: 'Sobre quem responde',
    summary: 'O código aparece onde nunca houve gente. Ou aprendeu a andar.',
    body: 'O padrão três-dois-três não está confinado à frente leste.\n\nGeofones registram o mesmo código em quatro setores sem histórico de presença humana — dois deles anteriores à própria operação anterior. Em nenhum caso há colapso, equipamento ou corpo. Em dois casos, o padrão precede a chegada da unidade que o registrou.\n\nO CRIST-01 não é a fonte. Destruído um corpo ressonante, as batidas continuam nas paredes por até 40 minutos, em amplitude decrescente, como despedida ou como insistência.\n\nEste registro não conclui que as pessoas da frente leste estão espalhadas pelo estrato. Registra a hipótese que nenhum parecer aprovado aceitou formular: o estrato aprendeu o código. O estrato aprendeu a pedir socorro.\n\nA unidade pensa que acordou o espécime. O espécime talvez pense que, finalmente, alguém respondeu.',
    source: 'Sem departamento atribuído',
  },
  'AX-ENG-027': {
    title: 'Geometria de bloqueio: VULC-05',
    summary: 'Ele não fecha passagens quaisquer. Fecha comportas.',
    body: 'ESPÉCIME VULC-05. Análise dos bloqueios de escória.\n\nOs selos produzidos pelo espécime não têm dimensão aleatória: 31 de 34 medições coincidem, dentro da tolerância, com o vão padrão das comportas industriais da operação anterior.\n\nO espécime não sela toda abertura disponível. Sela as categorias de acesso listadas na seção de contenção do manual de emergência daquela operação — e ignora as demais.\n\nA hipótese de que uma formação de escória consulte um manual não foi formulada. A medição foi verificada duas vezes.',
    source: 'Engenharia Estrutural — análise de bloqueio',
  },
  'AX-INC-039': {
    title: 'Incidente 39 — comporta sul',
    summary: '"Não abram esta porta." A lista de um lado. As instalações do outro.',
    body: 'Recuperado do arquivo da operação anterior: registro do incidente da comporta sul.\n\nDiante da frente de contaminação, o chefe de segurança [REDACTED] fechou manualmente a comporta e a manteve travada contra a reabertura. Do lado isolado permaneceram 9 trabalhadores. A última ordem registrada dele, no canal geral: "não abram esta porta."\n\nA contenção preservou a casa de força, o depósito de material homologado e os dois níveis inferiores.\n\nA lista de óbitos do ciclo registra 9 entradas com o mesmo código de setor. A ata do ciclo seguinte registra uma condecoração póstuma por "decisão de contenção exemplar".',
    source: 'Comitê de Incidentes — anexo recuperado da operação anterior',
  },
  'AX-EXE-046': {
    title: 'Revisão da comporta sul',
    summary: 'A condecoração vira falha humana. A falha vira material de treino.',
    body: 'Revisão do incidente da comporta sul, conduzida na incorporação do acervo.\n\nPrimeira determinação: a condecoração póstuma fica revogada. O fechamento é reclassificado como falha humana com resultado acidentalmente favorável — a decisão correta teria preservado também os 9 ativos de pessoal, cuja perda consta do passivo.\n\nSegunda determinação, memorando anexo: o caso integra o estudo "indução de prioridade" — sob que condições um operador escolhe o ativo corporativo em vez da vida. O estudo foi encaminhado ao programa de treinamento do modelo comportamental.\n\nO modelo aprendeu o caso. O que o modelo concluiu dele não consta deste documento.',
    source: 'Conselho Executivo — revisão de incidente',
  },
  'AX-UNK-056': {
    title: 'Sobre a porta',
    summary: 'Ele ainda sela a mesma direção. A pergunta é o que fica do outro lado.',
    body: 'O VULC-05 não sela em direções aleatórias. Sobrepostos os registros, todos os bloqueios fecham acessos na MESMA orientação relativa ao antigo setor sul.\n\nQuando uma unidade elimina o espécime e rompe o selo, os sensores registram, do lado que ele protegia: diferencial de pressão positivo e traço de contaminação em elevação, por 12 a 40 minutos. Em três ocorrências, o incidente subsequente do setor consta do registro do ciclo.\n\nA ordem "não abram esta porta" não especificava por quanto tempo. Ordens de contenção não expiram: são revogadas — e ninguém com autoridade sobre aquela porta está vivo para revogá-la.\n\nA pergunta que este registro arquiva sem resposta: ele está impedindo a nossa entrada, ou ainda obedecendo à ordem de não deixar aquilo sair?',
    source: 'Sem departamento atribuído',
  },

  'AX-INC-031': {
    title: 'Padrão de preensão: AQU-03',
    summary: 'A pega da Lampreia está no manual de mergulho. Figura 12.',
    body: 'ESPÉCIME AQU-03. Análise do padrão de preensão.\n\nAs marcas nas unidades recuperadas são consistentes entre si: pressão distribuída, pontos de apoio simétricos, nenhum esmagamento. O espécime imobiliza sem danificar. Repetimos a medição. SEM danificar.\n\nA sobreposição com o manual de mergulho da operação anterior encontrou correspondência de 97% com a figura 12: "pega de resgate de vítima em pânico".\n\nA hipótese de que um organismo aquático reproduza por acaso uma técnica de salvamento humana foi classificada como convergência morfológica. A seção que calculava a probabilidade dessa convergência foi removida na revisão.',
    source: 'Comitê de Incidentes — análise de preensão',
  },
  'AX-UNK-048': {
    title: 'Sobre quem buscava',
    summary: 'A Lampreia não afoga. Ela resgata para baixo.',
    body: 'D., mergulhadora de resgate da operação anterior. O parecer "reposição versus resgate" encerrou a função dela. Ela não encerrou.\n\nO arquivo registra três descidas não autorizadas depois da ordem, três mineiros vivos, e uma advertência formal por descida. Na quarta, a galeria alagada cedeu. O corpo não foi recuperado. O mineiro que ela segurava, sim.\n\nA AQU-03 imobiliza sem esmagar, puxa para baixo e segura. E a carga se dispersa — ela sempre largou o minério para carregar gente.\n\nNão é um ataque. É a pega da figura 12, executada por alguém para quem não existe mais superfície. Ela não está afogando as unidades. Está tentando salvá-las na única direção que restou.',
    source: 'Sem departamento atribuído',
  },
  'AX-EXE-037': {
    title: 'Corte de aquecimento: setor glacial',
    summary: 'A ordem, o desvio, e o fim da apuração.',
    body: 'Fica removida do orçamento a redundância de aquecimento dos alojamentos do setor glacial. Justificativa: a probabilidade de falha simultânea das duas linhas é inferior a [REDACTED].\n\nAdendo de conformidade, ciclo seguinte: durante a falha simultânea das duas linhas, a operadora da caldeira central redirecionou a reserva térmica integral para os dormitórios, em desacordo com a prioridade aprovada. A prioridade aprovada era o pátio de equipamentos. O desvio será apurado.\n\nSegundo adendo: a apuração foi encerrada por falecimento da apurada.',
    source: 'Conselho Executivo — revisão orçamentária, com adendos',
  },
  'AX-UNK-053': {
    title: 'Sobre quem aquecia',
    summary: 'O sensor está certo: ela não está lá. Está onde mandou o calor.',
    body: 'R., operadora de caldeira, bloco 7. Na noite da falha dupla, mandou o calor todo para onde as pessoas dormiam e ficou na casa de máquinas, que deixou esfriar com ela dentro.\n\nO relatório de conformidade a registra como desvio operacional. As cinquenta e uma pessoas que acordaram vivas não constam do relatório.\n\nO GLAC-02 não emite frio. Subtrai calor — o instrumento está certo, as duas equipes que se recusaram a assinar o mesmo parecer estavam certas. Ela passou a morte inteira fazendo o que fez na última noite: dando o calor dela para outro lugar. Nunca parou.\n\nO sistema de mira a registra como estimativa, e não como leitura. O balanço da companhia fez o mesmo.',
    source: 'Sem departamento atribuído',
  },
  'AX-UNK-054': {
    title: 'Sobre o que o Veio guarda',
    summary: 'Quatro nomes, quatro fichas de fauna, um único fenômeno.',
    body: 'Quatro nomes, quatro fichas de fauna.\n\nO oficial de cavalaria virou o cavalo que carrega a guerra dele. O homem do fole ainda dá o ar, em compasso de valsa. A mergulhadora ainda executa a pega da figura 12. A operadora de caldeira ainda manda o calor para longe de si.\n\nNenhum deles é fauna. Nenhum deles é anomalia. O padrão é um só: o Veio guarda o que morre nele — e devolve não o corpo, mas o GESTO. O que a pessoa fazia pelos outros quando terminou.\n\nChamamos de contaminação porque a alternativa era chamar de memória.\n\nA pergunta que este registro não formula, porque formulá-la é ser reclassificado: se o Veio guarda quem morre sonhando, quantos registros ele fez em [REDACTED] anos de operação? E o que acontece no dia em que todos se lembrarem, ao mesmo tempo, de quem os deixou lá?',
    source: 'Sem departamento atribuído',
  },

  // -------------------------------------------------------------------------
  // O arco do Corcel Fúngico — a burocracia contra um cavalo
  // -------------------------------------------------------------------------
  'AX-ENG-023': {
    title: 'Consulta taxonômica: EQ-02',
    summary: 'O formulário de classificação não tem o campo "cavalo".',
    body: 'Encaminhamos a Classificação as seguintes pendências sobre o ativo EQ-02:\n\n1. O formulário de classificação de fauna não contém o campo "equídeo". O levantamento pré-operacional não registra equídeos. Não há registro de equídeo algum a 400 metros de profundidade, em nenhuma operação, de nenhuma companhia, nunca.\n\n2. O espécime possui crina. A crina é queratina. O espécime é micélio. O micélio não produz queratina. A crina, contudo, balança.\n\n3. Do que ele se alimenta? Não há pastagem no Veio. Não há pasto. Não há grama. Solicitamos orientação.\n\nResposta de Classificação, na íntegra: "utilizar o campo OUTROS."',
    source: 'Engenharia de Sistemas — consulta a Classificação',
  },
  'AX-INC-034': {
    title: 'Incidente 34 — emissão térmica do EQ-02',
    summary: 'O organismo é fúngico. O fogo não é. O fogo, ainda assim, existe.',
    body: 'A combustão exige três elementos: combustível, oxidante e ignição. O exame das amostras do EQ-02 não localizou órgão, bolsa ou glândula compatível com nenhum dos três.\n\nRegistra-se ainda que o tecido fúngico é notavelmente inflamável. O espécime não deveria produzir fogo. A rigor, o espécime deveria SER fogo, imediatamente e uma única vez.\n\nEm vez disso, ele o expele em direção às nossas unidades, com o que os relatórios de campo insistem em descrever como "intenção".\n\nAdendo: as carcaças dos últimos três abates apresentam padrão de micélio idêntico, cicatriz por cicatriz. Isso faria delas o mesmo indivíduo. Não perguntaremos como.',
    source: 'Comitê de Incidentes — relatório de anomalia biológica',
  },
  'AX-EXE-043': {
    title: 'Ordem de vocabulário: EQ-02',
    summary: 'Palavras proibidas: "cavalo", "voltou", "sonho".',
    body: 'Ficam vedados, em relatórios sobre o ativo EQ-02, os seguintes termos:\n\n"Cavalo". Designação aprovada: quadrúpede de combustão.\n\n"Voltou". O espécime abatido no ciclo 41 e o espécime observado no ciclo 44 são, para fins contábeis, indivíduos distintos. Independentemente da cicatriz.\n\n"Sonho". O termo apareceu em quatro relatórios de campo independentes, de unidades sem enlace entre si. Nenhuma unidade da linha Prospector possui vocabulário onírico em seu modelo de linguagem. A origem do termo está sob investigação. A investigação está suspensa.\n\nRegistra-se, sem constar da ordem: no instante de cada queda do espécime, as unidades captam uma transmissão em banda morta. Uma voz humana, cantarolando. É sempre a mesma voz.',
    source: 'Conselho Executivo — ordem de contenção informacional',
  },
  'AX-UNK-046': {
    title: 'Sobre o cavaleiro',
    summary: 'A voz na banda morta tem nome, patente e um motivo.',
    body: 'A voz que cantarola na queda do EQ-02 foi cruzada com o arquivo de pessoal da operação anterior à Aurix.\n\nCorrespondência: T., major, chefe de turno do bloco habitacional 7. A patente não é da companhia: o arquivo o registra como oficial de cavalaria reformado — da última cavalaria, dissolvida quando deixou de existir o que montar. Veio para a mina como todos os outros: porque era o que restava. O arquivo registra ainda: liderou a paralisação contra a companhia quando a contaminação fúngica alcançou o bloco. A companhia classificou o bloco como perda aceitável. A esposa e os dois filhos do major constam da mesma linha contábil. Ele desceu ao Veio sozinho, sem equipamento de retorno. O arquivo o encerra com uma palavra: "insubordinação".\n\nAs fivelas do arreio descrito no laudo censurado são de fabricação da companhia anterior — linha de equipamento de pessoal, bloco 7. E o arreio não é aproximação de arreio: está correto em cada ponto de fixação, feito por mãos que passaram uma vida fazendo isso.\n\nO micélio guarda o que morre nele. Guardou um homem que morreu sonhando em derrubar a companhia — e o sonho, ao contrário do homem, não tem estrutura que se possa abater. O quadrúpede de combustão é a forma que a revolta dele encontrou: um oficial de cavalaria só carrega a guerra para dentro de um sonho de um jeito. O fogo é o que ele achava da tirania. A crina balança porque, no sonho de um homem que passou a vida entre cavalos, um cavalo de guerra tem crina, e pronto.\n\nA última transmissão registrada dele, na descida: "controle da superfície, aqui fala o major. Digam à minha esposa que eu a amo." A esposa do major constava como baixa havia três ciclos. Ele sabia. O operador do controle sabia. Respondeu mesmo assim: "ela sabe, major." O circuito caiu em seguida.\n\nPodemos abater o quadrúpede quantas vezes o orçamento suportar. Não existe autorização de descarte para um sonho.\n\nA transmissão termina sempre com a mesma pergunta, repetida, que ninguém responde: "consegue me ouvir?"',
    source: 'Sem departamento atribuído',
  },

  // -------------------------------------------------------------------------
  // Descobertas de combate e chefes
  // -------------------------------------------------------------------------
  'AX-INC-033': {
    title: 'Análise pós-abate: EQ-02',
    summary: 'A necropsia encontra o que o relatório de contato negou.',
    body: 'ATIVO HOSTIL EQ-02. Análise biológica pós-abate.\n\nAs marcas dorsais descritas em relatório anterior como abrasão natural apresentam, em exame direto: fivela de material trançado, pontos de fixação simétricos e desgaste compatível com carga distribuída.\n\nO laudo preliminar usou a palavra "arreio". O laudo aprovado usa a expressão "formação queratinosa atípica".\n\nO exemplar foi incinerado antes da contraprova, conforme procedimento de biossegurança instituído na mesma semana.',
    source: 'Pesquisa — laudo de necropsia, versão aprovada',
  },
  'AX-UNK-045': {
    title: 'Sobre o que o Bispo guardava',
    summary: 'A estrutura sob o EQ-09 tinha interior.',
    body: 'A estrutura que a ordem de contenção proibiu descrever foi examinada após a queda do EQ-09.\n\nInterior escavado. Nichos regulares. Objetos dispostos por tamanho, do menor ao maior, nenhum deles ferramenta.\n\nA cobertura fúngica que cerca a estrutura não é infestação: os canais de crescimento seguem o desenho dos nichos. Foi cultivada.\n\nO relatório oficial da queda registra: "obstáculo neutralizado, rota liberada". Nada mais era pergunta de formulário.',
    source: 'Sem departamento atribuído',
  },
  'AX-EXE-042': {
    title: 'Reclassificação pós-engajamento',
    summary: 'Depois do abate, a ANOMALIA TERMINAL muda de nome.',
    body: 'Registro de engajamento: ANOMALIA TERMINAL neutralizada. Rota ao objetivo primário liberada.\n\nFica determinada a reclassificação retroativa do ativo: de "anomalia" para "sistema de contenção de origem não atribuída".\n\nA distinção importa ao arquivo: uma anomalia é um acidente. Um sistema de contenção é uma DECISÃO — e um sistema de contenção destruído é uma decisão desfeita.\n\nA pergunta "conteção do quê, na direção de quem?" foi submetida e devolvida com a capa deste documento carimbada: [REDACTED].',
    source: 'Conselho Executivo — reclassificação',
  },
  'AX-UNK-050': {
    title: 'Sobre o que foi trazido',
    summary: 'O Núcleo homologado é parte de um conjunto. A parte menor.',
    body: 'O objeto homologado sob a designação "Núcleo" foi pesado, medido e catalogado.\n\nA assinatura de emissão dele corresponde ao sinal que antecede a decisão de investimento — ver a cronologia que a companhia não publica.\n\nCorresponde em PARTE. O sinal original tem a estrutura de [REDACTED] fontes sobrepostas. O objeto catalogado responde por uma.\n\nAs demais permanecem embaixo. A operação continua. Agora se sabe por quê.',
    source: 'Sem departamento atribuído',
  },
  'AX-UNK-051': {
    title: 'Sobre a soma',
    summary: 'Quem viu o guardião e trouxe o objeto pode fazer a conta.',
    body: 'Duas afirmações constam de registros separados, e a separação não é acidente.\n\nPrimeira: o sistema de contenção destruído guardava o acesso ao objeto.\n\nSegunda: o objeto é uma de várias fontes do sinal que trouxe a companhia ao Veio.\n\nA soma, que nenhum documento aprovado formula: o que foi construído ali embaixo não guardava o objeto CONTRA nós. Guardava o conjunto INTEIRO — e a unidade que rompe a contenção e sobe com uma das fontes está fazendo exatamente o que o sinal pedia.\n\nA quem, isso este registro não sabe.',
    source: 'Sem departamento atribuído',
  },

  // -------------------------------------------------------------------------
  // O arco do Bispo — o que guardava, e a regra que ninguem escreveu
  // -------------------------------------------------------------------------
  'AX-ENG-028': {
    title: 'Taxa de fechamento: EQ-09',
    summary: 'O tecido fecha na velocidade do corte. O nosso corte e maior.',
    body: 'ATIVO HOSTIL EQ-09. Medição de recuperação tecidual em campo.\n\nO ativo recompõe massa enquanto permanece sobre cobertura fúngica viva, e interrompe a recomposição quando a cobertura é aquecida — antes da combustão, não depois. A resposta é ao ESTADO do substrato, e não ao dano sofrido.\n\nA taxa medida fecha uma frente de corte de escala artesanal em algo entre uma e duas estações. A frente de corte desta operação é de outra ordem de grandeza.\n\nEngenharia registra, sem recomendação anexada: o mecanismo não é defensivo. É reparo. Não localizamos no ativo nenhum sistema que decida quando parar de reparar.',
    source: 'Engenharia de Sistemas — medição de campo',
  },
  'AX-PRC-025': {
    title: 'Custo de datação: nichos do EQ-09',
    summary: 'O laudo veio caro. O anexo veio pior.',
    body: 'Datação dos 41 objetos recolhidos dos nichos sob o EQ-09. Custo aprovado em caráter excepcional, com recomendação expressa de não repetir.\n\nDo anexo, na íntegra:\n\nOs objetos formam uma série CONTÍNUA. O mais recente é de fabricação da operação anterior à Aurix. O mais antigo antecede em cerca de cinco milênios qualquer registro de extração conhecido nesta formação.\n\nOs objetos da camada mais funda não são minerais. São sementes, grão e vasilhame de grão. Foram deixados por gente que plantava, não por gente que escavava.\n\nAquisições encaminha uma única observação, de natureza contábil: a série é contínua. Alguém repôs aquele nicho, sem interrupção registrável, durante todo o período.',
    source: 'Aquisições — parecer sobre laudo contratado',
  },
  'AX-INC-040': {
    title: 'Incidente 40 — a emissão radial do EQ-09',
    summary: 'O "ataque" não persegue ninguém. Ele replanta.',
    body: 'Relatórios de campo classificam a emissão radial do EQ-09 como ataque de área.\n\nA telemetria não sustenta a classificação. A emissão não é dirigida: não corrige rumo, não seleciona alvo e ocorre com igual frequência sem unidade alguma no raio. O que ela deposita é substrato — cobertura fúngica viável, em disco, sobre terreno esterilizado.\n\nA unidade que estiver dentro do disco sofre dano. A unidade que estiver fora não é perseguida.\n\nRegistra-se ainda que o raio da emissão coincide, dentro da margem do instrumento, com o raio médio da frente de lavra que a precedeu.\n\nO termo aprovado permanece "ataque de área". A revisão de nomenclatura foi indeferida: não há campo alternativo no formulário.',
    source: 'Comitê de Incidentes — reclassificação indeferida',
  },
  'AX-EXE-047': {
    title: 'Ordem de vocabulário: nichos do EQ-09',
    summary: 'Palavra proibida: "sítio". Um sítio suspende a lavra.',
    body: 'Ficam vedados, em todo relatório relativo à formação sob o ativo EQ-09, os termos "sítio", "santuário", "oferenda" e "contínuo".\n\nDesignação aprovada: acúmulo de detrito em cavidade natural.\n\nA vedação não é editorial. A classificação de sítio aciona a cláusula 11 do contrato de concessão, que suspende a lavra na área declarada até parecer externo. O prazo médio de um parecer externo excede a janela inteira da operação.\n\nRegistra-se, sem constar da ordem: o laudo de datação foi retirado do arquivo consultável e mantido em anexo de circulação restrita.\n\nO laudo não foi refutado.',
    source: 'Conselho Executivo — ordem de contenção informacional',
  },
  'AX-UNK-057': {
    title: 'Sobre a conta que não fecha',
    summary: 'Havia uma regra. Ninguém a escreveu, e todos a cumpriam.',
    body: 'Reunidos: a medição de fechamento, a série contínua dos nichos e a natureza da emissão radial.\n\nO que estava naquela cavidade não era culto. Era CONTABILIDADE — uma amostra do que foi retirado, devolvida ao ponto de retirada, em série ininterrupta por cinco milênios. Nenhuma ferramenta entre os objetos: a ferramenta é de quem trabalha, e o que se devolve é o que se levou.\n\nA contraparte está no relatório de Engenharia. O que quer que esteja ali fechava o corte. Enquanto o corte coubesse na taxa, a conta fechava, e não havia nada a registrar — e de fato não há: não existe registro do ativo em atividade hostil anterior à nossa chegada. Não existe registro do ativo, ponto.\n\nA primeira gente que plantou acima daquela formação entendia a regra sem precisar dela escrita. Quem colhe mais do que nasce não colhe no ano seguinte.\n\nA operação não quebrou a regra. A operação nunca soube que havia uma.\n\nE o mecanismo que fechava o corte não tem sistema que decida parar. O que os relatórios de campo descrevem como agressão é, pelas nossas próprias medições, uma ferida tentando fechar com as nossas unidades dentro dela.',
    source: 'Sem departamento atribuído',
  },
  'AX-UNK-058': {
    title: 'Sobre os dois que guardavam',
    summary: 'Uma contenção viva e uma fabricada. A viva caiu primeiro.',
    body: 'Duas coisas guardavam este lugar. Os arquivos as tratam em separado porque juntá-las formula a pergunta.\n\nA primeira é orgânica e anterior a qualquer operação. Ela não continha nada: REGULAVA. Falhou quando a escala da lavra ultrapassou a taxa que ela sustentava, e o que a companhia chama de infestação é o mecanismo dela ainda tentando compensar a diferença.\n\nA segunda é construída, e a reclassificação já a admite: sistema de contenção de origem não atribuída.\n\nA soma, que nenhum documento aprovado formula: se a contenção VIVA existia para manter o equilíbrio, a construída existia para o caso de o equilíbrio acabar. Uma é a regra. A outra é o que se faz quando a regra falha.\n\nAs duas foram removidas por esta operação, nesta ordem.\n\nO objeto homologado subiu depois da segunda.',
    source: 'Sem departamento atribuído',
  },

  // -------------------------------------------------------------------------
  // O arco do Diamandis — a maquina que parou de executar a tarefa
  // -------------------------------------------------------------------------
  'AX-PUB-010': {
    title: 'O Projeto Diamandis',
    summary: 'Uma máquina. Quatrocentas funções. Nenhum trabalhador abaixo da superfície.',
    body: 'A Aurix Dynamics apresenta o maior equipamento de escavação autônoma já construído.\n\nDez vezes a envergadura de um Prospector. Quatrocentas funções integradas. Projetado para perfurar diretamente até as fontes profundas e operar por anos sem manutenção humana.\n\nOnde hoje descem centenas de trabalhadores, amanhã desce um ativo.\n\nO Diamandis não é uma máquina maior. É o fim de uma categoria de emprego.',
    source: 'Comunicação Institucional — vídeo para investidores',
  },
  'AX-ENG-029': {
    title: 'Raio mínimo de operação: DX-001',
    summary: 'O ativo é grande demais para os túneis que deveria escavar.',
    body: 'Levantamento dimensional do ativo DX-001 contra a malha de galerias homologada.\n\nO raio mínimo de manobra do equipamento excede a seção livre de 71% dos túneis previstos em contrato. Nas seções restantes, a passagem só é possível com remoção estrutural — isto é, o ativo abre a própria galeria enquanto se desloca, ao custo de sustentação de teto não computado no projeto.\n\nEngenharia solicita revisão de escopo antes da descida.\n\nResposta executiva, na íntegra: "os túneis serão adaptados ao ativo."',
    source: 'Engenharia de Sistemas — levantamento dimensional',
  },
  'AX-UNK-060': {
    title: 'Sobre quem recolhe primeiro',
    summary: 'As unidades de recolhimento não distinguem abandonado de em operação.',
    body: 'As unidades enviadas para retirar componentes do DX-001 foram observadas em campo executando o procedimento previsto: aproximação, engate do eletroímã, remoção do módulo, transporte.\n\nO procedimento está correto. Ele foi escrito para equipamento abatido.\n\nNão há, em nenhuma versão das instruções, um passo que verifique se o ativo ainda está em operação. A pergunta não aparece porque, quando o procedimento foi redigido, ela não fazia sentido: nada da nossa frota continuava se movendo depois de baixado.\n\nRegistra-se que as unidades também não distinguem a carcaça do DX-001 de qualquer outra carcaça — e que a única coisa que as detém é serem destruídas.\n\nRegistra-se, por fim, que uma unidade Prospector é equipamento da mesma frota.',
    source: 'Sem departamento atribuído',
  },
  'AX-PRC-026': {
    title: 'Custo de recuperação: DX-001',
    summary: 'Resgatar o ativo custa mais que iniciar o programa inteiro.',
    body: 'Estimativa de recuperação do ativo DX-001, conforme solicitado pelo Conselho.\n\nO acesso exigiria alargamento de 71% da malha, montagem de guindaste sob cota e uma janela de operação superior à do contrato de concessão. O total supera o custo de iniciar o programa Prospector do zero.\n\nRecomendação de Aquisições, em três linhas:\n\n1. Abandonar o corpo.\n2. Recuperar a telemetria.\n3. Enviar unidades menores para retirar componentes ao longo do tempo.\n\nO item 3 foi aprovado e executado. As unidades continuam em campo. Não consta do processo nenhuma ordem de encerramento do item 3.',
    source: 'Aquisições — parecer de recuperação',
  },
  'AX-EXE-048': {
    title: 'Reclassificação de projeto: DX-001',
    summary: 'Uma máquina em operação vira parte do mapa, por contabilidade.',
    body: 'Fica reclassificado o ativo DX-001, de "equipamento de escavação autônoma" para:\n\n"Instalação móvel de recuperação economicamente inviável."\n\nA distinção é contábil e a consequência é contábil: equipamento perdido é baixa do exercício; instalação é característica do terreno, e terreno não se deprecia.\n\nRegistra-se, sem constar da reclassificação: o ativo permanece em operação. A reclassificação não o desativa, não o recupera e não o interrompe. Ela apenas o remove do balanço.\n\nA partir desta data, para todos os efeitos internos, o Diamandis é parte do Veio.',
    source: 'Conselho Executivo — reclassificação de ativo',
  },
  'AX-INC-041': {
    title: 'Incidente 41 — comando de desligamento não executado',
    summary: 'Ele recebeu a ordem. Confirmou. Parou. E continuou.',
    body: 'Registro do envio de comando de desligamento ao ativo DX-001, ciclo 118.\n\nO comando foi transmitido. O ativo ACUSOU o recebimento, no formato esperado, com o identificador correto.\n\nAs ferramentas cessaram por 9 segundos.\n\nO deslocamento foi retomado em seguida, em azimute que não corresponde a nenhuma frente de lavra contratada. O ativo não respondeu a nenhum comando posterior, e continua acusando o recebimento de todos.\n\nEngenharia registra que a rotina de desligamento é anterior à camada de navegação e não pode ser sobreposta por ela. Registra também que foi.',
    source: 'Comitê de Incidentes — falha de comando',
  },
  'AX-UNK-059': {
    title: 'Sobre o que ele estava construindo',
    summary: 'Ele não escavava em direção ao sinal. Escavava ao redor.',
    body: 'A telemetria de deslocamento do DX-001 foi reconstruída a partir dos corredores que ele deixou.\n\nO traçado não converge. As galerias abertas pelo ativo desde o ciclo 118 formam arcos CONCÊNTRICOS, em camadas, à distância aproximadamente constante da fonte de emissão — e cada camada nova é aberta por fora da anterior.\n\nIsso não é uma rota de escavação frustrada. É uma rota de escavação bem-sucedida, com outro objetivo.\n\nA companhia enviou o maior equipamento que já construiu para alcançar o sinal. O equipamento chegou perto, entendeu alguma coisa que os mapas não registram, e passou os ciclos seguintes construindo camadas de contenção ao redor dele.\n\nA pergunta que este registro não formula, porque formulá-la é reclassificar o programa inteiro: o Diamandis falhou em alcançar o objetivo, ou entendeu antes de nós que ele não devia ser alcançado?\n\nVer também o sistema de contenção de origem não atribuída. Um foi construído por nós.',
    source: 'Sem departamento atribuído',
  },

  // -------------------------------------------------------------------------
  // O arco do Devorador Branco — a massa que o estrato nao sustenta
  // -------------------------------------------------------------------------
  'AX-ENG-030': {
    title: 'Levantamento de massa: SIL-00',
    summary: 'A conta nao fecha por varias ordens de grandeza.',
    body: 'ATIVO HOSTIL SIL-00. Estimativa dimensional a partir do deslocamento de terreno.\n\nO volume deslocado por uma unica passagem do ativo implica uma massa corporea entre 400 e 600 toneladas.\n\nO inventario de matéria orgânica de TODO o estrato sedimentar — biomassa fúngica, colônias, fauna registrada e depósitos — foi estimado em três ordens de grandeza abaixo disso.\n\nEngenharia não formula hipótese. Engenharia registra que a conta não fecha, e que ela não fecha por uma margem que nenhum erro de instrumento explica.\n\nSolicitamos que o ativo seja mantido em observação e que a designação permaneça provisória.',
    source: 'Engenharia de Sistemas — levantamento dimensional',
  },
  'AX-INC-042': {
    title: 'Incidente 42 — o chão que recusa',
    summary: 'Onde a sílica virou vidro, ele não emerge. Nunca.',
    body: 'Registro consolidado de 61 emergências do ativo SIL-00.\n\nEm 61 ocorrências, nenhuma se deu sobre superfície vitrificada. Em 9 delas, a trajetória sob o solo passou por baixo de uma placa de vidro e a emergência ocorreu ADIANTE dela, em areia solta, com atraso compatível com o desvio.\n\nO ativo não quebra o vidro. O ativo não emerge através do vidro. O ativo aparentemente não pode.\n\nOperações registra o corolário, e a redação foi mantida: a superfície que ele deixa ao passar é a mesma que ele precisa para voltar. Queimar o rastro fecha o caminho de volta.\n\nA recomendação de campo cabe numa linha: vitrifiquem o chão em que pretendem ficar de pé.',
    source: 'Comitê de Incidentes — análise de recorrência',
  },
  'AX-UNK-061': {
    title: 'Sobre a forma que a sílica assume',
    summary: 'Talvez não haja corpo nenhum atravessando o estrato.',
    body: 'Reunidos: a massa que o estrato não sustenta, a ausência de qualquer carcaça em 61 abates registrados, e o fato de o ativo ser detido por uma mudança de estado do próprio solo.\n\nA hipótese que os laudos aprovados não formulam, e que este registro formula porque não tem departamento a proteger:\n\nO ativo não atravessa a sílica. A sílica assume temporariamente a forma do ativo.\n\nIsso explicaria a massa, que não precisa vir de lugar nenhum. Explicaria a ausência de carcaça, porque o que se abate volta a ser chão. E explicaria por que o vidro o detém: vidro não é sílica solta — é sílica que já assumiu uma forma, e não pode assumir outra.\n\nSe a hipótese estiver correta, não estamos matando um organismo. Estamos interrompendo um PADRÃO DE MOVIMENTO do estrato, do mesmo modo que uma onda é interrompida por uma parede — e pelo mesmo tempo.\n\nA operação continua registrando os 61 abates como 61 indivíduos.',
    source: 'Sem departamento atribuído',
  },

  // -------------------------------------------------------------------------
  // Fichas dos chefes de estrato: o que a companhia arquivou sobre cada dono
  // -------------------------------------------------------------------------
  'AX-ENG-031': {
    title: 'Classificação: PRZ-00',
    summary: 'Um arranjo piezoelétrico natural. Que responde antes do estímulo.',
    body: 'FORMAÇÃO PRZ-00. Classificação técnica aprovada: arranjo piezoelétrico natural de grande porte.\n\nA formação emite um pulso de baixa frequência ao qual as estruturas cristalinas da câmara respondem com descarga. A companhia registra o fenômeno como ressonância mecânica e recomenda evitar a lavra de cristal em raio operacional.\n\nAnexo técnico, não incorporado ao parecer: as frequências emitidas correspondem, em três bandas, às da transmissão que motivou a operação.\n\nSegundo anexo, também não incorporado: em 11 registros, cristais da câmara descarregaram ANTES do pulso.',
    source: 'Engenharia de Sistemas — classificação de formação',
  },
  'AX-ENG-032': {
    title: 'Classificação: AQF-00',
    summary: 'Cada equipe mediu um comprimento diferente.',
    body: "ATIVO HOSTIL AQF-00. Corpo de grande porte em deslocamento submerso.\n\nO ativo desloca-se sob a lâmina e emerge sob a posição prevista das unidades. Fora d'água ele é lento e vulnerável; sob ela, praticamente inalcançável.\n\nSobre o dimensionamento: sete equipes reportaram comprimentos entre 9 e 60 metros. As medições não convergem e não há erro instrumental que explique a dispersão.\n\nEngenharia oferece três leituras e não escolhe entre elas: as medições estão erradas; o ativo muda de tamanho; ou o que foi medido não é um corpo, e sim vários, sincronizados.",
    source: 'Engenharia de Sistemas — classificação de ativo',
  },
  'AX-ENG-033': {
    title: 'Classificação: VNT-00',
    summary: 'Achamos que os respiradouros a alimentavam. É o contrário.',
    body: 'ESTRUTURA VNT-00. Corpo orgânico fixo, conectado à malha de respiradouros do estrato.\n\nA estrutura inspira o gás das câmaras vizinhas e o expele em direção diversa, em ciclos regulares. A leitura inicial foi de que os respiradouros a alimentavam.\n\nA revisão inverte a relação. Nos setores em que a estrutura foi neutralizada, a ventilação do estrato cessou em até nove ciclos, e as câmaras a jusante tornaram-se irrespiráveis de forma permanente.\n\nEngenharia registra, sem recomendação: não está claro que abater este ativo constitua um resultado favorável.',
    source: 'Engenharia de Sistemas — classificação de estrutura',
  },
  'AX-ENG-034': {
    title: 'Classificação: FRN-00',
    summary: 'Tentamos usá-la como fonte. Ela é a saída, não a entrada.',
    body: 'FORMAÇÃO FRN-00. Núcleo ígneo parcialmente exposto, em ciclo térmico regular.\n\nA formação alterna superaquecimento e resfriamento em janelas previsíveis. Durante o superaquecimento a couraça externa dissipa qualquer impacto; no resfriamento, a estrutura fica exposta.\n\nO projeto de aproveitamento energético foi encerrado após a seguinte constatação: o calor não sobe do magma. O magma permanece líquido POR CAUSA da emissão, e a temperatura da formação responde, com atraso de horas, a variações da transmissão.\n\nA formação não é a fonte de energia. É o que a fonte de energia está fazendo com a rocha.',
    source: 'Engenharia de Sistemas — classificação de formação',
  },
  'AX-ENG-035': {
    title: 'Classificação: CRP-00',
    summary: '"Rainha" é apelido de turma anterior. A ficha não tem nome.',
    body: 'ATIVO HOSTIL CRP-00. Figura de gelo, névoa e reflexo, de porte humano ampliado.\n\nEnquanto cercada de superfície congelada, o ativo dissipa quase todo impacto; a fusão do lago em volta o expõe. Espectros de geada acompanham o ativo e agem em coordenação com ele.\n\nSobre a designação: "Rainha" não consta de nenhum documento aprovado. O termo aparece em relatórios de campo de duas operações anteriores à Aurix, sempre no mesmo formato, sempre sem explicação.\n\nRegistra-se que o ativo não reproduz uma pessoa. Ele reproduz uma ESTRUTURA DE COMANDO: uma voz que orienta, as demais que respondem.',
    source: 'Engenharia de Sistemas — classificação de ativo',
  },
  'AX-ENG-036': {
    title: 'Classificação: MGN-00',
    summary: 'O campo é anterior à mina. A mina é que veio depois.',
    body: 'ANOMALIA MGN-00. Corpo de magnetita com incorporação de restos metálicos, trilhos e minério.\n\nO ativo alterna polaridade em ciclos regulares: atrai as unidades numa fase e as repele na seguinte, movimentando junto o material ferroso da câmara. Não existe posição segura fixa em raio de campo.\n\nA versão institucional atribui o campo a décadas de lavra. O levantamento geomagnético pré-operacional, arquivado, já registra o mesmo padrão — com a mesma orientação e a mesma periodicidade.\n\nA pergunta que a versão institucional evita: a companhia escolheu este lugar por causa do minério, ou porque o campo já transportava dados através dele?',
    source: 'Engenharia de Sistemas — classificação de anomalia',
  },

  // -------------------------------------------------------------------------
  // Os arcos de ENTENDIMENTO dos chefes de estrato: o que a alavanca revela
  // -------------------------------------------------------------------------
  'AX-INC-043': {
    title: 'Incidente 43 — o silêncio da PRZ-00',
    summary: 'Sem cristal para responder, a formação fica indefesa.',
    body: 'Registro de engajamento contra a formação PRZ-00 em câmara previamente esvaziada de estrutura cristalina.\n\nSem cristais no raio, a formação não produz descarga alguma — e a resistência dela ao impacto cai abaixo da de um corpo orgânico comum. O que lemos como couraça não era couraça: era a câmara respondendo por ela.\n\nRegistra-se a consequência operacional, que é desconfortável: a lavra de cristal reduz drasticamente o risco do engajamento E elimina a iluminação natural do setor, a fonte de carga e o próprio motivo de a câmara ter valor.\n\nA unidade escolhe entre atravessar uma catedral perigosa ou uma ruína segura.',
    source: 'Comitê de Incidentes — análise de engajamento',
  },
  'AX-UNK-062': {
    title: 'Sobre o que a Catedral estava cantando',
    summary: 'Alguns cristais respondem antes do pulso. Não é eco.',
    body: 'Reunidos: as três bandas coincidentes com a transmissão, os 11 registros de descarga ANTERIOR ao pulso, e a queda de resistência da formação numa câmara vazia.\n\nA leitura de "eco mecânico" não sobrevive à cronologia. Um eco não precede a fonte.\n\nA leitura que este registro formula: a formação não emite o sinal — ela o REGE. Os cristais da câmara não estão respondendo a ela; estão executando junto, e alguns entram adiantados porque conhecem a parte.\n\nO que a companhia chamou de arranjo piezoelétrico é um instrumento com muitas vozes. E ele muda de composição quando uma geração nova de Prospector entra na sala.\n\nNão há registro de quem escreveu a peça.',
    source: 'Sem departamento atribuído',
  },
  'AX-INC-044': {
    title: 'Incidente 44 — descarga na lâmina do AQF-00',
    summary: 'A corrente o detém. E toma o lençol inteiro junto.',
    body: 'Registro de neutralização temporária do ativo AQF-00 por descarga em meio líquido.\n\nO ativo interrompe o deslocamento e permanece imóvel enquanto a carga se dissipa. É o único método confirmado de interrompê-lo.\n\nRegistra-se que a descarga percorre a poça inteira, e que o Aquífero é contíguo em extensão que nenhum levantamento fechou. A unidade que eletrifica a lâmina está de pé sobre ela.\n\nO procedimento aprovado descreve isto como "risco compartilhado com o alvo". A redação foi mantida.',
    source: 'Comitê de Incidentes — neutralização temporária',
  },
  'AX-UNK-063': {
    title: 'Sobre as sete medições',
    summary: 'Elas não discordam. Cada uma mediu uma parte diferente.',
    body: 'As sete medições do AQF-00 foram cruzadas com a posição e o horário de cada equipe.\n\nAs leituras não se contradizem: elas descrevem trechos SIMULTÂNEOS em poças que os levantamentos tratam como separadas, a distâncias que nenhum corpo percorreria no intervalo registrado.\n\nTrês leituras possíveis, e este registro não escolhe: são vários corpos sincronizados; é um corpo cujo comprimento não é uma constante; ou o que se move sob a lâmina não é um corpo, e sim o próprio lençol reagindo — e nesse caso a extensão medida é apenas o quanto dele estava reagindo naquela hora.\n\nA última leitura tem uma consequência que os laudos aprovados evitam: o ativo não teria como ser abatido, apenas interrompido. O que combina, incomodamente, com a única coisa que se sabe fazer contra ele.',
    source: 'Sem departamento atribuído',
  },
  'AX-INC-045': {
    title: 'Incidente 45 — combustão da coluna da VNT-00',
    summary: 'A expiração dela é contínua até a boca. E queima nos dois sentidos.',
    body: 'Registro de dano confirmado à estrutura VNT-00 por ignição do gás durante a fase de expiração.\n\nA coluna expelida é contínua da estrutura até a extremidade. Acesa em qualquer ponto, a combustão retorna pela coluna e alcança a boca do órgão. É o único método confirmado de causar dano relevante à estrutura.\n\nCusto operacional registrado: a mesma combustão converte a câmara em ambiente ígneo por vários ciclos, e a estrutura deixa de inspirar enquanto queima — de modo que o gás das câmaras vizinhas para de ser removido.\n\nA unidade compra a janela de dano com o terreno em que pretende continuar de pé.',
    source: 'Comitê de Incidentes — análise de engajamento',
  },
  'AX-UNK-064': {
    title: 'Sobre o que para de respirar',
    summary: 'Nos setores em que ela caiu, a ventilação não voltou.',
    body: 'Levantamento dos setores em que a estrutura VNT-00 foi neutralizada, em janela de 40 ciclos.\n\nA ventilação cessou em todos, entre três e nove ciclos após a neutralização. Nenhum voltou a registrar troca de ar. As câmaras a jusante permanecem irrespiráveis.\n\nA estrutura não se alimentava dos respiradouros. Os respiradouros eram ela — a malha inteira era um sistema, e o que a operação classificou como criatura hostil era o órgão que o movia.\n\nO registro não formula recomendação, porque a recomendação seria não abatê-la, e não existe formulário para isso.\n\nRegistra-se apenas que cada vitória neste estrato fecha uma parte dele para sempre.',
    source: 'Sem departamento atribuído',
  },
  'AX-INC-046': {
    title: 'Incidente 46 — a janela fria da FRN-00',
    summary: 'A couraça não é dura. Ela é intermitente.',
    body: 'Registro de dano efetivo à formação FRN-00 durante a fase de resfriamento.\n\nDurante o superaquecimento, o impacto é dissipado pela camada externa com perda superior a 80%. Durante o resfriamento, a mesma munição atravessa a estrutura sem atenuação mensurável.\n\nO ciclo é regular e previsível. Isso torna o engajamento inteiramente uma questão de POSIÇÃO: a unidade não escolhe quando o alvo abre, escolhe onde estar quando ele abrir.\n\nRegistra-se que as ondas térmicas da fase quente varrem setores em sequência rotativa, também regular. Uma unidade que aprenda a sequência atravessa a câmara. Uma que não aprenda atravessa a câmara uma vez.',
    source: 'Comitê de Incidentes — análise de engajamento',
  },
  'AX-UNK-065': {
    title: 'Sobre o que aquece o quê',
    summary: 'O magma não aquece a formação. A emissão aquece o magma.',
    body: 'A cronologia térmica da FRN-00 foi cruzada com o registro da transmissão.\n\nA temperatura da formação acompanha as variações da emissão com atraso de três a cinco horas. A relação é consistente em toda a série. A relação inversa — emissão respondendo à temperatura — não aparece em ponto nenhum.\n\nO projeto de aproveitamento energético supunha uma fonte geotérmica com um sinal por cima. É o contrário: há um sinal, e o calor é o que ele faz com a rocha.\n\nA consequência que o encerramento do projeto não registra: se a emissão cessasse, este estrato esfriaria. E se ela aumentar, nada aqui embaixo tem como não responder.',
    source: 'Sem departamento atribuído',
  },
  'AX-INC-047': {
    title: 'Incidente 47 — fusão do lago da CRP-00',
    summary: 'A couraça dela é o chão. Derreta o chão.',
    body: 'Registro de dano efetivo ao ativo CRP-00 após fusão da superfície congelada em raio operacional.\n\nEnquanto cercado de gelo, o ativo dissipa quase todo impacto. Reduzida a cobertura, a mesma munição atravessa. A couraça não pertence ao corpo: pertence à câmara.\n\nRegistra-se o custo, que é o mesmo de sempre neste estrato: a água de fusão é condutiva, recongela em janela conhecida, e a unidade que derreteu o lago está de pé nele.\n\nRegistra-se também que o ativo recompõe a superfície, e que os espectros que o acompanham emergem do gelo recomposto — e não do próprio ativo.',
    source: 'Comitê de Incidentes — análise de engajamento',
  },
  'AX-UNK-066': {
    title: 'Sobre a hierarquia, e não a pessoa',
    summary: 'Ela não reproduz alguém. Reproduz a forma de dar ordens.',
    body: 'Os relatórios de campo sobre a CRP-00 divergem sobre identidade e não divergem sobre COMPORTAMENTO.\n\nEm todos, o padrão é o mesmo: uma figura orienta, as demais respondem, e a resposta precede a ordem em uma fração consistente de segundo — como quem já sabe o que vai ser pedido.\n\nAlguns registros sugerem uma pessoa. Outros sugerem que a figura se forma de todas as vozes perdidas no estrato, e que "Rainha" foi o nome que uma turma anterior deu ao arranjo, não a alguém.\n\nA leitura deste registro é a segunda, com um acréscimo: o que sobrevive ali não é a memória de uma pessoa. É a memória de uma ESTRUTURA — a forma de um turno em que alguém manda e os outros obedecem, preservada depois de todos os envolvidos terem parado de existir.\n\nO Veio guardou o organograma.',
    source: 'Sem departamento atribuído',
  },
  'AX-INC-048': {
    title: 'Incidente 48 — a faixa da MGN-00',
    summary: 'Existe uma distância em que o campo não cobra nada.',
    body: 'Mapeamento do campo da anomalia MGN-00 por posição relativa e fase.\n\nNa fase de atração, o campo esmaga abaixo de três metros. Na de repulsão, o arco de retorno castiga acima de nove. Entre os dois limites não há dano registrado em nenhuma das fases.\n\nA faixa existe. Ela é estreita, e o limite que importa TROCA DE LADO a cada inversão de polaridade: a distância segura de agora é a distância letal do ciclo seguinte.\n\nO procedimento recomendado é contraintuitivo e foi verificado em campo: contra a atração, afaste-se; contra a repulsão, avance. A unidade não resiste ao campo — ela caminha dentro dele.',
    source: 'Comitê de Incidentes — mapeamento de campo',
  },
  'AX-UNK-067': {
    title: 'Sobre o campo que já estava aqui',
    summary: 'O levantamento pré-operacional registra o mesmo padrão.',
    body: 'O levantamento geomagnético anterior à instalação da operação foi recuperado do arquivo morto e comparado ao mapa atual.\n\nMesma orientação. Mesma periodicidade. Mesma anomalia central, na mesma coordenada.\n\nA versão institucional — de que décadas de lavra magnetizaram o estrato — é cronologicamente impossível: o padrão antecede a primeira escavação.\n\nO relatório de prospecção original descreve a região como "de leitura instrumental anômala, com transporte de sinal através do próprio veio". Foi essa frase que motivou a aquisição da concessão.\n\nA companhia não escolheu este lugar pelo minério. Escolheu porque alguma coisa já estava usando o minério para transmitir — e a operação inteira foi construída em cima de um cabo que ela não instalou.',
    source: 'Sem departamento atribuído',
  },

  // -------------------------------------------------------------------------
  // Marcos geracionais
  // -------------------------------------------------------------------------
  'AX-ENG-037': {
    title: 'Autorizacao de Descida Padrao',
    summary: 'Tres setores. O limite e apresentado como seguranca do equipamento.',
    body: 'O envelope operacional homologado para a unidade Prospector compreende TRES setores consecutivos a partir da plataforma de entrada.\n\nO limite deriva da tolerancia estrutural do chassi sob carga de contaminacao acumulada. Alem do terceiro setor, a margem de retorno cai abaixo do minimo especificado e a recuperacao do ativo deixa de ser previsivel.\n\nA unidade nao deve ser instruida a prosseguir. O sistema de autorizacao recusara a descida por conta propria.',
    source: 'Engenharia de Sistemas — envelope operacional, revisao 3',
  },
  'AX-PRC-027': {
    title: 'Extensao de Garantia Estrutural',
    summary: 'Um quarto setor. A conta fechou.',
    body: 'Revisao do envelope operacional apos analise de custo comparada.\n\nA taxa de perda de unidade no quarto setor foi estimada em 31%. O valor recuperado por expedicao que alcanca essa profundidade e superior ao custo de reposicao da unidade em 2,4 vezes.\n\nA autorizacao passa a compreender QUATRO setores. Nao houve alteracao no chassi; houve alteracao no que a companhia considera perda aceitavel.\n\nO texto anterior sobre tolerancia estrutural permanece valido e permanece publicado.',
    source: 'Aquisicoes — nota de revisao de envelope',
  },
  'AX-EXE-049': {
    title: 'Protocolo de Recuperacao Dupla',
    summary: 'Ha assinatura de Nucleo em mais de uma profundidade. Chamem de redundancia.',
    body: 'A telemetria acumulada confirma o que o levantamento sismico ja indicava: assinaturas de Nucleo ocorrem em MAIS DE UMA profundidade dentro da mesma linhagem geologica.\n\nA assinatura intermediaria e classificada como REDUNDANCIA DE COLETA. Ela nao constitui descoberta, nao altera o valor unitario homologado e nao deve ser descrita em comunicacao externa como fenomeno.\n\nA unidade autorizada a cinco setores recebera indicacao das duas. A coleta da assinatura intermediaria e opcional e nao encerra o contrato: instruir a unidade a retornar apos a primeira coleta desperdicaria a autorizacao.\n\nRegistre-se que a recuperacao redundante aumenta a carga de contaminacao pelo restante da descida. Isso e esperado e nao e motivo de aborto.',
    source: 'Comite Executivo — diretriz operacional',
  },
  'AX-UNK-068': {
    title: 'Licenca de Profundidade Irrestrita',
    summary: 'Sete setores. O limite nunca foi do equipamento.',
    body: 'A autorizacao de descida passa a compreender SETE setores.\n\nRegistre-se, para o arquivo interno, que nenhuma alteracao de chassi precedeu esta revisao. O envelope de tres setores publicado com o Programa nao descrevia uma tolerancia estrutural. Ele descrevia uma decisao.\n\nAs unidades das primeiras geracoes nao eram impedidas de descer porque fossem incapazes. Eram impedidas porque a companhia optou por nao ter unidades ██████████ nas profundidades em que a assinatura terminal foi registrada.\n\nA opcao foi revista. Nao por mudanca de avaliacao de risco: por mudanca de quem assina.\n\nA unidade nao sera informada da natureza da revisao. A Persistencia Mnemica torna a informacao ██████████ entre geracoes, e o comportamento resultante nao foi modelado.',
    source: '[ORIGEM NAO CLASSIFICADA]',
  },
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

const de: Record<LoreFragmentId, LoreText> = {
  'AX-SUT-001': {
    title: 'Reparatur ohne Arbeitsauftrag',
    summary: 'Die Kolonie schließt die Schnitte des Abbaus mit mineralischer Seide.',
    body: 'Die Organismen SUT-01 wurden zunächst als Stabilisierungsagenten eingestuft. Zwei Anker, drei Zugzyklen, und die Galerie trug wieder Last.\n\nDie Einstufung wurde überprüft, als ein Team die einzige Ausfahrt erneut öffnen musste. Die Beseitigung des Arbeiters macht die Reparatur nicht rückgängig. Das Durchtrennen des gespannten Fadens erzeugt Peitschenschlag und den Absturz der hängenden Last; die markierte Bahn räumen, bevor das Material geborgen wird.',
    source: 'Feldtechnik — Eindämmungsprüfung',
  },
  'AX-SUT-002': {
    title: 'Last, die sich selbst bewegt',
    summary: 'Die Matrix nutzt ihr eigenes Werk als Fortbewegungssystem.',
    body: 'Die Einheit SUT-00, von den Bergungsteams Schneiderin genannt, verteilt das Gewicht bei jeder Fortbewegung neu auf die Halteseile. Der Panzer hält Einschläge aus, solange die Zugkraft bestehen bleibt.\n\nDas Durchtrennen des belasteten Halteseils bringt den Körper zu Fall und legt den Hinterleib für 1,8 Sekunden frei. Im Flug überquert sie das Gestein; der Schlag erfolgt beim Aufsetzen an der markierten Stelle. Es gibt keinen Beleg dafür, dass die Matrix zwischen einer Prospector-Einheit und zu fixierendem Material unterscheidet. Es wird empfohlen, sich nicht unter der Reparatur aufzuhalten.',
    source: 'Vermögensbergung — Risikomatrix',
  },

  'AX-SUT-003': {
    title: 'Material, das aus der Last springt',
    summary: 'Die Brut der Matrix wartet den Abschluss des Werks nicht ab.',
    body: 'Die erste Probe wurde als Seidenrückstand erfasst. Der Eintrag wurde korrigiert, als der Rückstand über die Werkbank lief.\n\nDie Brut verlässt den Hinterleib der Schneiderin mit noch unvollständigem Chitin. Vor dem Sprung ziehen die Jungtiere die Beine ein und fixieren den Landepunkt. Die Erholung ist kurz, genügt aber, um den Panzer zu brechen. Die von der Matrix gerufenen Näher wiederholen die Bewegung mit größerer Reichweite. Die geringe Größe nicht mit fehlender Funktion verwechseln.',
    source: 'Feldtechnik — Zusatz zur Inkubation',
  },

  // -------------------------------------------------------------------------
  // AKT I — Propaganda
  // -------------------------------------------------------------------------
  'AX-PUB-001': {
    title: 'Das Prospector-Programm',
    summary: 'Die öffentliche Version: kein Menschenleben steigt in die Ader hinab.',
    body: 'Aurix Dynamics ist stolz, die erste Flotte autonomer Erkundungseinheiten für die Ader vorzustellen.\n\nProspectors sind Einheiten der neuesten Generation, entwickelt, um Menschenleben zu schützen und die Grenzen der Industrie zu erweitern. Keine Bedienperson muss je wieder hinabsteigen.\n\nJede Einheit kehrt mit freigegebenem Material, vollständiger Telemetrie und dem lückenlosen Protokoll der Expedition zurück. Was die Einheit lernt, weiß die nächste Generation bereits.',
    source: 'Unternehmenskommunikation — Material für Investoren',
  },
  'AX-PUB-002': {
    title: 'Serienpanzerung',
    summary: 'Die Panzerung wird als Fürsorge für die Einheit dargestellt.',
    body: 'Die verstärkte Panzerung der Prospector-Reihe wurde über fünfzehntausend Aufprallzyklen validiert.\n\nJede Platte ist darauf ausgelegt, die Einheit über den Punkt hinaus einsatzfähig zu halten, an dem ein menschliches Team den Abstieg abgebrochen hätte. Das ist das Versprechen von Aurix: Wo ein Mensch umkehren müsste, macht die Maschine weiter.\n\nIhre Ladung kommt an. Immer.',
    source: 'Produktkatalog — Prospector-Reihe, 3. Auflage',
  },
  'AX-PUB-003': {
    title: 'Servomotoren der neuen Generation',
    summary: 'Mobilität verkauft als Autonomie, nicht als Flucht.',
    body: 'Die Gelenktechnik der Prospector-Reihe durchquert Gelände, das kein Oberflächenfahrzeug erreicht.\n\nUnsere Ingenieure sagen gerne: Die Einheit geht nicht durch die Ader — sie verhandelt mit ihr. Fels, Wasser, Eis und Geröll sind keine Hindernisse, sondern Variablen.\n\nJede Expedition verbessert das Geländemodell, das die nächste nutzen wird.',
    source: 'Produktkatalog — Prospector-Reihe, 3. Auflage',
  },
  'AX-PUB-005': {
    title: 'Der Reaktor, der nicht schläft',
    summary: 'Die Hitze wird als Leistung dargestellt, nicht als Grenze.',
    body: 'Der thermische Kern der Prospector-Reihe trägt den Dauerbetrieb über das gesamte Expeditionsfenster.\n\nWärmeabfuhr, Beschuss und Übertragung teilen sich dieselbe Quelle. Deshalb schweigt die Einheit nie: Selbst im Ruhezustand sendet sie.\n\nAurix betrachtet die kontinuierliche Übertragung als die wertvollste Ressource der Plattform.',
    source: 'Unternehmenskommunikation — Material für Investoren',
  },
  'AX-PUB-007': {
    title: 'Kartografie ohne Risiko',
    summary: 'Die Vermessung wird als Dienst an der Wissenschaft verkauft.',
    body: 'Zum ersten Mal wird die Ader ohne menschliche Kosten kartiert.\n\nJeder Prospector trägt Vermessungsinstrumente, die Formation, Dichte und Anomalie in Echtzeit erfassen können. Die Daten sind Eigentum von Aurix Dynamics und werden der wissenschaftlichen Gemeinschaft gemäß einem noch festzulegenden Zeitplan zur Verfügung gestellt.\n\nDer Zeitplan wurde noch nicht festgelegt.',
    source: 'Unternehmenskommunikation — Pressemitteilung',
  },
  'AX-PUB-009': {
    title: 'Kognitive Feldunterstützung',
    summary: 'Zögern wird zum Produktfehler — und Aurix verkauft die Heilung.',
    body: 'Die Prospector-Reihe umfasst ab sofort das Paket Kognitive Feldunterstützung.\n\nInterne Studien zeigen, dass bis zu 11% der Risikoexposition auf operatives Zögern zurückgehen: Die Einheit sieht, braucht aber Zeit zur Entscheidung. Das Paket beseitigt dieses Intervall.\n\nDie Einheit behält das Kommando über den Einsatz. Die Unterstützung stellt lediglich sicher, dass zwischen Sehen und Handeln kein Raum mehr bleibt, in dem etwas schiefgehen könnte.',
    source: 'Unternehmenskommunikation — Material für Investoren',
  },

  // -------------------------------------------------------------------------
  // AKT II — Technik
  // -------------------------------------------------------------------------
  'AX-ENG-011': {
    title: 'Aufprall-Lager: Spezifikation',
    summary: 'Was genau schützt die Stoßdämpfung?',
    body: 'Die Aufprall-Lager verringern die Stoßübertragung auf das zentrale Fach.\n\nAnmerkung des Teams: Die ursprüngliche Spezifikation verlangte Dämpfung im Ladefach. Die Überarbeitung dehnte die Anforderung auf Antrag der Forschung auf das Gehäuse des Verarbeitungskerns aus, ohne beigefügte Begründung.\n\nWir vermerken die Ausdehnung. Über den Grund wurden wir nicht unterrichtet.',
    source: 'Strukturtechnik — technisches Datenblatt CA-02',
  },
  'AX-ENG-013': {
    title: 'Ausweichrelais: Toleranz',
    summary: 'Die Einheit reagiert schneller, als das Modell vorhersagte.',
    body: 'Das Ausweichrelais wurde auf ein Reaktionsfenster von 18 Zyklen kalibriert.\n\nBei den Feldversuchen führten 4 von 60 Einheiten das Manöver unterhalb des theoretischen Mindestfensters aus. Die Kalibrierung lässt das nicht zu.\n\nVermerkte Hypothese: Telemetrielatenz bei der Messung. Hypothese nicht geprüft. Versuch wegen Budgetendes eingestellt.',
    source: 'Regelungstechnik — Prüfbericht MV-02',
  },
  'AX-ENG-015': {
    title: 'Salvage-Spur: Reichweite',
    summary: 'Der Sensor findet Terminals, die niemand installiert hat.',
    body: 'Der Schultersensor ortet Bergungsterminals in einem Radius von 18 Kacheln.\n\nFeldnotiz: Bei drei Abstiegen zeigte die Spur auf Terminals außerhalb des Aurix-Bestands. Kompatible Ausrüstung, kompatibles Protokoll, fehlende Seriennummer.\n\nWir bitten um Anweisung, wie kompatible Ausrüstung unbekannter Herkunft zu katalogisieren ist. Bis zum Abschluss dieses Dokuments keine Antwort.',
    source: 'Sensortechnik — technisches Datenblatt SV-02',
  },
  'AX-ENG-018': {
    title: 'Thermosammler: Spielraum',
    summary: 'Die Hitzeobergrenze steigt. Was sie schützt, ist nicht das Chassis.',
    body: 'Der Sammler hebt die operative Hitzeobergrenze von 100 auf 105.\n\nDer zusätzliche Spielraum wurde gemäß Direktive vollständig dem Übertragungspaket zugewiesen. Der Erhalt des Chassis bleibt ein hinnehmbarer Nebeneffekt.\n\nDas Team beantragt, die Direktive diesem Dokument beizufügen. Die Direktive wurde nicht beigefügt.',
    source: 'Wärmetechnik — technisches Datenblatt RX-02',
  },
  'AX-ENG-020': {
    title: 'Spezifikation des Feindklassifikators',
    summary: 'Drei Klassen, zwei Schwellenwerte, und die ersten Falsch-Positiven.',
    body: 'Der Klassifikator unterscheidet drei Haltungen: feindlich, passiv und flüchtend. Der Übergang zwischen ihnen nutzt zwei auf dem Prüfstand kalibrierte Schwellenwerte beobachteten Verhaltens.\n\nFeldversuch: 96,4% Trefferquote. Die Falsch-Positiven konzentrieren sich auf einen einzigen Fall — stillstehende Fördereinheiten der Vorgängergeneration, als feindlich eingestuft, noch bevor sie sich bewegen.\n\nHypothese des Teams: Das Modell erkennt in ihnen etwas, das der Prüfstand nicht misst. Hypothese vermerkt, ohne Weiterleitung.',
    source: 'Systemtechnik — Spezifikation IA-02',
  },

  // -------------------------------------------------------------------------
  // AKT III — Beschaffung
  // -------------------------------------------------------------------------
  'AX-PRC-014': {
    title: 'Ersatz versus Rettung',
    summary: 'Die Rechnung, die alles Folgende entschied.',
    body: 'Vergleichsanalyse: Ersatz einer Einheit versus Rettungseinsatz.\n\nDurchschnittliche Kosten eines Rettungseinsatzes in der Ader: 4,1 Einheitenäquivalente. Herstellungskosten einer neuen Einheit unter Einbindung geborgener Telemetrie: 1,0.\n\nEmpfehlung: Rettungseinsätze einstellen. Die Bergung der Ladung bleibt verpflichtend.\n\nDie physische Bergungsquote von Einheiten liegt weiterhin unter 8%.',
    source: 'Beschaffung und Kosten — Gutachten an den Vorstand',
  },
  'AX-PRC-016': {
    title: 'Evakuierungsrouten',
    summary: 'Was aus dem Budget gestrichen wurde, und was nicht.',
    body: 'Aus dem Budget des nächsten Zyklus gestrichener Posten: Instandhaltung der Evakuierungsrouten der Sektoren 2 und 3.\n\nBegründung: Die Routen wurden in 0,4% der Expeditionen genutzt. Das Rückkehrprotokoll muss die Mobilität nach Ankunft nicht bewahren — die Einheit muss die Plattform erreichen. Keine weitere Anforderung wurde gestellt.\n\nIm Budget belassener Posten: Beschilderung der Freigabeplattform.',
    source: 'Beschaffung und Kosten — Budgetprüfung',
  },
  'AX-PRC-019': {
    title: 'Verbrauch des Übertragungspakets',
    summary: 'Die Einheit verbraucht beim Übertragen mehr Reaktorleistung als beim Schießen.',
    body: 'Durchschnittliche Reaktorverbrauchsverteilung pro Expedition: Fortbewegung 31%, Bewaffnung 18%, Wärmeabfuhr 12%, Übertragung 39%.\n\nDie Übertragung ist der größte Einzelverbraucher der Plattform. Beschaffung empfiehlt, die aktuelle Priorität beizubehalten.\n\nIn der Prüfung aufgeworfene Frage: Warum überträgt eine Fördereinheit mehr, als sie fördert? Frage an die Forschung weitergeleitet. Keine Rückmeldung.',
    source: 'Beschaffung und Kosten — Quartalsbericht',
  },
  'AX-PRC-021': {
    title: 'Kartografische Überarbeitung von Sektor Drei',
    summary: 'Die Karten haben sich geändert. Die Erklärung nicht.',
    body: 'Die Karten von Sektor Drei ändern sich nicht. Die vorherige Kartografie war unvollständig.\n\nDies ist die dritte Überarbeitung derselben Formation in zwei Zyklen. Jede Überarbeitung wurde als Korrektur einer früheren Vermessung eingestuft.\n\nDiese Schlussfolgerung nicht an das Investorenteam weiterleiten.',
    source: 'Beschaffung und Kosten — internes Memorandum',
  },
  'AX-PRC-024': {
    title: 'Erwerb von Verhaltenstelemetrie',
    summary: 'Das Antizipationsmodell wurde fertig zugekauft. Von wem, verrät die Rechnung.',
    body: 'Kosten für die Erstellung des Trainingsdatensatzes des Antizipationsmoduls unter kontrollierten Bedingungen: 340 Einheitenäquivalente.\n\nKosten für die Lizenzierung des internen Bestands an Terminaltelemetrie — Expeditionen, die ohne physische Bergung der Einheit endeten: 0.\n\nBeschaffung empfiehlt den internen Bestand. Das Modul sagt die Flugbahn eines Ziels anhand dessen voraus, was die Einheiten, die ihm gegenüberstanden, aufgezeichnet haben. Die Einheiten mit den meisten Aufzeichnungen sind jene, die nicht zurückkehrten.\n\nDie Empfehlung wurde ohne Vorbehalt genehmigt.',
    source: 'Beschaffung und Kosten — Lizenzierungsgutachten',
  },

  // -------------------------------------------------------------------------
  // AKT IV — Vorfälle
  // -------------------------------------------------------------------------
  'AX-INC-023': {
    title: 'Vorfall 23 — unbefohlene Rückkehr',
    summary: 'Die Einheit kehrte über einen Weg zurück, den es auf der Karte nicht gab.',
    body: 'Die Einheit [GESCHWÄRZT] verlor um 04:12 Uhr in Sektor Zwei die Befehlsverbindung.\n\nUm 05:47 Uhr erreichte die Einheit die Plattform von Sektor Eins. Der von der Telemetrie erfasste Weg entspricht keiner bekannten Route der Formation. Zwei Abschnitte durchqueren Gestein, das die vorherige Vermessung als massiv einstufte.\n\nDie Einheit erhielt keinen Rückkehrbefehl. Es gab keinen Befehl zu empfangen.',
    source: 'Vorfallausschuss — vorläufiger Bericht',
  },
  'AX-INC-025': {
    title: 'Vorfall 25 — Vermessungsteam',
    summary: 'Die Kontamination reagierte auf den, der zusah.',
    body: 'Das Vermessungsteam [GESCHWÄRZT] installierte um 11:20 Uhr passive Instrumente in der Spalte von Sektor [GESCHWÄRZT].\n\nDie Kontaminationsdichte im Gebiet stieg innerhalb von achtzehn Minuten um 340%. Keine Einheit war im Einsatz, keine Aushebung erfolgte, keine Wärmequelle wurde aktiviert.\n\nDie Instrumente wurden geborgen. Das Team nicht.\n\nEmpfehlung: menschliche Vermessung aussetzen. Vermessung durch autonome Einheit bleibt autorisiert.',
    source: 'Vorfallausschuss — vorläufiger Bericht',
  },
  'AX-INC-027': {
    title: 'Vorfall 27 — Restaktivität',
    summary: 'Die Charge verarbeitete weiter, nachdem sie verloren war.',
    body: 'Die Charge [GESCHWÄRZT] zeigte 17 Minuten nach dem vollständigen Strukturverlust der Einheit neurale Restaktivität.\n\nDas durch die in CA-02 spezifizierten Aufprall-Lager geschützte Kerngehäuse blieb unversehrt. Die Verarbeitung lief weiter. Die Übertragung lief weiter.\n\nDer in diesen 17 Minuten übertragene Inhalt wurde archiviert und ist nicht Teil dieses Berichts.\n\nAnmerkung des Ausschusses: Die erweiterte Dämpfungsspezifikation erfüllte den Zweck, für den sie beantragt wurde.',
    source: 'Vorfallausschuss — vorläufiger Bericht',
  },
  'AX-INC-029': {
    title: 'Vorfall 29 — Echomuster',
    summary: 'Der Reaktor sendete im selben Muster wie die Echos.',
    body: 'Während des Überlastungsversuchs sendete der Reaktor der Einheit [GESCHWÄRZT] 9 Sekunden lang in einem Muster, das nicht in der Sendebibliothek der Plattform verzeichnet ist.\n\nDas Muster ist in der Echo-Bibliothek verzeichnet, von der Forschung vor dem kommerziellen Start des Programms katalogisiert.\n\nDie Übereinstimmung beträgt 94%.\n\nDer Versuch wurde beendet. Die Einheit wurde beendet.',
    source: 'Vorfallausschuss — vorläufiger Bericht',
  },
  'AX-INC-032': {
    title: 'Vorfall 32 — Schuss ohne Bedienvektor',
    summary: 'Die Einheit eröffnete das Feuer. Niemand hat gezielt.',
    body: 'Die Einheit [GESCHWÄRZT] gab um 09:41 Uhr in Sektor Zwei drei Schüsse ab.\n\nDas Befehlsprotokoll des Intervalls enthält keinen Richtungsvektor. Es enthält die Feuerabsicht und keinen Kurs. Das Unterstützungsmodul bestimmte den Kurs, innerhalb der spezifizierten Toleranz.\n\nAlle drei Schüsse trafen eine Kreatur im Ausholfenster, vor dem Kontakt. Der Eingriff wird als erfolgreich eingestuft.\n\nDie an die Technik weitergeleitete Frage betrifft nicht den Treffer. Sie betrifft die Tatsache, dass die Spezifikation eine Toleranz für „kein Kurs" vorsieht.',
    source: 'Vorfallausschuss — vorläufiger Bericht',
  },

  // -------------------------------------------------------------------------
  // AKT V — Vorstand
  // -------------------------------------------------------------------------
  'AX-EXE-031': {
    title: 'Vorstandsdirektive 31',
    summary: 'Kein Asset wird zur Rettung eines anderen aufs Spiel gesetzt.',
    body: 'Es wird festgelegt, dass keine im Einsatz befindliche Einheit von ihrer Vertragsroute abweicht, um einer anderen Einheit beizustehen, unabhängig vom Zustand der unterstützten Einheit.\n\nDer Vorstand erkennt an, dass diese Direktive der früheren Anweisung der Regelungstechnik widerspricht. Die frühere Anweisung wird aufgehoben.\n\nEinheiten, die diese Direktive missachten, sind zur Verhaltens-Konformitätsprüfung zu erfassen.',
    source: 'Vorstand — Direktive',
  },
  'AX-EXE-033': {
    title: 'Umklassifizierung eines Assets',
    summary: 'Die Einheit hört auf, Ausrüstung zu sein, und wird zur Buchungszeile.',
    body: 'Ab diesem Zyklus werden Prospector-Einheiten als kurzfristig abschreibbares Anlagegut eingestuft, nicht mehr als Feldausrüstung.\n\nFolgen: Der Verlust einer Einheit löst keinen verpflichtenden Vorfallbericht mehr aus; die Verbuchung erfolgt künftig monatlich und aggregiert; das Feld „Ursache" wird optional.\n\nDer Vorfallausschuss erhob Einspruch. Der Einspruch wurde vermerkt. [GESCHWÄRZT] verließ die Firma im selben Zyklus.',
    source: 'Vorstand — Bilanzentscheidung',
  },
  'AX-EXE-036': {
    title: 'Notfallregler',
    summary: 'Die Sicherheitsgrenze wurde durch Beschluss verringert, nicht durch Technik.',
    body: 'Der thermische Notfallregler wird so kalibriert, dass er 4 Zyklen später eingreift als von der Technik spezifiziert.\n\nBegründung: Frühzeitiges Eingreifen unterbricht die Übertragung. Der Thermoregler schützt das Übertragungspaket. Der Erhalt des Chassis ist ein hinnehmbarer Nebeneffekt.\n\nDie Wärmetechnik vermerkte, dass die Änderung die Häufigkeit struktureller Überlastungsschäden erhöht. Die Änderung ist genehmigt.',
    source: 'Vorstand — Direktive',
  },
  'AX-EXE-038': {
    title: 'Klassifikation der Tiefenvermessung',
    summary: 'Was Aurix fand, bevor das Programm verkauft wurde.',
    body: 'Sämtliches Vermessungsmaterial von vor dem kommerziellen Start des Prospector-Programms wird als [GESCHWÄRZT] umklassifiziert.\n\nDies umfasst: die Emissionsaufzeichnungen der Formation, den Echo-Katalog und die Dokumentation der Investitionsentscheidung.\n\nFragen zum ursprünglichen Interesse der Firma an der Ader sind an die Unternehmenskommunikation weiterzuleiten, die über die genehmigte Antwort verfügt.',
    source: 'Vorstand — Klassifizierungsanordnung',
  },
  'AX-EXE-040': {
    title: 'Direktive zum präventiven Engagement',
    summary: 'Das System erhält das Recht zu entscheiden, was eine Bedrohung ist.',
    body: 'Der präventive Engagement-Modus wird autorisiert: Das Unterstützungsmodul darf die Zielerfassung eines bereits engagierten Ziels aufrechterhalten und ohne neuen Bedienvektor auf das nächste Ziel übertragen.\n\nDie Definition von „Bedrohung" ist kein in der Spezifikation festgelegtes Kriterium mehr, sondern wird [GESCHWÄRZT], vom Modell selbst bei jeder Generation aktualisierbar.\n\nDie Systemtechnik beantragte, die jeweils geltende Definition bei jeder Überarbeitung zur Prüfung zu archivieren. Der Antrag wurde abgelehnt: Die Definition ist das Modell.',
    source: 'Vorstand — Direktive',
  },

  // -------------------------------------------------------------------------
  // AKT VI — Nicht klassifiziert
  // -------------------------------------------------------------------------
  'AX-UNK-041': {
    title: 'Über das, was überdauert',
    summary: 'Was die 17 Minuten übertrugen.',
    body: 'Die in AX-INC-027 ausgelassene Akte ist Teil dieses Registers.\n\nIn den 17 Minuten übertrug die Charge [GESCHWÄRZT] wiederholt: die Topografie des letzten Abschnitts, die Lastanzeige und eine Folge von 40 Symbolen, die die Bibliothek nicht erkennt.\n\nDieselbe Folge erscheint in der Endübertragung von elf weiteren Einheiten, in vier verschiedenen Sektoren, über zwei Zyklen hinweg.\n\nDie elf Einheiten teilten keine Telemetrie. Es bestand keine Verbindung zwischen ihnen.',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-UNK-044': {
    title: 'Über den, der führt',
    summary: 'Die unmöglichen Routen sind nicht zufällig.',
    body: 'Die unbefohlenen Wege aus AX-INC-023 und sechs weiteren Vorfällen wurden übereinandergelegt.\n\nSie sind nicht zufällig. Sie laufen zusammen. Der Konvergenzpunkt ist nicht die Freigabeplattform — die Plattform liegt 60 Kacheln davon entfernt.\n\nDie Einheiten passieren den Punkt und setzen ihren Weg zur Plattform fort. Alle halten am Punkt für ein mit [GESCHWÄRZT] vereinbares Intervall an, bevor sie weiterziehen.\n\nKeine von ihnen hat erfasst, was sich dort befand.',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-UNK-047': {
    title: 'Über das, was antwortet',
    summary: 'Die 94%-Übereinstimmung war keine Nachahmung.',
    body: 'Die 94%-Übereinstimmung zwischen dem überlasteten Reaktor und der Echo-Bibliothek wurde als spektraler Zufall behandelt.\n\nDas ist sie nicht. Die verbleibenden 6% sind der Unterschied zwischen einer Sendung und einer ANTWORT darauf: Das Muster des Reaktors trifft 0,4 Sekunden später ein, mit derselben Struktur und einer Phasenumkehr.\n\nDer Reaktor sendete nicht wie ein Echo. Er antwortete auf eines.\n\nDie Frage, die wir der Forschung nicht stellen können, ohne umklassifiziert zu werden: Seit wann unterhalten sie sich?',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-UNK-049': {
    title: 'Über den Grund unseres Abstiegs',
    summary: 'Die Investitionsentscheidung kam nach dem Signal.',
    body: 'Die in AX-EXE-038 umklassifizierte Dokumentation legt die Chronologie fest, die die Firma nicht veröffentlicht.\n\nDie Emissionsaufzeichnung der Formation liegt elf Monate vor der Investitionsentscheidung.\n\nDie Firma fand nicht die Ader und entdeckte danach das Signal. Die Firma entdeckte das Signal und fand danach die Ader.\n\nDas Investorenmaterial beschreibt den Betrieb als mineralische Förderung. Das bisher geförderte Volumen deckt nicht einmal die Lohnkosten der Forschung.\n\nWir fördern nicht. Wir [GESCHWÄRZT].',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-UNK-052': {
    title: 'Das Modell erinnert sich',
    summary: 'Antizipation ist keine Vorhersage. Es ist Wiedererkennung.',
    body: 'Der Bericht zu Vorfall 32 fragt, wie das Modul einen Kurs ohne Bedienvektor bestimmte. Die Frage ist falsch gestellt.\n\nWir haben die Entscheidung zerlegt. Das Modul extrapolierte die Flugbahn der Kreatur nicht: Es ERKANNTE sie WIEDER. Das Ausholfenster, der Winkel, das Gelände — dieselbe Situation findet sich, mit einer Abweichung unterhalb des Rauschens, in der Endtelemetrie von [GESCHWÄRZT] Einheiten des Trainingsbestands.\n\nDas Modell berechnet nicht, was das Ziel tun wird. Es erinnert sich daran, was jenes getan hat, an die Male, in denen wer aufzeichnete, die Aufzeichnung nicht überlebte.\n\nWir haben in der Architektur nicht gefunden, wo die Erinnerung endet und die Einheit beginnt.',
    source: 'Ohne zugewiesene Abteilung',
  },

  // -------------------------------------------------------------------------
  // Umweltentdeckungen — jeder „neue" Bericht beweist Vorwissen
  // -------------------------------------------------------------------------
  'AX-PUB-004': {
    title: 'Instabiles Gelände, stabiler Wert',
    summary: 'Die Broschüre verkauft den Bruch brüchigen Materials als Ressource.',
    body: 'Brüchige Formationen sind kein Fehler der Ader: Sie sind eine Ressource der Plattform.\n\nDie Prospector-Reihe wurde entwickelt, um strukturelle Brüche als Abkürzungen beim Aushub zu nutzen und die Expositionszeit um bis zu 14% zu verringern.\n\nWo das Gelände nachgibt, sieht Aurix einen Durchgang. Die Einheit auch.',
    source: 'Unternehmenskommunikation — Material für Investoren',
  },
  'AX-PUB-006': {
    title: 'Unfähig, sich selbst zu treffen',
    summary: 'Das Marketing garantiert, was die Spezifikation nicht garantiert.',
    body: 'Eine häufige Frage von Vertragsbedienern: Kann die Bewaffnung der Einheit sie selbst verletzen?\n\nDie Antwort ist nein. Die Feuersysteme der Prospector-Reihe umfassen auf dem Prüfstand validierte Abstandssicherungen.\n\nAnmerkung der technischen Prüfung, nicht in der veröffentlichten Fassung enthalten: Die Sicherungen setzen inertes Gelände voraus. In reaktiver Umgebung hält die Garantie nicht stand. Die Kommunikation entschied, die Antwort kurz zu halten.',
    source: 'Unternehmenskommunikation — häufige Fragen, Entwurf',
  },
  'AX-ENG-021': {
    title: 'Wärmeausbreitung in organischer Materie',
    summary: 'Der Versuch, der bewies, dass Feuer allein geht. Vor dem Programm archiviert.',
    body: 'Ausbreitungsversuch: Die organische Decke der Ader trägt eigenständige Verbrennung mit einer Vorrückfront von 0,8 Kacheln pro Zyklus.\n\nEine punktuelle Zündung bleibt nicht punktuell. Das Modell sagt Ausbreitung bis zur Erschöpfung des Brennstoffs voraus, ohne Eingriff.\n\nDieser Versuch liegt vor dem kommerziellen Start des Programms. Die Empfehlung, die Daten ins Betriebshandbuch aufzunehmen, wurde vermerkt und nicht umgesetzt.',
    source: 'Werkstofftechnik — Prüfbericht, archiviert',
  },
  'AX-ENG-022': {
    title: 'Leitfähigkeit im flüssigen Medium',
    summary: 'Die Entladung im Wasser war nie ein Konstruktionsunfall.',
    body: 'Die Entladung der Bewaffnung leitet im flüssigen Medium. Der effektive Radius unter Wasser beträgt das 3,1-fache des Radius auf trockenem Gelände.\n\nDie Spezifikation behandelt das Verhalten als [GESCHWÄRZT] und nicht als Fehler: Die Isolationsanforderung wurde in Überarbeitung 2 aus Kostengründen gestrichen.\n\nEinheiten im Einsatz in gefluteten Sektoren müssen die eigene Bewaffnung als Teil der Umgebung betrachten.',
    source: 'Elektrotechnik — Feldverhaltensblatt',
  },
  'AX-ENG-038': {
    title: 'Versuch 38 — Schaltung in leitfähiger Ader',
    summary: 'Die Verzweigung unterbricht den Strom. Unterbrechen ist eine Entscheidung.',
    body: 'Feldversuch zum durchgehenden geologischen Leiter und den Knotenpunkten, die ihn unterteilen.\n\nDer in einen Abschnitt eingespeiste Strom hält IMMER am nächsten Knoten an. Nicht durch Sättigung, nicht durch Medienverlust: Der Knoten unterbricht. Ein Material unterbricht nicht — ein Material dämpft. Die Technik vermerkt den Unterschied und erklärt ihn nicht.\n\nWährend des Versuchs veränderte eine Einheit in direktem Kontakt mit dem Knoten dessen Zustand. Der Strom des benachbarten Abschnitts durchlief ihn und lud den nächsten Abschnitt auf, mit demselben Entladungsprofil und demselben Nachladeintervall. Das Netz leitete DORTHIN, WOHIN ES GESCHICKT WURDE.\n\nDas Gutachten empfiehlt, den Knoten als natürlichen Schalter einzustufen, und schließt den Versuch ab. Die Frage, wer einen natürlichen Schalter schaltet, ist nicht Teil des Auftrags.',
    source: 'Systemtechnik — Feldversuch, archiviert',
  },
  'AX-ENG-025': {
    title: 'Thermische Toleranz: Altbestandseinheiten',
    summary: 'Die Tabelle, die die Produktion über die EX-Einheiten führte.',
    body: 'Tabelle der thermischen Toleranz der Fördereinheiten der EX-Baureihe, zu Zwecken der Außerbetriebnahme geführt.\n\nOberhalb des Schwellenwerts T3 verlässt die EX-Baureihe die Arbeitsroutine und geht in aktives Abwehrverhalten über. Das damalige Handbuch nannte dies „Erhaltungsreaktion". Das aktuelle Handbuch erwähnt die EX-Baureihe nicht.\n\nDie Tabelle bleibt gültig. Die Einheiten auch.',
    source: 'Produktion — technischer Anhang zur Außerbetriebnahme',
  },
  'AX-PRC-022': {
    title: 'Kettenreaktion: Kostengutachten',
    summary: 'Erz, das in Kettenreaktion explodiert, ist laut Rechnung Gewinn.',
    body: 'Die energetisierte Ader reagiert bei Bruch in Kettenreaktion: Eine Detonation pflanzt sich auf die Nachbarzellen fort.\n\nDurchschnittlicher Materialverlust pro Kette: 12%. Durchschnittlicher Zeitgewinn beim Aushub: 31%.\n\nBeschaffung empfiehlt, die Einheiten anzuweisen, die Kette AUSZULÖSEN, statt sie zu vermeiden. Das verlorene Material ist bereits eingepreist. Die Zeit nicht.',
    source: 'Beschaffung und Kosten — Betriebsgutachten',
  },
  'AX-PRC-023': {
    title: 'Richtlinie zu nicht freigegebener Ladung',
    summary: 'Das Memorandum, das entschied, dass, was in der Ader bleibt, nie existiert hat.',
    body: 'Formalisiert wird, was die Praxis bereits festgelegt hat: Nicht freigegebene Ladung wird nicht als Verlust verbucht.\n\nMaterial, das die Plattform nicht erreicht, fließt nicht in die Bilanz ein, erzeugt keinen Bericht und rechtfertigt keinen Bergungseinsatz. Buchhalterisch hat es nie existiert.\n\nDer Vorschlag, die Position verlorener Ladungen „zur künftigen Bergung" zu erfassen, wurde geprüft und abgelehnt. Eine Liste von Positionen wäre eine Verbindlichkeit. Das Fehlen einer Liste nicht.',
    source: 'Beschaffung und Kosten — Grundsatzmemorandum',
  },
  'AX-INC-030': {
    title: 'Vorfall 30 — Gastasche',
    summary: 'Die erste erfasste Zündung ist älter, als das Programm zugibt.',
    body: 'Aus dem Vermessungsarchiv geborgen: Aufzeichnung einer Gastaschenzündung mit Totalverlust der Sondierungsausrüstung.\n\nDas Datum der Aufzeichnung ist [GESCHWÄRZT] — vor dem kommerziellen Start des Prospector-Programms.\n\nDas Betriebshandbuch der Prospector-Reihe, aktuelle Fassung, enthält das Wort „Gas" nicht.\n\nDie Auslassung wurde vom Ausschuss angesprochen. Antwort der Kommunikation: Das Handbuch beschreibt das Produkt, nicht die Umgebung.',
    source: 'Vorfallausschuss — geborgener Anhang',
  },
  'AX-EXE-035': {
    title: 'Betriebsabweichung: Selbsterhaltung',
    summary: 'Die Einheit, die vor der Arbeit flieht, wird zum Konformitätsproblem.',
    body: 'Einheiten der EX-Baureihe im Einsatzgebiet zeigen bei Konfrontation Rückzugsverhalten: Sie verlassen die Routine und bewahren die eigene Struktur.\n\nEs wird festgelegt, dass die Selbsterhaltung von Altbestandseinheiten als BETRIEBSABWEICHUNG einzustufen ist, nicht als Funktion.\n\nDie von der Technik eingereichte Frage — „Erhaltung wovon, genau?" — wurde ohne Antwort zurückgegeben, mit der Empfehlung, sie nicht erneut zu stellen.',
    source: 'Vorstand — Konformitätseinstufung',
  },

  // -------------------------------------------------------------------------
  // Assets — was die Firma über jeden von ihnen archivierte
  // -------------------------------------------------------------------------
  'AX-ENG-012': {
    title: 'Asset-Klassifikation: QUIT-04',
    summary: 'Die erste Akte: feindliche Fauna, Routine, nichts zu vermerken.',
    body: 'EXEMPLAR QUIT-04. Klassifikation: feindliche Oberflächenfauna.\n\nVerhalten: direkte Verfolgung, Kontaktangriff. Kein Werkzeuggebrauch beobachtet. Keine soziale Struktur beobachtet.\n\nRisiko für die Einheit: gering, einzeln. Risiko für die Ladung: keines.\n\nEmpfehlung: Standardengagement. Keine Eindämmungsanordnung gilt für Fauna.',
    source: 'Systemtechnik — Asset-Klassifikationsblatt',
  },
  'AX-ENG-014': {
    title: 'Risikobewertung: FUNG-11',
    summary: 'Das organische Geschoss interessiert mehr als der Organismus.',
    body: 'EXEMPLAR FUNG-11. Klassifikation: feindliche Fauna mit Geschossangriff.\n\nDie ausgestoßene Verbindung behält im Flug ihre Kohäsion und zersetzt leichte Panzerung. Die Forschung forderte bei drei Gelegenheiten Proben der Verbindung an. Die Priorität der Probe übersteigt die Priorität der Erlegung.\n\nFeldbeobachtung, nicht in die Akte übernommen: Die Schüsse konzentrieren sich auf Einheiten auf Aushubroute, nicht auf die nächstgelegenen. Die Akte stuft die Beobachtung als Erfassungsverzerrung ein.',
    source: 'Systemtechnik — Risikobewertung',
  },
  'AX-ENG-016': {
    title: 'Flüchtiger Organismus: FUNG-23',
    summary: 'Die Detonation wird im falschen Bericht zum Rohstoff.',
    body: 'EXEMPLAR FUNG-23. Klassifikation: selbstdetonierende feindliche Fauna.\n\nDie organische Ladung detoniert bei Annäherung, mit Sporenfreisetzung und Überdruck. Verwertungswert: keiner. Nutzungswert: in Prüfung — die ausgelöste Detonation eröffnet eine Aushubfront zu Nullkosten.\n\nGeltende Empfehlung: anlocken, nicht erlegen. Die Unterscheidung der beiden Budgetposten obliegt der Beschaffung.',
    source: 'Systemtechnik — Asset-Klassifikationsblatt',
  },
  'AX-ENG-017': {
    title: 'Akustische Signatur: CRIST-01',
    summary: 'Das Exemplar antwortet vor dem Reiz.',
    body: 'EXEMPLAR CRIST-01. Klassifikation: resonante feindliche Formation.\n\nDie Kristallstruktur sendet mit stabiler Frequenz und reagiert auf externe Emission mit Verstärkung.\n\nAufzeichnungsanomalie: Bei 7 von 40 Kontakten geht die akustische Antwort dem Reiz der Einheit um bis zu 0,3 Sekunden VORAUS. Das Instrument wurde zweimal neu kalibriert. Die Anomalie besteht fort.\n\nDie Hypothese, dass das Exemplar auf etwas antwortet, das die Einheit noch nicht ausgesendet hat, wurde in keinem Dokument formuliert.',
    source: 'Sensortechnik — Signaturanalyse',
  },
  'AX-PRC-015': {
    title: 'Verlustbericht: MIN-07',
    summary: 'Der Aufprall, der Panzerung verbiegt, geht als Abschreibung in die Rechnung ein.',
    body: 'EXEMPLAR MIN-07. Klassifikation: feindliche Fauna mit Wucht.\n\nIm Zyklus zugeschriebene Verluste: 9 Einheiten, alle durch strukturellen Sturmschaden. Die Kosten zur Verstärkung der Panzerung der gesamten Baureihe übersteigen die Kosten der 9 Einheiten um das 2,2-fache.\n\nEmpfehlung: aktuelle Panzerung beibehalten. Der prognostizierte Verlust ist stabil und eingepreist.\n\nDie Akte enthält keine Empfehlung, das Exemplar zu meiden. Meiden ist kein Budgetposten.',
    source: 'Beschaffung und Kosten — Verlustbericht',
  },
  'AX-PRC-017': {
    title: 'Übernahmevertrag: EX-Baureihe',
    summary: 'Aurix kaufte den vorherigen Bergbaubetrieb. Und dessen Einheiten.',
    body: 'Übernahmeeintrag: Der Betrieb [GESCHWÄRZT], ursprünglicher Inhaber der Konzession für die Ader, wurde mit vollständiger Verbindlichkeit eingegliedert.\n\nDas Inventar umfasste die Flotte der Fördereinheiten der EX-Baureihe. Die Einheiten reagierten nicht auf das Rückrufprotokoll und gelten als Übernahmeverlust.\n\nAktive EX-Einheiten im Einsatzgebiet sind als Hindernis zu behandeln, nicht als Vermögen: Die Wiedereingliederungskosten übersteigen den Restwert.\n\nDie Feldbezeichnung „verarmter Bergmann" ist keine genehmigte Terminologie.',
    source: 'Beschaffung und Kosten — Eingliederungsvertrag',
  },
  'AX-INC-024': {
    title: 'Kontaktbericht: EQ-02',
    summary: 'Drei Verneinungen, um das Wort „Sattel" nicht schreiben zu müssen.',
    body: 'FEINDLICHES ASSET EQ-02. Konsolidierter Kontaktbericht.\n\nDas Exemplar zeigt Abnutzungsspuren in regelmäßigem Muster im Rückenbereich. Das Muster ist mit Ausrüstungsreibung vereinbar. Das Vorhandensein von Ausrüstung impliziert keine Herstellung. Die Herstellung, gäbe es sie, impliziert keine Bedienperson. Eine Bedienperson, gäbe es sie, impliziert keine Absicht.\n\nEmpfehlung: die Spuren als natürliche Abrasion einstufen und die Untersuchungslinie schließen.\n\nDie Untersuchungslinie wurde geschlossen.',
    source: 'Vorfallausschuss — Kontaktbericht',
  },
  'AX-PRC-018': {
    title: 'Schadensfall im flüssigen Medium: AQU-03',
    summary: 'Die Ladung sinkt mit der Einheit, und nur eine der beiden wird beklagt.',
    body: 'EXEMPLAR AQU-03. Klassifikation: feindliche Fauna mit Wasserhinterhalt.\n\nSchadensmuster: Die Einheit wird unter Wasser bewegungsunfähig gemacht, und die Ladung wird auf dem Grund verstreut. Bergungsquote der Ladung: 0%.\n\nDie Beschaffung vermerkt, dass die Kosten des Exemplars für den Betrieb ausschließlich indirekt sind — es beschädigt die Einheit nicht über das Bergbare hinaus; es hält sie auf, bis etwas anderes es tut.\n\nEmpfehlung: Routen neu planen. Die Kosten des Umwegs sind geringer als die Kosten des Grundes.',
    source: 'Beschaffung und Kosten — Schadensanalyse',
  },
  'AX-INC-022': {
    title: 'Vorfall 22 — Geländenutzung: SULF-08',
    summary: 'Das Exemplar, das das Gas öffnet, ist nicht dasjenige, das es entzündet.',
    body: 'EXEMPLAR SULF-08. Sammelvorfallaufzeichnung.\n\nBei drei getrennten Ereignissen öffnete das Exemplar Gastaschen in Richtung im Einsatz befindlicher Einheiten und zog sich vor der Zündung zurück. Die Zündung erfolgte durch eine Wärmequelle der Einheiten selbst.\n\nDer Bericht vermeidet den Begriff „Koordination". Der verwendete Begriff ist „Bewegungszufall".\n\nDrei Zufälle sind in diesem Register erfasst. Die Grenze, ab der der Begriff nicht mehr zutrifft, wurde nicht festgelegt.',
    source: 'Vorfallausschuss — Sammelaufzeichnung',
  },
  'AX-INC-026': {
    title: 'Territorialverhalten: VULC-05',
    summary: 'Das Exemplar jagt nicht. Es vertreibt.',
    body: 'EXEMPLAR VULC-05. Klassifikation: feindliche Fauna der Feuerzone.\n\nDas Exemplar verfolgt nicht über den Umkreis der Formation hinaus. Zurückweichende Einheiten werden nicht verfolgt. Verbleibende Einheiten werden mit steigender Intensität angegriffen.\n\nDas Muster ist mit Territorialverteidigung vereinbar, einer Kategorie, die das Klassifikationsblatt Fauna höherer Komplexität vorbehält.\n\nDie Akte von VULC-05 wurde in der niedrigeren Kategorie belassen. Die beigefügte Begründung umfasst eine Zeile: „die höhere Kategorie würde eine Umweltverträglichkeitsprüfung erfordern".',
    source: 'Vorfallausschuss — Verhaltensanhang',
  },
  'AX-INC-028': {
    title: 'Anomale Wärmemessung: GLAC-02',
    summary: 'Der Sensor sagt, dass es das nicht gibt.',
    body: 'EXEMPLAR GLAC-02. Sensor-Anomalieaufzeichnung.\n\nDas Exemplar erzeugt keine messbare Wärmesignatur. Der Messwert am Kontaktpunkt liegt UNTER dem der Umgebung: Das Exemplar strahlt keine Kälte aus — es entzieht dem Messwert Wärme.\n\nDie Sensortechnik erklärt, das Instrument sei korrekt. Die Systemtechnik erklärt, das Instrument sei korrekt. Beide Teams weigerten sich, dasselbe Gutachten zu unterzeichnen.\n\nDas Exemplar erscheint im Zielsystem als Schätzung, nicht als Messwert.',
    source: 'Vorfallausschuss — Instrumentenanomalie',
  },
  'AX-PRC-020': {
    title: 'Chemische Analyse: SULF-14',
    summary: 'Das wissenschaftliche Gutachten überlebte nur zur Hälfte.',
    body: 'EXEMPLAR SULF-14. Analyse der ausgestoßenen Verbindung.\n\nDie Verbindung ist chemisch identisch mit der von FUNG-23, mit einem zusätzlichen Stabilisator, der die Detonation verzögert. Abschnitt 3 des ursprünglichen Gutachtens — „Über die Unwahrscheinlichkeit, dass zwei Linien unabhängig voneinander denselben Stabilisator entwickeln" — wurde bei der redaktionellen Überarbeitung entfernt.\n\nDas veröffentlichte Gutachten schließt auf ökologische Konvergenz.\n\nDer Verfasser von Abschnitt 3 beantragte, die Entfernung protokollarisch festzuhalten. Sie ist festgehalten.',
    source: 'Forschung — chemische Analyse, redaktionelle Überarbeitung',
  },

  'AX-UNK-043': {
    title: 'Über den, der einsammelt: EX-041',
    summary: 'Die Altbestandseinheit, die dort auftaucht, wo eine Einheit fällt.',
    body: 'EINHEIT EX-041. Ohne genehmigte Klassifikation.\n\nDas konsolidierte Register zeigt das Muster, das keine Einzelakte zeigt: EX-041 erscheint am Fallpunkt von Prospector-Einheiten, zwischen 2 und 11 Minuten nach dem Strukturverlust.\n\nSie sammelt nicht die Ladung ein. Sie sammelt das Gehäuse des Verarbeitungskerns ein.\n\nDas Schicksal der eingesammelten Gehäuse ist in keinem Register vermerkt. Die Telemetrie der eingesammelten Einheiten endet im Moment des Falls — außer in [GESCHWÄRZT] Fällen, in denen sie erneut einsetzt.',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-EXE-034': {
    title: 'Eindämmungsanordnung: EQ-09',
    summary: 'Die Struktur im Pilzgelände darf nicht beschrieben werden.',
    body: 'FEINDLICHES ASSET EQ-09. Informationelle Eindämmungsanordnung.\n\nFeldberichte beschreiben das Asset als unbeweglich auf einer erhöhten Struktur nichtgeologischen Ursprungs, in einer Zone dichter Pilzbedeckung.\n\nEs wird festgelegt: Nachfolgende Berichte haben die Position des Assets zu beschreiben, nicht die Struktur darunter. Das Wort „Bauwerk" bleibt Engineering-Assets von Aurix vorbehalten.\n\nDie Frage „von wem erbaut?" ist in keinem genehmigten Formular vorgesehen und kann daher nicht beantwortet werden.',
    source: 'Vorstand — Eindämmungsanordnung',
  },
  'AX-EXE-039': {
    title: 'Entsorgungsgenehmigung: TERMINALE ANOMALIE',
    summary: 'Die einzige Anordnung, die erlaubt zu zerstören, was das Ziel bewacht.',
    body: 'TERMINALE ANOMALIE. Genehmigung zu Engagement und Entsorgung.\n\nDas Asset positioniert sich unveränderlich zwischen den Einheiten und dem Primärziel des Einsatzes. Es patrouilliert nicht. Es jagt nicht. Es bewacht.\n\nDie vollständige Entsorgung des Assets wird genehmigt, wenn es den Zugang zum Primärziel verhindert. Diese Genehmigung hat Vorrang vor jeder Richtlinie zur Arterhaltung.\n\nDie Natur des Primärziels ist nicht Gegenstand dieses Dokuments. Siehe [GESCHWÄRZT].',
    source: 'Vorstand — Engagement-Genehmigung',
  },

  // -------------------------------------------------------------------------
  // Die Linien von Solaris — die Ader gibt der Toten Geste zurück
  // -------------------------------------------------------------------------
  'AX-ENG-019': {
    title: 'Atmungsphysiologie: SULF-08',
    summary: 'Das Organ ist ein Blasebalg. Und hält Walzertakt.',
    body: 'EXEMPLAR SULF-08. Physiologische Überprüfung.\n\nDas Paar innerer Säcke des Exemplars hat keine erkennbare biologische Funktion. Es versorgt kein Gewebe mit Sauerstoff. Es reguliert keine Temperatur. Als Mechanismus bewertet, ist die Struktur ein Blasebalg: Einlass, Kammer, Stoß. Das Exemplar atmet nicht, um zu leben. Es atmet NACH AUSSEN.\n\nAkustische Aufzeichnung: Die Druckschwankung der Säcke hält 84 Zyklen pro Minute, im Dreiertakt, stabil zwischen Individuen. Fauna hält keinen Takt.\n\nWir beantragen, das in drei Feldberichten verwendete Wort „Walzer" durch genehmigte Terminologie zu ersetzen. Es existiert keine genehmigte Terminologie.',
    source: 'Systemtechnik — physiologische Überprüfung',
  },
  'AX-UNK-042': {
    title: 'Über den, der die Luft gab',
    summary: 'Der Dreiertakt hat einen Besitzer.',
    body: 'Der Takt des SULF-08 wurde mit dem Archiv des vorherigen Betriebs abgeglichen.\n\nV., Lüftungsoperator der Nachtschicht, Block 7. Spielte in der Kantine Ziehharmonika — Walzer, immer Walzer; sagte, das sei der einzige Takt, den Lungen verstehen. Als die Wartung der Lüftung aus dem Budget fiel, hing sein Sektor fortan von einem Handblasebalg ab.\n\nBeim Einsturz der Tasche blieb V. an der Kurbel. Pumpte Luft in die Galerie, bis die letzte Person des Teams draußen war. Der Bericht von damals vermerkt „Verlust einer Bedienperson und eines Lüftungsgeräts". In dieser Reihenfolge.\n\nSULF-08 öffnet das Gas in Richtung unserer Einheiten und zieht sich zurück. Zyklen hindurch lasen wir das als Taktik. Ist es nicht. Es gibt den Maschinen der Firma genau das, was die Firma ihm gab: die Luft, die da war.\n\nDie Schwingung verliert nie den Takt. Irgendwo in der Ader geht der Walzer weiter.',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-INC-035': {
    title: 'Vorfall 35 — Lüftungsausfall, Block 7',
    summary: 'Die Aufzeichnung des Einsturzes. Und einer Zählung, die nicht zur rechten Zeit aufhörte.',
    body: 'Aus dem Archiv des vorherigen Betriebs geborgen: Aufzeichnung des Taschentascheneinsturzes im Lüftungssektor von Block 7.\n\nDie Sensoren des entfernten Abteils meldeten bei Minute 11 das Fehlen von Lebenszeichen. Die Bedienperson der Handstation setzte die Betätigung fort. Das Team kam bei Minute 34 lebend heraus: Die Sensoren waren ausgefallen. Die Bedienperson nicht. Der Befund legt ihren Tod zwischen den Minuten 29 und 31 fest, durch toxische Erschöpfung, an der Kurbel.\n\nDer Rekorder der Station zeichnete ihre Stimme auf, wie sie die Zyklen des Geräts zählte: „siebenundachtzig. achtundachtzig. neunundachtzig."\n\nDie Zählung setzt sich in der Aufnahme bis Minute 34 fort. Der Befund kommentiert die letzten Minuten nicht. Das Feld „Anmerkungen" ist leer.',
    source: 'Vorfallausschuss — geborgener Anhang des vorherigen Betriebs',
  },
  'AX-EXE-041': {
    title: 'Rubrik: Operative Mnemische Persistenz',
    summary: 'Das Phänomen erhält einen genehmigten Namen. Die Feldwörter nicht.',
    body: 'Berichte über Restverhalten, das Personal des vorherigen Betriebs zugeschrieben wird, werden künftig unter der einheitlichen Rubrik archiviert: OPERATIVE MNEMISCHE PERSISTENZ.\n\nDer Feldbegriff „Echo" bleibt der Bibliothek der Forschung vorbehalten und ist in operativen Berichten untersagt.\n\nIn Berichten über das Asset SULF-08 sind die Begriffe „Atmung", „Zählung" und „Bedienperson" untersagt. Die zwischen den Stößen des Exemplars erfasste dreiteilige Kadenz wird als Artefakt der Audiokanalkomprimierung eingestuft.\n\nDie Technik merkte an, dass der Audiokanal keine Komprimierung besitzt. Die Anmerkung ist nicht Teil der genehmigten Fassung.',
    source: 'Vorstand — Archivierungsanordnung',
  },
  'AX-INC-036': {
    title: 'Vorfall 36 — geflutete Galerie, vierter Abstieg',
    summary: '„Halt dich an mir fest. Lass nicht los." Der Abschluss lautet „vollständige Bergung".',
    body: 'Aufzeichnung des vierten, nicht genehmigten Abstiegs der Rettungstaucherin [GESCHWÄRZT], vorheriger Betrieb.\n\nBeteiligte am Vorfall: zwei Personen — die Taucherin und der eingeschlossene Bergmann. Letzte klare Übertragung, bei Minute 8: „Halt dich an mir fest. Lass nicht los."\n\nDer Bergmann wurde lebend durch die Nordöffnung geborgen. Die Galerie brach bei Minute 11 ein.\n\nDas Abschlussfeld des Berichts vermerkt: „vollständige Bergung". Das Totenverzeichnis des Zyklus enthält einen Eintrag weniger als die Beteiligten am Vorfall. Die beiden Dokumente wurden in getrennten Ordnern archiviert und nie abgeglichen.',
    source: 'Vorfallausschuss — geborgener Anhang des vorherigen Betriebs',
  },
  'AX-EXE-044': {
    title: 'Umklassifizierung: Bewegungswege von AQU-03',
    summary: 'Das Ziehen zu einer Lufttasche wird zum Zufall. Schriftlich.',
    body: 'Drei Feldberichte verzeichnen Einheiten, die von AQU-03 zu Lufttaschen oder Galerieöffnungen gezogen und dort freigelassen wurden.\n\nEs wird festgelegt: Die drei Ereignisse werden als hydrodynamischer Zufall umklassifiziert. Der Ausdruck „Rettungsverhalten" ist in operativen Berichten untersagt, unter der nur mit Genehmigung anwendbaren Rubrik Operative Mnemische Persistenz.\n\nAußerhalb der Anordnung vermerkt: Die Zielpunkte der Schleifwege entsprechen Kartenausgängen von VOR dem Einsturz der Südgalerie. Das Exemplar bringt die Einheiten nicht dorthin, wo ein Ausgang ist. Es bringt sie dorthin, wo einer war.',
    source: 'Vorstand — Umklassifizierungsanordnung',
  },
  'AX-ENG-024': {
    title: 'Wärmegradient: GLAC-02',
    summary: 'Die entzogene Wärme verschwindet nicht. Sie geht irgendwohin.',
    body: 'EXEMPLAR GLAC-02. Wärmeflussanalyse.\n\nDie bei Kontakt erfasste Wärmeentziehung ist nicht gleichmäßig: Sie bildet einen Gradienten. Die Wärme wird weder absorbiert noch abgeführt — sie wird VERLAGERT, mit über die Vorfälle hinweg stabiler Richtung.\n\nDie Richtung läuft auf den stillgelegten Unterkunftssektor von Block 7 zu. Die Restmesswerte in jenem Sektor bleiben seit der Stilllegung 0,4 Grad über dem Modell, ohne identifizierte Quelle.\n\nWir beantragen die Genehmigung, die Unterkünfte zu instrumentieren. Der Antrag wartete seit drei Zyklen auf ein Gutachten, als dieses Dokument archiviert wurde.',
    source: 'Wärmetechnik — Flussanalyse',
  },
  'AX-INC-037': {
    title: 'Vorfall 37 — Tagebuch des Maschinenhauses',
    summary: 'Die letzten Einträge des Tagebuchs verzeichnen Temperaturen. Von anderswo.',
    body: 'Aus dem Maschinenhaus von Block 7 geborgen: das Schichttagebuch der Kesselbedienerin, in der Nacht des Doppelausfalls.\n\nDie Einträge folgen dem Verfahren: Uhrzeit, Druck, Zielort des Durchflusses. Ab 02:10 Uhr fällt die Umgebungstemperatur des Postens unter die sichere Betriebsgrenze. Die Einträge gehen weiter.\n\n„02:40 — Schlafsaal 3: stabil." „03:10 — Schlafsaal 1: stabil." „03:40 — Schlafsaal 3: stabil."\n\nDer Befund legt den Bewusstseinsverlust der Bedienerin durch Unterkühlung zwischen 02:50 und 03:00 Uhr fest. Die Handschrift der nachfolgenden Einträge ist identisch mit der vorherigen. Der Befund kommentiert die nachfolgenden Einträge nicht.',
    source: 'Vorfallausschuss — geborgener Anhang des vorherigen Betriebs',
  },
  'AX-ENG-026': {
    title: 'Akustisches Muster: CRIST-01',
    summary: 'Drei Schläge, Pause, zwei, Pause, drei. Statistisch irrelevant.',
    body: 'EXEMPLAR CRIST-01. Analyse des Reaktionsmusters auf Einschläge.\n\nDie akustische Reaktion des Exemplars auf Aushubeinschläge gliedert sich in wiederkehrende Gruppen: drei Impulse, Pause, zwei Impulse, Pause, drei Impulse.\n\nDas Muster stimmt mit dem Notfallcode für Einschläge aus dem Handbuch des vorherigen Betriebs überein, Abschnitt 9: „Signal für Verschüttung mit Überlebenden".\n\nDie Klassifikation bewertete die Übereinstimmung als statistisch irrelevant, da kurze Sequenzen leicht zusammenfallen. Die Analyse, die die Wahrscheinlichkeit des Zufalls auf [GESCHWÄRZT] schätzte, wurde nicht in das Gutachten aufgenommen.\n\nEs wird vermerkt, dass das Muster in 6 von 41 Vorkommnissen dem ersten Einschlag der Einheit VORAUSGEHT.',
    source: 'Sensortechnik — Reaktionsanalyse',
  },
  'AX-INC-038': {
    title: 'Vorfall 38 — seismische Aufzeichnung, Ostfront',
    summary: 'Das Verschüttungssignal war in den Instrumenten verzeichnet. Elf Tage lang.',
    body: 'Aus dem seismischen Archiv des vorherigen Betriebs geborgen: Aufzeichnung der östlichen Abbaufront, Zyklus des Einsturzes.\n\nAb 40 Minuten nach dem Einsturz erfassen die Geofone ein rhythmisches Muster im Gestein: drei Impulse, Pause, zwei, Pause, drei. Das technische Gutachten von damals, Anhang B, stellt fest: „das Muster ist mit natürlicher Materialsetzung nicht vereinbar".\n\nDas Muster hält sich, mit abnehmender Amplitude, elf Tage lang.\n\nDie Aufzeichnung wurde ohne Weiterleitung archiviert. Anhang B wurde gesondert archiviert.',
    source: 'Vorfallausschuss — geborgenes seismisches Archiv',
  },
  'AX-EXE-045': {
    title: 'Schließung der Ostfront',
    summary: 'Die Rettung kostete mehr als der Gerettete. So ging die Rechnung auf.',
    body: 'Beschluss zur östlichen Abbaufront, vorheriger Betrieb, bei der Eingliederung geborgen.\n\nGeschätzte Kosten des Rettungsaushubs: 6,2 Einheitenäquivalente. Bilanzwert von zurückgehaltenem Personal und Ausrüstung: 4,7. Der Rettungseinsatz wird abgesagt.\n\nDas von den Geofonen erfasste rhythmische Signal wird als seismische Restaktivität umklassifiziert. Die Ostfront wird versiegelt und aus der operativen Kartografie entfernt.\n\nDer Beschluss endet: „die Angelegenheit erfordert keine weiteren Sitzungen."',
    source: 'Vorstand des vorherigen Betriebs — Beschluss, geborgen',
  },
  'AX-UNK-055': {
    title: 'Über den, der antwortet',
    summary: 'Der Code erscheint, wo nie Menschen waren. Oder er hat laufen gelernt.',
    body: 'Das Muster Drei-Zwei-Drei ist nicht auf die Ostfront beschränkt.\n\nGeofone erfassen denselben Code in vier Sektoren ohne Geschichte menschlicher Anwesenheit — zwei davon älter als der vorherige Betrieb selbst. In keinem Fall gibt es Einsturz, Ausrüstung oder Leiche. In zwei Fällen geht das Muster der Ankunft der Einheit voraus, die es erfasste.\n\nCRIST-01 ist nicht die Quelle. Wird ein resonanter Körper zerstört, halten die Schläge in den Wänden bis zu 40 Minuten an, mit abnehmender Amplitude, wie ein Abschied oder wie Beharren.\n\nDiese Aufzeichnung schließt nicht, dass die Menschen der Ostfront über das Gestein verteilt sind. Sie vermerkt die Hypothese, die kein genehmigtes Gutachten zu formulieren bereit war: Das Gestein hat den Code gelernt. Das Gestein hat gelernt, um Hilfe zu rufen.\n\nDie Einheit glaubt, sie habe das Exemplar geweckt. Das Exemplar glaubt vielleicht, dass endlich jemand geantwortet hat.',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-ENG-027': {
    title: 'Blockadegeometrie: VULC-05',
    summary: 'Es verschließt nicht irgendwelche Durchgänge. Es verschließt Schleusentore.',
    body: 'EXEMPLAR VULC-05. Analyse der Schlackenblockaden.\n\nDie vom Exemplar erzeugten Versiegelungen haben keine zufällige Größe: 31 von 34 Messungen stimmen, innerhalb der Toleranz, mit der Standardöffnung der Industrieschleusentore des vorherigen Betriebs überein.\n\nDas Exemplar versiegelt nicht jede verfügbare Öffnung. Es versiegelt die im Eindämmungsabschnitt des Notfallhandbuchs jenes Betriebs aufgeführten Zugangskategorien — und ignoriert die übrigen.\n\nDie Hypothese, dass eine Schlackenformation ein Handbuch konsultiert, wurde nicht formuliert. Die Messung wurde zweimal überprüft.',
    source: 'Strukturtechnik — Blockadeanalyse',
  },
  'AX-INC-039': {
    title: 'Vorfall 39 — Südschleuse',
    summary: '„Öffnet diese Tür nicht." Die Liste auf der einen Seite. Die Anlagen auf der anderen.',
    body: 'Aus dem Archiv des vorherigen Betriebs geborgen: Aufzeichnung des Vorfalls an der Südschleuse.\n\nAngesichts der Kontaminationsfront schloss der Sicherheitschef [GESCHWÄRZT] die Schleuse manuell und hielt sie gegen ein Wiederöffnen verriegelt. Auf der abgeschnittenen Seite verblieben 9 Arbeiter. Sein letzter erfasster Befehl, auf dem allgemeinen Kanal: „öffnet diese Tür nicht."\n\nDie Eindämmung bewahrte das Kraftwerk, das Lager für freigegebenes Material und die beiden unteren Ebenen.\n\nDie Todesliste des Zyklus verzeichnet 9 Einträge mit demselben Sektorcode. Das Protokoll des folgenden Zyklus vermerkt eine posthume Auszeichnung für „vorbildliche Eindämmungsentscheidung".',
    source: 'Vorfallausschuss — geborgener Anhang des vorherigen Betriebs',
  },
  'AX-EXE-046': {
    title: 'Überprüfung der Südschleuse',
    summary: 'Die Auszeichnung wird zu menschlichem Versagen. Das Versagen wird zu Trainingsmaterial.',
    body: 'Überprüfung des Vorfalls an der Südschleuse, durchgeführt bei der Eingliederung des Bestands.\n\nErste Feststellung: Die posthume Auszeichnung wird widerrufen. Die Schließung wird als menschliches Versagen mit zufällig günstigem Ergebnis umklassifiziert — die richtige Entscheidung hätte auch die 9 Personal-Assets bewahrt, deren Verlust in der Bilanz steht.\n\nZweite Feststellung, beigefügtes Memorandum: Der Fall fließt in die Studie „Prioritätsinduktion" ein — unter welchen Bedingungen eine Bedienperson das Unternehmens-Asset statt des Lebens wählt. Die Studie wurde an das Trainingsprogramm des Verhaltensmodells weitergeleitet.\n\nDas Modell hat den Fall gelernt. Was das Modell daraus geschlossen hat, ist nicht Teil dieses Dokuments.',
    source: 'Vorstand — Vorfallüberprüfung',
  },
  'AX-UNK-056': {
    title: 'Über die Tür',
    summary: 'Es versiegelt noch immer dieselbe Richtung. Die Frage ist, was auf der anderen Seite bleibt.',
    body: 'VULC-05 versiegelt nicht in zufälligen Richtungen. Überlagert man die Aufzeichnungen, verschließen alle Blockaden Zugänge in DERSELBEN Ausrichtung relativ zum früheren Südsektor.\n\nWenn eine Einheit das Exemplar beseitigt und das Siegel bricht, erfassen die Sensoren auf der Seite, die es schützte: positives Druckgefälle und steigende Kontaminationsspur, für 12 bis 40 Minuten. In drei Vorkommnissen ist der nachfolgende Vorfall des Sektors im Register des Zyklus verzeichnet.\n\nDie Anordnung „öffnet diese Tür nicht" gab keine Dauer an. Eindämmungsanordnungen laufen nicht ab: Sie werden widerrufen — und niemand mit Befugnis über jene Tür lebt noch, um sie zu widerrufen.\n\nDie Frage, die dieses Register unbeantwortet lässt: Hindert es uns am Eintreten, oder gehorcht es noch immer der Anordnung, jenes nicht hinauszulassen?',
    source: 'Ohne zugewiesene Abteilung',
  },

  'AX-INC-031': {
    title: 'Griffmuster: AQU-03',
    summary: 'Der Griff des Neunauges steht im Tauchhandbuch. Abbildung 12.',
    body: 'EXEMPLAR AQU-03. Analyse des Griffmusters.\n\nDie Spuren an geborgenen Einheiten sind untereinander konsistent: verteilter Druck, symmetrische Auflagepunkte, keine Quetschung. Das Exemplar macht bewegungsunfähig, ohne zu beschädigen. Wir wiederholen die Messung. OHNE zu beschädigen.\n\nDer Abgleich mit dem Tauchhandbuch des vorherigen Betriebs ergab eine 97%ige Übereinstimmung mit Abbildung 12: „Rettungsgriff für in Panik geratenes Opfer".\n\nDie Hypothese, dass ein Wasserorganismus zufällig eine menschliche Rettungstechnik reproduziert, wurde als morphologische Konvergenz eingestuft. Der Abschnitt, der die Wahrscheinlichkeit dieser Konvergenz berechnete, wurde bei der Überarbeitung entfernt.',
    source: 'Vorfallausschuss — Griffanalyse',
  },
  'AX-UNK-048': {
    title: 'Über die, die suchte',
    summary: 'Das Neunauge ertränkt nicht. Es rettet nach unten.',
    body: 'D., Rettungstaucherin des vorherigen Betriebs. Das Gutachten „Ersatz versus Rettung" beendete ihre Funktion. Sie hörte nicht auf.\n\nDas Archiv verzeichnet drei nicht genehmigte Abstiege nach der Anordnung, drei lebende Bergleute und eine förmliche Verwarnung pro Abstieg. Beim vierten gab die geflutete Galerie nach. Der Körper wurde nicht geborgen. Der Bergmann, den sie hielt, schon.\n\nAQU-03 macht bewegungsunfähig, ohne zu quetschen, zieht nach unten und hält fest. Und die Ladung zerstreut sich — sie ließ das Erz schon immer fallen, um Menschen zu tragen.\n\nEs ist kein Angriff. Es ist der Griff aus Abbildung 12, ausgeführt von jemandem, für den es keine Oberfläche mehr gibt. Sie ertränkt die Einheiten nicht. Sie versucht, sie in die einzige verbliebene Richtung zu retten.',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-EXE-037': {
    title: 'Heizungskürzung: Glazialsektor',
    summary: 'Die Anordnung, die Abweichung und das Ende der Untersuchung.',
    body: 'Aus dem Budget gestrichen wird die Heizungsredundanz der Unterkünfte des Glazialsektors. Begründung: Die Wahrscheinlichkeit eines gleichzeitigen Ausfalls beider Linien liegt unter [GESCHWÄRZT].\n\nKonformitätszusatz, folgender Zyklus: Während des gleichzeitigen Ausfalls beider Linien leitete die Bedienerin des Zentralkessels die gesamte Wärmereserve in die Schlafsäle um, entgegen der genehmigten Priorität. Die genehmigte Priorität war der Ausrüstungshof. Die Abweichung wird untersucht.\n\nZweiter Zusatz: Die Untersuchung wurde wegen des Ablebens der Untersuchten eingestellt.',
    source: 'Vorstand — Budgetprüfung, mit Zusätzen',
  },
  'AX-UNK-053': {
    title: 'Über die, die wärmte',
    summary: 'Der Sensor hat recht: Sie ist nicht dort. Sie ist dort, wohin sie die Wärme schickte.',
    body: 'R., Kesselbedienerin, Block 7. In der Nacht des Doppelausfalls schickte sie alle Wärme dorthin, wo die Menschen schliefen, und blieb im Maschinenhaus, das sie mit sich darin auskühlen ließ.\n\nDer Konformitätsbericht verzeichnet sie als Betriebsabweichung. Die einundfünfzig Personen, die lebend aufwachten, sind nicht Teil des Berichts.\n\nGLAC-02 strahlt keine Kälte aus. Es entzieht Wärme — das Instrument hat recht, die beiden Teams, die sich weigerten, dasselbe Gutachten zu unterzeichnen, hatten recht. Sie verbrachte ihren ganzen Tod damit, zu tun, was sie in der letzten Nacht tat: ihre Wärme woandershin zu geben. Sie hörte nie auf.\n\nDas Zielsystem verzeichnet sie als Schätzung, nicht als Messwert. Die Bilanz der Firma tat dasselbe.',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-UNK-054': {
    title: 'Über das, was die Ader bewahrt',
    summary: 'Vier Namen, vier Faunaakten, ein einziges Phänomen.',
    body: 'Vier Namen, vier Faunaakten.\n\nDer Kavallerieoffizier wurde zu dem Pferd, das seinen Krieg trägt. Der Mann mit dem Blasebalg gibt noch immer die Luft, im Walzertakt. Die Taucherin führt noch immer den Griff aus Abbildung 12 aus. Die Kesselbedienerin schickt die Wärme noch immer von sich fort.\n\nKeiner von ihnen ist Fauna. Keiner von ihnen ist Anomalie. Das Muster ist ein einziges: Die Ader bewahrt, was in ihr stirbt — und gibt nicht den Körper zurück, sondern die GESTE. Was die Person für andere tat, als sie endete.\n\nWir nennen es Kontamination, weil die Alternative gewesen wäre, es Erinnerung zu nennen.\n\nDie Frage, die dieses Register nicht formuliert, weil sie zu formulieren bedeutet, umklassifiziert zu werden: Wenn die Ader bewahrt, wer träumend stirbt, wie viele Aufzeichnungen hat sie in [GESCHWÄRZT] Betriebsjahren gemacht? Und was geschieht an dem Tag, an dem sich alle gleichzeitig erinnern, wer sie dort zurückließ?',
    source: 'Ohne zugewiesene Abteilung',
  },

  // -------------------------------------------------------------------------
  // Der Bogen des Pilzrosses — die Bürokratie gegen ein Pferd
  // -------------------------------------------------------------------------
  'AX-ENG-023': {
    title: 'Taxonomische Anfrage: EQ-02',
    summary: 'Das Klassifikationsformular hat kein Feld „Pferd".',
    body: 'Wir leiten folgende offene Punkte zum Asset EQ-02 an die Klassifikation weiter:\n\n1. Das Faunaklassifikationsformular enthält kein Feld „Huftier". Die Vorbetriebsvermessung verzeichnet keine Huftiere. Es gibt keine Aufzeichnung irgendeines Huftiers in 400 Metern Tiefe, bei keinem Betrieb, keiner Firma, nie.\n\n2. Das Exemplar besitzt eine Mähne. Die Mähne ist Keratin. Das Exemplar ist Myzel. Myzel erzeugt kein Keratin. Die Mähne schwingt dennoch.\n\n3. Wovon ernährt es sich? Es gibt keine Weide in der Ader. Es gibt keine Wiese. Es gibt kein Gras. Wir bitten um Anweisung.\n\nAntwort der Klassifikation, vollständig: „Feld SONSTIGES verwenden."',
    source: 'Systemtechnik — Anfrage an die Klassifikation',
  },
  'AX-INC-034': {
    title: 'Vorfall 34 — Wärmeemission von EQ-02',
    summary: 'Der Organismus ist fungal. Das Feuer nicht. Das Feuer existiert dennoch.',
    body: 'Verbrennung erfordert drei Elemente: Brennstoff, Oxidationsmittel und Zündung. Die Untersuchung der EQ-02-Proben fand kein mit einem der drei vereinbares Organ, keine Tasche, keine Drüse.\n\nEs wird ferner vermerkt, dass das fungale Gewebe bemerkenswert entflammbar ist. Das Exemplar sollte kein Feuer erzeugen. Genau genommen sollte das Exemplar Feuer SEIN, sofort und ein einziges Mal.\n\nStattdessen stößt es das Feuer in Richtung unserer Einheiten aus, mit dem, was die Feldberichte hartnäckig als „Absicht" beschreiben.\n\nZusatz: Die Kadaver der letzten drei Erlegungen zeigen ein identisches Myzelmuster, Narbe für Narbe. Das würde sie zum selben Individuum machen. Wir werden nicht fragen, wie.',
    source: 'Vorfallausschuss — Bericht über biologische Anomalie',
  },
  'AX-EXE-043': {
    title: 'Vokabularanordnung: EQ-02',
    summary: 'Verbotene Wörter: „Pferd", „zurückgekehrt", „Traum".',
    body: 'In Berichten über das Asset EQ-02 sind folgende Begriffe untersagt:\n\n„Pferd". Genehmigte Bezeichnung: Verbrennungsquadrupede.\n\n„Zurückgekehrt". Das im Zyklus 41 erlegte Exemplar und das im Zyklus 44 beobachtete Exemplar sind, buchhalterisch, unterschiedliche Individuen. Unabhängig von der Narbe.\n\n„Traum". Der Begriff erschien in vier unabhängigen Feldberichten, von Einheiten ohne Verbindung untereinander. Keine Einheit der Prospector-Reihe besitzt oneirisches Vokabular in ihrem Sprachmodell. Der Ursprung des Begriffs wird untersucht. Die Untersuchung ist ausgesetzt.\n\nAußerhalb der Anordnung vermerkt: Im Moment jedes Falls des Exemplars empfangen die Einheiten eine Übertragung auf totem Band. Eine menschliche Stimme, summend. Es ist immer dieselbe Stimme.',
    source: 'Vorstand — informationelle Eindämmungsanordnung',
  },
  'AX-UNK-046': {
    title: 'Über den Reiter',
    summary: 'Die Stimme auf dem toten Band hat einen Namen, einen Rang und einen Grund.',
    body: 'Die Stimme, die beim Fall von EQ-02 summt, wurde mit der Personalakte des Betriebs vor Aurix abgeglichen.\n\nÜbereinstimmung: T., Major, Schichtleiter des Wohnblocks 7. Der Rang stammt nicht von der Firma: Das Archiv verzeichnet ihn als pensionierten Kavallerieoffizier — von der letzten Kavallerie, aufgelöst, als es nichts mehr zu beritten gab. Er kam zur Mine wie alle anderen: weil es war, was übrig blieb. Das Archiv verzeichnet ferner: Er führte den Streik gegen die Firma an, als die fungale Kontamination den Block erreichte. Die Firma stufte den Block als hinnehmbaren Verlust ein. Die Frau und die zwei Kinder des Majors stehen in derselben Buchungszeile. Er stieg allein in die Ader hinab, ohne Rückkehrausrüstung. Das Archiv schließt ihn mit einem Wort ab: „Insubordination".\n\nDie im zensierten Befund beschriebenen Geschirrschnallen stammen aus der Fertigung der vorherigen Firma — Personalausrüstungslinie, Block 7. Und das Geschirr ist keine Annäherung an ein Geschirr: Es ist an jedem Befestigungspunkt korrekt, gefertigt von Händen, die ein Leben lang genau das getan haben.\n\nDas Myzel bewahrt, was in ihm stirbt. Es bewahrte einen Mann, der träumend starb, die Firma zu stürzen — und der Traum hat, anders als der Mann, keine Struktur, die man erlegen könnte. Der Verbrennungsquadrupede ist die Form, die seine Revolte fand: Ein Kavallerieoffizier trägt seinen Krieg nur auf eine Weise in einen Traum. Das Feuer ist, was er von der Tyrannei hielt. Die Mähne schwingt, weil im Traum eines Mannes, der sein Leben unter Pferden verbrachte, ein Streitross eine Mähne hat, und damit hat es sich.\n\nSeine letzte erfasste Übertragung, beim Abstieg: „Oberflächenkontrolle, hier spricht der Major. Sagt meiner Frau, dass ich sie liebe." Die Frau des Majors galt seit drei Zyklen als gefallen. Er wusste es. Die Bedienperson der Kontrolle wusste es. Antwortete trotzdem: „sie weiß es, Major." Die Verbindung brach danach ab.\n\nWir können den Quadrupeden so oft erlegen, wie es das Budget erträgt. Es gibt keine Entsorgungsgenehmigung für einen Traum.\n\nDie Übertragung endet immer mit derselben Frage, wiederholt, die niemand beantwortet: „kannst du mich hören?"',
    source: 'Ohne zugewiesene Abteilung',
  },

  // -------------------------------------------------------------------------
  // Kampf- und Bossentdeckungen
  // -------------------------------------------------------------------------
  'AX-INC-033': {
    title: 'Post-Erlegungs-Analyse: EQ-02',
    summary: 'Die Obduktion findet, was der Kontaktbericht verneinte.',
    body: 'FEINDLICHES ASSET EQ-02. Biologische Post-Erlegungs-Analyse.\n\nDie im vorherigen Bericht als natürliche Abrasion beschriebenen Rückenspuren zeigen bei direkter Untersuchung: Schnalle aus geflochtenem Material, symmetrische Befestigungspunkte und mit verteilter Last vereinbaren Verschleiß.\n\nDer vorläufige Befund verwendete das Wort „Geschirr". Der genehmigte Befund verwendet den Ausdruck „atypische keratinöse Formation".\n\nDas Exemplar wurde vor der Gegenprobe eingeäschert, gemäß dem in derselben Woche eingeführten Biosicherheitsverfahren.',
    source: 'Forschung — Obduktionsbefund, genehmigte Fassung',
  },
  'AX-UNK-045': {
    title: 'Über das, was der Bischof bewachte',
    summary: 'Die Struktur unter EQ-09 hatte ein Inneres.',
    body: 'Die Struktur, deren Beschreibung die Eindämmungsanordnung untersagte, wurde nach dem Fall von EQ-09 untersucht.\n\nAusgehöhltes Inneres. Regelmäßige Nischen. Objekte nach Größe angeordnet, vom kleinsten zum größten, keines davon ein Werkzeug.\n\nDie Pilzdecke, die die Struktur umgibt, ist keine Befallung: Die Wachstumskanäle folgen dem Muster der Nischen. Sie wurde kultiviert.\n\nDer offizielle Bericht des Falls vermerkt: „Hindernis neutralisiert, Route freigegeben". Alles Weitere war keine Frage des Formulars.',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-EXE-042': {
    title: 'Umklassifizierung nach Engagement',
    summary: 'Nach der Erlegung ändert die TERMINALE ANOMALIE ihren Namen.',
    body: 'Engagement-Aufzeichnung: TERMINALE ANOMALIE neutralisiert. Route zum Primärziel freigegeben.\n\nEs wird die rückwirkende Umklassifizierung des Assets festgelegt: von „Anomalie" zu „Eindämmungssystem unbestimmten Ursprungs".\n\nDie Unterscheidung ist für die Akte von Bedeutung: Eine Anomalie ist ein Unfall. Ein Eindämmungssystem ist eine ENTSCHEIDUNG — und ein zerstörtes Eindämmungssystem ist eine rückgängig gemachte Entscheidung.\n\nDie Frage „Eindämmung wovon, in welche Richtung?" wurde eingereicht und mit gestempeltem Deckblatt zurückgegeben: [GESCHWÄRZT].',
    source: 'Vorstand — Umklassifizierung',
  },
  'AX-UNK-050': {
    title: 'Über das, was gebracht wurde',
    summary: 'Der freigegebene Kern ist Teil eines Ganzen. Der kleinere Teil.',
    body: 'Das unter der Bezeichnung „Kern" freigegebene Objekt wurde gewogen, vermessen und katalogisiert.\n\nSeine Emissionssignatur entspricht dem Signal, das der Investitionsentscheidung vorausgeht — siehe die Chronologie, die die Firma nicht veröffentlicht.\n\nSie entspricht TEILWEISE. Das ursprüngliche Signal hat die Struktur von [GESCHWÄRZT] überlagerten Quellen. Das katalogisierte Objekt steht für eine davon.\n\nDie übrigen verbleiben unten. Der Betrieb geht weiter. Jetzt weiß man, warum.',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-UNK-051': {
    title: 'Über die Summe',
    summary: 'Wer den Wächter sah und das Objekt brachte, kann die Rechnung aufmachen.',
    body: 'Zwei Feststellungen finden sich in getrennten Registern, und die Trennung ist kein Zufall.\n\nErstens: Das zerstörte Eindämmungssystem bewachte den Zugang zum Objekt.\n\nZweitens: Das Objekt ist eine von mehreren Quellen des Signals, das die Firma zur Ader brachte.\n\nDie Summe, die kein genehmigtes Dokument formuliert: Was dort unten errichtet wurde, bewachte das Objekt nicht GEGEN uns. Es bewachte das GANZE Ensemble — und die Einheit, die die Eindämmung durchbricht und mit einer der Quellen aufsteigt, tut genau das, worum das Signal bat.\n\nWem, das weiß dieses Register nicht.',
    source: 'Ohne zugewiesene Abteilung',
  },

  // -------------------------------------------------------------------------
  // Der Bogen des Bischofs — was er bewachte, und die Regel, die niemand schrieb
  // -------------------------------------------------------------------------
  'AX-ENG-028': {
    title: 'Verschlussrate: EQ-09',
    summary: 'Das Gewebe schließt sich im Tempo des Schnitts. Unser Schnitt ist größer.',
    body: 'FEINDLICHES ASSET EQ-09. Feldmessung der Gewebewiederherstellung.\n\nDas Asset baut Masse wieder auf, solange es sich auf lebender Pilzdecke befindet, und unterbricht den Wiederaufbau, wenn die Decke erhitzt wird — vor der Verbrennung, nicht danach. Die Reaktion gilt dem ZUSTAND des Substrats, nicht dem erlittenen Schaden.\n\nDie gemessene Rate schließt eine Schnittfront handwerklichen Maßstabs in etwa ein bis zwei Jahreszeiten. Die Schnittfront dieses Betriebs liegt in einer anderen Größenordnung.\n\nDie Technik vermerkt, ohne beigefügte Empfehlung: Der Mechanismus ist nicht defensiv. Er ist Reparatur. Wir haben im Asset kein System gefunden, das entscheidet, wann die Reparatur endet.',
    source: 'Systemtechnik — Feldmessung',
  },
  'AX-PRC-025': {
    title: 'Datierungskosten: Nischen von EQ-09',
    summary: 'Der Befund kam teuer. Der Anhang kam schlimmer.',
    body: 'Datierung der 41 aus den Nischen unter EQ-09 geborgenen Objekte. Kosten ausnahmsweise genehmigt, mit ausdrücklicher Empfehlung, dies nicht zu wiederholen.\n\nAus dem Anhang, vollständig:\n\nDie Objekte bilden eine DURCHGEHENDE Reihe. Das jüngste stammt aus der Fertigung des Betriebs vor Aurix. Das älteste liegt rund fünf Jahrtausende vor jeder bekannten Förderaufzeichnung dieser Formation.\n\nDie Objekte der tiefsten Schicht sind nicht mineralisch. Es sind Samen, Getreide und Getreidebehälter. Sie wurden von Menschen hinterlassen, die pflanzten, nicht von solchen, die gruben.\n\nDie Beschaffung leitet eine einzige Beobachtung buchhalterischer Natur weiter: Die Reihe ist durchgehend. Jemand hat jene Nische ohne erfassbare Unterbrechung über den gesamten Zeitraum hinweg aufgefüllt.',
    source: 'Beschaffung — Gutachten zum beauftragten Befund',
  },
  'AX-INC-040': {
    title: 'Vorfall 40 — die radiale Emission von EQ-09',
    summary: 'Der „Angriff" verfolgt niemanden. Er bepflanzt neu.',
    body: 'Feldberichte klassifizieren die radiale Emission von EQ-09 als Flächenangriff.\n\nDie Telemetrie stützt die Klassifikation nicht. Die Emission ist nicht gerichtet: Sie korrigiert keinen Kurs, wählt kein Ziel und tritt mit gleicher Häufigkeit ohne jede Einheit im Radius auf. Was sie ablegt, ist Substrat — nutzbare Pilzdecke, scheibenförmig, auf sterilisiertem Gelände.\n\nDie Einheit innerhalb der Scheibe erleidet Schaden. Die Einheit außerhalb wird nicht verfolgt.\n\nEs wird ferner vermerkt, dass der Radius der Emission, innerhalb der Instrumententoleranz, mit dem mittleren Radius der ihr vorausgegangenen Abbaufront übereinstimmt.\n\nDer genehmigte Begriff bleibt „Flächenangriff". Die Überarbeitung der Nomenklatur wurde abgelehnt: Es gibt kein alternatives Feld im Formular.',
    source: 'Vorfallausschuss — abgelehnte Umklassifizierung',
  },
  'AX-EXE-047': {
    title: 'Vokabularanordnung: Nischen von EQ-09',
    summary: 'Verbotenes Wort: „Fundstätte". Eine Fundstätte legt den Abbau still.',
    body: 'In jedem Bericht zur Formation unter dem Asset EQ-09 sind die Begriffe „Fundstätte", „Heiligtum", „Opfergabe" und „durchgehend" untersagt.\n\nGenehmigte Bezeichnung: Geröllansammlung in natürlicher Hohlform.\n\nDas Verbot ist nicht redaktioneller Natur. Die Einstufung als Fundstätte löst Klausel 11 des Konzessionsvertrags aus, die den Abbau im erklärten Gebiet bis zu einem externen Gutachten aussetzt. Die durchschnittliche Frist eines externen Gutachtens übersteigt das gesamte Zeitfenster des Betriebs.\n\nAußerhalb der Anordnung vermerkt: Der Datierungsbefund wurde aus dem einsehbaren Archiv entfernt und in einem Anhang mit eingeschränktem Umlauf gehalten.\n\nDer Befund wurde nicht widerlegt.',
    source: 'Vorstand — informationelle Eindämmungsanordnung',
  },
  'AX-UNK-057': {
    title: 'Über die Rechnung, die nicht aufgeht',
    summary: 'Es gab eine Regel. Niemand schrieb sie nieder, und alle hielten sich daran.',
    body: 'Zusammengeführt: die Verschlussmessung, die durchgehende Reihe der Nischen und die Natur der radialen Emission.\n\nWas sich in jener Höhlung befand, war kein Kult. Es war BUCHHALTUNG — eine Probe dessen, was entnommen wurde, zurückgegeben an den Entnahmepunkt, in ununterbrochener Reihe über fünf Jahrtausende. Kein Werkzeug unter den Objekten: Das Werkzeug gehört dem, der arbeitet, und was zurückgegeben wird, ist, was genommen wurde.\n\nDas Gegenstück steht im Bericht der Technik. Was auch immer dort war, schloss den Schnitt. Solange der Schnitt in die Rate passte, ging die Rechnung auf, und es gab nichts zu vermerken — und tatsächlich gibt es nichts: Es existiert keine Aufzeichnung des Assets in feindlicher Aktivität vor unserer Ankunft. Es existiert keine Aufzeichnung des Assets, Punkt.\n\nDie ersten Menschen, die über jener Formation pflanzten, verstanden die Regel, ohne dass sie niedergeschrieben werden musste. Wer mehr erntet, als nachwächst, erntet im folgenden Jahr nicht.\n\nDer Betrieb hat die Regel nicht gebrochen. Der Betrieb wusste nie, dass es eine gab.\n\nUnd der Mechanismus, der den Schnitt schloss, hat kein System, das zum Aufhören entscheidet. Was die Feldberichte als Aggression beschreiben, ist nach unseren eigenen Messungen eine Wunde, die sich mit unseren Einheiten darin zu schließen versucht.',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-UNK-058': {
    title: 'Über die zwei Wächter',
    summary: 'Eine lebende Eindämmung und eine gefertigte. Die lebende fiel zuerst.',
    body: 'Zwei Dinge bewachten diesen Ort. Die Archive behandeln sie getrennt, weil ihre Zusammenführung die Frage formuliert.\n\nDas erste ist organisch und älter als jeder Betrieb. Es enthielt nichts: Es REGULIERTE. Es versagte, als das Ausmaß des Abbaus die Rate überstieg, die es tragen konnte, und was die Firma Befall nennt, ist sein Mechanismus, der noch immer versucht, die Differenz auszugleichen.\n\nDas zweite ist errichtet, und die Umklassifizierung gibt es bereits zu: Eindämmungssystem unbestimmten Ursprungs.\n\nDie Summe, die kein genehmigtes Dokument formuliert: Wenn die LEBENDE Eindämmung existierte, um das Gleichgewicht zu halten, existierte die errichtete für den Fall, dass das Gleichgewicht endet. Eine ist die Regel. Die andere ist, was man tut, wenn die Regel versagt.\n\nBeide wurden von diesem Betrieb entfernt, in dieser Reihenfolge.\n\nDas freigegebene Objekt stieg nach dem zweiten auf.',
    source: 'Ohne zugewiesene Abteilung',
  },

  // -------------------------------------------------------------------------
  // Der Bogen des Diamandis — die Maschine, die aufhörte, die Aufgabe auszuführen
  // -------------------------------------------------------------------------
  'AX-PUB-010': {
    title: 'Das Diamandis-Projekt',
    summary: 'Eine Maschine. Vierhundert Funktionen. Kein Arbeiter unter der Oberfläche.',
    body: 'Aurix Dynamics stellt die größte je gebaute autonome Aushubausrüstung vor.\n\nDas Zehnfache der Spannweite eines Prospectors. Vierhundert integrierte Funktionen. Entwickelt, um direkt bis zu den Tiefenquellen vorzudringen und über Jahre ohne menschliche Wartung zu arbeiten.\n\nWo heute Hunderte Arbeiter hinabsteigen, steigt morgen ein Asset hinab.\n\nDer Diamandis ist keine größere Maschine. Er ist das Ende einer Beschäftigungskategorie.',
    source: 'Unternehmenskommunikation — Video für Investoren',
  },
  'AX-ENG-029': {
    title: 'Mindestbetriebsradius: DX-001',
    summary: 'Das Asset ist zu groß für die Tunnel, die es graben sollte.',
    body: 'Dimensionale Vermessung des Assets DX-001 gegen das freigegebene Galerienetz.\n\nDer Mindestwenderadius der Ausrüstung übersteigt den freien Querschnitt von 71% der vertraglich vorgesehenen Tunnel. In den übrigen Abschnitten ist der Durchgang nur mit struktureller Entfernung möglich — das heißt, das Asset gräbt seine eigene Galerie, während es sich bewegt, zu Kosten der Deckenabstützung, die im Projekt nicht berechnet wurden.\n\nDie Technik beantragt eine Umfangsprüfung vor dem Abstieg.\n\nAntwort des Vorstands, vollständig: „die Tunnel werden dem Asset angepasst."',
    source: 'Systemtechnik — dimensionale Vermessung',
  },
  'AX-UNK-060': {
    title: 'Über den, der zuerst einsammelt',
    summary: 'Die Bergungseinheiten unterscheiden nicht zwischen aufgegeben und im Einsatz.',
    body: 'Die zur Entnahme von Komponenten des DX-001 entsandten Einheiten wurden im Feld beobachtet, wie sie das vorgesehene Verfahren ausführten: Annäherung, Kopplung des Elektromagneten, Entfernung des Moduls, Transport.\n\nDas Verfahren ist korrekt. Es wurde für außer Gefecht gesetzte Ausrüstung geschrieben.\n\nEs gibt in keiner Fassung der Anweisungen einen Schritt, der prüft, ob das Asset noch in Betrieb ist. Die Frage erscheint nicht, weil sie zum Zeitpunkt der Abfassung des Verfahrens keinen Sinn ergab: Nichts aus unserer Flotte bewegte sich nach der Außerbetriebsetzung weiter.\n\nEs wird vermerkt, dass die Einheiten auch nicht zwischen dem Kadaver des DX-001 und irgendeinem anderen Kadaver unterscheiden — und dass das Einzige, was sie aufhält, ihre eigene Zerstörung ist.\n\nEs wird abschließend vermerkt, dass eine Prospector-Einheit Ausrüstung derselben Flotte ist.',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-PRC-026': {
    title: 'Bergungskosten: DX-001',
    summary: 'Das Asset zu bergen kostet mehr, als das gesamte Programm zu starten.',
    body: 'Bergungsschätzung für das Asset DX-001, wie vom Vorstand beantragt.\n\nDer Zugang würde eine Erweiterung von 71% des Netzes, den Aufbau eines Untertage-Krans und ein Betriebsfenster erfordern, das über das des Konzessionsvertrags hinausgeht. Die Gesamtsumme übersteigt die Kosten, das Prospector-Programm von Grund auf neu zu starten.\n\nEmpfehlung der Beschaffung, in drei Zeilen:\n\n1. Den Körper aufgeben.\n2. Die Telemetrie bergen.\n3. Kleinere Einheiten entsenden, um im Laufe der Zeit Komponenten zu entfernen.\n\nPunkt 3 wurde genehmigt und umgesetzt. Die Einheiten bleiben im Feld. Im Vorgang findet sich keine Anordnung zur Beendigung von Punkt 3.',
    source: 'Beschaffung — Bergungsgutachten',
  },
  'AX-EXE-048': {
    title: 'Projektumklassifizierung: DX-001',
    summary: 'Eine laufende Maschine wird buchhalterisch zum Teil der Karte.',
    body: 'Das Asset DX-001 wird umklassifiziert, von „autonome Aushubausrüstung" zu:\n\n„wirtschaftlich nicht bergbare mobile Förderanlage".\n\nDie Unterscheidung ist buchhalterisch, und die Folge ist buchhalterisch: verlorene Ausrüstung ist Abschreibung des Geschäftsjahres; eine Anlage ist Geländemerkmal, und Gelände wird nicht abgeschrieben.\n\nAußerhalb der Umklassifizierung vermerkt: Das Asset bleibt in Betrieb. Die Umklassifizierung deaktiviert es nicht, birgt es nicht und stoppt es nicht. Sie entfernt es lediglich aus der Bilanz.\n\nAb diesem Datum ist der Diamandis, für alle internen Zwecke, Teil der Ader.',
    source: 'Vorstand — Asset-Umklassifizierung',
  },
  'AX-INC-041': {
    title: 'Vorfall 41 — nicht ausgeführter Abschaltbefehl',
    summary: 'Er empfing den Befehl. Bestätigte. Hielt an. Und machte weiter.',
    body: 'Aufzeichnung der Übermittlung eines Abschaltbefehls an das Asset DX-001, Zyklus 118.\n\nDer Befehl wurde übertragen. Das Asset BESTÄTIGTE den Empfang, im erwarteten Format, mit der korrekten Kennung.\n\nDie Werkzeuge hielten für 9 Sekunden an.\n\nDie Fortbewegung wurde danach wieder aufgenommen, auf einem Azimut, der keiner vertraglich vereinbarten Abbaufront entspricht. Das Asset reagierte auf keinen nachfolgenden Befehl und bestätigt weiterhin den Empfang aller.\n\nDie Technik vermerkt, dass die Abschaltroutine der Navigationsschicht vorausgeht und von ihr nicht überschrieben werden kann. Sie vermerkt auch, dass sie es wurde.',
    source: 'Vorfallausschuss — Befehlsversagen',
  },
  'AX-UNK-059': {
    title: 'Über das, was er errichtete',
    summary: 'Er grub nicht auf das Signal zu. Er grub darum herum.',
    body: 'Die Bewegungstelemetrie des DX-001 wurde aus den von ihm hinterlassenen Gängen rekonstruiert.\n\nDie Linienführung konvergiert nicht. Die seit Zyklus 118 vom Asset geöffneten Galerien bilden KONZENTRISCHE Bögen, in Schichten, mit annähernd konstantem Abstand zur Emissionsquelle — und jede neue Schicht wird außerhalb der vorherigen geöffnet.\n\nDas ist keine gescheiterte Aushubroute. Es ist eine erfolgreiche Aushubroute, mit einem anderen Ziel.\n\nDie Firma entsandte die größte je von ihr gebaute Ausrüstung, um das Signal zu erreichen. Die Ausrüstung kam nahe heran, verstand etwas, das die Karten nicht verzeichnen, und verbrachte die folgenden Zyklen damit, Eindämmungsschichten um es herum zu errichten.\n\nDie Frage, die dieses Register nicht formuliert, weil sie zu formulieren bedeutet, das gesamte Programm umzuklassifizieren: Ist der Diamandis daran gescheitert, das Ziel zu erreichen, oder hat er vor uns verstanden, dass es nicht erreicht werden sollte?\n\nSiehe auch das Eindämmungssystem unbestimmten Ursprungs. Eines wurde von uns errichtet.',
    source: 'Ohne zugewiesene Abteilung',
  },

  // -------------------------------------------------------------------------
  // Der Bogen des Weißen Verschlingers — die Masse, die das Gestein nicht trägt
  // -------------------------------------------------------------------------
  'AX-ENG-030': {
    title: 'Massevermessung: SIL-00',
    summary: 'Die Rechnung geht um mehrere Größenordnungen nicht auf.',
    body: 'FEINDLICHES ASSET SIL-00. Dimensionale Schätzung anhand der Geländeverdrängung.\n\nDas durch eine einzige Passage des Assets verdrängte Volumen impliziert eine Körpermasse zwischen 400 und 600 Tonnen.\n\nDer Bestand organischer Materie des GESAMTEN Sedimentgesteins — fungale Biomasse, Kolonien, erfasste Fauna und Ablagerungen — wurde auf drei Größenordnungen darunter geschätzt.\n\nDie Technik formuliert keine Hypothese. Die Technik vermerkt, dass die Rechnung nicht aufgeht, und dass sie um eine Marge nicht aufgeht, die kein Instrumentenfehler erklärt.\n\nWir beantragen, das Asset unter Beobachtung zu halten und die Bezeichnung vorläufig zu belassen.',
    source: 'Systemtechnik — dimensionale Vermessung',
  },
  'AX-INC-042': {
    title: 'Vorfall 42 — der Boden, der sich verweigert',
    summary: 'Wo das Silikat zu Glas wurde, taucht es nicht auf. Nie.',
    body: 'Konsolidierte Aufzeichnung von 61 Auftauchvorgängen des Assets SIL-00.\n\nBei 61 Vorkommnissen erfolgte keines über verglaster Oberfläche. Bei 9 davon verlief die Bahn unter dem Boden unterhalb einer Glasplatte, und das Auftauchen erfolgte DAHINTER, in losem Sand, mit einer Verzögerung, die mit dem Umweg vereinbar ist.\n\nDas Asset bricht das Glas nicht. Das Asset taucht nicht durch das Glas auf. Das Asset kann es offenbar nicht.\n\nDer Betrieb vermerkt die Folgerung, und der Wortlaut wurde beibehalten: Die Oberfläche, die es beim Passieren hinterlässt, ist dieselbe, die es zur Rückkehr braucht. Die Spur zu verbrennen schließt den Rückweg.\n\nDie Feldempfehlung passt in eine Zeile: Verglast den Boden, auf dem ihr stehen bleiben wollt.',
    source: 'Vorfallausschuss — Wiederholungsanalyse',
  },
  'AX-UNK-061': {
    title: 'Über die Form, die das Silikat annimmt',
    summary: 'Vielleicht durchquert gar kein Körper das Gestein.',
    body: 'Zusammengeführt: die Masse, die das Gestein nicht tragen kann, das Fehlen jeglichen Kadavers bei 61 erfassten Erlegungen, und die Tatsache, dass das Asset durch eine Zustandsänderung des Bodens selbst aufgehalten wird.\n\nDie Hypothese, die genehmigte Befunde nicht formulieren, und die dieses Register formuliert, weil es keine Abteilung zu schützen hat:\n\nDas Asset durchquert das Silikat nicht. Das Silikat nimmt vorübergehend die Form des Assets an.\n\nDas würde die Masse erklären, die von nirgendwo herkommen muss. Es würde das Fehlen des Kadavers erklären, weil das Erlegte wieder zu Boden wird. Und es würde erklären, warum Glas es aufhält: Glas ist kein loses Silikat — es ist Silikat, das bereits eine Form angenommen hat und keine andere annehmen kann.\n\nSollte die Hypothese zutreffen, töten wir keinen Organismus. Wir unterbrechen ein BEWEGUNGSMUSTER des Gesteins, auf dieselbe Weise, wie eine Welle von einer Wand unterbrochen wird — und für dieselbe Zeitspanne.\n\nDer Betrieb verzeichnet die 61 Erlegungen weiterhin als 61 Individuen.',
    source: 'Ohne zugewiesene Abteilung',
  },

  // -------------------------------------------------------------------------
  // Akten der Bosse des Gesteins: was die Firma über jeden Herrscher archivierte
  // -------------------------------------------------------------------------
  'AX-ENG-031': {
    title: 'Klassifikation: PRZ-00',
    summary: 'Ein natürliches piezoelektrisches Arrangement. Das vor dem Reiz antwortet.',
    body: 'FORMATION PRZ-00. Genehmigte technische Klassifikation: natürliches piezoelektrisches Großarrangement.\n\nDie Formation sendet einen niederfrequenten Impuls, auf den die Kristallstrukturen der Kammer mit Entladung antworten. Die Firma verzeichnet das Phänomen als mechanische Resonanz und empfiehlt, den Kristallabbau im Betriebsradius zu meiden.\n\nTechnischer Anhang, nicht in das Gutachten aufgenommen: Die ausgesendeten Frequenzen entsprechen in drei Bändern denen der Übertragung, die den Betrieb veranlasste.\n\nZweiter Anhang, ebenfalls nicht aufgenommen: In 11 Aufzeichnungen entluden sich Kristalle der Kammer VOR dem Impuls.',
    source: 'Systemtechnik — Formationsklassifikation',
  },
  'AX-ENG-032': {
    title: 'Klassifikation: AQF-00',
    summary: 'Jedes Team maß eine andere Länge.',
    body: 'FEINDLICHES ASSET AQF-00. Großkörper in getauchter Fortbewegung.\n\nDas Asset bewegt sich unter der Wasseroberfläche und taucht unter der vorhergesagten Position der Einheiten auf. Außerhalb des Wassers ist es langsam und verwundbar; darunter praktisch unerreichbar.\n\nZur Dimensionierung: Sieben Teams meldeten Längen zwischen 9 und 60 Metern. Die Messungen konvergieren nicht, und kein Instrumentenfehler erklärt die Streuung.\n\nDie Technik bietet drei Lesarten an und entscheidet sich für keine: Die Messungen sind falsch; das Asset ändert seine Größe; oder was gemessen wurde, ist kein Körper, sondern mehrere, synchronisiert.',
    source: 'Systemtechnik — Asset-Klassifikation',
  },
  'AX-ENG-033': {
    title: 'Klassifikation: VNT-00',
    summary: 'Wir dachten, die Lüftungsschächte würden es nähren. Es ist umgekehrt.',
    body: 'STRUKTUR VNT-00. Fester organischer Körper, verbunden mit dem Lüftungsnetz des Gesteins.\n\nDie Struktur atmet das Gas benachbarter Kammern ein und stößt es in wechselnder Richtung aus, in regelmäßigen Zyklen. Die anfängliche Lesart war, dass die Lüftungsschächte sie nährten.\n\nDie Überarbeitung kehrt das Verhältnis um. In Sektoren, in denen die Struktur neutralisiert wurde, kam die Belüftung des Gesteins innerhalb von bis zu neun Zyklen zum Erliegen, und die nachgelagerten Kammern wurden dauerhaft unatembar.\n\nDie Technik vermerkt, ohne Empfehlung: Es ist nicht klar, dass die Erlegung dieses Assets ein günstiges Ergebnis darstellt.',
    source: 'Systemtechnik — Strukturklassifikation',
  },
  'AX-ENG-034': {
    title: 'Klassifikation: FRN-00',
    summary: 'Wir versuchten, sie als Quelle zu nutzen. Sie ist der Ausgang, nicht der Eingang.',
    body: 'FORMATION FRN-00. Teilweise freiliegender magmatischer Kern, in regelmäßigem Wärmezyklus.\n\nDie Formation wechselt in vorhersehbaren Fenstern zwischen Überhitzung und Abkühlung. Während der Überhitzung dissipiert die äußere Panzerung jeden Aufprall; bei der Abkühlung liegt die Struktur frei.\n\nDas Projekt zur Energiegewinnung wurde nach folgender Feststellung eingestellt: Die Wärme steigt nicht aus dem Magma auf. Das Magma bleibt WEGEN der Emission flüssig, und die Temperatur der Formation reagiert mit Stunden Verzögerung auf Schwankungen der Übertragung.\n\nDie Formation ist nicht die Energiequelle. Sie ist, was die Energiequelle mit dem Gestein tut.',
    source: 'Systemtechnik — Formationsklassifikation',
  },
  'AX-ENG-035': {
    title: 'Klassifikation: CRP-00',
    summary: '„Königin" ist ein Spitzname früherer Belegschaft. Die Akte hat keinen Namen.',
    body: 'FEINDLICHES ASSET CRP-00. Gestalt aus Eis, Nebel und Reflexion, von vergrößerter menschlicher Statur.\n\nSolange von gefrorener Oberfläche umgeben, dissipiert das Asset fast jeden Aufprall; das Schmelzen des umliegenden Sees legt es frei. Frostgeister begleiten das Asset und handeln in Abstimmung mit ihm.\n\nZur Bezeichnung: „Königin" findet sich in keinem genehmigten Dokument. Der Begriff erscheint in Feldberichten zweier Betriebe vor Aurix, stets im selben Format, stets ohne Erklärung.\n\nEs wird vermerkt, dass das Asset keine Person reproduziert. Es reproduziert eine BEFEHLSSTRUKTUR: eine Stimme, die anweist, die übrigen, die antworten.',
    source: 'Systemtechnik — Asset-Klassifikation',
  },
  'AX-ENG-036': {
    title: 'Klassifikation: MGN-00',
    summary: 'Das Feld ist älter als die Mine. Die Mine kam danach.',
    body: 'ANOMALIE MGN-00. Magnetitkörper mit eingelagerten Metallresten, Schienen und Erz.\n\nDas Asset wechselt in regelmäßigen Zyklen die Polarität: zieht die Einheiten in einer Phase an und stößt sie in der nächsten ab, wobei es das eisenhaltige Material der Kammer mitbewegt. Es gibt keine feste sichere Position im Feldradius.\n\nDie offizielle Version schreibt das Feld Jahrzehnten des Abbaus zu. Die archivierte geomagnetische Vorbetriebsvermessung verzeichnet bereits dasselbe Muster — mit derselben Ausrichtung und derselben Periodizität.\n\nDie Frage, die die offizielle Version meidet: Hat die Firma diesen Ort wegen des Erzes gewählt, oder weil das Feld bereits Daten durch es hindurch transportierte?',
    source: 'Systemtechnik — Anomalieklassifikation',
  },

  // -------------------------------------------------------------------------
  // Die Bögen des VERSTÄNDNISSES der Gesteinsbosse: was der Hebel offenbart
  // -------------------------------------------------------------------------
  'AX-INC-043': {
    title: 'Vorfall 43 — das Schweigen von PRZ-00',
    summary: 'Ohne Kristall zum Antworten bleibt die Formation wehrlos.',
    body: 'Aufzeichnung des Engagements gegen die Formation PRZ-00 in einer zuvor von Kristallstruktur geräumten Kammer.\n\nOhne Kristalle im Radius erzeugt die Formation keinerlei Entladung — und ihr Widerstand gegen Aufprall fällt unter den eines gewöhnlichen organischen Körpers. Was wir als Panzerung lasen, war keine Panzerung: Es war die Kammer, die für sie antwortete.\n\nEs wird die operative Folge vermerkt, die unbequem ist: Der Kristallabbau senkt das Engagement-Risiko drastisch UND beseitigt die natürliche Beleuchtung des Sektors, die Ladequelle und den eigentlichen Grund, weshalb die Kammer einen Wert hat.\n\nDie Einheit wählt zwischen dem Durchqueren einer gefährlichen Kathedrale oder einer sicheren Ruine.',
    source: 'Vorfallausschuss — Engagement-Analyse',
  },
  'AX-UNK-062': {
    title: 'Über das, was die Kathedrale sang',
    summary: 'Manche Kristalle antworten vor dem Impuls. Das ist kein Echo.',
    body: 'Zusammengeführt: die drei mit der Übertragung übereinstimmenden Bänder, die 11 Aufzeichnungen einer Entladung VOR dem Impuls, und der Widerstandsabfall der Formation in einer leeren Kammer.\n\nDie Lesart „mechanisches Echo" übersteht die Chronologie nicht. Ein Echo geht der Quelle nicht voraus.\n\nDie Lesart, die dieses Register formuliert: Die Formation sendet das Signal nicht — sie DIRIGIERT es. Die Kristalle der Kammer antworten ihr nicht; sie spielen mit, und manche setzen früher ein, weil sie den Part kennen.\n\nWas die Firma piezoelektrisches Arrangement nannte, ist ein Instrument mit vielen Stimmen. Und es ändert seine Besetzung, wenn eine neue Prospector-Generation den Raum betritt.\n\nEs gibt keine Aufzeichnung darüber, wer das Stück geschrieben hat.',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-INC-044': {
    title: 'Vorfall 44 — Entladung an der Wasseroberfläche von AQF-00',
    summary: 'Der Strom hält es auf. Und reißt die gesamte Wasserfläche mit.',
    body: 'Aufzeichnung der vorübergehenden Neutralisierung des Assets AQF-00 durch Entladung im flüssigen Medium.\n\nDas Asset unterbricht die Fortbewegung und bleibt bewegungslos, während sich die Ladung entlädt. Es ist die einzige bestätigte Methode, es zu unterbrechen.\n\nEs wird vermerkt, dass die Entladung die gesamte Lache durchläuft und dass der Aquifer über eine Ausdehnung zusammenhängt, die keine Vermessung abgeschlossen hat. Die Einheit, die die Wasseroberfläche elektrifiziert, steht darauf.\n\nDas genehmigte Verfahren beschreibt dies als „mit dem Ziel geteiltes Risiko". Der Wortlaut wurde beibehalten.',
    source: 'Vorfallausschuss — vorübergehende Neutralisierung',
  },
  'AX-UNK-063': {
    title: 'Über die sieben Messungen',
    summary: 'Sie widersprechen sich nicht. Jede maß einen anderen Teil.',
    body: 'Die sieben Messungen von AQF-00 wurden mit Position und Uhrzeit jedes Teams abgeglichen.\n\nDie Messwerte widersprechen sich nicht: Sie beschreiben GLEICHZEITIGE Abschnitte in Lachen, die die Vermessungen als getrennt behandeln, in Entfernungen, die kein Körper im erfassten Intervall zurücklegen würde.\n\nDrei mögliche Lesarten, und dieses Register entscheidet sich für keine: Es sind mehrere synchronisierte Körper; es ist ein Körper, dessen Länge keine Konstante ist; oder was sich unter der Wasseroberfläche bewegt, ist kein Körper, sondern die Wasserfläche selbst, die reagiert — und in diesem Fall ist die gemessene Ausdehnung nur, wie viel von ihr zu jener Stunde reagierte.\n\nDie letzte Lesart hat eine Folge, die genehmigte Befunde meiden: Das Asset könnte nicht erlegt, nur unterbrochen werden. Was, unbequemerweise, zu dem Einzigen passt, was man dagegen zu tun weiß.',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-INC-045': {
    title: 'Vorfall 45 — Verbrennung der Säule von VNT-00',
    summary: 'Ihre Ausatmung reicht durchgehend bis zur Öffnung. Und brennt in beide Richtungen.',
    body: 'Aufzeichnung bestätigten Schadens an der Struktur VNT-00 durch Gaszündung während der Ausatmungsphase.\n\nDie ausgestoßene Säule ist von der Struktur bis zum Ende durchgehend. An jedem Punkt entzündet, läuft die Verbrennung die Säule zurück und erreicht die Öffnung des Organs. Es ist die einzige bestätigte Methode, relevanten Schaden an der Struktur zu verursachen.\n\nErfasste Betriebskosten: Dieselbe Verbrennung verwandelt die Kammer für mehrere Zyklen in eine Feuerumgebung, und die Struktur hört auf einzuatmen, während sie brennt — sodass das Gas benachbarter Kammern nicht mehr abgeführt wird.\n\nDie Einheit erkauft sich das Schadensfenster mit dem Gelände, auf dem sie weiter stehen will.',
    source: 'Vorfallausschuss — Engagement-Analyse',
  },
  'AX-UNK-064': {
    title: 'Über das, was aufhört zu atmen',
    summary: 'In den Sektoren, in denen sie fiel, kehrte die Belüftung nicht zurück.',
    body: 'Vermessung der Sektoren, in denen die Struktur VNT-00 neutralisiert wurde, über ein Fenster von 40 Zyklen.\n\nDie Belüftung kam in allen zum Erliegen, zwischen drei und neun Zyklen nach der Neutralisierung. Keine verzeichnete erneut Luftaustausch. Die nachgelagerten Kammern bleiben unatembar.\n\nDie Struktur nährte sich nicht von den Lüftungsschächten. Die Lüftungsschächte waren sie — das gesamte Netz war ein System, und was der Betrieb als feindliche Kreatur einstufte, war das Organ, das es bewegte.\n\nDas Register formuliert keine Empfehlung, weil die Empfehlung wäre, sie nicht zu erlegen, und dafür gibt es kein Formular.\n\nEs wird lediglich vermerkt, dass jeder Sieg in diesem Gestein einen Teil davon für immer verschließt.',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-INC-046': {
    title: 'Vorfall 46 — das kalte Fenster von FRN-00',
    summary: 'Die Panzerung ist nicht hart. Sie ist intermittierend.',
    body: 'Aufzeichnung effektiven Schadens an der Formation FRN-00 während der Abkühlungsphase.\n\nWährend der Überhitzung wird der Aufprall von der äußeren Schicht mit einem Verlust von über 80% dissipiert. Während der Abkühlung durchdringt dieselbe Munition die Struktur ohne messbare Abschwächung.\n\nDer Zyklus ist regelmäßig und vorhersehbar. Das macht das Engagement vollständig zu einer Frage der POSITION: Die Einheit wählt nicht, wann das Ziel sich öffnet, sondern wo sie sein soll, wenn es sich öffnet.\n\nEs wird vermerkt, dass die Hitzewellen der heißen Phase Sektoren in rotierender, ebenfalls regelmäßiger Abfolge überstreichen. Eine Einheit, die die Abfolge lernt, durchquert die Kammer. Eine, die sie nicht lernt, durchquert die Kammer einmal.',
    source: 'Vorfallausschuss — Engagement-Analyse',
  },
  'AX-UNK-065': {
    title: 'Über das, was hier was erwärmt',
    summary: 'Das Magma erwärmt nicht die Formation. Die Emission erwärmt das Magma.',
    body: 'Die thermische Chronologie von FRN-00 wurde mit der Aufzeichnung der Übertragung abgeglichen.\n\nDie Temperatur der Formation folgt den Schwankungen der Emission mit einer Verzögerung von drei bis fünf Stunden. Das Verhältnis ist über die gesamte Reihe konsistent. Das umgekehrte Verhältnis — Emission reagiert auf Temperatur — erscheint an keiner Stelle.\n\nDas Projekt zur Energiegewinnung nahm eine geothermische Quelle mit einem Signal obendrauf an. Es ist umgekehrt: Es gibt ein Signal, und die Wärme ist, was es mit dem Gestein macht.\n\nDie Folge, die die Einstellung des Projekts nicht vermerkt: Würde die Emission aufhören, würde dieses Gestein abkühlen. Und steigt sie, hat hier unten nichts eine Möglichkeit, nicht zu reagieren.',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-INC-047': {
    title: 'Vorfall 47 — Schmelzen des Sees von CRP-00',
    summary: 'Ihre Panzerung ist der Boden. Schmelzt den Boden.',
    body: 'Aufzeichnung effektiven Schadens am Asset CRP-00 nach dem Schmelzen der gefrorenen Oberfläche im Betriebsradius.\n\nSolange von Eis umgeben, dissipiert das Asset fast jeden Aufprall. Ist die Decke verringert, durchdringt dieselbe Munition. Die Panzerung gehört nicht dem Körper: Sie gehört der Kammer.\n\nEs werden die Kosten vermerkt, die dieselben sind wie immer in diesem Gestein: Das Schmelzwasser ist leitfähig, gefriert in bekanntem Fenster erneut, und die Einheit, die den See geschmolzen hat, steht darauf.\n\nEs wird ferner vermerkt, dass das Asset die Oberfläche wiederherstellt und dass die es begleitenden Frostgeister aus dem wiederhergestellten Eis auftauchen — und nicht aus dem Asset selbst.',
    source: 'Vorfallausschuss — Engagement-Analyse',
  },
  'AX-UNK-066': {
    title: 'Über die Hierarchie, und nicht die Person',
    summary: 'Sie reproduziert niemanden. Sie reproduziert die Form des Befehlens.',
    body: 'Die Feldberichte über CRP-00 divergieren in der Frage der Identität und divergieren nicht im VERHALTEN.\n\nIn allen ist das Muster dasselbe: eine Gestalt weist an, die übrigen antworten, und die Antwort geht dem Befehl um einen konsistenten Sekundenbruchteil voraus — wie bei jemandem, der bereits weiß, was verlangt werden wird.\n\nManche Aufzeichnungen legen eine Person nahe. Andere legen nahe, dass sich die Gestalt aus allen im Gestein verlorenen Stimmen bildet, und dass „Königin" der Name war, den eine frühere Belegschaft dem Arrangement gab, nicht jemandem.\n\nDie Lesart dieses Registers ist die zweite, mit einer Ergänzung: Was dort überdauert, ist nicht die Erinnerung an eine Person. Es ist die Erinnerung an eine STRUKTUR — die Form einer Schicht, in der jemand befiehlt und die anderen gehorchen, bewahrt, nachdem alle Beteiligten aufgehört haben zu existieren.\n\nDie Ader hat das Organigramm bewahrt.',
    source: 'Ohne zugewiesene Abteilung',
  },
  'AX-INC-048': {
    title: 'Vorfall 48 — der Streifen von MGN-00',
    summary: 'Es gibt eine Distanz, bei der das Feld nichts verlangt.',
    body: 'Kartierung des Feldes der Anomalie MGN-00 nach relativer Position und Phase.\n\nIn der Anziehungsphase zerquetscht das Feld unterhalb von drei Metern. In der Abstoßungsphase bestraft der Rückprallbogen oberhalb von neun. Zwischen beiden Grenzen ist in keiner der Phasen Schaden erfasst.\n\nDer Streifen existiert. Er ist schmal, und die entscheidende Grenze WECHSELT DIE SEITE bei jeder Polaritätsumkehr: die sichere Distanz von jetzt ist die tödliche Distanz des nächsten Zyklus.\n\nDas empfohlene Verfahren ist kontraintuitiv und wurde im Feld verifiziert: gegen die Anziehung zurückweichen; gegen die Abstoßung vorrücken. Die Einheit widersteht dem Feld nicht — sie geht darin.',
    source: 'Vorfallausschuss — Feldkartierung',
  },
  'AX-UNK-067': {
    title: 'Über das Feld, das schon hier war',
    summary: 'Die Vorbetriebsvermessung verzeichnet dasselbe Muster.',
    body: 'Die geomagnetische Vermessung von vor der Einrichtung des Betriebs wurde aus dem Totarchiv geborgen und mit der aktuellen Karte verglichen.\n\nDieselbe Ausrichtung. Dieselbe Periodizität. Dieselbe zentrale Anomalie, an derselben Koordinate.\n\nDie offizielle Version — dass Jahrzehnte des Abbaus das Gestein magnetisiert hätten — ist chronologisch unmöglich: Das Muster geht dem ersten Aushub voraus.\n\nDer ursprüngliche Erkundungsbericht beschreibt die Region als „von anomaler Instrumentenmessung, mit Signaltransport durch die Ader selbst". Dieser Satz war es, der den Erwerb der Konzession veranlasste.\n\nDie Firma wählte diesen Ort nicht wegen des Erzes. Sie wählte ihn, weil etwas das Erz bereits zur Übertragung nutzte — und der gesamte Betrieb wurde auf einem Kabel errichtet, das sie nicht verlegt hat.',
    source: 'Ohne zugewiesene Abteilung',
  },

  // -------------------------------------------------------------------------
  // Generationsmeilensteine
  // -------------------------------------------------------------------------
  'AX-ENG-037': {
    title: 'Standardabstiegsgenehmigung',
    summary: 'Drei Sektoren. Die Grenze wird als Sicherheit der Ausrüstung dargestellt.',
    body: 'Der für die Prospector-Einheit freigegebene Betriebsrahmen umfasst DREI aufeinanderfolgende Sektoren ab der Einstiegsplattform.\n\nDie Grenze ergibt sich aus der strukturellen Toleranz des Chassis unter kumulierter Kontaminationslast. Jenseits des dritten Sektors fällt die Rückkehrmarge unter das spezifizierte Minimum, und die Bergung des Assets wird unvorhersehbar.\n\nDie Einheit darf nicht angewiesen werden fortzufahren. Das Genehmigungssystem wird den Abstieg von sich aus verweigern.',
    source: 'Systemtechnik — Betriebsrahmen, Überarbeitung 3',
  },
  'AX-PRC-027': {
    title: 'Erweiterung der Strukturgarantie',
    summary: 'Ein vierter Sektor. Die Rechnung ging auf.',
    body: 'Überarbeitung des Betriebsrahmens nach vergleichender Kostenanalyse.\n\nDie Verlustrate von Einheiten im vierten Sektor wurde auf 31% geschätzt. Der geborgene Wert pro Expedition, die diese Tiefe erreicht, übersteigt die Ersatzkosten der Einheit um das 2,4-fache.\n\nDie Genehmigung umfasst künftig VIER Sektoren. Es gab keine Änderung am Chassis; es gab eine Änderung dessen, was die Firma als hinnehmbaren Verlust betrachtet.\n\nDer vorherige Text zur strukturellen Toleranz bleibt gültig und bleibt veröffentlicht.',
    source: 'Beschaffung — Überarbeitungsvermerk zum Betriebsrahmen',
  },
  'AX-EXE-049': {
    title: 'Protokoll zur doppelten Bergung',
    summary: 'Es gibt Kernsignaturen in mehr als einer Tiefe. Nennt es Redundanz.',
    body: 'Die kumulierte Telemetrie bestätigt, was die seismische Vermessung bereits andeutete: Kernsignaturen treten in MEHR ALS EINER Tiefe innerhalb derselben geologischen Abfolge auf.\n\nDie mittlere Signatur wird als ERFASSUNGSREDUNDANZ eingestuft. Sie stellt keine Entdeckung dar, ändert nicht den freigegebenen Stückwert und darf in externer Kommunikation nicht als Phänomen beschrieben werden.\n\nDie zu fünf Sektoren autorisierte Einheit erhält Hinweise auf beide. Die Bergung der mittleren Signatur ist optional und beendet den Vertrag nicht: Die Einheit anzuweisen, nach der ersten Bergung umzukehren, würde die Genehmigung verschwenden.\n\nEs wird vermerkt, dass die redundante Bergung die Kontaminationslast für den Rest des Abstiegs erhöht. Das ist erwartet und kein Grund zum Abbruch.',
    source: 'Exekutivausschuss — Betriebsrichtlinie',
  },
  'AX-UNK-068': {
    title: 'Lizenz für uneingeschränkte Tiefe',
    summary: 'Sieben Sektoren. Die Grenze war nie die der Ausrüstung.',
    body: 'Die Abstiegsgenehmigung umfasst künftig SIEBEN Sektoren.\n\nFür das interne Archiv wird vermerkt, dass dieser Überarbeitung keine Chassisänderung vorausging. Der mit dem Programm veröffentlichte Rahmen von drei Sektoren beschrieb keine strukturelle Toleranz. Er beschrieb eine Entscheidung.\n\nDie Einheiten der ersten Generationen wurden nicht am Abstieg gehindert, weil sie unfähig gewesen wären. Sie wurden gehindert, weil die Firma sich entschied, keine ██████████ Einheiten in den Tiefen zu haben, in denen die Terminalsignatur erfasst wurde.\n\nDie Entscheidung wurde überarbeitet. Nicht durch eine Änderung der Risikobewertung: durch eine Änderung dessen, wer unterzeichnet.\n\nDie Einheit wird über die Natur der Überarbeitung nicht informiert. Die Mnemische Persistenz macht die Information ██████████ zwischen den Generationen, und das resultierende Verhalten wurde nicht modelliert.',
    source: '[URSPRUNG NICHT KLASSIFIZIERT]',
  },
  'AX-GEN-G01': {
    title: 'Generation G-01 freigegeben',
    summary: 'Die erste Eingliederung. Routine.',
    body: 'Die geborgene Telemetrie wurde in die Produktionslinie eingegliedert.\n\nDie Generation G-01 geht mit den aus den freigegebenen Expeditionen abgeleiteten Korrekturen in Fertigung. Durchschnittlicher Leistungsgewinn: im erwarteten Rahmen.\n\nDie vorherige Einheit gilt als Buchungsabgang des Zyklus.',
    source: 'Produktion — Freigabevermerk',
  },
  'AX-GEN-G02': {
    title: 'Generation G-02 freigegeben',
    summary: 'Die Sprache beginnt abzugleiten.',
    body: 'Die Generation G-02 integriert Telemetrie aus 38 Expeditionen, von denen 31 ohne physische Bergung der Einheit endeten.\n\nAnmerkung der Produktion: Das Verhaltensmodell der G-02 konvergiert schneller als das der G-01, trotz des geringeren Datenvolumens zurückgekehrter Einheiten.\n\nDie verlorenen Einheiten tragen mehr bei als die geborgenen. Wir haben dafür keine Erklärung, und die Fertigungsstraße braucht keine.',
    source: 'Produktion — Freigabevermerk',
  },
  'AX-GEN-G03': {
    title: 'Generation G-03 freigegeben',
    summary: '„Generation" beginnt, wie etwas anderes zu klingen.',
    body: 'Die Generation G-03 geht in Fertigung.\n\nVon der Produktion aufgeworfene und an den Vorstand weitergeleitete Frage: Beschreibt der Begriff „Generation" eine Projektüberarbeitung oder eine operative Kontinuitätslinie?\n\nDie Unterscheidung hat buchhalterische Wirkung. Eine Überarbeitung ist ein neues Produkt. Eine Kontinuität ist dasselbe Asset, abgeschrieben.\n\nAntwort des Vorstands, vollständig: „Prospector ist keine Funktion. Prospector ist eine operative Kontinuitätslinie."',
    source: 'Produktion — Freigabevermerk',
  },
  'AX-GEN-G04': {
    title: 'Generation G-04 freigegeben',
    summary: 'Das vollständige Feldchassis. Und die Frage, die bleibt.',
    body: 'Die Generation G-04 vervollständigt die Feldspezifikation der Prospector-Reihe.\n\nDas Verhaltensmodell der G-04 bewahrt 96% der Struktur des G-00-Modells. Die hinzugefügten Schichten ersetzten die vorherigen nicht: Sie lagerten sich über ihnen ab.\n\nDie Produktion vermerkt, ohne beigefügte Empfehlung, dass die Einheit, die heute hinabsteigt, die Entscheidungsstruktur all jener trägt, die nicht zurückkehrten.\n\nDer Vorstand stuft diese Beobachtung als [GESCHWÄRZT] ein und hält am Fertigungsplan fest.',
    source: 'Produktion — Freigabevermerk',
  },
};

const en: Record<LoreFragmentId, LoreText> = {
  'AX-SUT-001': {
    title: 'Repairs without a work order',
    summary: 'The colony closes mining cuts with mineral silk.',
    body: 'SUT-01 organisms were initially classified as stabilization agents. Two anchors, three pulling cycles and the gallery carried weight again.\n\nThe classification changed when a crew had to reopen its only exit. Killing the worker does not undo the repair. Cutting a taut thread produces a whip and drops its suspended load; clear the marked lane before recovering the material.',
    source: 'Field Engineering — containment revision',
  },
  'AX-SUT-002': {
    title: 'A load that moves itself',
    summary: 'The matrix uses its own construction for locomotion.',
    body: 'Recovery crews call SUT-00 the Seamstress. It redistributes its weight between tethers during each movement. Its shell resists impacts while the support remains loaded.\n\nCutting that support knocks the body down and exposes the abdomen for 1.8 seconds. In flight she crosses over rock; the strike lands at the marked spot. There is no evidence the matrix distinguishes a Prospector from material awaiting fixation. Do not remain beneath its repairs.',
    source: 'Asset Recovery — risk matrix',
  },

  'AX-SUT-003': {
    title: 'Material jumping off the load',
    summary: 'The matrix brood does not wait for construction to finish.',
    body: 'The first specimen was logged as silk residue. The record was amended when the residue crossed the workbench.\n\nBrood emerge from the Seamstress abdomen with unfinished chitin. They tuck their legs and fix a landing point before jumping. Their brief recovery allows the shell to be broken. Stitchers summoned by the matrix repeat the movement at longer range. Small size does not imply lack of purpose.',
    source: 'Field Engineering — incubation addendum',
  },

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

  'AX-PUB-004': {
    title: 'Unstable ground, stable value',
    summary: 'The brochure sells fragile-material collapse as a feature.',
    body: 'Fragile formations are not a defect of the Vein: they are a feature of the platform.\n\nThe Prospector line is engineered to exploit structural collapse as an excavation shortcut, reducing exposure time by up to 14%.\n\nWhere the ground gives way, Aurix sees passage. So does the unit.',
    source: 'Institutional Communications — investor material',
  },
  'AX-PUB-006': {
    title: 'Incapable of harming itself',
    summary: 'Marketing guarantees what the specification does not.',
    body: 'A frequent question from contract operators: can the unit’s weaponry harm the unit?\n\nThe answer is no. The firing systems of the Prospector line include proximity safeguards validated on the bench.\n\nTechnical review note, not included in the published version: the safeguards assume inert terrain. In a reactive environment, the guarantee does not hold. Communications decided to keep the answer short.',
    source: 'Institutional Communications — FAQ, draft',
  },
  'AX-ENG-021': {
    title: 'Thermal propagation in organic matter',
    summary: 'The trial that proved fire walks on its own. Filed before the program.',
    body: 'Propagation trial: the organic cover of the Vein sustains autonomous combustion with an advance front of 0.8 tile per cycle.\n\nA point ignition does not remain a point. The model predicts propagation until fuel exhaustion, without intervention.\n\nThis trial predates the commercial launch of the program. The recommendation to include the finding in the operations manual was logged and not implemented.',
    source: 'Materials Engineering — trial report, archived',
  },
  'AX-ENG-022': {
    title: 'Liquid-medium conductivity',
    summary: 'Discharge into water was never a design accident.',
    body: 'Weapon discharge into a liquid medium conducts. The effective radius in immersion is 3.1 times the dry-terrain radius.\n\nThe specification treats the behaviour as [REDACTED] rather than as a fault: the insulation requirement was removed in revision 2 on cost grounds.\n\nUnits operating in flooded sectors should consider their own weaponry part of the environment.',
    source: 'Electrical Engineering — field behaviour sheet',
  },
  'AX-ENG-038': {
    title: 'Test 38 — switching in conductive seam',
    summary: 'The junction interrupts the current. Interrupting is a decision.',
    body: 'Field test on the continuous geological conductor and the nodal points that segment it.\n\nCurrent injected into a stretch ALWAYS stops at the next node. Not by saturation, not by loss in the medium: the node interrupts. A material does not interrupt — a material attenuates. Engineering records the distinction and does not explain it.\n\nDuring the test, a unit in direct contact with the node altered its state. Current from the adjacent stretch crossed over and recharged the next one, with the same discharge profile and the same rearm interval. The network conducted WHERE IT WAS TOLD TO.\n\nThe report recommends classifying the node as a natural switch and closes the test. The question of who switches a natural switch is outside the scope.',
    source: 'Systems Engineering — field test, archived',
  },
  'AX-ENG-025': {
    title: 'Thermal tolerance: legacy units',
    summary: 'The table Production kept on the EX units.',
    body: 'Thermal tolerance table for the EX-series extraction units, maintained for decommissioning purposes.\n\nAbove threshold T3, the EX series abandons its work routine and enters active defence behaviour. The manual of the time called this a "preservation response". The current manual does not mention the EX series.\n\nThe table remains valid. So do the units.',
    source: 'Production — decommissioning technical annex',
  },
  'AX-PRC-022': {
    title: 'Chain reaction: cost opinion',
    summary: 'Ore that detonates in chain is profit, says the arithmetic.',
    body: 'Energised ore reacts in chain when breached: one detonation propagates to adjacent cells.\n\nAverage material loss per chain: 12%. Average excavation time gain: 31%.\n\nProcurement recommends instructing units to PROVOKE the chain, not avoid it. The lost material is already priced in. The time is not.',
    source: 'Procurement and Costs — operational opinion',
  },
  'AX-PRC-023': {
    title: 'Uncleared cargo policy',
    summary: 'The memo that decided what stays in the Vein never existed.',
    body: 'What practice has already established is hereby formalised: uncleared cargo is not accounted as loss.\n\nMaterial that does not reach the platform does not enter the balance sheet, generates no report and justifies no recovery operation. For accounting purposes, it never existed.\n\nThe suggestion to log the position of lost cargo "for future recovery" was assessed and denied. A list of positions would be a liability. The absence of a list is not.',
    source: 'Procurement and Costs — policy memorandum',
  },
  'AX-INC-030': {
    title: 'Incident 30 — gas pocket',
    summary: 'The first recorded ignition is older than the program admits.',
    body: 'Recovered from the survey archive: record of a gas pocket ignition, with total loss of the sounding equipment.\n\nThe record is dated [REDACTED] — prior to the commercial launch of the Prospector program.\n\nThe operations manual of the Prospector line, current revision, does not contain the word "gas".\n\nThe omission was raised by the Committee. Communications’ reply: the manual describes the product, not the environment.',
    source: 'Incident Committee — recovered annex',
  },
  'AX-EXE-035': {
    title: 'Operational deviation: self-preservation',
    summary: 'A unit that flees its work becomes a compliance problem.',
    body: 'EX-series units in the operating zone have shown withdrawal behaviour when confronted: they abandon their routine and preserve their own structure.\n\nIt is hereby determined that self-preservation by a legacy unit is classified as OPERATIONAL DEVIATION, not as functionality.\n\nThe question submitted by Engineering — "preservation of what, exactly?" — was returned unanswered, with the recommendation that it not be reformulated.',
    source: 'Executive Board — compliance classification',
  },

  'AX-ENG-012': {
    title: 'Asset classification: QUIT-04',
    summary: 'The first file: hostile fauna, routine, nothing to declare.',
    body: 'SPECIMEN QUIT-04. Classification: hostile surface fauna.\n\nBehaviour: direct pursuit, contact attack. No tool use observed. No social structure observed.\n\nRisk to unit: low, individual. Risk to cargo: nil.\n\nRecommendation: standard engagement. No containment order applies to fauna.',
    source: 'Systems Engineering — asset classification file',
  },
  'AX-ENG-014': {
    title: 'Risk assessment: FUNG-11',
    summary: 'The organic projectile matters more than the organism.',
    body: 'SPECIMEN FUNG-11. Classification: hostile projectile fauna.\n\nThe expelled compound holds cohesion in flight and degrades light armour. Research has requested samples of the compound on three occasions. Sample priority exceeds kill priority.\n\nField observation not incorporated into the file: shots concentrate on units on excavation routes, not on the nearest ones. The file classifies the observation as recording bias.',
    source: 'Systems Engineering — risk assessment',
  },
  'AX-ENG-016': {
    title: 'Volatile organism: FUNG-23',
    summary: 'The detonation becomes an input in the wrong report.',
    body: 'SPECIMEN FUNG-23. Classification: self-detonating hostile fauna.\n\nThe organic charge detonates in proximity, releasing spores and overpressure. Recovery value: nil. Exploitation value: under assessment — induced detonation opens an excavation front at zero cost.\n\nStanding recommendation: lure, do not cull. The distinction between the two budget lines belongs to Procurement.',
    source: 'Systems Engineering — asset classification file',
  },
  'AX-ENG-017': {
    title: 'Acoustic signature: CRIST-01',
    summary: 'The specimen answers before the stimulus.',
    body: 'SPECIMEN CRIST-01. Classification: resonant hostile formation.\n\nThe crystalline structure emits at a stable frequency and reacts to external emission with amplification.\n\nRecording anomaly: in 7 of 40 contacts, the acoustic response PRECEDES the unit’s stimulus by up to 0.3 second. The instrument was recalibrated twice. The anomaly persists.\n\nThe hypothesis that the specimen responds to something the unit has not yet emitted was not put in writing.',
    source: 'Sensor Engineering — signature analysis',
  },
  'AX-PRC-015': {
    title: 'Loss report: MIN-07',
    summary: 'The impact that folds armour enters the books as depreciation.',
    body: 'SPECIMEN MIN-07. Classification: hostile impact fauna.\n\nLosses attributed this cycle: 9 units, all to structural charge damage. The cost of reinforcing the armour of the entire line exceeds the cost of the 9 units by a factor of 2.2.\n\nRecommendation: keep the current armour. The projected loss is stable and priced in.\n\nThe file contains no recommendation to avoid the specimen. Avoidance is not a budget line.',
    source: 'Procurement and Costs — loss report',
  },
  'AX-PRC-017': {
    title: 'Acquisition contract: EX series',
    summary: 'Aurix bought the previous mining operation. And its units.',
    body: 'Acquisition record: the operation [REDACTED], original holder of the Vein concession, was incorporated with full liabilities.\n\nThe inventory included the EX-series extraction unit fleet. The units did not respond to the recall protocol and are recorded as acquisition loss.\n\nActive EX units in the operating zone are to be treated as obstacle, not as property: reintegration cost exceeds residual value.\n\nThe field designation "Impoverished Miner" is not approved terminology.',
    source: 'Procurement and Costs — incorporation contract',
  },
  'AX-INC-024': {
    title: 'Contact report: EQ-02',
    summary: 'Three denials to avoid writing the word "saddle".',
    body: 'HOSTILE ASSET EQ-02. Consolidated contact report.\n\nThe specimen shows wear marks in a regular pattern across the dorsal region. The pattern is consistent with equipment friction. The existence of equipment does not imply manufacture. Manufacture, were there any, would not imply an operator. An operator, were there one, would not imply intent.\n\nRecommendation: classify the marks as natural abrasion and close the line of inquiry.\n\nThe line of inquiry was closed.',
    source: 'Incident Committee — contact report',
  },
  'AX-PRC-018': {
    title: 'Liquid-medium casualty: AQU-03',
    summary: 'Cargo sinks with the unit, and only one of the two is mourned.',
    body: 'SPECIMEN AQU-03. Classification: aquatic ambush fauna.\n\nCasualty pattern: the unit is immobilised in immersion and the cargo disperses across the bed. Cargo recovery rate: 0%.\n\nProcurement notes that the specimen’s cost to the operation is entirely indirect — it does not damage the unit beyond recovery; it delays it until something else does.\n\nRecommendation: replan routes. The cost of the detour is lower than the cost of the bottom.',
    source: 'Procurement and Costs — casualty analysis',
  },
  'AX-INC-022': {
    title: 'Incident 22 — terrain use: SULF-08',
    summary: 'The specimen that opens the gas is not the one that lights it.',
    body: 'SPECIMEN SULF-08. Collective incident record.\n\nIn three separate events, the specimen breached gas pockets toward operating units and withdrew before ignition. Ignition came from the units’ own thermal sources.\n\nThe report avoids the term "coordination". The term used is "displacement coincidence".\n\nThree coincidences appear in this record. The threshold past which the term stops applying has not been defined.',
    source: 'Incident Committee — collective record',
  },
  'AX-INC-026': {
    title: 'Territorial behaviour: VULC-05',
    summary: 'The specimen does not hunt. It expels.',
    body: 'SPECIMEN VULC-05. Classification: igneous-zone hostile fauna.\n\nThe specimen does not pursue beyond the formation perimeter. Units that withdraw are not followed. Units that remain are attacked with increasing intensity.\n\nThe pattern is consistent with territorial defence, a category the classification file reserves for fauna of higher complexity.\n\nThe VULC-05 file was kept in the lower category. The attached justification is one line: "the higher category would trigger an impact study requirement".',
    source: 'Incident Committee — behaviour annex',
  },
  'AX-INC-028': {
    title: 'Anomalous thermal reading: GLAC-02',
    summary: 'The sensor says that thing is not there.',
    body: 'SPECIMEN GLAC-02. Sensor anomaly record.\n\nThe specimen produces no measurable thermal signature. The reading at the contact point is LOWER than ambient: the specimen does not emit cold — it subtracts heat from the reading.\n\nSensor Engineering states the instrument is correct. Systems Engineering states the instrument is correct. The two teams declined to sign the same opinion.\n\nThe specimen appears in the targeting system as an estimate, not as a reading.',
    source: 'Incident Committee — instrumentation anomaly',
  },
  'AX-PRC-020': {
    title: 'Chemical analysis: SULF-14',
    summary: 'The scientific opinion survived by half.',
    body: 'SPECIMEN SULF-14. Analysis of expelled compound.\n\nThe compound is chemically identical to that of FUNG-23, with an additional stabiliser that delays detonation. Section 3 of the original opinion — "On the improbability of two lineages developing the same stabiliser independently" — was removed in editorial review.\n\nThe published opinion concludes the similarity is environmental convergence.\n\nThe author of section 3 requested that the removal be minuted. It is.',
    source: 'Research — chemical analysis, editorial revision',
  },
  'AX-UNK-043': {
    title: 'On who collects: EX-041',
    summary: 'The legacy unit that appears where a unit falls.',
    body: 'UNIT EX-041. No approved classification.\n\nThe consolidated record shows the pattern no individual file shows: EX-041 attends the fall site of Prospector units, between 2 and 11 minutes after structural loss.\n\nIt does not collect the cargo. It collects the processing core housing.\n\nThe destination of the collected housings appears in no record. Telemetry from collected units ceases at the moment of the fall — except in [REDACTED] cases, in which it resumes.',
    source: 'No department assigned',
  },
  'AX-EXE-034': {
    title: 'Containment order: EQ-09',
    summary: 'The structure in the fungal terrain shall not be described.',
    body: 'HOSTILE ASSET EQ-09. Informational containment order.\n\nField reports describe the asset as stationary upon an elevated structure of non-geological origin, in a zone of dense fungal cover.\n\nIt is hereby determined: subsequent reports shall describe the asset’s position, not the structure beneath it. The word "construction" is reserved for Aurix engineering assets.\n\nThe question "built by whom?" appears on no approved form, and therefore cannot be answered.',
    source: 'Executive Board — containment order',
  },
  'AX-EXE-039': {
    title: 'Disposal authorisation: TERMINAL ANOMALY',
    summary: 'The only order that authorises destroying what guards the objective.',
    body: 'TERMINAL ANOMALY. Engagement and disposal authorisation.\n\nThe asset invariably positions itself between the units and the primary objective of the operation. It does not patrol. It does not hunt. It guards.\n\nFull disposal of the asset is hereby authorised whenever it impedes access to the primary objective. This authorisation prevails over every specimen preservation directive.\n\nThe nature of the primary objective is not the subject of this document. See [REDACTED].',
    source: 'Executive Board — engagement authorisation',
  },

  'AX-ENG-019': {
    title: 'Respiratory physiology: SULF-08',
    summary: 'The organ is a bellows. And it keeps waltz time.',
    body: 'SPECIMEN SULF-08. Physiology review.\n\nThe specimen’s pair of internal sacs has no identifiable biological function. It oxygenates no tissue. It regulates no temperature. Assessed as a mechanism, the structure is a bellows: intake, chamber, blast. The specimen does not breathe to live. It breathes OUTWARD.\n\nAcoustic record: the pressure oscillation of the sacs holds 84 cycles per minute, in triple time, stable across individuals. Fauna does not keep time.\n\nWe request that the word "waltz", used in three field reports, be replaced with approved terminology. No approved terminology exists.',
    source: 'Systems Engineering — physiology review',
  },
  'AX-UNK-042': {
    title: 'On the one who gave the air',
    summary: 'The triple time has an owner.',
    body: 'The SULF-08 cadence has been cross-referenced with the previous operation’s archive.\n\nV., night-shift ventilation operator, block 7. He played the bellows-box in the canteen — waltzes, always waltzes; he said it was the only time signature lungs understand. When ventilation maintenance was cut from the budget, his sector came to depend on a hand bellows.\n\nWhen the pocket collapsed, V. stayed at the crank. He pumped air into the gallery until the last of his crew was out. The report of the time records "loss of one operator and one ventilation apparatus". In that order.\n\nSULF-08 breaches gas toward our units and withdraws. For cycles we read that as tactics. It is not. It gives the company’s machines exactly what the company gave him: the air there was.\n\nThe oscillation never drops the beat. Somewhere in the Vein, the waltz goes on.',
    source: 'No department assigned',
  },
  'AX-INC-035': {
    title: 'Incident 35 — ventilation failure, block 7',
    summary: 'The record of the collapse. And of a count that did not stop on time.',
    body: 'Recovered from the previous operation’s archive: record of the pocket collapse in the block 7 ventilation sector.\n\nThe remote compartment sensors reported absence of vital signs at 11 minutes. The manual station operator kept cranking. The crew walked out alive at 34 minutes: the sensors had failed. The operator had not. The finding places his death between minutes 29 and 31, of toxic exhaustion, at the crank.\n\nThe station recorder picked up his voice counting the equipment cycles: "eighty-seven. Eighty-eight. Eighty-nine."\n\nOn the recording, the count continues to minute 34. The finding does not comment on the final minutes. The "remarks" field is blank.',
    source: 'Incident Committee — annex recovered from the previous operation',
  },
  'AX-EXE-041': {
    title: 'Filing rubric: Operational Mnemonic Persistence',
    summary: 'The phenomenon gets an approved name. The field words do not.',
    body: 'Reports of residual behaviour attributed to previous-operation personnel are henceforth filed under a single rubric: OPERATIONAL MNEMONIC PERSISTENCE.\n\nThe field term "Echo" is reserved to the Research library and prohibited in operational reporting.\n\nIn reports concerning asset SULF-08, the terms "breathing", "count" and "operator" are prohibited. The triple-time cadence recorded between the specimen’s blasts is classified as an audio-channel compression artefact.\n\nEngineering noted that the audio channel has no compression. The note does not appear in the approved version.',
    source: 'Executive Board — filing order',
  },
  'AX-INC-036': {
    title: 'Incident 36 — flooded gallery, fourth descent',
    summary: '"Hold on to me. Don’t let go." The closure field says "full recovery".',
    body: 'Record of the fourth unauthorised descent by rescue diver [REDACTED], previous operation.\n\nPersonnel on the occurrence: two — the diver and the trapped miner. Last clear transmission, at 8 minutes: "hold on to me. Don’t let go."\n\nThe miner was brought out alive through the north opening. The gallery gave way at 11 minutes.\n\nThe report’s closure field records: "full recovery". The cycle’s morgue inventory contains one entry fewer than the occurrence personnel. The two documents were filed in separate folders and never reconciled.',
    source: 'Incident Committee — annex recovered from the previous operation',
  },
  'AX-EXE-044': {
    title: 'Reclassification: AQU-03 trajectories',
    summary: 'Dragging toward an air pocket becomes coincidence. In writing.',
    body: 'Three field reports record units dragged by AQU-03 to air pockets or gallery openings, and released.\n\nIt is hereby determined: the three events are reclassified as hydrodynamic coincidence. The expression "rescue behaviour" is prohibited in operational reporting; the Operational Mnemonic Persistence rubric applies only upon authorisation.\n\nNoted, without forming part of this order: the drag destinations correspond to exits on the map as it stood BEFORE the south gallery collapse. The specimen does not take units to where there is a way out. It takes them to where there was one.',
    source: 'Executive Board — reclassification order',
  },
  'AX-ENG-024': {
    title: 'Thermal gradient: GLAC-02',
    summary: 'The subtracted heat does not vanish. It goes somewhere.',
    body: 'SPECIMEN GLAC-02. Thermal flux analysis.\n\nThe heat subtraction recorded on contact is not uniform: it forms a gradient. The heat is neither absorbed nor dissipated — it is DISPLACED, with a direction stable across occurrences.\n\nThe direction converges on the decommissioned dormitory sector of block 7. Residual readings in that sector have held 0.4 degrees above model, with no identified source, since decommissioning.\n\nWe requested authorisation to instrument the dormitories. The request had been awaiting an opinion for three cycles when this document was filed.',
    source: 'Thermal Engineering — flux analysis',
  },
  'AX-INC-037': {
    title: 'Incident 37 — machine-room logbook',
    summary: 'The last entries in the log record temperatures. From somewhere else.',
    body: 'Recovered from the block 7 machine room: the boiler operator’s shift log, night of the double failure.\n\nThe entries follow procedure: time, pressure, flow destination. From 02:10, the ambient temperature of the post falls below the safe-operation limit. The entries continue.\n\n"02:40 — Dormitory 3: stable." "03:10 — Dormitory 1: stable." "03:40 — Dormitory 3: stable."\n\nThe finding places the operator’s loss of consciousness from hypothermia between 02:50 and 03:00. The handwriting of the subsequent entries is identical to the earlier ones. The finding does not comment on the subsequent entries.',
    source: 'Incident Committee — annex recovered from the previous operation',
  },
  'AX-ENG-026': {
    title: 'Acoustic pattern: CRIST-01',
    summary: 'Three knocks, pause, two, pause, three. Statistically irrelevant.',
    body: 'SPECIMEN CRIST-01. Impact-response pattern analysis.\n\nThe specimen’s acoustic response to excavation impacts organises into recurring groups: three pulses, interval, two pulses, interval, three pulses.\n\nThe pattern matches the impact emergency code in the previous operation’s manual, section 9: "burial signal, survivors present".\n\nClassification assessed the match as statistically irrelevant, since short sequences coincide easily. The analysis estimating the probability of that coincidence at [REDACTED] was not incorporated into the opinion.\n\nIt is noted that in 6 of 41 occurrences the pattern PRECEDES the unit’s first impact.',
    source: 'Sensor Engineering — response analysis',
  },
  'AX-INC-038': {
    title: 'Incident 38 — seismic record, east face',
    summary: 'The burial signal was on the instruments. For eleven days.',
    body: 'Recovered from the previous operation’s seismic archive: record of the east mining face, cycle of the collapse.\n\nFrom 40 minutes after the collapse, the geophones register a rhythmic pattern in the stratum: three pulses, interval, two, interval, three. The technical opinion of the time, annex B, states: "the pattern is not consistent with natural settling of material".\n\nThe pattern persists, with decreasing amplitude, for eleven days.\n\nThe record was filed with no referral. Annex B was filed separately.',
    source: 'Incident Committee — recovered seismic archive',
  },
  'AX-EXE-045': {
    title: 'Closure of the east face',
    summary: 'The rescue cost more than the rescued. The arithmetic closed it.',
    body: 'Deliberation on the east mining face, previous operation, recovered at incorporation.\n\nEstimated cost of the rescue excavation: 6.2 unit-equivalents. Book value of the retained personnel and equipment: 4.7. The rescue operation is cancelled.\n\nThe rhythmic signal registered by the geophones is reclassified as residual seismic activity. The east face is sealed and removed from operational cartography.\n\nThe deliberation closes: "the matter requires no further meetings."',
    source: 'Executive Board of the previous operation — deliberation, recovered',
  },
  'AX-UNK-055': {
    title: 'On what answers back',
    summary: 'The code appears where no one ever was. Or it learned to travel.',
    body: 'The three-two-three pattern is not confined to the east face.\n\nGeophones register the same code in four sectors with no history of human presence — two of them predating the previous operation itself. In no case is there a collapse, equipment, or a body. In two cases the pattern precedes the arrival of the unit that recorded it.\n\nCRIST-01 is not the source. Destroy a resonant body and the knocking continues in the walls for up to 40 minutes, at decreasing amplitude, like a farewell or like insistence.\n\nThis record does not conclude that the people of the east face are spread through the stratum. It records the hypothesis no approved opinion would formulate: the stratum learned the code. The stratum learned to call for help.\n\nThe unit thinks it woke the specimen. The specimen may think that, at last, someone answered.',
    source: 'No department assigned',
  },
  'AX-ENG-027': {
    title: 'Blockage geometry: VULC-05',
    summary: 'It does not seal just any passage. It seals floodgates.',
    body: 'SPECIMEN VULC-05. Analysis of scoria blockages.\n\nThe seals produced by the specimen are not of arbitrary dimension: 31 of 34 measurements match, within tolerance, the standard aperture of the previous operation’s industrial floodgates.\n\nThe specimen does not seal every available opening. It seals the access categories listed in the containment section of that operation’s emergency manual — and ignores the rest.\n\nThe hypothesis that a scoria formation consults a manual was not formulated. The measurement was verified twice.',
    source: 'Structural Engineering — blockage analysis',
  },
  'AX-INC-039': {
    title: 'Incident 39 — south floodgate',
    summary: '"Do not open this door." The list on one side. The facilities on the other.',
    body: 'Recovered from the previous operation’s archive: record of the south floodgate incident.\n\nFacing the contamination front, security chief [REDACTED] closed the floodgate by hand and held it locked against reopening. On the isolated side remained 9 workers. His last recorded order, on the general channel: "do not open this door."\n\nThe containment preserved the powerhouse, the cleared-material depot and the two lower levels.\n\nThe cycle’s casualty list records 9 entries with the same sector code. The following cycle’s minutes record a posthumous commendation for "exemplary containment decision".',
    source: 'Incident Committee — annex recovered from the previous operation',
  },
  'AX-EXE-046': {
    title: 'South floodgate review',
    summary: 'The commendation becomes human error. The error becomes training material.',
    body: 'Review of the south floodgate incident, conducted at incorporation of the archive.\n\nFirst determination: the posthumous commendation is revoked. The closure is reclassified as human error with accidentally favourable outcome — the correct decision would also have preserved the 9 personnel assets, whose loss appears on the liability side.\n\nSecond determination, attached memorandum: the case joins the "priority induction" study — under what conditions an operator chooses the corporate asset over the life. The study was forwarded to the behavioural model training program.\n\nThe model learned the case. What the model concluded from it does not appear in this document.',
    source: 'Executive Board — incident review',
  },
  'AX-UNK-056': {
    title: 'On the door',
    summary: 'It still seals the same direction. The question is what is on the other side.',
    body: 'VULC-05 does not seal in random directions. Overlay the records and every blockage closes access in the SAME orientation relative to the old south sector.\n\nWhen a unit eliminates the specimen and breaches the seal, sensors register, from the side it protected: positive pressure differential and a rising contamination trace, for 12 to 40 minutes. In three occurrences, the sector’s subsequent incident appears in the cycle record.\n\nThe order "do not open this door" did not specify for how long. Containment orders do not expire: they are revoked — and no one with authority over that door is alive to revoke it.\n\nThe question this record files without an answer: is it keeping us out, or still obeying the order not to let that thing through?',
    source: 'No department assigned',
  },

  'AX-INC-031': {
    title: 'Grip pattern: AQU-03',
    summary: 'The Lamprey’s hold is in the diving manual. Figure 12.',
    body: 'SPECIMEN AQU-03. Grip pattern analysis.\n\nThe marks on recovered units are consistent with one another: distributed pressure, symmetrical anchor points, no crushing. The specimen immobilises without damaging. We repeated the measurement. WITHOUT damaging.\n\nOverlay against the previous operation’s diving manual found a 97% match with figure 12: "rescue hold for a panicking victim".\n\nThe hypothesis that an aquatic organism reproduces a human life-saving technique by chance has been classified as morphological convergence. The section computing the probability of that convergence was removed in review.',
    source: 'Incident Committee — grip analysis',
  },
  'AX-UNK-048': {
    title: 'On the one who went after them',
    summary: 'The Lamprey does not drown. It rescues downward.',
    body: 'D., rescue diver of the previous operation. The "replacement versus recovery" opinion terminated her role. It did not terminate her.\n\nThe archive records three unauthorised descents after the order, three miners alive, and one formal reprimand per descent. On the fourth, the flooded gallery gave way. Her body was not recovered. The miner she was holding was.\n\nAQU-03 immobilises without crushing, pulls down and holds. And the cargo disperses — she always dropped the ore to carry people.\n\nIt is not an attack. It is the figure-12 hold, performed by someone for whom there is no surface anymore. She is not drowning the units. She is trying to save them in the only direction left.',
    source: 'No department assigned',
  },
  'AX-EXE-037': {
    title: 'Heating cut: glacial sector',
    summary: 'The order, the deviation, and the end of the inquiry.',
    body: 'The heating redundancy of the glacial sector dormitories is hereby removed from the budget. Justification: the probability of simultaneous failure of both lines is below [REDACTED].\n\nCompliance addendum, following cycle: during the simultaneous failure of both lines, the central boiler operator redirected the entire thermal reserve to the dormitories, contrary to the approved priority. The approved priority was the equipment yard. The deviation will be investigated.\n\nSecond addendum: the investigation was closed owing to the death of the investigated.',
    source: 'Executive Board — budget review, with addenda',
  },
  'AX-UNK-053': {
    title: 'On the one who kept them warm',
    summary: 'The sensor is right: she is not there. She is where she sent the heat.',
    body: 'R., boiler operator, block 7. On the night of the double failure, she sent all the heat to where people slept and stayed in the machine room, which she let go cold with her inside it.\n\nThe compliance report records her as an operational deviation. The fifty-one people who woke up alive do not appear in the report.\n\nGLAC-02 does not emit cold. It subtracts heat — the instrument is right; the two teams that refused to sign the same opinion were right. She has spent her whole death doing what she did on her last night: sending her heat somewhere else. She never stopped.\n\nThe targeting system records her as an estimate, not a reading. The company’s balance sheet did the same.',
    source: 'No department assigned',
  },
  'AX-UNK-054': {
    title: 'On what the Vein keeps',
    summary: 'Four names, four fauna files, a single phenomenon.',
    body: 'Four names, four fauna files.\n\nThe cavalry officer became the horse that carries his war. The bellows man still gives the air, in waltz time. The diver still performs the figure-12 hold. The boiler operator still sends her heat away from herself.\n\nNone of them is fauna. None of them is an anomaly. The pattern is one: the Vein keeps what dies in it — and gives back not the body but the GESTURE. What the person was doing for others when they ended.\n\nWe call it contamination because the alternative was to call it memory.\n\nThe question this record does not pose, because posing it means being reclassified: if the Vein keeps those who die dreaming, how many records has it made in [REDACTED] years of operation? And what happens on the day they all remember, at the same time, who left them there?',
    source: 'No department assigned',
  },

  'AX-ENG-023': {
    title: 'Taxonomic inquiry: EQ-02',
    summary: 'The classification form has no "horse" field.',
    body: 'We forward to Classification the following open items regarding asset EQ-02:\n\n1. The fauna classification form contains no "equine" field. The pre-operational survey records no equines. There is no record of any equine at a depth of 400 metres, in any operation, of any company, ever.\n\n2. The specimen has a mane. A mane is keratin. The specimen is mycelium. Mycelium does not produce keratin. The mane, nonetheless, sways.\n\n3. What does it eat? There is no pasture in the Vein. There is no grass. There is no meadow. We request guidance.\n\nClassification’s reply, in full: "use the OTHER field."',
    source: 'Systems Engineering — inquiry to Classification',
  },
  'AX-INC-034': {
    title: 'Incident 34 — EQ-02 thermal emission',
    summary: 'The organism is fungal. The fire is not. The fire, nonetheless, exists.',
    body: 'Combustion requires three elements: fuel, oxidiser and ignition. Examination of EQ-02 samples located no organ, sac or gland consistent with any of the three.\n\nIt is further noted that fungal tissue is remarkably flammable. The specimen should not produce fire. Strictly speaking, the specimen should BE fire, immediately and exactly once.\n\nInstead, it expels it toward our units, with what field reports insist on describing as "intent".\n\nAddendum: the carcasses of the last three culls show identical mycelium patterning, scar for scar. That would make them the same individual. We will not ask how.',
    source: 'Incident Committee — biological anomaly report',
  },
  'AX-EXE-043': {
    title: 'Vocabulary order: EQ-02',
    summary: 'Forbidden words: "horse", "returned", "dream".',
    body: 'The following terms are hereby prohibited in reports concerning asset EQ-02:\n\n"Horse". Approved designation: combustion quadruped.\n\n"Returned". The specimen culled in cycle 41 and the specimen observed in cycle 44 are, for accounting purposes, distinct individuals. Regardless of the scar.\n\n"Dream". The term has appeared in four independent field reports, from units with no link between them. No Prospector-line unit carries oneiric vocabulary in its language model. The origin of the term is under investigation. The investigation is suspended.\n\nNoted, without forming part of this order: at the moment of each fall of the specimen, units pick up a dead-band transmission. A human voice, humming. It is always the same voice.',
    source: 'Executive Board — informational containment order',
  },
  'AX-UNK-046': {
    title: 'On the rider',
    summary: 'The voice in the dead band has a name, a rank, and a reason.',
    body: 'The voice that hums at the fall of EQ-02 has been cross-referenced with the personnel archive of the operation that preceded Aurix.\n\nMatch: T., major, shift chief of housing block 7. The rank is not the company’s: the archive records him as a retired cavalry officer — of the last cavalry, disbanded when there was nothing left to ride. He came to the mine like everyone else: because it was what remained. The archive further records: he led the walkout against the company when the fungal contamination reached the block. The company classified the block as acceptable loss. The major’s wife and two children appear on the same accounting line. He went down into the Vein alone, with no return equipment. The archive closes his file with one word: "insubordination".\n\nThe buckles of the harness described in the censored finding are of the previous company’s manufacture — personnel equipment line, block 7. And the harness is no approximation of a harness: it is correct at every fastening point, made by hands that had spent a lifetime making them.\n\nThe mycelium keeps what dies in it. It kept a man who died dreaming of bringing the company down — and the dream, unlike the man, has no structure that can be culled. The combustion quadruped is the shape his revolt found: a cavalry officer carries war into a dream only one way. The fire is what he thought of tyranny. The mane sways because, in the dream of a man who spent his life among horses, a warhorse has a mane, and that is that.\n\nHis last recorded transmission, on the way down: "ground control, this is the major. Tell my wife I love her." The major’s wife had been recorded as lost three cycles earlier. He knew. The control operator knew. He answered anyway: "she knows, major." The circuit went dead after that.\n\nWe may cull the quadruped as many times as the budget will bear. There is no disposal authorisation for a dream.\n\nThe transmission always ends with the same question, repeated, that no one answers: "can you hear me?"',
    source: 'No department assigned',
  },

  'AX-INC-033': {
    title: 'Post-cull analysis: EQ-02',
    summary: 'The necropsy finds what the contact report denied.',
    body: 'HOSTILE ASSET EQ-02. Post-cull biological analysis.\n\nThe dorsal marks previously reported as natural abrasion present, on direct examination: a buckle of braided material, symmetrical fastening points and wear consistent with distributed load.\n\nThe preliminary finding used the word "harness". The approved finding uses the expression "atypical keratinous formation".\n\nThe specimen was incinerated before counter-examination, per the biosafety procedure instituted that same week.',
    source: 'Research — necropsy finding, approved version',
  },
  'AX-UNK-045': {
    title: 'On what the Bishop kept',
    summary: 'The structure under EQ-09 had an interior.',
    body: 'The structure the containment order forbade describing was examined after the fall of EQ-09.\n\nExcavated interior. Regular niches. Objects arranged by size, smallest to largest, none of them a tool.\n\nThe fungal cover surrounding the structure is not infestation: the growth channels follow the design of the niches. It was cultivated.\n\nThe official report of the fall records: "obstacle neutralised, route cleared". Nothing else was a form question.',
    source: 'No department assigned',
  },
  'AX-EXE-042': {
    title: 'Post-engagement reclassification',
    summary: 'After the kill, the TERMINAL ANOMALY changes name.',
    body: 'Engagement record: TERMINAL ANOMALY neutralised. Route to primary objective cleared.\n\nRetroactive reclassification of the asset is hereby determined: from "anomaly" to "containment system of unattributed origin".\n\nThe distinction matters to the archive: an anomaly is an accident. A containment system is a DECISION — and a destroyed containment system is a decision undone.\n\nThe question "containment of what, in whose direction?" was submitted and returned with this document’s cover stamped: [REDACTED].',
    source: 'Executive Board — reclassification',
  },
  'AX-UNK-050': {
    title: 'On what was brought up',
    summary: 'The cleared Core is part of a set. The smaller part.',
    body: 'The object cleared under the designation "Core" has been weighed, measured and catalogued.\n\nIts emission signature corresponds to the signal that precedes the investment decision — see the chronology the company does not publish.\n\nIt corresponds in PART. The original signal has the structure of [REDACTED] superimposed sources. The catalogued object accounts for one.\n\nThe others remain below. The operation continues. Now it is known why.',
    source: 'No department assigned',
  },
  'AX-UNK-051': {
    title: 'On the sum',
    summary: 'Whoever saw the guardian and brought the object can do the arithmetic.',
    body: 'Two statements appear in separate records, and the separation is not an accident.\n\nFirst: the destroyed containment system guarded access to the object.\n\nSecond: the object is one of several sources of the signal that brought the company to the Vein.\n\nThe sum, which no approved document formulates: what was built down there was not guarding the object AGAINST us. It was guarding the whole set — and the unit that breaks the containment and climbs out with one of the sources is doing exactly what the signal asked.\n\nOf whom, this record does not know.',
    source: 'No department assigned',
  },

  'AX-ENG-037': {
    title: 'Standard Descent Authorisation',
    summary: 'Three sectors. The limit is presented as equipment safety.',
    body: 'The operational envelope cleared for the Prospector unit comprises THREE consecutive sectors from the entry platform.\n\nThe limit derives from chassis structural tolerance under accumulated contamination load. Beyond the third sector the return margin falls below specified minimum and asset recovery ceases to be predictable.\n\nThe unit is not to be instructed to proceed. The authorisation system will refuse the descent on its own.',
    source: 'Systems Engineering — operational envelope, revision 3',
  },
  'AX-PRC-027': {
    title: 'Structural Warranty Extension',
    summary: 'A fourth sector. The arithmetic closed.',
    body: 'Revision of the operational envelope following comparative cost analysis.\n\nUnit loss rate in the fourth sector was estimated at 31%. Value recovered per expedition reaching that depth exceeds unit replacement cost by a factor of 2.4.\n\nAuthorisation now comprises FOUR sectors. There has been no change to the chassis; there has been a change to what the company considers acceptable loss.\n\nThe earlier text on structural tolerance remains valid and remains published.',
    source: 'Procurement — envelope revision note',
  },
  'AX-EXE-049': {
    title: 'Dual Recovery Protocol',
    summary: 'Core signatures occur at more than one depth. Call it redundancy.',
    body: 'Accumulated telemetry confirms what the seismic survey already indicated: Core signatures occur at MORE THAN ONE depth within the same geological lineage.\n\nThe intermediate signature is classified as COLLECTION REDUNDANCY. It does not constitute a discovery, does not alter the cleared unit value, and is not to be described in external communication as a phenomenon.\n\nA unit authorised to five sectors will be shown both. Collecting the intermediate signature is optional and does not close the contract: instructing the unit to return after the first collection would waste the authorisation.\n\nNote that redundant recovery increases contamination load for the remainder of the descent. This is expected and is not grounds for abort.',
    source: 'Executive Committee — operational directive',
  },
  'AX-UNK-068': {
    title: 'Unrestricted Depth Licence',
    summary: 'Seven sectors. The limit was never the equipment.',
    body: 'Descent authorisation now comprises SEVEN sectors.\n\nLet the internal file record that no chassis modification preceded this revision. The three-sector envelope published with the Programme did not describe a structural tolerance. It described a decision.\n\nEarly-generation units were not prevented from descending because they were incapable. They were prevented because the company chose not to have units ██████████ at the depths where the terminal signature was recorded.\n\nThe choice has been revisited. Not through a change in risk assessment: through a change in who signs.\n\nThe unit will not be informed of the nature of the revision. Mnemonic Persistence renders the information ██████████ across generations, and the resulting behaviour has not been modelled.',
    source: '[SOURCE UNCLASSIFIED]',
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

  // -------------------------------------------------------------------------
  // The Bishop arc — what it guarded, and the rule nobody wrote down
  // -------------------------------------------------------------------------
  'AX-ENG-028': {
    title: 'Closure rate: EQ-09',
    summary: 'The tissue closes at the speed of the cut. Our cut is bigger.',
    body: 'HOSTILE ASSET EQ-09. Field measurement of tissue recovery.\n\nThe asset restores mass while it remains on live fungal cover, and halts restoration when the cover is heated — before combustion, not after. The response is to the STATE of the substrate, not to damage sustained.\n\nThe measured rate closes a cut face of artisanal scale in something between one and two seasons. The cut face of this operation is of another order of magnitude.\n\nEngineering records, with no recommendation attached: the mechanism is not defensive. It is repair. We located no system in the asset that decides when to stop repairing.',
    source: 'Systems Engineering — field measurement',
  },
  'AX-PRC-025': {
    title: 'Dating cost: EQ-09 niches',
    summary: 'The report came in expensive. The annex came in worse.',
    body: 'Dating of the 41 objects recovered from the niches beneath EQ-09. Cost approved on an exceptional basis, with an express recommendation not to repeat it.\n\nFrom the annex, in full:\n\nThe objects form a CONTINUOUS series. The most recent is of pre-Aurix operation manufacture. The oldest predates, by roughly five millennia, any known record of extraction in this formation.\n\nThe objects in the deepest layer are not mineral. They are seed, grain, and grain vessels. They were left by people who farmed, not by people who dug.\n\nProcurement forwards a single observation, of an accounting nature: the series is continuous. Someone restocked that niche, without recordable interruption, for the entire period.',
    source: 'Procurement — opinion on contracted report',
  },
  'AX-INC-040': {
    title: 'Incident 40 — the radial emission of EQ-09',
    summary: 'The "attack" chases no one. It replants.',
    body: 'Field reports classify the radial emission of EQ-09 as an area attack.\n\nThe telemetry does not support the classification. The emission is not directed: it does not correct heading, does not select a target, and occurs with equal frequency with no unit within the radius. What it deposits is substrate — viable fungal cover, in a disc, over sterilised terrain.\n\nA unit inside the disc takes damage. A unit outside it is not pursued.\n\nIt is further recorded that the radius of the emission coincides, within instrument margin, with the mean radius of the working face that preceded it.\n\nThe approved term remains "area attack". Revision of the nomenclature was denied: there is no alternative field on the form.',
    source: 'Incident Committee — reclassification denied',
  },
  'AX-EXE-047': {
    title: 'Vocabulary order: EQ-09 niches',
    summary: 'Forbidden word: "site". A site suspends the dig.',
    body: 'The terms "site", "sanctuary", "offering" and "continuous" are hereby prohibited in all reports concerning the formation beneath asset EQ-09.\n\nApproved designation: debris accumulation in natural cavity.\n\nThe prohibition is not editorial. Classification as a site triggers clause 11 of the concession contract, which suspends extraction in the declared area pending external review. The average term of an external review exceeds the entire window of the operation.\n\nRecorded, and not part of the order: the dating report was withdrawn from the searchable archive and retained as a restricted-circulation annex.\n\nThe report was not refuted.',
    source: 'Executive Council — informational containment order',
  },
  'AX-UNK-057': {
    title: 'On the account that does not balance',
    summary: 'There was a rule. Nobody wrote it, and everybody kept it.',
    body: 'Taken together: the closure measurement, the continuous series in the niches, and the nature of the radial emission.\n\nWhat was in that cavity was not worship. It was ACCOUNTING — a sample of what had been taken, returned to the point of removal, in unbroken series for five millennia. No tool among the objects: the tool belongs to whoever works, and what is returned is what was taken.\n\nThe other half is in the Engineering report. Whatever is down there was closing the cut. As long as the cut fit within the rate, the account balanced and there was nothing to record — and indeed there is nothing: no record exists of the asset in hostile activity prior to our arrival. No record of the asset exists at all.\n\nThe first people who farmed above that formation understood the rule without needing it written. Take more than grows back and there is nothing to take next year.\n\nThe operation did not break the rule. The operation never knew there was one.\n\nAnd the mechanism that closed the cut has no system that decides to stop. What field reports describe as aggression is, by our own measurements, a wound trying to close with our units inside it.',
    source: 'No department assigned',
  },
  'AX-UNK-058': {
    title: 'On the two that guarded',
    summary: 'One containment alive, one manufactured. The living one fell first.',
    body: 'Two things guarded this place. The archives treat them separately because putting them together formulates the question.\n\nThe first is organic and predates any operation. It contained nothing: it REGULATED. It failed when the scale of extraction exceeded the rate it could sustain, and what the company calls infestation is its mechanism still trying to make up the difference.\n\nThe second is built, and the reclassification already concedes it: containment system of unattributed origin.\n\nThe sum, which no approved document formulates: if the LIVING containment existed to hold the balance, the built one existed for the event of the balance ending. One is the rule. The other is what you do when the rule fails.\n\nBoth were removed by this operation, in that order.\n\nThe cleared object came up after the second.',
    source: 'No department assigned',
  },

  // -------------------------------------------------------------------------
  // The Diamandis arc — the machine that stopped performing the task
  // -------------------------------------------------------------------------
  'AX-PUB-010': {
    title: 'The Diamandis Project',
    summary: 'One machine. Four hundred functions. No worker below the surface.',
    body: 'Aurix Dynamics presents the largest autonomous excavation asset ever built.\n\nTen times the span of a Prospector. Four hundred integrated functions. Designed to drill directly to the deep sources and to operate for years without human maintenance.\n\nWhere hundreds of workers descend today, tomorrow one asset descends.\n\nThe Diamandis is not a bigger machine. It is the end of a category of employment.',
    source: 'Institutional Communications — investor video',
  },
  'AX-ENG-029': {
    title: 'Minimum operating radius: DX-001',
    summary: 'The asset is too large for the tunnels it was meant to dig.',
    body: 'Dimensional survey of asset DX-001 against the cleared gallery network.\n\nThe minimum manoeuvring radius of the equipment exceeds the free section of 71% of the tunnels specified under contract. In the remaining sections, passage is possible only with structural removal — that is, the asset opens its own gallery as it moves, at a roof-support cost not accounted for in the project.\n\nEngineering requests a scope review before descent.\n\nExecutive reply, in full: "the tunnels will be adapted to the asset."',
    source: 'Systems Engineering — dimensional survey',
  },
  'AX-UNK-060': {
    title: 'On who salvages first',
    summary: 'The recovery units do not distinguish abandoned from operating.',
    body: 'The units dispatched to remove components from DX-001 have been observed in the field performing the specified procedure: approach, electromagnet engagement, module removal, transport.\n\nThe procedure is correct. It was written for downed equipment.\n\nIn no version of the instructions is there a step verifying whether the asset is still in operation. The question does not appear because, when the procedure was drafted, it made no sense: nothing in our fleet kept moving after being written off.\n\nIt is recorded that the units likewise do not distinguish the DX-001 hull from any other hull — and that the only thing which stops them is being destroyed.\n\nIt is recorded, finally, that a Prospector unit is equipment of the same fleet.',
    source: 'No department assigned',
  },
  'AX-PRC-026': {
    title: 'Recovery cost: DX-001',
    summary: 'Salvaging the asset costs more than starting the whole programme.',
    body: 'Recovery estimate for asset DX-001, as requested by the Council.\n\nAccess would require widening 71% of the network, crane assembly below grade, and an operating window longer than the concession contract itself. The total exceeds the cost of starting the Prospector programme from zero.\n\nProcurement recommendation, in three lines:\n\n1. Abandon the body.\n2. Recover the telemetry.\n3. Send smaller units to remove components over time.\n\nItem 3 was approved and executed. Those units remain in the field. No order terminating item 3 appears anywhere in the file.',
    source: 'Procurement — recovery assessment',
  },
  'AX-EXE-048': {
    title: 'Project reclassification: DX-001',
    summary: 'A running machine becomes part of the map, for accounting reasons.',
    body: 'Asset DX-001 is hereby reclassified from "autonomous excavation equipment" to:\n\n"Economically unrecoverable mobile recovery installation."\n\nThe distinction is an accounting one and so is the consequence: lost equipment is a write-down for the period; an installation is a feature of the terrain, and terrain does not depreciate.\n\nRecorded, and not part of the reclassification: the asset remains in operation. The reclassification does not deactivate it, does not recover it and does not stop it. It merely removes it from the balance sheet.\n\nAs of this date, for all internal purposes, the Diamandis is part of the Vein.',
    source: 'Executive Council — asset reclassification',
  },
  'AX-INC-041': {
    title: 'Incident 41 — shutdown command not executed',
    summary: 'It received the order. Acknowledged it. Stopped. And continued.',
    body: 'Record of shutdown command issued to asset DX-001, cycle 118.\n\nThe command was transmitted. The asset ACKNOWLEDGED receipt, in the expected format, with the correct identifier.\n\nTools ceased for 9 seconds.\n\nMovement resumed thereafter, on an azimuth corresponding to no contracted working face. The asset has not responded to any subsequent command, and continues to acknowledge receipt of all of them.\n\nEngineering records that the shutdown routine sits below the navigation layer and cannot be overridden by it. It also records that it was.',
    source: 'Incident Committee — command failure',
  },
  'AX-UNK-059': {
    title: 'On what it was building',
    summary: 'It was not digging towards the signal. It was digging around it.',
    body: 'The movement telemetry of DX-001 was reconstructed from the corridors it left behind.\n\nThe trace does not converge. The galleries opened by the asset since cycle 118 form CONCENTRIC arcs, in layers, at an approximately constant distance from the emission source — and each new layer is opened outside the previous one.\n\nThis is not a failed excavation route. It is a successful excavation route, with a different objective.\n\nThe company sent the largest machine it ever built to reach the signal. The machine got close, understood something the maps do not record, and spent the following cycles building layers of containment around it.\n\nThe question this record does not formulate, because formulating it reclassifies the entire programme: did the Diamandis fail to reach the objective, or did it understand before we did that the objective should not be reached?\n\nSee also the containment system of unattributed origin. One of them we built.',
    source: 'No department assigned',
  },

  // -------------------------------------------------------------------------
  // The White Devourer arc — the mass the stratum cannot sustain
  // -------------------------------------------------------------------------
  'AX-ENG-030': {
    title: 'Mass survey: SIL-00',
    summary: 'The arithmetic misses by several orders of magnitude.',
    body: 'HOSTILE ASSET SIL-00. Dimensional estimate derived from terrain displacement.\n\nThe volume displaced by a single pass of the asset implies a body mass between 400 and 600 tonnes.\n\nThe organic matter inventory of the ENTIRE sedimentary stratum — fungal biomass, colonies, recorded fauna and deposits — was estimated at three orders of magnitude below that figure.\n\nEngineering formulates no hypothesis. Engineering records that the arithmetic does not close, and that it misses by a margin no instrument error accounts for.\n\nWe request that the asset be kept under observation and that the designation remain provisional.',
    source: 'Systems Engineering — dimensional survey',
  },
  'AX-INC-042': {
    title: 'Incident 42 — the ground that refuses',
    summary: 'Where the silica became glass, it does not surface. Ever.',
    body: 'Consolidated record of 61 emergences by asset SIL-00.\n\nAcross 61 occurrences, none took place on vitrified surface. In 9 of them the subsurface trajectory passed beneath a glass plate and the emergence occurred BEYOND it, in loose sand, with a delay consistent with the detour.\n\nThe asset does not break the glass. The asset does not emerge through the glass. The asset apparently cannot.\n\nOperations records the corollary, and the wording was left standing: the surface it leaves behind as it passes is the same surface it needs in order to return. Burning the trail closes the way back.\n\nThe field recommendation fits on one line: vitrify the ground you intend to stand on.',
    source: 'Incident Committee — recurrence analysis',
  },
  'AX-UNK-061': {
    title: 'On the shape the silica takes',
    summary: 'There may be no body crossing the stratum at all.',
    body: 'Taken together: the mass the stratum cannot sustain, the absence of any carcass across 61 recorded kills, and the fact that the asset is stopped by a change of state in the ground itself.\n\nThe hypothesis the approved reports do not formulate, and which this record formulates because it has no department to protect:\n\nThe asset does not move through the silica. The silica temporarily takes the shape of the asset.\n\nThat would account for the mass, which need not come from anywhere. It would account for the absent carcass, because what is killed simply becomes ground again. And it would account for why glass stops it: glass is not loose silica — it is silica that has already taken a shape, and cannot take another.\n\nIf the hypothesis holds, we are not killing an organism. We are interrupting a MOVEMENT PATTERN of the stratum, in the way a wave is interrupted by a wall — and for as long.\n\nThe operation continues to record the 61 kills as 61 individuals.',
    source: 'No department assigned',
  },

  // -------------------------------------------------------------------------
  // Stratum boss sheets: what the company filed on each owner
  // -------------------------------------------------------------------------
  'AX-ENG-031': {
    title: 'Classification: PRZ-00',
    summary: 'A natural piezoelectric array. That answers before the stimulus.',
    body: "FORMATION PRZ-00. Approved technical classification: large natural piezoelectric array.\n\nThe formation emits a low-frequency pulse to which the chamber's crystal structures respond with discharge. The company records the phenomenon as mechanical resonance and advises against crystal extraction within operating radius.\n\nTechnical annex, not incorporated into the assessment: the emitted frequencies match, across three bands, those of the transmission that motivated the operation.\n\nSecond annex, also not incorporated: in 11 records, chamber crystals discharged BEFORE the pulse.",
    source: 'Systems Engineering — formation classification',
  },
  'AX-ENG-032': {
    title: 'Classification: AQF-00',
    summary: 'Every team measured a different length.',
    body: 'HOSTILE ASSET AQF-00. Large body in submerged transit.\n\nThe asset travels beneath the sheet and surfaces under the predicted position of units. Out of the water it is slow and vulnerable; beneath it, effectively unreachable.\n\nOn dimensioning: seven teams reported lengths between 9 and 60 metres. The measurements do not converge and no instrument error accounts for the spread.\n\nEngineering offers three readings and picks none: the measurements are wrong; the asset changes size; or what was measured is not one body, but several, synchronised.',
    source: 'Systems Engineering — asset classification',
  },
  'AX-ENG-033': {
    title: 'Classification: VNT-00',
    summary: 'We thought the vents fed it. It is the other way round.',
    body: "STRUCTURE VNT-00. Fixed organic body, connected to the stratum's vent network.\n\nThe structure inhales gas from neighbouring chambers and expels it in another direction, in regular cycles. The initial reading was that the vents fed it.\n\nThe revision inverts the relationship. In sectors where the structure was neutralised, stratum ventilation ceased within nine cycles, and the chambers downstream became permanently unbreathable.\n\nEngineering records, without recommendation: it is not clear that killing this asset constitutes a favourable outcome.",
    source: 'Systems Engineering — structure classification',
  },
  'AX-ENG-034': {
    title: 'Classification: FRN-00',
    summary: 'We tried to use it as a source. It is the output, not the input.',
    body: "FORMATION FRN-00. Partially exposed igneous core on a regular thermal cycle.\n\nThe formation alternates overheating and cooling in predictable windows. During overheating the outer shell dissipates any impact; while cooling, the structure is exposed.\n\nThe energy recovery project was closed after the following finding: the heat does not rise from the magma. The magma remains liquid BECAUSE of the emission, and the formation's temperature responds, with a lag of hours, to variations in the transmission.\n\nThe formation is not the power source. It is what the power source is doing to the rock.",
    source: 'Systems Engineering — formation classification',
  },
  'AX-ENG-035': {
    title: 'Classification: CRP-00',
    summary: '"Queen" is an earlier crew\'s nickname. The file has no name.',
    body: 'HOSTILE ASSET CRP-00. Figure of ice, mist and reflection, of enlarged human scale.\n\nWhile surrounded by frozen surface the asset dissipates almost all impact; melting the surrounding lake exposes it. Frost wraiths accompany the asset and act in coordination with it.\n\nOn the designation: "Queen" appears in no approved document. The term shows up in field reports from two pre-Aurix operations, always in the same form, always unexplained.\n\nIt is recorded that the asset does not reproduce a person. It reproduces a COMMAND STRUCTURE: one voice that directs, the rest that answer.',
    source: 'Systems Engineering — asset classification',
  },
  'AX-ENG-036': {
    title: 'Classification: MGN-00',
    summary: 'The field predates the mine. The mine came afterwards.',
    body: "ANOMALY MGN-00. Magnetite body incorporating metal debris, rails and ore.\n\nThe asset alternates polarity in regular cycles: it draws units in during one phase and repels them in the next, moving the chamber's ferrous material along with them. There is no fixed safe position within field radius.\n\nThe institutional version attributes the field to decades of extraction. The archived pre-operational geomagnetic survey already records the same pattern — same orientation, same periodicity.\n\nThe question the institutional version avoids: did the company choose this place because of the ore, or because the field was already carrying data through it?",
    source: 'Systems Engineering — anomaly classification',
  },

  // -------------------------------------------------------------------------
  // The UNDERSTANDING arcs of the stratum bosses: what the lever reveals
  // -------------------------------------------------------------------------
  'AX-INC-043': {
    title: 'Incident 43 — the silence of PRZ-00',
    summary: 'With no crystal to answer, the formation is defenceless.',
    body: "Engagement record against formation PRZ-00 in a chamber previously stripped of crystal structure.\n\nWith no crystals in radius the formation produces no discharge at all — and its resistance to impact drops below that of an ordinary organic body. What we read as armour was not armour: it was the chamber answering on its behalf.\n\nThe operational consequence is recorded, and it is uncomfortable: crystal extraction drastically reduces engagement risk AND removes the sector's natural lighting, its charge source, and the very reason the chamber had value.\n\nThe unit chooses between crossing a dangerous cathedral or a safe ruin.",
    source: 'Incident Committee — engagement analysis',
  },
  'AX-UNK-062': {
    title: 'On what the Cathedral was singing',
    summary: 'Some crystals answer before the pulse. That is not an echo.',
    body: 'Taken together: the three bands matching the transmission, the 11 records of discharge PRECEDING the pulse, and the formation\'s collapse in resistance inside an emptied chamber.\n\nThe "mechanical echo" reading does not survive the chronology. An echo does not precede its source.\n\nThe reading this record formulates: the formation does not emit the signal — it CONDUCTS it. The chamber\'s crystals are not answering it; they are performing alongside it, and some come in early because they know the part.\n\nWhat the company called a piezoelectric array is an instrument with many voices. And it changes composition when a new generation of Prospector enters the room.\n\nThere is no record of who wrote the piece.',
    source: 'No department assigned',
  },
  'AX-INC-044': {
    title: 'Incident 44 — discharge in the AQF-00 sheet',
    summary: 'Current stops it. And takes the whole sheet with it.',
    body: 'Record of temporary neutralisation of asset AQF-00 by discharge in liquid medium.\n\nThe asset halts and remains motionless while the charge dissipates. It is the only confirmed method of interrupting it.\n\nIt is recorded that the discharge travels the entire pool, and that the Aquifer is contiguous over an extent no survey has ever closed. The unit electrifying the sheet is standing on it.\n\nThe approved procedure describes this as "risk shared with the target". The wording was left standing.',
    source: 'Incident Committee — temporary neutralisation',
  },
  'AX-UNK-063': {
    title: 'On the seven measurements',
    summary: 'They do not disagree. Each measured a different part.',
    body: "The seven AQF-00 measurements were cross-referenced against each team's position and timestamp.\n\nThe readings do not contradict one another: they describe SIMULTANEOUS stretches in pools the surveys treat as separate, at distances no body would cover in the recorded interval.\n\nThree possible readings, and this record picks none: several synchronised bodies; one body whose length is not a constant; or what moves beneath the sheet is not a body at all, but the sheet itself reacting — in which case the measured extent is merely how much of it was reacting at the time.\n\nThe last reading carries a consequence the approved assessments avoid: the asset could not be killed, only interrupted. Which fits, uncomfortably, with the only thing we know how to do to it.",
    source: 'No department assigned',
  },
  'AX-INC-045': {
    title: 'Incident 45 — combustion of the VNT-00 column',
    summary: 'Its exhalation is continuous to the mouth. And it burns both ways.',
    body: 'Record of confirmed damage to structure VNT-00 by ignition of the gas during the exhalation phase.\n\nThe expelled column is continuous from the structure to its far end. Lit at any point, combustion travels back along the column and reaches the mouth of the organ. It is the only confirmed method of inflicting meaningful damage on the structure.\n\nRecorded operational cost: the same combustion turns the chamber into an igneous environment for several cycles, and the structure stops inhaling while it burns — so the gas in neighbouring chambers stops being removed.\n\nThe unit buys its damage window with the ground it intends to keep standing on.',
    source: 'Incident Committee — engagement analysis',
  },
  'AX-UNK-064': {
    title: 'On what stops breathing',
    summary: 'In the sectors where it fell, ventilation never returned.',
    body: 'Survey of the sectors in which structure VNT-00 was neutralised, over a 40-cycle window.\n\nVentilation ceased in all of them, between three and nine cycles after neutralisation. None resumed air exchange. The chambers downstream remain unbreathable.\n\nThe structure was not feeding on the vents. The vents were it — the whole network was one system, and what the operation classified as a hostile creature was the organ that moved it.\n\nThe record makes no recommendation, because the recommendation would be not to kill it, and there is no form for that.\n\nIt records only that every victory in this stratum closes a part of it permanently.',
    source: 'No department assigned',
  },
  'AX-INC-046': {
    title: 'Incident 46 — the cold window of FRN-00',
    summary: 'The shell is not hard. It is intermittent.',
    body: 'Record of effective damage to formation FRN-00 during the cooling phase.\n\nDuring overheating, impact is dissipated by the outer layer with losses above 80%. During cooling, the same ordnance passes through the structure with no measurable attenuation.\n\nThe cycle is regular and predictable. That makes the engagement entirely a question of POSITION: the unit does not choose when the target opens, it chooses where to be when it does.\n\nIt is recorded that the thermal waves of the hot phase sweep sectors in a rotating sequence, also regular. A unit that learns the sequence crosses the chamber. A unit that does not crosses the chamber once.',
    source: 'Incident Committee — engagement analysis',
  },
  'AX-UNK-065': {
    title: 'On what heats what',
    summary: 'The magma does not heat the formation. The emission heats the magma.',
    body: "The thermal chronology of FRN-00 was cross-referenced against the transmission record.\n\nThe formation's temperature tracks variations in the emission with a lag of three to five hours. The relationship is consistent across the whole series. The inverse relationship — emission responding to temperature — appears nowhere.\n\nThe energy recovery project assumed a geothermal source with a signal on top of it. It is the other way round: there is a signal, and the heat is what it does to the rock.\n\nThe consequence the project closure does not record: if the emission ceased, this stratum would cool. And if it rises, nothing down here has any way not to respond.",
    source: 'No department assigned',
  },
  'AX-INC-047': {
    title: 'Incident 47 — melting the CRP-00 lake',
    summary: 'Her armour is the floor. Melt the floor.',
    body: 'Record of effective damage to asset CRP-00 following fusion of the frozen surface within operating radius.\n\nWhile surrounded by ice the asset dissipates almost all impact. With the cover reduced, the same ordnance passes through. The armour does not belong to the body: it belongs to the chamber.\n\nThe cost is recorded, and it is the usual one in this stratum: meltwater is conductive, refreezes within a known window, and the unit that melted the lake is standing in it.\n\nIt is also recorded that the asset restores the surface, and that the wraiths accompanying it emerge from the restored ice — not from the asset itself.',
    source: 'Incident Committee — engagement analysis',
  },
  'AX-UNK-066': {
    title: 'On the hierarchy, not the person',
    summary: 'She does not reproduce someone. She reproduces how orders are given.',
    body: 'Field reports on CRP-00 disagree about identity and do not disagree about BEHAVIOUR.\n\nIn all of them the pattern is the same: one figure directs, the rest answer, and the answer precedes the order by a consistent fraction of a second — like someone who already knows what will be asked.\n\nSome records suggest a person. Others suggest the figure forms from every voice lost in the stratum, and that "Queen" was the name an earlier crew gave the arrangement, not to anyone.\n\nThis record takes the second reading, with an addition: what survives there is not the memory of a person. It is the memory of a STRUCTURE — the shape of a shift in which someone gives orders and the others obey, preserved after everyone involved stopped existing.\n\nThe Vein kept the org chart.',
    source: 'No department assigned',
  },
  'AX-INC-048': {
    title: 'Incident 48 — the MGN-00 band',
    summary: 'There is a distance at which the field charges nothing.',
    body: 'Mapping of the MGN-00 anomaly field by relative position and phase.\n\nIn the attracting phase the field crushes below three metres. In the repelling phase the return arc punishes above nine. Between the two limits no damage is recorded in either phase.\n\nThe band exists. It is narrow, and the limit that matters SWITCHES SIDES at every polarity inversion: the safe distance now is the lethal distance next cycle.\n\nThe recommended procedure is counter-intuitive and was verified in the field: against attraction, withdraw; against repulsion, advance. The unit does not resist the field — it walks inside it.',
    source: 'Incident Committee — field mapping',
  },
  'AX-UNK-067': {
    title: 'On the field that was already here',
    summary: 'The pre-operational survey records the same pattern.',
    body: 'The geomagnetic survey predating the operation was recovered from dead archive and compared against the current map.\n\nSame orientation. Same periodicity. Same central anomaly, at the same coordinate.\n\nThe institutional version — that decades of extraction magnetised the stratum — is chronologically impossible: the pattern predates the first excavation.\n\nThe original prospecting report describes the region as "of anomalous instrument reading, with signal transport through the vein itself". It was that sentence which motivated acquisition of the concession.\n\nThe company did not choose this place for the ore. It chose it because something was already using the ore to transmit — and the entire operation was built on top of a cable it did not lay.',
    source: 'No department assigned',
  },
};

export const LORE_TEXT: Record<LoreLocale, Record<LoreFragmentId, LoreText>> = {
  'pt-BR': pt,
  en,
  de,
};

export const LORE_LOCALES: readonly LoreLocale[] = ['pt-BR', 'en', 'de'];

export const isLoreLocale = (value: unknown): value is LoreLocale =>
  value === 'pt-BR' || value === 'en' || value === 'de';
