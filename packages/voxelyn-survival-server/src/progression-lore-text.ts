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
