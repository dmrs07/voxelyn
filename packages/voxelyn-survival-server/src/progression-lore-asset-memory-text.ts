// Documentos dos cinco arcos de Persistencia Mnemica Operacional.
//
// Mesmas regras do arquivo principal: voz corporativa, textos curtos, horror
// pela distancia entre o formulario e o que aconteceu. Os documentos finais
// aproximam fatos; nenhum deles prova que uma pessoa inteira sobreviveu.

import type { LoreFragmentId } from '@voxelyn/survival-sim';

export type AssetMemoryLoreText = {
  title: string;
  summary: string;
  body: string;
  source: string;
};

export type AssetMemoryLoreLocale = 'pt-BR' | 'en';

export const ASSET_MEMORY_TEXT: Record<
  AssetMemoryLoreLocale,
  Record<LoreFragmentId, AssetMemoryLoreText>
> = {
  'pt-BR': {
    // -----------------------------------------------------------------------
    // Ressonante — o pedido coletivo que aprende a responder
    // -----------------------------------------------------------------------
    'AX-ENG-019': {
      title: 'Protocolo de impacto 3–2–3',
      summary: 'A assinatura do CRIST-01 ja existia num manual de resgate.',
      body: 'Comparacao solicitada entre a assinatura acustica do CRIST-01 e protocolos de emergencia aposentados.\n\nCorrespondencia encontrada: tres impactos, pausa, dois impactos, pausa, tres impactos. O padrao era usado por equipes soterradas para distinguir pedido humano de acomodacao geologica.\n\nEm parte dos registros, a resposta do especime comeca 0,3 segundo antes do impacto da unidade. Engenharia recomenda tratar a antecipacao como erro de sincronizacao.\n\nO relogio foi conferido. O erro permaneceu.',
      source: 'Engenharia de Sensores — nota comparativa',
    },
    'AX-INC-035': {
      title: 'Incidente 35 — galeria do turno C',
      summary: 'O resgate ouviu o codigo. A planilha ouviu o custo.',
      body: 'Desabamento na galeria C-14. Dezessete trabalhadores sem enlace de voz. O geofone registrou 3–2–3 durante seis horas e quarenta e um minutos.\n\nA equipe de resgate confirmou origem humana e solicitou perfuracao vertical. Aquisições estimou custo de 4,6 unidades-equivalente e probabilidade de recuperacao com vida abaixo de 9%.\n\nA perfuracao foi cancelada. O sinal continuou por mais duas horas.\n\nNo relatorio aprovado, a coluna “comunicacao” foi alterada para “atividade sismica residual”.',
      source: 'Comite de Incidentes — consolidado de salvamento',
    },
    'AX-EXE-044': {
      title: 'Reclassificacao de sinal sismico',
      summary: 'Se a companhia nao respondeu, o arquivo determina que nunca houve pergunta.',
      body: 'Fica ratificada a classificacao de padroes 3–2–3 no Veio como atividade sismica residual, inclusive quando houver regularidade, repeticao ou aparente alternancia com impactos de unidade.\n\nOs termos “pedido”, “resposta” e “sobreviventes” nao devem constar de relatorios geofonicos. A deteccao de um protocolo humano nao prova presenca humana atual.\n\nO parecer tecnico que reconhecia o codigo de emergencia sera mantido em anexo restrito. O anexo nao acompanha a versao operacional.',
      source: 'Conselho Executivo — norma de classificacao acustica',
    },
    'AX-UNK-053': {
      title: 'Sobre quem respondeu',
      summary: 'Depois que a formacao cai, as paredes continuam a conversa.',
      body: 'Sobrepusemos os contatos com CRIST-01 ao registro da galeria C-14. O primeiro impacto de uma unidade nunca inicia o padrao: ele entra no intervalo em que o proximo impacto do codigo ja deveria ocorrer.\n\nQuando o corpo cristalino e destruido, 3–2–3 continua vindo das paredes. Nao de um ponto: de tres, depois cinco, depois de setores sem ocupacao humana registrada.\n\nNao sabemos se os soterrados continuam batendo. Sabemos apenas que o Veio conservou o ritmo — e que, quando uma unidade minera perto dele, alguma coisa registra que finalmente houve resposta.',
      source: 'Sem departamento atribuido',
    },

    // -----------------------------------------------------------------------
    // Lampreia — o gesto de resgate sem uma superficie correta
    // -----------------------------------------------------------------------
    'AX-ENG-024': {
      title: 'Padrao de preensao: AQU-03',
      summary: 'A aderencia evita tecido fragil e procura onde uma pessoa seguraria.',
      body: 'Analise de quatorze contatos com AQU-03. A preensao nao se concentra em juntas, cabos expostos ou compartimento de carga. O especime ancora no ponto de maior estabilidade estrutural e orienta o modulo superior da unidade acima da linha liquida em onze casos.\n\nO comportamento e ineficiente para alimentacao e inconsistente com imobilizacao aleatoria. A expressao “tecnica de extracao” foi sugerida na revisao.\n\nClassificacao manteve “aderencia parasitaria”. A sugestao nao consta da versao aprovada.',
      source: 'Engenharia de Sistemas — analise biomecanica',
    },
    'AX-INC-036': {
      title: 'Incidente 36 — galeria inundada',
      summary: 'Duas pessoas entraram na agua. O inventario recebeu uma.',
      body: 'Equipe de salvamento enviada a galeria AQU-3 apos ruptura do dique interno. A socorrista R. estabeleceu contato fisico com o operador isolado as 02:18.\n\nUltima transmissao inteligivel: “segura em mim. Nao solta.” A corrente interrompeu ambos os sinais onze segundos depois.\n\nO relatorio de encerramento registra dois corpos recuperados. O inventario mortuario anexo possui uma bolsa, uma etiqueta e uma assinatura de recebimento. A linha referente ao segundo corpo foi preenchida com o codigo “transferido”. Nao ha destino.',
      source: 'Comite de Incidentes — arquivo de recuperacao AQU-3',
    },
    'AX-EXE-045': {
      title: 'Ordem de vocabulario: AQU-03',
      summary: '“Resgate” e uma interpretacao; “transporte terminal” e um dado.',
      body: 'Em registros sobre AQU-03 ficam vedados os termos “resgate”, “mao”, “superficie” e “nao soltar”.\n\nDesignacoes aprovadas: aderencia, arrasto e transporte terminal. Ocorrencias em que a unidade foi deslocada para bolsa respiravel devem ser classificadas como coincidencia topografica.\n\nA direcao do movimento nao altera a classificacao. Para fins do modelo, todo arrasto termina no fundo — inclusive quando os sensores registram ganho de altitude.',
      source: 'Conselho Executivo — contencao de linguagem operacional',
    },
    'AX-UNK-054': {
      title: 'Sobre nao soltar',
      summary: 'A criatura nao procura o fundo. Procura uma saida que deixou de existir.',
      body: 'As rotas de arrasto de AQU-03 convergem para antigos pocos de acesso da operacao anterior. Todos foram selados apos a inundacao. No mapa usado pela equipe de resgate, eram as unicas rotas para cima.\n\nA cavitacao produzida durante a preensao contem uma repeticao de baixa frequencia. Isolada, aproxima-se de duas palavras: “nao solta”.\n\nO especime nao leva cada unidade ao mesmo lugar. Leva-a para a superficie segundo o ultimo mapa que parece conhecer. O mapa esta morto. Nao sabemos o que restou de quem tentou segui-lo.',
      source: 'Sem departamento atribuido',
    },

    // -----------------------------------------------------------------------
    // Fole — manter os mortos respirando
    // -----------------------------------------------------------------------
    'AX-ENG-026': {
      title: 'Cadencia pneumatica: SULF-08',
      summary: 'O ciclo organico repete uma maquina desativada ha tres decadas.',
      body: 'A expansao toracica do SULF-08 mantem intervalo medio de 4,8 segundos, com variacao inferior a 0,2%. Organismos comparaveis variam entre 6% e 19%.\n\nA cadencia corresponde ao ventilador manual VA-7 quando operado por alavanca completa. O VA-7 deixou de ser usado antes da concessao Aurix.\n\nEm proximidade a estruturas sem atividade, o especime reduz pressao e prolonga a fase de expiracao. O relatorio de campo chama isso de “escuta”. Engenharia nao possui categoria equivalente.',
      source: 'Engenharia Pneumatica — estudo de cadencia',
    },
    'AX-INC-037': {
      title: 'Incidente 37 — ventilacao manual',
      summary: 'Os sensores ja tinham encerrado a equipe. A operadora nao.',
      body: 'Falha total de ventilacao no abrigo V-7. A operadora L. permaneceu na estacao manual enquanto a equipe aguardava no compartimento remoto.\n\nAs leituras vitais do compartimento cessaram as 19:04. Controle informou a operadora e ordenou abandono. Ela acusou recebimento e continuou a alavanca.\n\nO audio registra apenas a contagem dos ciclos: “duzentos e onze. Duzentos e doze. Duzentos e treze.” A telemetria da operadora cessa durante o ultimo numero. O mecanismo executa outro ciclo.',
      source: 'Comite de Incidentes — transcricao V-7',
    },
    'AX-EXE-046': {
      title: 'Diretriz de encerramento respiratorio',
      summary: 'Energia nao deve ser gasta ventilando baixas confirmadas.',
      body: 'Em caso de perda integral de sinais vitais num compartimento remoto, a ventilacao manual deve ser encerrada imediatamente. A preservacao energetica da instalacao prevalece sobre tentativa sem beneficiario operacional.\n\nRelatorios nao devem empregar “respiracao”, “ultimo folego” ou “continuou por eles”. O termo aprovado e acionamento residual.\n\nNo incidente V-7, o circuito da estacao foi isolado da rede as 19:06. O sensor mecanico registrou acionamentos ate 19:31. A divergencia foi atribuida a inercia da alavanca.',
      source: 'Conselho Executivo — diretriz de contingencia',
    },
    'AX-UNK-055': {
      title: 'Sobre quem ainda respira',
      summary: 'A contagem nao recomeca quando o Fole volta.',
      body: 'A gravacao de V-7 termina em duzentos e treze. A primeira emissao inteligivel atribuida a um SULF-08 comeca em duzentos e quatorze.\n\nCatalogamos as quedas seguintes. Cada novo corpo retoma a contagem no numero posterior ao ultimo registrado. Nunca volta a um. Nunca repete. O intervalo permanece o do VA-7.\n\nTalvez o Veio nao tenha guardado uma operadora. Talvez tenha guardado apenas a tarefa que ela se recusou a abandonar. Para quem recebe o ar, a diferenca pode nao existir.',
      source: 'Sem departamento atribuido',
    },

    // -----------------------------------------------------------------------
    // Scoriac — a ordem de manter uma porta fechada
    // -----------------------------------------------------------------------
    'AX-ENG-027': {
      title: 'Geometria de vedacao: VULC-05',
      summary: 'As barreiras seguem um manual industrial, nao a geologia.',
      body: 'As massas solidificadas pelo VULC-05 foram medidas em nove contatos. Largura, altura e sobreposicao lateral correspondem ao padrao de comportas corta-fogo da operacao anterior, com tolerancia inferior a dois centimetros.\n\nO especime nao bloqueia a passagem mais estreita. Bloqueia a fronteira de pressao prevista no manual de emergencia, mesmo quando a comporta original nao existe mais.\n\nEm todos os casos, posiciona o proprio corpo do lado de maior pressao.',
      source: 'Engenharia Estrutural — laudo de vedacao',
    },
    'AX-INC-038': {
      title: 'Incidente 38 — comporta do Setor Quatro',
      summary: 'A ordem salvou a instalacao e condenou quem estava do lado errado.',
      body: 'Contaminacao termica no Setor Quatro. O chefe de seguranca M. acionou o fechamento manual da comporta 4-C apos falha do comando remoto. Doze trabalhadores permaneceram no lado isolado.\n\nControle solicitou reabertura por noventa segundos. M. recusou. Ultima transmissao: “nao abram esta porta.”\n\nA contencao preservou o reator auxiliar e tres linhas de producao. Nenhum dos doze trabalhadores foi recuperado. M. consta entre as baixas do lado pressurizado.',
      source: 'Comite de Incidentes — relatorio 4-C',
    },
    'AX-EXE-047': {
      title: 'Revisao de merito operacional',
      summary: 'A decisao correta para os ativos foi registrada como falha humana.',
      body: 'Fica revogada a mencao de merito concedida provisoriamente ao chefe M. A manutencao da comporta 4-C fechada contrariou ordem direta e resultou em perda de pessoal.\n\nA preservacao do reator auxiliar nao constitui justificativa retroativa. Para fins disciplinares, a decisao e classificada como priorizacao nao autorizada de ativo.\n\nPesquisa recebe permissao para incorporar o caso ao classificador de ameacas: operadores humanos demonstram maior adesao quando a protecao de ativo e apresentada como protecao da equipe.',
      source: 'Conselho Executivo — revisao disciplinar e cessao de dados',
    },
    'AX-UNK-056': {
      title: 'Sobre o lado da porta',
      summary: 'O Scoriac continua fechando uma fronteira que ja nao tem estrutura.',
      body: 'Toda manifestacao conhecida de VULC-05 sela a direcao correspondente ao lado pressurizado da antiga comporta 4-C. A instalacao foi removida; a fronteira permanece.\n\nQuando uma unidade destroi o especime, sensores registram aumento de pressao, calor e esporos vindos do lado que ele ocupava. O evento dura pouco e desaparece antes da chegada de sonda.\n\nA classificacao diz que ele impede nossa entrada. A telemetria permite outra leitura: ele ainda cumpre a ultima ordem recebida. Nao sabemos o que considera estar do outro lado.',
      source: 'Sem departamento atribuido',
    },

    // -----------------------------------------------------------------------
    // Espectro Glacial — conduzir por um mapa morto
    // -----------------------------------------------------------------------
    'AX-ENG-028': {
      title: 'Correlacao cartografica: GLAC-02',
      summary: 'As aparicoes seguem uma rota removida dos mapas atuais.',
      body: 'Posicoes de contato com GLAC-02 foram sobrepostas as revisoes cartograficas do Setor Frio. O especime aparece sobre a rota L-6 da operacao anterior e avanca sempre na direcao do antigo ponto de encontro.\n\nO ponto foi destruido por colapso criogenico onze ciclos antes do primeiro registro do especime. Mapas atuais nao o exibem.\n\nQuando a unidade abandona a rota L-6, a resposta hostil comeca. O padrao e mais consistente com correcao de trajeto do que com caca.',
      source: 'Engenharia de Cartografia — correlacao de campo',
    },
    'AX-INC-039': {
      title: 'Incidente 39 — ponto de encontro',
      summary: 'O guia continuou chamando depois que nao havia equipe para guiar.',
      body: 'Equipe de levantamento L-6 dispersa durante colapso criogenico. O lider S. manteve canal aberto e orientou retorno ao ponto de encontro antigo.\n\n“Sigam minha voz.” “Estamos quase chegando.” “Nao parem agora.”\n\nOs sinais vitais da equipe cessaram as 03:22. A voz continuou por dezessete minutos. A ultima coordenada transmitida corresponde ao interior de uma parede formada no colapso. O relatorio atribuiu as mensagens posteriores a fila de transmissao.',
      source: 'Comite de Incidentes — transcricao de levantamento L-6',
    },
    'AX-EXE-048': {
      title: 'Parecer de latencia residual',
      summary: 'O equipamento podia guardar onze segundos. A voz durou dezessete minutos.',
      body: 'Fica aprovada a explicacao “latencia de buffer” para transmissao de voz posterior a perda de telemetria na ocorrencia L-6.\n\nEngenharia informa que o modelo de radio utilizado possuia capacidade maxima de onze segundos e apagava a fila em perda de energia. O parecer foi recebido. A limitacao tecnica nao integrara o resumo executivo.\n\nRelatorios futuros devem usar “reproducao residual”. Os termos “guia”, “chamada” e “resposta pelo nome” ficam reservados a comunicacao humana ativa.',
      source: 'Conselho Executivo — parecer de encerramento L-6',
    },
    'AX-UNK-057': {
      title: 'Sobre quem segue a voz',
      summary: 'A chamada antiga aprendeu identificadores que ainda nao existiam.',
      body: 'As emissoes associadas a GLAC-02 nao repetem integralmente a gravacao L-6. Elas substituem nomes e indicativos pelos identificadores das unidades presentes.\n\nO ultimo contato chamou uma unidade por um numero atribuido dois dias antes. Nenhum enlace externo estava ativo. A rota indicada continuou sendo L-6, ate o ponto de encontro que nao existe.\n\nNao e uma gravacao preservada de forma perfeita. E uma chamada incompleta sendo refeita para quem estiver ouvindo. O que lidera pode nao saber que morreu. O que segue pode nao saber para onde esta sendo levado.',
      source: 'Sem departamento atribuido',
    },
  },

  en: {
    // -----------------------------------------------------------------------
    // Resonant — the collective distress call that learns to answer
    // -----------------------------------------------------------------------
    'AX-ENG-019': {
      title: '3–2–3 impact protocol',
      summary: 'CRIST-01’s signature already existed in a rescue manual.',
      body: 'Requested comparison between the CRIST-01 acoustic signature and retired emergency protocols.\n\nMatch found: three impacts, pause, two impacts, pause, three impacts. Buried crews used the pattern to distinguish a human request from geological settling.\n\nIn part of the record, the specimen’s response begins 0.3 second before the unit’s impact. Engineering recommends treating the anticipation as a synchronisation error.\n\nThe clock was checked. The error remained.',
      source: 'Sensor Engineering — comparative note',
    },
    'AX-INC-035': {
      title: 'Incident 35 — C-shift gallery',
      summary: 'Rescue heard the code. The spreadsheet heard the cost.',
      body: 'Collapse in gallery C-14. Seventeen workers without voice link. The geophone recorded 3–2–3 for six hours and forty-one minutes.\n\nThe rescue team confirmed human origin and requested vertical drilling. Procurement estimated a cost of 4.6 unit-equivalents and a live-recovery probability below 9%.\n\nDrilling was cancelled. The signal continued for another two hours.\n\nIn the approved report, the “communication” column was changed to “residual seismic activity”.',
      source: 'Incident Committee — rescue consolidation',
    },
    'AX-EXE-044': {
      title: 'Seismic signal reclassification',
      summary: 'If the company did not answer, the archive determines there was no question.',
      body: 'Classification of 3–2–3 patterns in the Vein as residual seismic activity is hereby ratified, including where regularity, repetition or apparent alternation with unit impacts is present.\n\nThe terms “request”, “answer” and “survivors” shall not appear in geophone reports. Detection of a human protocol does not prove current human presence.\n\nThe technical opinion recognising the emergency code will remain in a restricted annex. The annex does not accompany the operational version.',
      source: 'Executive Board — acoustic classification standard',
    },
    'AX-UNK-053': {
      title: 'On who answered',
      summary: 'After the formation falls, the walls continue the exchange.',
      body: 'We overlaid CRIST-01 contacts with the C-14 gallery record. A unit’s first strike never begins the pattern: it enters the interval in which the code’s next impact should already occur.\n\nWhen the crystalline body is destroyed, 3–2–3 continues from the walls. Not from one point: from three, then five, then from sectors with no recorded human occupation.\n\nWe do not know whether the buried crew is still striking. We know only that the Vein retained the rhythm — and that when a unit mines near it, something records that an answer has finally arrived.',
      source: 'No department assigned',
    },

    // -----------------------------------------------------------------------
    // Mud Lamprey — the rescue gesture with no correct surface
    // -----------------------------------------------------------------------
    'AX-ENG-024': {
      title: 'Grip pattern: AQU-03',
      summary: 'The hold avoids fragile tissue and finds where a person would take hold.',
      body: 'Analysis of fourteen AQU-03 contacts. The grip does not concentrate on joints, exposed cabling or the cargo compartment. The specimen anchors at the point of greatest structural stability and keeps the unit’s upper module above the liquid line in eleven cases.\n\nThe behaviour is inefficient for feeding and inconsistent with random immobilisation. The phrase “extraction technique” was proposed in review.\n\nClassification retained “parasitic adhesion”. The proposal does not appear in the approved version.',
      source: 'Systems Engineering — biomechanical analysis',
    },
    'AX-INC-036': {
      title: 'Incident 36 — flooded gallery',
      summary: 'Two people entered the water. Inventory received one.',
      body: 'Rescue team dispatched to gallery AQU-3 following rupture of the internal barrier. Rescuer R. established physical contact with the isolated operator at 02:18.\n\nLast intelligible transmission: “hold on to me. Don’t let go.” The current interrupted both signals eleven seconds later.\n\nThe closure report records two bodies recovered. The attached mortuary inventory contains one bag, one tag and one receiving signature. The second body’s line was completed with the code “transferred”. There is no destination.',
      source: 'Incident Committee — AQU-3 recovery file',
    },
    'AX-EXE-045': {
      title: 'Vocabulary order: AQU-03',
      summary: '“Rescue” is an interpretation; “terminal transport” is a datum.',
      body: 'The terms “rescue”, “hand”, “surface” and “do not let go” are prohibited in records concerning AQU-03.\n\nApproved designations: adhesion, dragging and terminal transport. Events in which a unit was displaced into a breathable pocket are to be classified as topographic coincidence.\n\nDirection of movement does not alter the classification. For model purposes, every drag ends at the bottom — including where sensors record elevation gain.',
      source: 'Executive Board — operational language containment',
    },
    'AX-UNK-054': {
      title: 'On not letting go',
      summary: 'The creature is not seeking the bottom. It is seeking an exit that no longer exists.',
      body: 'AQU-03 drag routes converge on old access shafts from the previous operation. All were sealed after the flood. On the rescue team’s map, they were the only routes upward.\n\nThe cavitation produced during the grip contains a low-frequency repetition. Isolated, it approximates two words: “don’t let go”.\n\nThe specimen does not take every unit to the same place. It takes it towards the surface according to the last map it appears to know. The map is dead. We do not know what remains of the person who tried to follow it.',
      source: 'No department assigned',
    },

    // -----------------------------------------------------------------------
    // Bellows — keeping the dead breathing
    // -----------------------------------------------------------------------
    'AX-ENG-026': {
      title: 'Pneumatic cadence: SULF-08',
      summary: 'The organic cycle repeats a machine decommissioned three decades ago.',
      body: 'SULF-08 thoracic expansion maintains a mean interval of 4.8 seconds, with variation below 0.2%. Comparable organisms vary between 6% and 19%.\n\nThe cadence matches a VA-7 manual ventilator under full-lever operation. The VA-7 left service before the Aurix concession.\n\nIn proximity to structures showing no activity, the specimen lowers pressure and extends the exhalation phase. The field report calls this “listening”. Engineering has no equivalent category.',
      source: 'Pneumatic Engineering — cadence study',
    },
    'AX-INC-037': {
      title: 'Incident 37 — manual ventilation',
      summary: 'The sensors had closed the crew. The operator had not.',
      body: 'Total ventilation failure in shelter V-7. Operator L. remained at the manual station while the crew waited in the remote compartment.\n\nVital readings from the compartment ceased at 19:04. Control informed the operator and ordered evacuation. She acknowledged and continued the lever.\n\nThe audio records only the cycle count: “two hundred and eleven. Two hundred and twelve. Two hundred and thirteen.” The operator’s telemetry ceases during the last number. The mechanism performs another cycle.',
      source: 'Incident Committee — V-7 transcript',
    },
    'AX-EXE-046': {
      title: 'Respiratory termination directive',
      summary: 'Energy shall not be spent ventilating confirmed losses.',
      body: 'Where all vital signs in a remote compartment are lost, manual ventilation shall cease immediately. Preservation of installation power takes precedence over an attempt without an operational beneficiary.\n\nReports shall not use “breathing”, “last breath” or “continued for them”. The approved term is residual actuation.\n\nIn incident V-7, the station circuit was isolated from the grid at 19:06. The mechanical sensor recorded actuations until 19:31. The discrepancy was attributed to lever inertia.',
      source: 'Executive Board — contingency directive',
    },
    'AX-UNK-055': {
      title: 'On who is still breathing',
      summary: 'The count does not restart when the Bellows returns.',
      body: 'The V-7 recording ends at two hundred and thirteen. The first intelligible emission attributed to a SULF-08 begins at two hundred and fourteen.\n\nWe catalogued the subsequent falls. Each new body resumes the count at the number after the last recorded one. It never returns to one. It never repeats. The interval remains that of the VA-7.\n\nPerhaps the Vein did not retain an operator. Perhaps it retained only the task she refused to abandon. To whoever receives the air, the distinction may not exist.',
      source: 'No department assigned',
    },

    // -----------------------------------------------------------------------
    // Scoriac — the order to keep a door shut
    // -----------------------------------------------------------------------
    'AX-ENG-027': {
      title: 'Seal geometry: VULC-05',
      summary: 'The barriers follow an industrial manual, not geology.',
      body: 'Masses solidified by VULC-05 were measured across nine contacts. Width, height and lateral overlap match the fire-door standard of the previous operation to within two centimetres.\n\nThe specimen does not block the narrowest passage. It blocks the pressure boundary specified in the emergency manual, even where the original door no longer exists.\n\nIn every case, it positions its own body on the higher-pressure side.',
      source: 'Structural Engineering — sealing assessment',
    },
    'AX-INC-038': {
      title: 'Incident 38 — Sector Four bulkhead',
      summary: 'The order saved the installation and condemned whoever was on the wrong side.',
      body: 'Thermal contamination in Sector Four. Security chief M. engaged manual closure of bulkhead 4-C after remote command failure. Twelve workers remained on the isolated side.\n\nControl requested reopening for ninety seconds. M. refused. Last transmission: “do not open this door.”\n\nContainment preserved the auxiliary reactor and three production lines. None of the twelve workers was recovered. M. appears among the losses on the pressurised side.',
      source: 'Incident Committee — 4-C report',
    },
    'AX-EXE-047': {
      title: 'Operational merit review',
      summary: 'The correct decision for the assets was recorded as human failure.',
      body: 'The provisional commendation awarded to security chief M. is hereby revoked. Keeping bulkhead 4-C closed contradicted a direct order and resulted in personnel loss.\n\nPreservation of the auxiliary reactor does not constitute retroactive justification. For disciplinary purposes, the decision is classified as unauthorised asset prioritisation.\n\nResearch is granted permission to incorporate the case into the threat classifier: human operators show greater compliance when asset protection is presented as crew protection.',
      source: 'Executive Board — disciplinary review and data grant',
    },
    'AX-UNK-056': {
      title: 'On the side of the door',
      summary: 'The Scoriac continues sealing a boundary that has no structure left.',
      body: 'Every known VULC-05 manifestation seals the direction corresponding to the pressurised side of the former 4-C bulkhead. The installation was removed; the boundary remains.\n\nWhen a unit destroys the specimen, sensors register a rise in pressure, heat and spores from the side it occupied. The event is brief and ends before a probe arrives.\n\nClassification says it prevents our entry. Telemetry permits another reading: it is still carrying out the last order received. We do not know what it considers to be on the other side.',
      source: 'No department assigned',
    },

    // -----------------------------------------------------------------------
    // Frost Wraith — leading by a dead map
    // -----------------------------------------------------------------------
    'AX-ENG-028': {
      title: 'Cartographic correlation: GLAC-02',
      summary: 'The sightings follow a route removed from current maps.',
      body: 'GLAC-02 contact positions were overlaid on revisions of the Cold Sector survey. The specimen appears on route L-6 of the previous operation and always advances towards the former rendezvous point.\n\nThe point was destroyed by cryogenic collapse eleven cycles before the first specimen record. Current maps do not show it.\n\nWhen the unit leaves route L-6, the hostile response begins. The pattern is more consistent with route correction than hunting.',
      source: 'Cartographic Engineering — field correlation',
    },
    'AX-INC-039': {
      title: 'Incident 39 — rendezvous point',
      summary: 'The guide kept calling after there was no crew left to guide.',
      body: 'Survey team L-6 dispersed during a cryogenic collapse. Leader S. kept the channel open and directed return to the old rendezvous point.\n\n“Follow my voice.” “We are almost there.” “Do not stop now.”\n\nThe team’s vital signs ceased at 03:22. The voice continued for seventeen minutes. The final transmitted coordinate lies inside a wall formed by the collapse. The report attributed the later messages to the transmission queue.',
      source: 'Incident Committee — L-6 survey transcript',
    },
    'AX-EXE-048': {
      title: 'Residual latency opinion',
      summary: 'The equipment could retain eleven seconds. The voice lasted seventeen minutes.',
      body: 'The explanation “buffer latency” is approved for voice transmission after telemetry loss in event L-6.\n\nEngineering reports that the radio model used had a maximum capacity of eleven seconds and cleared its queue on power loss. The opinion was received. The technical limitation will not form part of the executive summary.\n\nFuture reports shall use “residual playback”. The terms “guide”, “call” and “answer by name” are reserved for active human communication.',
      source: 'Executive Board — L-6 closure opinion',
    },
    'AX-UNK-057': {
      title: 'On who follows the voice',
      summary: 'The old call learned identifiers that did not yet exist.',
      body: 'Emissions associated with GLAC-02 do not repeat the L-6 recording in full. They replace names and call signs with the identifiers of the units present.\n\nThe latest contact called a unit by a number assigned two days earlier. No external link was active. The indicated route remained L-6, towards the rendezvous point that does not exist.\n\nThis is not a recording preserved perfectly. It is an incomplete call being remade for whoever is listening. What leads may not know it died. What follows may not know where it is being taken.',
      source: 'No department assigned',
    },
  },
};
