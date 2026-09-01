// O catálogo de origem. Toda string que o JOGADOR lê nasce aqui.
//
// pt-BR é a língua em que o jogo foi escrito, e por isso ela é a fonte da
// verdade e não uma tradução como as outras: `MessageKey` é derivado deste
// objeto, e é o compilador que cobra das demais localidades a cobertura de
// 100% das chaves. Uma string nova esquecida em inglês não compila — que é a
// única forma de a promessa "sem texto solto" sobreviver ao próximo commit.
//
// As chaves são hierárquicas por PONTO e agrupadas por tela, não por tipo de
// widget: quem edita a tela de fim quer ler as linhas dela juntas, e não achar
// "título" no meio de todos os títulos do jogo.
//
// Interpolação é `{nome}`. Nunca concatene traduções — a ordem das partes muda
// entre línguas, e uma frase montada com `+` só funciona por acidente naquela
// em que foi escrita.

export const PT_BR = {
  // ---------------------------------------------------------------------
  // Marca e telas de menu
  // ---------------------------------------------------------------------
  'app.title': 'Voxelyn Survival',

  // ---------------------------------------------------------------------
  // Sequência de abertura (ver src/client/boot/)
  //
  // O wordmark vem QUEBRADO em duas linhas porque na tela de carregamento ele
  // é a composição inteira, empilhado e centralizado — diferente de
  // `menu.title`, que é uma linha só no cabeçalho da folha de despacho. São
  // dois usos tipográficos distintos da mesma marca, e por isso duas chaves.
  //
  // Os rótulos de estado nomeiam a tarefa mais pesada que ainda não terminou.
  // A voz é a da companhia preparando a unidade — nunca "carregando arquivo
  // 3 de 8", que é vocabulário de instalador, não de despacho.
  // ---------------------------------------------------------------------
  'boot.ident.alt': 'Marca do desenvolvedor',
  'boot.title.line1': 'VOXELYN',
  'boot.title.line2': 'SURVIVAL',
  'boot.status.start': 'Iniciando sistemas da unidade',
  'boot.status.fonts': 'Carregando tipografia da companhia',
  'boot.status.core': 'Montando chassi e corpos de contato',
  'boot.status.terrain': 'Levantando estratos e superfícies',
  'boot.status.props': 'Instalando equipamento de campo',
  'boot.status.keyart': 'Compondo imagem de abertura',
  'boot.status.ready': 'Unidade pronta para despacho',
  // A falha é da INICIALIZAÇÃO, não da run: o jogador não perdeu nada, o jogo
  // é que não conseguiu montar. Por isso o texto pede uma ação e não lamenta.
  'boot.error.title': 'FALHA NA INICIALIZAÇÃO',
  'boot.error.body':
    'Recursos essenciais da unidade não chegaram. Verifique a conexão e autorize nova tentativa.',
  'boot.error.retry': 'Tentar de novo',
  'menu.title': 'VOXELYN SURVIVAL',
  'menu.tagline': 'o Veio está vivo — sobreviva',
  'menu.solo': 'Descer',
  'menu.online': 'Co-op online',
  'menu.contract': 'Desafio Semanal',
  'menu.room.label': 'Sala',
  'menu.room.placeholder': 'código',
  'menu.room.hint': 'vazio = qualquer sala',
  'menu.options': 'Opções',
  'menu.records': 'Registro',
  'menu.rank': 'Ranking',
  'menu.dev.seed': 'Seed',
  'menu.dev.seed.placeholder': 'aleatória',
  'menu.dev.server': 'Servidor',
  'menu.dev.server.placeholder': 'auto',
  'menu.controls':
    'Toque para jogar · WASD/mouse no desktop · R reinicia · T volta ao terminal · M silencia',
  'menu.headphones': 'Use fones: o som avisa o que a tela ainda não mostra.',

  // Cromo Aurix do redesign (doc AD-UI-2.0): rótulos decorativos do documento.
  // Não mudam o significado de nenhum botão existente — só o papel timbrado.
  'aurix.motto': 'EXTRAIR. PROTEGER. ADAPTAR.',
  'aurix.rail.dispatch': 'Despacho',
  'aurix.rail.copy': 'Via do operador',
  'aurix.menu.docTitle': 'Ordem de despacho',
  'aurix.menu.requisition': 'Requisição',
  'menu.clearance.generation': 'PROSPECTOR {generation}',
  'menu.clearance.depth': 'AUTORIZAÇÃO DE DESCIDA: {sectors} SETORES',
  'menu.clearance.cores': 'NÚCLEOS DETECTÁVEIS: {cores}',
  'aurix.menu.authorisation': 'Autorização de descida',
  'aurix.doc.options': 'AD-CFG-2.1 · terminal local',
  'aurix.doc.records': 'AD-REG-8.1 · livro de recuperação',
  'aurix.doc.matrix': 'AD-MTX-5.0 · console de autorização',
  'aurix.doc.rank': 'AD-RNK-6.2 · expedições homologadas',
  'aurix.doc.pause': 'AD-DEP-0114 · contrato em curso',
  'aurix.doc.abandon': 'FORMULÁRIO AD-RS-04 · baixa de ativo',
  'aurix.abandon.stamp': 'sem valor de recuperação',
  'aurix.options.operator': 'Operador',
  'aurix.options.video': 'Sistema de vídeo',
  'aurix.options.audio': 'Áudio',
  'aurix.options.network': 'Rede',
  'aurix.options.telemetry': 'Telemetria',
  'aurix.options.credits': 'Créditos',
  'credits.game': 'jogo por DaniTools (@dani.tools)',
  'credits.music': 'trilha sonora por Clevo (@clevoclevoclevo)',
  'aurix.options.footer': 'alterações salvas localmente',

  'options.title': 'OPÇÕES',
  'options.name': 'Nome',
  'options.name.placeholder': 'anônimo',
  'options.language': 'Idioma',
  'options.quality': 'Qualidade',
  'options.quality.high': 'Alta',
  'options.quality.medium': 'Média',
  'options.quality.low': 'Baixa (30 FPS)',
  'options.volume': 'Volume',
  'options.sfx': 'Efeitos',
  'options.music': 'Música',
  'options.musicSource': 'Trilha',
  'options.musicSource.composed': 'Composta',
  'options.musicSource.synth': 'Sintetizada (clássica)',
  'options.sound.on': 'Som: ligado',
  'options.sound.off': 'Som: desligado',
  'options.telemetry.on': 'Telemetria: ligada',
  'options.telemetry.off': 'Telemetria: desligada',
  'options.telemetry.note': 'dados anônimos de sessão, sem identificação',
  'options.net.probe': 'Medir',
  'options.net.probing': 'medindo…',
  'options.net.idle': 'latência ainda não medida',
  'options.net.live': 'ida e volta {rtt} ms até o servidor da sala',
  'options.net.probed': 'ida e volta {rtt} ms até o servidor',
  'options.net.unreachable': 'não consegui falar com o servidor',
  'options.net.cushion':
    'o desenho fica {cushion} ms atrás do servidor para absorver a variação — é o que separa mirar no que se vê de mirar atrás',
  'options.back': 'Voltar',

  // ---------------------------------------------------------------------
  // Menu de campo e abandono
  // ---------------------------------------------------------------------
  'pause.title': 'TERMINAL DE CAMPO',
  'pause.coopWarning': 'No co-op o mundo não para — a descida continua enquanto você lê isto.',
  'pause.resume': 'Retomar descida',
  'pause.abandon': 'Abandonar contrato',
  'pause.leave': 'Sair para o terminal',
  'pause.status.noSignal': 'sem sinal do setor — conexão pendente',
  'pause.status.closed': 'contrato encerrado — sem descida ativa',
  'pause.status.running': 'Setor {sector} · contaminação {contamination}% · contrato em aberto',
  'pause.hint': 'ESC ou segure no topo da tela para o menu',

  'abandon.title': 'ABANDONAR CONTRATO?',
  'abandon.notice': 'Registro de rescisão — leia antes de confirmar.',
  'abandon.material': 'Material coletado neste setor',
  'abandon.material.value': 'não creditado',
  'abandon.progress': 'Progresso da descida',
  'abandon.progress.value': 'perdido',
  'abandon.rank': 'Posição no ranking',
  'abandon.rank.value': 'nenhuma',
  'abandon.unit': 'Unidade em campo',
  'abandon.unit.value': 'baixa operacional',
  'abandon.footnote': 'a companhia não registra o motivo.',
  'abandon.cancel': 'Continuar a descida',
  'abandon.confirm': 'Confirmar abandono',

  // ---------------------------------------------------------------------
  // Convite de co-op
  // ---------------------------------------------------------------------
  'invite.channel': 'CANAL CIFRADO',
  'invite.copy': 'Copiar convite',
  'invite.shared': 'Enviado',
  'invite.copied': 'Copiado!',
  'invite.manual': 'Copie da barra',
  'invite.shareText': 'Desce comigo — sala {room}',

  // ---------------------------------------------------------------------
  // Banners de sistema
  // ---------------------------------------------------------------------
  'banner.sound.on': 'Som ligado',
  'banner.sound.off': 'Som desligado',
  'banner.run.duplicate': 'Run já registrada',
  'banner.run.verified': 'Run verificada e registrada',
  'banner.quality.downgraded': 'Qualidade reduzida para {quality} (desempenho)',
  'banner.room.invalid': 'Código de sala inválido: {code}',
  'banner.connecting': 'Conectando…',
  'banner.reconnecting': 'Reconectando…',
  'banner.offline': 'Offline — tentando reconectar',
  'banner.resync': 'Ressincronizando o mundo…',
  'banner.session.expired': 'Sessão expirada — reconectando…',
  'banner.version.mismatch': 'Versão incompatível ({field}) — recarregue a página.',
  'banner.server.invalid': 'Endereço de servidor inválido: {url}',
  'banner.restarting': 'Descendo de novo…',

  // ---------------------------------------------------------------------
  // Desafio da companhia (contrato)
  // ---------------------------------------------------------------------
  'contract.weekly': 'DESAFIO SEMANAL {period} — VEIO {vein}',
  'contract.daily': 'DESAFIO DIÁRIO {period} — VEIO {vein}',

  // ---------------------------------------------------------------------
  // Painel Registro
  // ---------------------------------------------------------------------
  'records.title': 'REGISTRO',
  'records.tab.summary': 'Resumo',
  'records.tab.assets': 'Ativos',
  'records.tab.discoveries': 'Descobertas',
  'records.tab.history': 'Histórico',
  'records.totals': 'TOTAIS',
  'records.totals.runs': 'Descidas',
  'records.totals.deaths': 'Mortes',
  'records.totals.extractions': 'Extrações',
  'records.totals.withCore': 'Com o núcleo',
  'records.totals.kills': 'Abates',
  'records.totals.time': 'Tempo no Veio',
  'records.best': 'MELHORES',
  'records.best.stars': 'Melhor nota',
  'records.best.fastestCore': 'Núcleo mais rápido',
  'records.best.longestSurvival': 'Maior sobrevivência',
  'records.best.masteredSeeds': 'Seeds dominadas',
  'records.assets': 'REGISTRO DE ATIVOS',
  'records.assets.locked': '— — —',
  'records.assets.noOccurrence': 'sem ocorrência registrada',
  'records.assets.fieldName': 'campo: {name}',
  'records.assets.tally': '×{count}',
  'records.discoveries': 'DESCOBERTAS',
  'records.discoveries.locked': 'ainda não aconteceu com você',
  'records.history': 'ÚLTIMAS DESCIDAS',
  'records.history.empty': 'nenhuma ainda',
  'records.history.seed': 'seed {seed}',
  'records.history.core': 'núcleo',
  'records.history.extracted': 'saiu',
  'records.replay': 'Rever esta descida',

  // ---------------------------------------------------------------------
  // Painel Ranking
  // ---------------------------------------------------------------------
  'rank.title': 'RANKING',
  'rank.best': 'MELHORES DESCIDAS',
  'rank.seed': 'SEED {seed}',
  'rank.empty': 'ninguém extraiu ainda',
  'rank.empty.offline': 'ninguém extraiu ainda — ou o servidor está fora do ar',
  'rank.loading': 'carregando…',
  'rank.entry': '{position}. {stars} {name}',
  'rank.col.operator': 'Operador',
  'rank.col.cores': 'Núcleos',
  'rank.col.time': 'Tempo',
  'rank.class': '{sectors} setores',
  'rank.class.entries': '{entries} expedições homologadas',
  'rank.replay': 'Assistir replay autoritativo',
  'rank.how': 'COMO ENTRAR',
  'rank.how.text':
    'Só runs que extraíram entram. O servidor re-simula a sua partida a partir das teclas que você apertou — não há placar para enviar, só o que aconteceu. A posição sai de duas coisas: quantos Núcleos você trouxe e quanto tempo levou. Cada profundidade tem o seu próprio livro — descidas de três setores não competem com as de sete.',

  // ---------------------------------------------------------------------
  // Painel Replay (replay.html)
  // ---------------------------------------------------------------------
  'replay.badge': 'Replay autoritativo — re-simulado a partir do log homologado',
  'replay.badge.local': 'Replay local — re-simulado a partir do log gravado neste aparelho',
  'replay.back': '← voltar ao ranking',
  'replay.unavailable.local':
    'O log desta descida não está mais neste aparelho — ou foi gravado por outra versão da simulação.',
  'replay.loading.title': 'Carregando o replay…',
  'replay.invalid.title': 'Replay inválido',
  'replay.invalid.detail': 'Esta página precisa de um id de run na URL.',
  'replay.unavailable.title': 'Replay indisponível',
  'replay.unavailable.detail':
    'Esta run não tem um replay guardado — ou o servidor está fora do ar.',
  'replay.corrupt.title': 'Replay corrompido',
  'replay.corrupt.detail': 'O log guardado para esta run não pôde ser lido.',
  'replay.pause': 'Pausar',
  'replay.resume': 'Continuar',
  'replay.restart': 'Reiniciar',

  // ---------------------------------------------------------------------
  // Bestiário: designação corporativa e nome de campo
  // ---------------------------------------------------------------------
  'enemy.stalker': 'Espreitador',
  'enemy.spitter': 'Cuspidor',
  'enemy.bomber': 'Portador de Esporos',
  'enemy.bruiser': 'Britador',
  'enemy.miner': 'Mineiro',
  'enemy.fungal_horse': 'Corcel',
  'enemy.bishop': 'Bispo',
  'enemy.guardian': 'Guardião',
  'enemy.resonant': 'Ressonante',
  'enemy.mud_lamprey': 'Lampreia',
  'enemy.bellows': 'Fole',
  'enemy.scoriac': 'Escoriáceo',
  'enemy.frost_wraith': 'Espectro',
  'enemy.sulfur_bomber': 'Bombardeiro',
  'enemy.undertaker': 'Coveiro',
  'enemy.diamandis': 'Diamandis',
  'enemy.white_devourer': 'Devorador Branco',
  'enemy.devourer_brood': 'Ninhada',
  'enemy.archcantor': 'Arquicantor',
  'enemy.sheet_leviathan': 'Leviatã do Lençol',
  'enemy.lung_matrix': 'Pulmão-Matriz',
  'enemy.furnace_heart': 'Coração da Fornalha',
  'enemy.frost_queen': 'Rainha da Geada',
  'enemy.magnetarch': 'Magnetarca',

  'bestiary.name.stalker': 'Espreitador',
  'bestiary.name.spitter': 'Cuspidor',
  'bestiary.name.bomber': 'Portador de Esporos',
  'bestiary.name.bruiser': 'Britador',
  'bestiary.name.miner': 'Minerador Empobrecido',
  'bestiary.name.fungal_horse': 'Corcel Fúngico',
  'bestiary.name.resonant': 'Ressonante',
  'bestiary.name.mud_lamprey': 'Lampreia de Lodo',
  'bestiary.name.bellows': 'Fole',
  'bestiary.name.scoriac': 'Escoriáceo',
  'bestiary.name.frost_wraith': 'Espectro de Geada',
  'bestiary.name.sulfur_bomber': 'Bombardeiro de Enxofre',
  'bestiary.name.undertaker': 'Coveiro',
  'bestiary.name.diamandis': 'Diamandis',
  'bestiary.name.white_devourer': 'Devorador Branco',
  'bestiary.name.devourer_brood': 'Minhoquinha',
  'bestiary.name.archcantor': 'Arquicantor',
  'bestiary.name.sheet_leviathan': 'Leviatã do Lençol',
  'bestiary.name.lung_matrix': 'Pulmão-Matriz',
  'bestiary.name.furnace_heart': 'Coração da Fornalha',
  'bestiary.name.frost_queen': 'Rainha da Geada',
  'bestiary.name.magnetarch': 'Magnetarca',
  'bestiary.name.bishop': 'Bispo do Veio',
  'bestiary.name.guardian': 'Guardião do Núcleo',

  'bestiary.code.stalker': 'ESPÉCIME QUIT-04',
  'bestiary.note.stalker':
    'Fauna de túnel. Agressiva por instinto, não por organização. Custo de remoção desprezível.',
  'bestiary.code.spitter': 'ESPÉCIME FUNG-11',
  'bestiary.note.spitter':
    'Secreção corrosiva sem valor industrial confirmado. Programa de amostragem descontinuado.',
  'bestiary.code.bomber': 'ESPÉCIME FUNG-23',
  'bestiary.note.bomber':
    'Vetor de esporos. Ruptura espontânea documentada em 100% dos encontros registrados.',
  'bestiary.code.bruiser': 'ESPÉCIME MIN-07',
  'bestiary.note.bruiser':
    'Massa mineral animada. Reclassificado de "maquinário extraviado" após o terceiro relatório.',
  'bestiary.code.miner': 'UNIDADE EX-016',
  'bestiary.note.miner':
    'Extratora da geração anterior. Operação após o encerramento do contrato não foi autorizada. Sem valor de recuperação.',
  'bestiary.code.fungal_horse': 'ATIVO HOSTIL EQ-02',
  'bestiary.note.fungal_horse': 'Quadrúpede adaptado. A presença de arreios não implica operador.',
  'bestiary.code.resonant': 'ESPÉCIME CRIST-01',
  'bestiary.note.resonant':
    'Induz descarga em formações cristalinas próximas. Perda de material catalogável atribuída ao espécime, não ao protocolo de extração.',
  'bestiary.code.mud_lamprey': 'ESPÉCIME AQU-03',
  'bestiary.note.mud_lamprey':
    'Predador lacustre. Ataques ocorrem exclusivamente a partir da lâmina d’água. Drenagem preventiva excede o orçamento do setor.',
  'bestiary.code.bellows': 'ESPÉCIME SULF-08',
  'bestiary.note.bellows':
    'Redistribui gases do estrato por respiração. Utilidade como equipamento de ventilação avaliada e arquivada.',
  'bestiary.code.scoriac': 'ESPÉCIME VULC-05',
  'bestiary.note.scoriac':
    'Carapaça refratária de escória. Vulnerável após exposição térmica — condição que também o torna consideravelmente pior.',
  'bestiary.code.frost_wraith': 'ESPÉCIME GLAC-02',
  'bestiary.note.frost_wraith':
    'Desloca-se sob a lâmina de gelo. Relatos de "assombração" refletem baixa visibilidade, não fenômeno anômalo.',
  'bestiary.code.sulfur_bomber': 'ESPÉCIME SULF-14',
  'bestiary.note.sulfur_bomber':
    'Variante mineral do vetor FUNG-23. Carga interna inflamável. Recomenda-se neutralização a distância de fontes de calor — recomendação reiterada após o incidente da galeria 7.',
  'bestiary.code.undertaker': 'UNIDADE EX-041',
  'bestiary.code.diamandis': 'ATIVO DE PATRIMÔNIO DX-001',
  'bestiary.code.white_devourer': 'PADRÃO DE MOVIMENTO SIL-00',
  'bestiary.code.devourer_brood': 'PADRÃO DE MOVIMENTO SIL-00b',
  'bestiary.code.archcantor': 'ARRANJO PIEZOELÉTRICO PRZ-00',
  'bestiary.note.archcantor':
    'A companhia o classifica como "arranjo piezoelétrico natural". Os laudos posteriores registram que os cristais reproduzem frequências da transmissão — e que alguns respondem ANTES de receber o pulso.',
  'bestiary.code.sheet_leviathan': 'ATIVO HOSTIL AQF-00',
  'bestiary.note.sheet_leviathan':
    'Cada equipe mediu um comprimento diferente. A explicação mais simples é que as medições estão erradas. A segunda mais simples é que não se trata de um único corpo.',
  'bestiary.code.lung_matrix': 'ESTRUTURA DE VENTILAÇÃO VNT-00',
  'bestiary.note.lung_matrix':
    'A operação acreditou que os respiradouros alimentavam a criatura. Levantamentos posteriores sugerem o inverso: ela é o órgão que mantém o estrato inteiro respirando. Matá-la não é claramente uma vitória.',
  'bestiary.code.furnace_heart': 'FORMAÇÃO ÍGNEA FRN-00',
  'bestiary.note.furnace_heart':
    'A companhia tentou usar a formação como fonte de energia. Os registros mostram que o calor não vem do magma: o magma se mantém líquido por causa da emissão, e a temperatura responde quando a transmissão aumenta.',
  'bestiary.code.frost_queen': 'ATIVO HOSTIL CRP-00',
  'bestiary.note.frost_queen':
    '"Rainha" é apelido de equipes anteriores, não classificação. Os registros discordam sobre a identidade: alguns sugerem uma pessoa; outros, que ela se forma de todas as vozes perdidas no estrato. Ela não reproduz uma pessoa — reproduz uma HIERARQUIA.',
  'bestiary.code.magnetarch': 'ANOMALIA MAGNÉTICA MGN-00',
  'bestiary.note.magnetarch':
    'A companhia afirma que o campo foi criado por décadas de mineração. Registros anteriores à operação já mostram o mesmo padrão magnético. Talvez a companhia tenha escolhido aquele lugar porque o campo já transmitia dados através do minério.',
  'bestiary.note.devourer_brood':
    'Mesma assinatura do SIL-00, em escala de centímetros e em número. Não atacam, não fogem do calor e não têm nada que se pareça com uma boca. O relatório de campo anexa a única observação que a equipe considerou relevante e que a companhia não citou em lugar nenhum: eles acompanham o adulto. Alguma coisa ali cuida de alguma coisa.',
  'bestiary.note.white_devourer':
    'A massa estimada excede em várias ordens a matéria orgânica que o estrato inteiro poderia sustentar. A hipótese que os laudos posteriores formulam, e que nenhum deles assina: o corpo não atravessa a sílica — a sílica assume temporariamente a forma do corpo.',
  'bestiary.note.diamandis':
    'Instalação móvel de recuperação economicamente inviável. Não foi desativado: foi RECLASSIFICADO — a companhia transformou uma máquina em operação em parte do mapa para não contabilizar a perda. Continua escavando numa direção que não consta do contrato.',
  'bestiary.note.undertaker':
    'Recolhedora de sucata. Continua cumprindo a diretriz de coleta sem distinguir maquinário inativo de pessoal em serviço. Reclassificação pendente desde a última auditoria.',
  'bestiary.code.bishop': 'ATIVO HOSTIL EQ-09',
  'bestiary.note.bishop':
    'Figura cerimonial. A alegação de estrutura religiosa permanece não corroborada.',
  'bestiary.code.guardian': 'ANOMALIA TERMINAL',
  'bestiary.note.guardian':
    'Impede o acesso ao núcleo. Nenhuma outra propriedade é relevante para esta operação.',

  // ---------------------------------------------------------------------
  // Descobertas (codex)
  // ---------------------------------------------------------------------
  'discovery.fireSpread.title': 'Fogo caminha',
  'discovery.fireSpread.lesson':
    'Biofluido conduz chama de célula em célula. Uma poça é um rastilho.',
  'discovery.gasIgnition.title': 'O gás não espera',
  'discovery.gasIgnition.lesson':
    'Gás sulfúrico acende ao primeiro contato com fogo. Sala fechada é câmara.',
  'discovery.dischargePool.title': 'A poça inteira é o alvo',
  'discovery.dischargePool.lesson':
    'Descarga percorre todo o biofluido conectado — e não pergunta quem está nele.',
  'discovery.oreChain.title': 'Minério é fiação',
  'discovery.oreChain.lesson':
    'Um veio carrega a carga até o outro lado da parede e a solta nas aberturas.',
  'discovery.fragileBreach.title': 'Nem toda parede é parede',
  'discovery.fragileBreach.lesson':
    'Rocha frágil cede a explosão e perfuração. Rotas existem onde não parecia haver.',
  'discovery.selfHarm.title': 'O Veio não escolhe lados',
  'discovery.selfHarm.lesson':
    'Toda reação atinge você igual. A build mais forte é a mais perigosa de carregar.',
  'discovery.minerFled.title': 'Ele larga a carga',
  'discovery.minerFled.lesson':
    'Arma morna e o mineiro recua pelos túneis — e deixa o que carregava. Alcançá-lo custa tempo.',
  'discovery.minerEnraged.title': 'O calor sobrecarrega',
  'discovery.minerEnraged.lesson':
    'Chegue em brasa e o circuito dele falha: picareta em círculo. Recuar responde; orbitar, não.',
  'discovery.cargoLost.title': 'Sem valor de recuperação',
  'discovery.cargoLost.lesson':
    'A carga só existe depois da plataforma. O que ficou no Veio nunca foi seu.',
  'discovery.horseFelled.title': 'O rastro fica',
  'discovery.horseFelled.lesson':
    'A investida atravessa a sala e deixa fogo onde passou. Pedra no caminho a encerra.',
  'discovery.bishopFelled.title': 'Ele se cura do chão',
  'discovery.bishopFelled.lesson':
    'Sobre fungo vivo o Bispo regenera mais do que você tira. Aquecer o tapete já corta a cura.',
  'discovery.guardianFelled.title': 'O Guardião cai',
  'discovery.guardianFelled.lesson':
    'Ele sela a arena na metade da vida e chama companhia. O cerco desaba com ele.',
  'discovery.leylineRouted.title': 'A junção obedece',
  'discovery.leylineCircuit.title': 'A rede inteira, de uma vez',
  'discovery.leylineCircuit.lesson':
    'Uma única cascata acendeu todos os trechos do condutor. O estrato parou de trabalhar contra você — e a propriedade que ele perdeu também era sua.',
  'discovery.leylineRouted.lesson':
    'Uma junção roteada vira relé: a descarga atravessa e arma o trecho vizinho. A rede conduz para onde você mandar.',
  'discovery.coreTaken.title': 'O núcleo é só metade',
  'discovery.coreTaken.lesson': 'Pegá-lo dobra o ritmo da contaminação. A saída é a outra metade.',

  // ---------------------------------------------------------------------
  // Tela de fim: causa da morte e lição
  // ---------------------------------------------------------------------
  'summary.enemy.elite': '{name} mutado',
  'summary.cause.none.headline': 'Você saiu inteiro',
  'summary.cause.contact.headline': '{enemy} te alcançou',
  'summary.cause.contact.lesson':
    'Corpo a corpo é telegrafado. O som do windup chega antes do golpe.',
  'summary.cause.projectile.headline': '{enemy} te acertou de longe',
  'summary.cause.projectile.rock.lesson':
    'O arremesso avisa por 0,8 s antes de sair. Quebre a linha de visão ou desvie de lado.',
  'summary.cause.projectile.spit.lesson':
    'Cuspe deixa poça de biofluido. Recuar em linha reta te mantém no caminho dela.',
  'summary.cause.fire.headline': 'O fogo te consumiu',
  'summary.cause.fire.lesson':
    'Chama caminha por biofluido e fungo. O chão pega antes de você ver a chama.',
  'summary.cause.gas.headline': 'O gás sulfúrico te dissolveu',
  'summary.cause.gas.lesson': 'Gás se acumula em espaço fechado. O pulso cinético dissipa a nuvem.',
  'summary.cause.spores.headline': 'Os esporos te tomaram',
  'summary.cause.spores.lesson':
    'A nuvem do Portador não se espalha, mas fica. Saia dela em vez de atravessá-la.',
  'summary.cause.contamination.headline': 'O ar te terminou',
  'summary.cause.contamination.lesson':
    'A saturação não deixa nuvem em que pisar — ela cobra por segundo, e a conta cresce. Descer limpa; ficar parado nunca.',
  'summary.cause.discharge.self.headline': 'Sua própria descarga te pegou',
  'summary.cause.discharge.self.lesson':
    'Condutivo percorre a poça inteira. Antes de eletrificar, olhe onde você pisa.',
  'summary.cause.discharge.world.headline': 'Uma descarga te pegou na poça',
  'summary.cause.discharge.world.lesson':
    'Cristal quebrado eletrifica todo biofluido conectado. Poça é terreno hostil.',
  'summary.cause.leviathanDischarge.headline': 'O Leviatã eletrificou o Dilúvio',
  'summary.cause.leviathanDischarge.lesson':
    'Entre por inteiro em uma das grandes bolhas de ar antes da descarga.',
  'summary.cause.explosion.self.headline': 'Você se explodiu',
  'summary.cause.explosion.self.lesson':
    'O módulo explosivo arma a 2,25 tiles. Em corredor, ele volta para você.',
  'summary.cause.explosion.world.headline': 'Uma explosão te alcançou',
  'summary.cause.explosion.world.lesson':
    'O Portador detona ao morrer. Matá-lo de perto é o mesmo que detoná-lo em você.',
  'summary.cause.overheat.headline': 'Sua arma superaqueceu em você',
  'summary.cause.overheat.lesson':
    'O calor sobe a cada tiro e o apito sobe junto. Solte o gatilho antes do topo.',
  'summary.cause.bleedout.headline': 'Você se apagou no escuro',
  'summary.cause.bleedout.lesson':
    'Abatido dura 20 s. Caia perto do parceiro, não no meio da sala.',
  'summary.cause.unknown.headline': 'O Veio te consumiu',

  // ---------------------------------------------------------------------
  // Tela de fim: números, desfecho e próxima estrela
  // ---------------------------------------------------------------------
  'summary.stat.time': 'Tempo',
  'summary.stat.contamination': 'Contaminação',
  'summary.stat.kills': 'Abates',
  'summary.stat.damageDealt': 'Dano causado',
  'summary.stat.damageTaken': 'Dano sofrido',
  'summary.stat.damagePerShot': 'Dano/tiro',
  'summary.stat.salvage': 'Salvage',
  'summary.stat.modules': 'Módulos',
  'summary.stat.ore': 'Minério',
  'summary.stat.none': '—',
  'summary.outcome.core': 'NÚCLEO EXTRAÍDO',
  'summary.outcome.cores': 'NÚCLEOS EXTRAÍDOS ×{cores}',
  'summary.outcome.extracted': 'EXTRAÍDO SEM O NÚCLEO',
  'summary.outcome.dead': 'O VEIO TE CONSUMIU',
  'summary.reputation.one':
    'REGISTRO CORPORATIVO: 1 unidade inativa destruída — sem valor de recuperação.',
  'summary.reputation.other':
    'REGISTRO CORPORATIVO: {count} unidades inativas destruídas — sem valor de recuperação.',
  'summary.nextStar.three': '★★★ exige todos os núcleos em {target} — você passou {over}.',
  'summary.nextStar.three.cores':
    '★★★ exige os {total} núcleos da descida — você subiu com {missing} ainda no Veio.',
  'summary.nextStar.two': '★★ exige sair com o núcleo do Guardião.',
  'summary.nextStar.one': '★ exige alcançar a extração vivo.',
  'summary.seed': 'seed {seed}',
  'summary.action.restart': 'DESCER DE NOVO',
  'summary.action.terminal': 'VOLTAR AO TERMINAL',
  'summary.doc.loss': 'RELATÓRIO DE PERDA DE UNIDADE',
  'summary.doc.settlement': 'LIQUIDAÇÃO DE CONTRATO',
  'summary.doc.cause': 'CAUSA PROVÁVEL',
  'summary.doc.recommendation': 'RECOMENDAÇÃO DE CAMPO',

  // ---------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------
  'banner.expedition.offline': 'AURIX INDISPONÍVEL · SIMULAÇÃO LOCAL, NADA SERÁ REGISTRADO',
  'banner.expedition.tooLong': 'EXPEDIÇÃO EXCEDEU O REGISTRO DE 30 MIN · CARGA NÃO HOMOLOGÁVEL',
  'banner.expedition.pending': 'TRANSMISSÃO INTERROMPIDA · A TELEMETRIA SERÁ REENVIADA',
  'banner.cargo.cleared': 'CARGA HOMOLOGADA · +{ore} MINÉRIO',
  'banner.cargo.cleared.core': 'CONTRATO CONCLUÍDO · +{ore} MINÉRIO E +{cores} NÚCLEO',
  'banner.cargo.lost': 'SEM VALOR DE RECUPERAÇÃO · {ore} DE CARGA PERDIDOS NO VEIO',
  'matrix.title': 'MATRIZ GERACIONAL AURIX',
  'matrix.tab.matrix': 'Matriz',
  'matrix.tab.codex': 'Arquivos Aurix',
  'matrix.wallet.ore': 'Minério',
  'matrix.wallet.ore.note': 'homologado',
  'matrix.wallet.cores': 'Núcleos',
  'matrix.wallet.cores.note': 'recuperados',
  'matrix.generation': 'Geração',
  'matrix.generation.note': 'chassi atual',
  'matrix.protocols': 'Protocolos',
  'matrix.protocols.note': 'de {total}',
  'matrix.branch.chassis': 'CHASSI',
  'matrix.branch.chassis.note': 'Sobrevivência',
  'matrix.branch.mobility': 'MOBILIDADE',
  'matrix.branch.mobility.note': 'Movimento',
  'matrix.branch.reactor': 'REATOR',
  'matrix.branch.reactor.note': 'Calor e combate',
  'matrix.branch.survey': 'LEVANTAMENTO',
  'matrix.branch.survey.note': 'Navegação',
  'matrix.branch.intelligence': 'IA',
  'matrix.branch.intelligence.note': 'Cognição de combate',
  'matrix.node.installed': 'INCORPORADO',
  'matrix.node.locked': 'exige {id}',
  'matrix.node.missing': 'faltam {ore} ⬡ e {cores} ◉',
  'matrix.node.missingOre': 'faltam {ore} ⬡',
  'matrix.node.missingCores': 'faltam {cores} ◉',
  'matrix.node.sealed': 'PROTOCOLO NÃO ESPECIFICADO',
  'matrix.confirm.title': 'INCORPORAR PROTOCOLO À PRÓXIMA GERAÇÃO?',
  'matrix.confirm.cost': 'Custo: {ore} minério e {cores} núcleo(s).',
  'matrix.confirm.warning': 'Esta operação não pode ser desfeita.',
  'matrix.confirm.yes': 'Incorporar',
  'matrix.confirm.no': 'Cancelar',
  'matrix.buying': 'PROCESSANDO…',
  'matrix.inspector.title': 'NÓ SELECIONADO',
  'matrix.inspector.hint': 'toque um protocolo no trilho para inspecioná-lo',
  'matrix.inspector.requires': 'Requer',
  'matrix.inspector.cost': 'Custo',
  'matrix.inspector.balanceAfter': 'Saldo após',
  'matrix.inspector.sealed':
    'A Aurix Dynamics não especifica o que ainda não alcançou. Incorpore o protocolo anterior para abrir esta especificação.',
  'matrix.legend': '● incorporado · + autorizável · ⬡ sem lastro · ✕ pré-requisito ausente',
  'matrix.declassified': 'ARQUIVO DESCLASSIFICADO',
  'matrix.generationUp': 'CHASSI HOMOLOGADO: {generation}',
  'matrix.offline':
    'Conexão com a Aurix Dynamics indisponível. A Matriz mostra o último estado conhecido e nenhuma compra pode ser incorporada.',
  'matrix.badUrl':
    'Endereço de servidor inválido. Nenhuma consulta chegou a ser enviada — confira o campo Servidor no menu ou o parâmetro server= na URL.',
  'matrix.refused':
    'A Aurix Dynamics respondeu e recusou a consulta ({code}). A Matriz mostra o último estado conhecido e nenhuma compra pode ser incorporada.',
  'matrix.conflict':
    'O ESTADO DA MATRIZ FOI ATUALIZADO EM OUTRA SESSÃO. REVISE OS DADOS ANTES DE INCORPORAR O PROTOCOLO.',
  'matrix.loading': 'Consultando a Aurix Dynamics…',
  'matrix.policy': 'O que retorna é homologado. O que fica no Veio nunca existiu.',
  'codex.locked': 'AUTORIZAÇÃO INSUFICIENTE',
  'codex.clearance': 'nível {level}',
  'codex.related': 'Arquivos relacionados',
  'codex.source': 'Origem',
  'codex.count': '{unlocked} de {total} arquivos',
  'codex.empty': 'Nenhum arquivo desclassificado além do material público.',
  'codex.new': 'novo',
  'codex.filter.all': 'Todos',
  'codex.filter.asset': 'Ativo: {name}',
  'codex.filter.discovery': 'Descoberta: {name}',
  'codex.filter.upgrade': 'Protocolo: {id}',
  'codex.contextEmpty': 'Nenhum documento desclassificado para este contexto ainda.',
  'codex.backToRecords': 'Voltar ao Registro',
  'codex.related.aria': 'Abrir arquivo relacionado {code}',
  'records.viewDocs': 'Ver docs',
  'records.viewDocs.aria': 'Ver documentos de {name} nos Arquivos Aurix',
  'menu.matrix': 'Matriz Geracional',
  'upgrade.CA-01.name': 'Carapaça Reforçada I',
  'upgrade.CA-01.desc': '+4 de vida máxima',
  'upgrade.CA-02.name': 'Berços de Impacto',
  'upgrade.CA-02.desc': 'duração de stun −10%',
  'upgrade.CA-03.name': 'Carapaça Reforçada II',
  'upgrade.CA-03.desc': '+4 de vida máxima',
  'upgrade.CA-04.name': 'Selagem Ambiental',
  'upgrade.CA-04.desc': 'dano ambiental −8%',
  'upgrade.CA-05.name': 'Carapaça Reforçada III',
  'upgrade.CA-05.desc': '+4 de vida máxima',
  'upgrade.CA-X.name': 'Reservatório Auxiliar',
  'upgrade.CA-X.desc': 'começa com +1 célula de purga',
  'upgrade.MV-01.name': 'Servomotores I',
  'upgrade.MV-01.desc': 'movimento +2%',
  'upgrade.MV-02.name': 'Relé de Esquiva',
  'upgrade.MV-02.desc': 'cooldown da esquiva 18 → 17 ticks',
  'upgrade.MV-03.name': 'Tração Segmentada',
  'upgrade.MV-03.desc': 'slow de líquidos −8%',
  'upgrade.MV-04.name': 'Estabilizadores Giroscópicos',
  'upgrade.MV-04.desc': 'mais controle no gelo',
  'upgrade.MV-05.name': 'Servomotores II',
  'upgrade.MV-05.desc': 'movimento +2%',
  'upgrade.MV-X.name': 'Firmware Reflexo',
  'upgrade.MV-X.desc': '+1 iframe na esquiva',
  'upgrade.RX-01.name': 'Dissipador Expandido',
  'upgrade.RX-01.desc': 'dissipação de calor +5%',
  'upgrade.RX-02.name': 'Coletor Térmico',
  'upgrade.RX-02.desc': 'calor máximo 100 → 105',
  'upgrade.RX-03.name': 'Capacitor de Resposta',
  'upgrade.RX-03.desc': 'cooldown de habilidade −4%',
  'upgrade.RX-04.name': 'Colimador Balístico',
  'upgrade.RX-04.desc': 'projéteis +6% de velocidade',
  'upgrade.RX-05.name': 'Governador de Emergência',
  'upgrade.RX-05.desc': 'overheat −4 ticks e −1 de dano',
  'upgrade.RX-X.name': 'Malha de Combate',
  'upgrade.RX-X.desc': 'dano de bolt e habilidade +4%',
  'upgrade.SV-01.name': 'Beacon de Objetivo',
  'upgrade.SV-01.desc': 'pulso ao objetivo na entrada do setor',
  'upgrade.SV-02.name': 'Traço de Salvage',
  'upgrade.SV-02.desc': 'aponta terminal próximo a 18 tiles',
  'upgrade.SV-03.name': 'Espectrômetro Mineral',
  'upgrade.SV-03.desc': 'veio pulsa através de 1 parede',
  'upgrade.SV-04.name': 'Memória de Rota',
  'upgrade.SV-04.desc': 'o mapa guarda os salões visitados',
  'upgrade.SV-05.name': 'Vetor de Retorno',
  'upgrade.SV-05.desc': 'direção da entrada enquanto carrega o núcleo',
  'upgrade.SV-X.name': 'Previsão de Contaminação',
  'upgrade.SV-X.desc': 'leitura da próxima onda no HUD',
  'upgrade.IA-01.name': 'Classificação de Assinaturas',
  'upgrade.IA-01.desc': 'brackets em hostis próximos; distingue hostil, passivo e em fuga',
  'upgrade.IA-02.name': 'Leitura de Intenção',
  'upgrade.IA-02.desc': 'destaca windup de investidas e disparos antes da execução',
  'upgrade.IA-03.name': 'Solução de Interceptação',
  'upgrade.IA-03.desc': 'marcador de antecipação; a mira continua sua',
  'upgrade.IA-04.name': 'Correção Vetorial',
  'upgrade.IA-04.desc': 'mira que passa muito perto encosta no alvo (cone de 6°)',
  'upgrade.IA-05.name': 'Memória de Engajamento',
  'upgrade.IA-05.desc': 'aderência curta ao alvo adquirido; troca quando ele cai',
  'upgrade.IA-X.name': 'Diretiva Autônoma',
  'upgrade.IA-X.desc': 'toque sem direção dispara no inimigo válido mais próximo',
  'summary.cargo.lost': 'CARGA NÃO RECUPERADA: {ore} ⬡ · SEM VALOR DE RECUPERAÇÃO',
  'summary.cargo.cleared': 'CARGA TRANSMITIDA PARA HOMOLOGAÇÃO: {ore} ⬡',
  'summary.cargo.core': 'CARGA E NÚCLEOS TRANSMITIDOS PARA HOMOLOGAÇÃO: {ore} ⬡ · {cores} ◉',
  'hud.contamination': 'CONTAMINAÇÃO',
  'hud.contamination.saturated': 'AR SATURADO — SAIA',
  'hud.cargo': '{count} CARGA',
  'hud.purgeCells': 'CÉLULA DE PURGA ×{count}',
  'hud.purge': 'PURGA',
  'hud.sector': 'SETOR {sector}/{total}',
  'hud.objective.descend': 'DESÇA PELO POÇO',
  'hud.objective.ascend': 'SUBA PELA ENTRADA — O POÇO SELOU',
  'hud.objective.extract': 'EXTRAIA NA ENTRADA',
  'hud.objective.findCore': 'ENCONTRE O NÚCLEO',
  'hud.objective.breakSeal': 'O SELO DO SETOR RESISTE — DERRUBE QUEM O SUSTENTA',
  'hud.cores': 'NÚCLEOS {taken}/{total}',
  // O localizador de cofre virou instrumento 360° no topo-centro (ver
  // cache-locator.ts); o texto cardinal "COFRE: LESTE" morreu com ele.
  'hud.locator.distance': '{distance}m',

  // Estratos e ocupações do Veio (a gramática de biomas da descida)
  'biome.stratum.basalt': 'GALERIAS DE BASALTO',
  'biome.stratum.prismatic': 'CATEDRAL PRISMÁTICA',
  'biome.stratum.aquifer': 'AQUÍFERO NEGRO',
  'biome.stratum.sulfur': 'FENDA SULFUROSA',
  'biome.stratum.furnace': 'FORNALHA ABISSAL',
  'biome.stratum.silica': 'SUMIDOUROS DE SÍLICA',
  'biome.stratum.glacial': 'CRIPTA GLACIAL',
  'biome.stratum.ferric': 'ESTRATO FERRÍFERO',
  'biome.occupation.mycelial': 'MATRIZ MICELIAL',
  'biome.occupation.aurix': 'CICATRIZ AURIX',

  // ---------------------------------------------------------------------
  // Mensagens centrais da run
  // ---------------------------------------------------------------------
  'toast.ability.assimilated': '{ability} ASSIMILADO',
  'toast.core.deeper': 'NÚCLEO {taken}/{total} RECUPERADO — DESCIDA ADICIONAL AUTORIZADA',
  'toast.furnace.cooled': 'A SALA ESFRIA',
  'toast.core.taken': 'NÚCLEO EXTRAÍDO — VOLTE PARA A ENTRADA!',
  'toast.guardian.awake': 'O GUARDIÃO DESPERTOU',
  'toast.module.expired': '{module} DESATIVADO',
  // Os quatro estados de uma peça do Diamandis. O verbo de cada frase e o que
  // separa os quatro: SOLTOU (apareceu), LEVANDO (ainda da tempo), CAIU (voltou
  // a ser sua) e PERDIDO (acabou). Sem o verbo, quatro frases com o mesmo nome
  // de peça lem todas igual no canto da tela.
  'toast.bossModule.exposed': '{module} SOLTOU DA CARCAÇA',
  'toast.bossModule.detached': 'COVEIRO LEVANDO {module}',
  'toast.bossModule.dropped': '{module} CAIU — RECUPERÁVEL',
  'toast.bossModule.lost': '{module} PERDIDO',
  'bossModule.drill': 'BROCA',
  'bossModule.tower': 'TORRE',
  'bossModule.scanner': 'LENTE',
  'bossModule.unknown': 'MÓDULO',
  'toast.cache.opened': 'COFRE RECUPERADO',
  'toast.purgeCell': '+1 CÉLULA DE PURGA',
  'toast.purge.used': 'PURGA — SISTEMAS RESTABELECIDOS +{amount}',
  'toast.scan.complete': 'VARREDURA CONCLUÍDA — COFRE REVELADO',
  'toast.overheat': 'SUPERAQUECIMENTO!',
  'toast.well.resonance': 'O VEIO RESSOA — DOIS ECOS DEMONSTRAM',
  'toast.sector.entered': 'SETOR {sector} — {biome}',

  // Mensagens emitidas pela simulação (chegam como chave, nunca como texto)
  'sim.partnerRevived': 'Parceiro revivido.',
  'sim.reviveBeforeDescend': 'Revele o parceiro abatido antes de descer.',
  'sim.waitAtShaft': 'Aguarde todos no poço para descer.',
  'sim.coreTaken': 'Núcleo extraído. O Veio despertou — volte à superfície, setor por setor!',
  'sim.wellSealedReturn': 'O poço selou. A saída é por onde você entrou.',
  'sim.reviveBeforeExtract': 'Revele o parceiro abatido antes de extrair.',
  'sim.waitAtExit': 'Aguarde todos na saída para extrair.',
  'sim.contaminationRising': 'O Veio se agita — a contaminação aumenta.',
  'sim.contaminationCritical':
    'O ar saturou. Cada segundo aqui embaixo custa sangue agora — extraia ou desça.',
  'sim.coreDropped': 'O núcleo caiu com o portador.',
  'sim.leylineCircuitClosed': 'O condutor fechou. O estrato cede até a descida.',
  'sim.arenaSealed': 'O Veio se fecha. Abra caminho ou lute.',
  'sim.ceilingCollapsing': 'O teto cede. A câmara está desabando.',
  'sim.delugeRising': 'O lençol está subindo — o setor inteiro vai submergir.',
  'sim.furnaceUnstable': 'O constructo perdeu a forma — a sala virou fogo.',
  'sim.furnaceCooled': 'O Coração parou. O calor foi embora com ele.',
  'sim.siegeCollapsed': 'O cerco desaba com o Guardião.',
  'sim.descentSealedByBoss': 'O poço não responde: o selo deste setor continua ativo.',
  'sim.coreSealedByBoss': 'O pedestal recusa o acoplamento. O selo deste setor continua ativo.',
  'sim.coreTakenDeeper': 'Núcleo recuperado — descida adicional autorizada.',

  // ---------------------------------------------------------------------
  // Escolha de módulos
  // ---------------------------------------------------------------------
  'choice.title': 'DADOS DE MÓDULO RECUPERADOS',
  'choice.card': '[{index}] {label}',
  'choice.recharge': 'RECARGA · {lifetime}',
  'choice.volatile': 'VOLÁTIL',
  // O terminal de recuperação Aurix: texto de equipamento corporativo
  // indiferente, curto o bastante para caber no CRT de um celular deitado.
  'choice.terminal.brand': 'AURIX DYNAMICS // RECUPERAÇÃO',
  'choice.terminal.unit': 'AD-SLV 04',
  'choice.cacheClass': 'COFRE CLASSE {tier}',
  'choice.integrity': 'INTEGRIDADE DE DADOS {percent}%',
  'choice.select': 'SELECIONE O EQUIPAMENTO RECUPERÁVEL',
  'choice.moduleIndex': 'MÓDULO 0{index}',
  'choice.moduleTier': 'NÍVEL {tier}',
  'choice.install': '[{index}] INSTALAR',
  'choice.rechargeAction': '[{index}] RECARREGAR',

  'module.piercing.label': 'PIERCING',
  'module.piercing.description': 'Perfura alvos sem repetir dano durante a travessia.',
  'module.piercing.proc': 'TRAVESSIAS',
  'module.conductive.label': 'CONDUCTIVE',
  'module.conductive.description': 'Descarrega biofluido e materiais conectados.',
  'module.conductive.proc': 'DESCARGAS',
  'module.explosive.label': 'EXPLOSIVE',
  'module.explosive.description':
    'Detona impactos armados em uma área. Perigoso a curta distância.',
  'module.explosive.proc': 'EXPLOSÕES',
  'module.siphon.label': 'SIPHON',
  'module.siphon.description': 'Recupera 2 HP quando um acerto útil é drenado.',
  'module.siphon.proc': 'DRENAGENS',
  'module.ricochet.label': 'RICOCHET LENS',
  'module.ricochet.description': 'Faz o bolt rebater uma vez em uma superfície sólida.',
  'module.ricochet.proc': 'REBOTES',
  'module.return_disc.label': 'RETURN DISC',
  'module.return_disc.description': 'Causa dano na ida e retorna perseguindo o Prospector.',
  'module.return_disc.proc': 'RETORNOS',
  'module.minigun.label': 'CANHÃO ROTATIVO',
  'module.minigun.description':
    'Os canos precisam pegar no tranco. Depois disso, despeja balas fracas até o cano travar.',
  'module.minigun.proc': 'BALAS',
  'hud.minigun.spinup': 'GIRANDO',
  'hud.minigun.overheated': 'CANO TRAVADO',
  'module.lifetime.charges': '{count} {proc}',
  'module.lifetime.duration': '{seconds}s',

  // ---------------------------------------------------------------------
  // Habilidades e ressonância
  // ---------------------------------------------------------------------
  'ability.pulse.label': 'PULSO CINÉTICO',
  'ability.pulse.hint': 'Empurra e dissipa nuvem. É a saída quando algo já está colado em você.',
  'ability.pulse.origin': 'Equipamento padrão de prospecção.',
  'ability.flamethrower.label': 'SOPRO TÉRMICO',
  'ability.flamethrower.hint':
    'A chama FICA no chão. Vale em corredor, e vira armadilha no seu recuo.',
  'ability.flamethrower.origin': 'O Veio ouviu você secar e queimar o que encontrou.',
  'ability.seeker.label': 'DRONE RASTREADOR',
  'ability.seeker.hint':
    'Um quadricóptero, uma carga: ele caça e mergulha, com curva lenta. Solte quando o alvo já se comprometeu com uma direção.',
  'ability.seeker.origin': 'O Veio ouviu você detonar o que encontrou.',
  'ability.arc.label': 'ARCO CONDUTIVO',
  'ability.arc.hint': 'Salta entre corpos próximos e não precisa de poça. Grupo colado é o alvo.',
  'ability.arc.origin': 'O Veio ouviu você eletrificar o que encontrou.',
  'ability.offer.use': 'USAR — {ability}',

  'resonance.fire': 'COMBUSTÃO',
  'resonance.current': 'CORRENTE',
  'resonance.blast': 'ESTOURO',
  'resonance.kinetic': 'IMPACTO',

  // ---------------------------------------------------------------------
  // Ecos do Veio (caixa-preta)
  // ---------------------------------------------------------------------
  'echo.prompt': 'USAR — PAREAR CAIXA-PRETA',
  'leyline.node.route': 'USAR — ROTEAR JUNÇÃO',
  'leyline.source.launch': 'USAR — LANÇAR CIRCUITO',
  'leyline.source.again': 'USAR — LANÇAR DE NOVO',
  'leyline.node.unroute': 'USAR — DESFAZER ROTEAMENTO',
  'echo.designation': 'UNIDADE {serial}',
  'echo.carcass': 'CARCAÇA {condition}',
  'echo.aggregate': '{count} UNIDADES PERDIDAS NESTA CÂMARA — CAUSA PREDOMINANTE ABAIXO',
  'echo.condition.scorched': 'CARBONIZADA',
  'echo.condition.arced': 'FULMINADA',
  'echo.condition.ruptured': 'ROMPIDA',
  'echo.condition.crushed': 'ESMAGADA',
  'echo.condition.dissolved': 'CORROÍDA',
  'echo.condition.overgrown': 'COLONIZADA',
  'echo.condition.intact': 'ÍNTEGRA',

  // ---------------------------------------------------------------------
  // Barra de comandos (desktop)
  //
  // Rótulos CURTOS: cada um cabe embaixo de uma tampa de tecla, e a barra
  // encolhe junto com a janela. Verbo no infinitivo, como manual de operação.
  // ---------------------------------------------------------------------
  'controls.move': 'MOVER',
  'controls.fire': 'ATIRAR',
  'controls.dodge': 'ESQUIVA',
  'controls.ability': 'HABILIDADE',
  'controls.purge': 'PURGA',
  'controls.interact': 'INTERAGIR',
  'controls.menu': 'MENU',

  // ---------------------------------------------------------------------
  // Indução do operador (o documento de boas-vindas)
  //
  // A voz é a da companhia, e a companhia não ensina: ela NOTIFICA. Cada artigo
  // diz o que o operador precisa saber para a primeira descida não ser um
  // acidente, e para nas linhas em que a descoberta começa — o Veio reage a
  // fogo, corrente e ácido, e QUAL reação vem de qual material é coisa que o
  // jogador aprende no escuro, não num parágrafo.
  // ---------------------------------------------------------------------
  'menu.induction': 'Indução',
  'aurix.doc.induction': 'AD-IND-0001 · leitura obrigatória',
  'induction.title': 'INDUÇÃO DO OPERADOR',
  'induction.preamble':
    'Bem-vindo ao Programa Prospector. Este documento substitui o treinamento presencial, descontinuado por inviabilidade logística. Leia. A Aurix não repete instrução em campo.',
  'induction.asset.code': '§1 · ATIVO',
  'induction.asset.title': 'VOCÊ NÃO DESCE',
  'induction.asset.body':
    'Desce um chassi Prospector, operado remotamente por você. O chassi é material de consumo e a companhia contabiliza a perda como custo previsto. O CONTRATO não é consumível: cada unidade perdida volta como registro, e o registro autoriza a próxima a descer mais fundo.',
  'induction.contract.code': '§2 · CONTRATO',
  'induction.contract.title': 'DESÇA. RECUPERE. EXTRAIA.',
  'induction.contract.body':
    'Cada setor tem um poço para o setor seguinte. Onde houver Núcleo, recolha-o. A carga só é homologada na EXTRAÇÃO, na entrada do setor — minério ainda no chassi é minério perdido. Descer é opcional; voltar é o que paga.',
  'induction.vein.code': '§3 · AMBIENTE',
  'induction.vein.title': 'O VEIO REAGE',
  'induction.vein.body':
    'Nada ali é cenário. Rocha frágil cede ao tiro, fogo caminha pelo que está seco, corrente atravessa qualquer poça e ácido consome o que toca — inclusive o seu chassi. A Aurix não mantém documentação sobre o que acontece quando dois desses se encontram. Recomenda-se cautela. Registra-se que a cautela raramente é o que recupera Núcleos.',
  'induction.heat.code': '§4 · ARMAMENTO',
  'induction.heat.title': 'O CANO TEM LIMITE',
  'induction.heat.body':
    'A arma esquenta a cada disparo e trava quando satura. A barra fina sob a vida é o calor, e a marca nela é o ponto em que o aviso sonoro começa. Gatilho preso é a forma mais comum de perda de unidade neste programa.',
  'induction.echo.code': '§5 · POÇO',
  'induction.echo.title': 'O VEIO OUVE',
  'induction.echo.body':
    'Os poços oferecem habilidades, e a oferta não é sorteio: ela responde ao que você fez até ali. O que você queimou, eletrificou ou detonou volta como equipamento. Uma habilidade equipada tem recarga — a barra de comandos, no rodapé, diz quando ela volta.',
  'induction.archive.code': '§6 · ARQUIVO',
  'induction.archive.title': 'LEIA A MATRIZ',
  'induction.archive.body':
    'Toda unidade recuperada alimenta a MATRIZ GERACIONAL. Ali ficam os Arquivos Aurix — o que a companhia sabe sobre cada Ativo que você encontrou lá embaixo, liberado à medida que você o encontra — e os protocolos de hardware, que autorizam a geração seguinte a descer mais fundo, aguentar mais e mirar melhor. O que você não ler continua acontecendo com você.',
  'induction.controls.title': 'ESQUEMA DE COMANDO · TERMINAL DE MESA',
  'induction.controls.note':
    'Em aparelho de toque o esquema é outro: manche esquerdo move, manche direito mira e dispara, e os botões acima dele repetem esta lista.',
  'induction.begin': 'AUTORIZAR DESCIDA',
  'induction.archiveButton': 'ARQUIVAR',
  'induction.reopen': 'Este documento continua no despacho, em INDUÇÃO.',
  'induction.training': 'OPERAÇÃO DE TREINAMENTO',

  // ---------------------------------------------------------------------
  // Operação de treinamento (o exercício da primeira descida)
  //
  // A voz continua sendo a da companhia, agora em circular de exercício: a
  // instrução é numerada, curta e imperativa. Cada passo tem uma variante
  // `.touch` porque o esquema de comando é outro no toque — e a instrução que
  // cita a tecla errada ensina errado.
  // ---------------------------------------------------------------------
  'menu.training': 'Operação de treinamento',
  'aurix.doc.training': 'FORMULÁRIO AD-TRN-01 · exercício de indução',
  'training.step.move': 'Exercício 1 — MOVER: W A S D. Avance pela galeria.',
  'training.step.move.touch': 'Exercício 1 — MOVER: manche esquerdo. Avance pela galeria.',
  'training.step.clear':
    'Exercício 2 — FOGO: segure o botão esquerdo do mouse e mire com o cursor. Neutralize os dois espécimes.',
  'training.step.clear.touch':
    'Exercício 2 — FOGO: o manche direito mira e dispara. Neutralize os dois espécimes.',
  'training.step.dash':
    'Exercício 3 — ESQUIVA: ESPAÇO. Execute um avanço evasivo entre os pilares.',
  'training.step.dash.touch':
    'Exercício 3 — ESQUIVA: botão de esquiva. Execute um avanço evasivo entre os pilares.',
  'training.step.core': 'Exercício 4 — O NÚCLEO: aproxime-se do pedestal e interaja com E.',
  'training.step.core.touch':
    'Exercício 4 — O NÚCLEO: aproxime-se do pedestal e use o botão de interação.',
  'training.step.extract':
    'Exercício final — EXTRAÇÃO: volte à plataforma de entrada e interaja com E. Carga só conta fora do Veio.',
  'training.step.extract.touch':
    'Exercício final — EXTRAÇÃO: volte à plataforma de entrada e use o botão de interação. Carga só conta fora do Veio.',
  'training.done.move': '✓ deslocamento registrado',
  'training.done.clear': '✓ neutralização registrada',
  'training.done.dash': '✓ evasiva registrada',
  'training.tip.heat':
    'O cano saturou. Solte o gatilho e deixe o calor cair — ritmo é parte do armamento.',
  'training.complete.title': 'EXERCÍCIO HOMOLOGADO',
  'training.complete.body':
    'Registro de treinamento arquivado. Nenhuma carga foi creditada — treinamento não rende. O Veio lá embaixo rende.',
  'training.complete.descend': 'AUTORIZAR DESCIDA',
  'training.complete.terminal': 'VOLTAR AO TERMINAL',
  // Extração de mãos vazias: a saída é registrada, o exercício não. A voz
  // continua notificando em vez de repreender — o contrato pedia o Núcleo, e
  // a única consequência é o formulário oferecer a repetição.
  'training.incomplete.title': 'EXERCÍCIO NÃO HOMOLOGADO',
  'training.incomplete.body':
    'Extração sem carga. O contrato do exercício pede o Núcleo na plataforma — a companhia registra a saída, mas não homologa. Repita a operação.',
  'training.incomplete.retry': 'REPETIR EXERCÍCIO',

  // ---------------------------------------------------------------------
  // Arquivo desbloqueado (o aviso, nao o painel)
  //
  // Curto por medida: o cartao avisa, quem le e o documento. 'LIBERADO'
  // e a voz da companhia — ela nao presenteia, ela autoriza acesso.
  // ---------------------------------------------------------------------
  'lore.toast.unlocked': 'ARQUIVO LIBERADO',
  'lore.toast.debut': 'PRIMEIRO ARQUIVO',
  'lore.toast.open': 'abrir documento',
} as const;
