// Versoes de compatibilidade transmitidas em todo handshake e snapshot.
// Regras:
// - PROTOCOL_VERSION muda quando o formato das mensagens muda (quebra de wire).
// - SIMULATION_VERSION muda quando a logica autoritativa muda de forma que altera
//   hashes deterministicos (cliente e servidor precisam concordar para prever/interpolar).
// - CONTENT_VERSION muda quando itens/criaturas/materiais mudam (pool de conteudo).
// 11: eventos `message` passam a viajar como CHAVE de catalogo (`key`) e nao
// como frase pronta (`text`). E quebra de wire nos dois sentidos: um cliente
// novo contra servidor antigo leria `key` ausente e mostraria o aviso em
// branco, e um cliente antigo contra servidor novo procuraria `text`. Sem o
// bump, o handshake aceitaria os dois pares e o defeito apareceria como um
// aviso vazio no meio do co-op, em vez de uma recusa explicita na conexao.
// 12: CARGA NAO HOMOLOGADA no wire. `cargoOre` entra em snapshot e full_resync
// como estado GLOBAL da sala — `oreCollected` sempre foi contador de equipe, e
// poe-lo no estado privado do viewer inventaria uma posse individual que a
// simulacao nao tem. Sem o campo, o contador do HUD dependeria so dos eventos
// `ore_gained`: quem reconecta ou pede resync veria a carga da run zerada e
// tomaria a decisao de extrair com o numero errado na tela.
// 13: o SOPRO CANALIZADO muda o formato do evento `flame_cone` — `seq` e
// `reach` (alcances reais por raio, recortados por parede) viram campos
// OBRIGATORIOS — e dois eventos novos entram no wire: `bolt_impact` (burst de
// plasma do bolt em parede firme) e `action_end` (cancelamento de acao
// telegrafada antes do `endTick` anunciado). E quebra nos dois sentidos: um
// cliente novo contra servidor antigo espalha um `reach` ausente em
// `Math.max(...)` e quebra no primeiro sopro; um cliente antigo contra
// servidor novo ignora o recorte e desenha chama atravessando parede.
// Ainda na 13 (mesma leva): `ViewerState` passa a transportar os timers
// privados de recarga (`dodgeCooldownUntil`, `abilityCooldownUntil`,
// `channelingUntil`) e a habilidade EQUIPADA (`ability`) — o radial do HUD
// online deixa de chutar a duracao a partir do toque e segue o servidor, com
// o cooldown da habilidade certa.
// 14: `flame_cone` ganha `owner` OBRIGATORIO — e por ele que o cliente gira o
// tronco do dono junto com o jato, inclusive o do parceiro remoto, cujo
// `facing` de snapshot passou a seguir os pes. Um cliente novo contra servidor
// v13 receberia emissoes sem `owner` e nunca associaria a chama ao corpo.
// 15: `WorldFlags.guardianAwake` vira `bossAwake`, e o evento `guardian_awake`
// vira `boss_awake`. Desde `bossForBiome` a camara final pode ser do Bispo (ou
// de qualquer outro da tabela), e os dois nomes antigos mentiam sobre metade
// das runs. E quebra nos dois sentidos: um cliente novo contra servidor antigo
// le `bossAwake` ausente e nunca acorda a apresentacao do chefe; um cliente
// antigo contra servidor novo procura `guardianAwake` e nao acha.
// 16: dois eventos novos do Diamandis. `blast_marker` (uma carga da Salva de
// Demolicao marcada, com o tick em que cai) e `beam_line` (o feixe de
// prospeccao, com `powered` distinguindo a varredura inofensiva da passagem
// com potencia). Um cliente antigo nao desenharia nem a marca nem a linha — e
// as duas SAO o telegrafo: sem elas, os dois golpes chegam sem sinal.
// 17: o evento `boss_module` — a vida de um modulo do Diamandis (soltou,
// arrancado, derrubado, perdido). Um cliente antigo nao desenharia nem o
// modulo pendurado nem o Coveiro carregando: a ESCOLHA do encontro (deixar
// trabalhar ou interceptar) e feita a partir do que se ve.
// 18: a acao `leap` — o arco do Devorador Branco, da decolagem a queda. O
// `EntityActionKind` e um enum no wire, entao um cliente antigo recebe um
// `kind` que ele nao conhece e cai no ramo de ataque: desenharia o chefe
// PLANTADO NO CHAO durante o voo, porque a altura da parabola sai justamente
// do vao de tempo dessa acao. O corpo apareceria atravessando a arena colado no
// piso, sem sombra descolada e sem arco nenhum.
// 19: PROFUNDIDADE POR GERACAO no wire. O handshake passa a carregar a
// configuracao congelada da sala (`sectorCount`, `coreSectors`, `generation`),
// `WorldFlags` troca o booleano `coreTaken` por ele MAIS a mascara de Nucleos
// recolhidos e os dois selos do setor (`descentUnlocked`, `coreUnlocked`,
// `activeBoss`), `ViewerState` ganha `coreCount`, `sector_entered` ganha o
// total acessivel e o dono do setor, e entra o evento `sector_unsealed`.
// E quebra nos dois sentidos, e as duas metades doem: um cliente novo contra
// servidor antigo le `sectorCount` ausente e desenha "SETOR 2/undefined",
// alem de nunca saber que o poco esta selado — ele mostraria o portal aberto
// e o jogador ficaria apertando interagir sem resposta; um cliente antigo
// contra servidor novo procura `coreTaken` (que continua la) mas ignora os
// selos e a contagem, entao anunciaria a run encerrada no primeiro Nucleo de
// uma expedicao de G-04 que ainda tem quatro setores pela frente.
// 20: o COLAPSO TERMICO do Coracao da Fornalha entra no wire. `WorldFlags`
// ganha `bossPhases` (a bitmask de fases de uma vez, espelhada para quem
// reconecta no meio), tres eventos novos — `boss_phase`, `stalactite` e
// `furnace_cooled` — e `ProjectileKind` ganha `cyclone`.
// E quebra nos dois sentidos, e a metade que dói é o cliente antigo contra
// servidor novo: ele recebe um `kind` de projetil que nao conhece e cai no
// ramo de desenho generico, entao o ciclone que o esta matando aparece como
// um ponto; e ignora `stalactite`, que e o TELEGRAFO da queda — dano sem
// sinal, o unico invariante de combate que este jogo nao quebra. Um cliente
// novo contra servidor antigo le `bossPhases` ausente e nunca acende a
// apresentacao do colapso.
// 21: o DILUVIO do Leviata entra em `WorldFlags` como tres numeros
// (`delugeAt`, `delugeX`, `delugeY`), e o evento `discharge` ganha `fromX`/
// `fromY` — o ponto em que a corrente entrou no condutor.
//
// Os tres primeiros sao OPCIONAIS de proposito: um servidor anterior ao Diluvio
// simplesmente nao os manda e o cliente le -1, que e "nunca aconteceu". O bump
// existe pelo segundo campo — sem `fromX`/`fromY` um cliente novo nao consegue
// prever a atenuacao da corrente, e prever dano errado num setor inteiramente
// condutivo e a pior forma de discordancia possivel: ela aparece como vida
// sumindo sem causa visivel.
// 22: o evento `hit` no jogador ganha `hazard` opcional — dano POR TICK do
// chao cobrando presenca (gas, esporo, fogo sob os pes), apresentacao apenas.
// Esse dano roda a 20 Hz, e sem a marca o cliente nao tem como distinguir a
// pressao continua de uma pancada de chefe: ele tocava o impacto pleno
// (`hitPlayer`) em ate 14 disparos por segundo dentro de uma nuvem de gas.
// E um FLAG do call site (`applyCellHazards`), e nao a causa do dano, de
// proposito: a primeira forma deste campo carregava `DamageCause['kind']` e o
// cliente inferia "fogo => pressao" — inferencia que a varredura energizada
// do Coracao da Fornalha desmentiu na primeira review, porque ela tambem fere
// com {kind:'fire'} e E uma pancada. O campo permanece opcional por
// TOLERANCIA DEFENSIVA no cliente (fixtures, eventos construidos a mao em
// teste) — a interoperabilidade cliente-servidor e protegida pelo exact-match
// deste numero; nao ha expectativa de conexao cruzada 21<->22.
// 23: as LEYLINES entram no wire por dois campos. O evento `leyline_charge`
// e O TELEGRAFO da descarga de segmento — um cliente que nao o conhece
// tomaria o choque sem o sinal previo que justifica o dano existir, que e
// exatamente a classe de quebra que este numero guarda. E `WorldFlags` ganha
// `leylineClocks` (opcional, alinhado por indice como `railTimers`): quem
// reconecta durante os 16 ticks de carga recebe o relogio e desenha o aviso;
// servidor anterior simplesmente nao manda e tudo fica dormente. (Nasceu como
// "22" na branch das leylines, em paralelo ao hazard acima; renumerado no
// merge — dois protocolos diferentes nao podem dividir um numero que o
// handshake compara por igualdade.)
// 24: o ROTEAMENTO das leylines entra no wire por tres campos. `WorldFlags`
// ganha `leylineRouting` (opcional, boolean por indice de juncao — o mesmo
// contrato alinhado de railTimers/leylineClocks); o evento `discharge` ganha
// `relayed` (a descarga repassada por rele, que nao credita ressonancia); e
// nasce o evento `leyline_routed` (o toggle, para cue e particula). A metade
// que doi: cliente antigo contra servidor novo nunca desenharia a juncao
// roteada nem o prompt, e veria um rele "inexplicavel" atravessar — energia
// pulando de segmento sem causa visivel.
// 25: o CIRCUITO da leyline entra no wire por tres campos. `WorldFlags` ganha
// `leylineCircuit` (opcional: `closed`/`live` e o placar `lit`/`total`) —
// `closed` nao e enfeite, ele desliga a propriedade do estrato, entao quem
// reconecta sem ele desenharia a agua do Aquifero conduzindo onde a sim ja
// decidiu que nao conduz, prometendo um choque que nao vem. E nascem dois
// eventos: `leyline_short` (o segmento recusou a carga por ter cristal e
// minerio demais encostados — sem ele o obstaculo seria indistinguivel de a
// mecanica estar quebrada) e `leyline_circuit` (o desfecho da cascata). A
// metade que doi: cliente antigo contra servidor novo veria a cascata morrer
// no meio sem motivo e nunca saberia que o setor tinha um circuito.
// 26: a MINIGUN entra no wire. `ViewerState` ganha `minigun` (rotacao,
// acumulador e fase autoritativos do canhao rotativo) e nascem dois eventos:
// `minigun_spin`, publicado so na TRANSICAO de fase, e `minigun_burst`, a
// contagem AGREGADA de balas de uma janela de quatro ticks. `ProjectileKind`
// ganha `flechette`.
// As duas metades doem. Um cliente antigo contra servidor novo recebe um
// `kind` que nao conhece e desenha o estilhaco generico: dezesseis por segundo
// viram uma mancha unica onde deveria haver tracantes, e a unica leitura que a
// arma tem — para onde vai o muro de balas — some. Um cliente novo contra
// servidor antigo le `minigun` ausente e desenha canos parados durante o
// spin-up inteiro, que e justamente a meia-segundo de antecipacao pela qual a
// arma existe.
// O que deliberadamente NAO entrou: um evento por bala. A cadencia e de
// dezesseis por segundo por jogador, e a apresentacao precisa da densidade,
// nao da sequencia — o projetil em si continua viajando no snapshot como
// todos os outros, entao nada do que machuca depende de evento nenhum.
// 27: `WorldFlags` ganha `mawOpenedAt` — o tick em que a BOCA do Devorador
// Branco abriu, ou -1. Um numero so, pela mesma economia do Diluvio: o vortice
// inteiro (alcance, forca a cada distancia, quanto ainda falta para abrir) e
// derivado dele mais as constantes que as duas pontas compartilham.
// As duas metades doem, e de formas diferentes. Cliente ANTIGO contra servidor
// novo desenha um chefe entalado e inofensivo — a leitura antiga, e ela virou
// mentira — enquanto o servidor arrasta o corpo do jogador para dentro da
// garganta: dano sem sinal, o unico invariante de combate que este projeto nao
// quebra. Cliente NOVO contra servidor antigo le o campo ausente como -1 e
// nunca desenha vortice nenhum, o que esta certo: naquela simulacao ele nao
// existe.
// O que deliberadamente NAO entrou: um campo por tick com o alcance atual. Ele
// diria o que o cliente sabe calcular, e abriria a chance de o anel desenhado
// discordar da sucao que ele promete — que e a unica coisa que este efeito nao
// pode fazer.
// 28: WorldFlags carrega a carga do Leviata e as duas bolhas protetivas;
// EntityActionKind/eventos ganham massive_shock/leviathan_discharge.
export const PROTOCOL_VERSION = 28;
// 14: sistema de biomas — estratos/ocupacoes/linhagens mudam a geracao semeada
// dos setores 2+ e a populacao de inimigos; agua/brasa/gelo mudam reacoes de
// celula; cinco arquetipos de assinatura entram na simulacao e no hash de
// kills. Dois peers em versoes diferentes gerariam MUNDOS diferentes da mesma
// seed — a recusa tem de acontecer no handshake, nao como divergencia de hash
// no minuto tres. (O protocolo em si nao muda: o envelope das mensagens e o
// mesmo, e os campos novos de `sector_entered` viajam dentro de um evento cujo
// par de versoes de sim ja garante que ambos os lados conhecem.)
// 15: a Lampreia vira bando (tres por setor de Aquifero), as vagas de
// assinatura derivam do orcamento real do setor, e os estratos ganham
// ESTRUTURAS DE SALAO no worldgen (rotunda, pulmoes, canions, bacias,
// sumidouros, lagos) — a geracao semeada dos setores 2+ muda de novo.
// 16: INERCIA DO GELO — sobre SURF_ICE o movimento do jogador carrega
// embalo (ICE_GLIDE): o rumo novo entra aos poucos e soltar o direcional
// desliza. Fora do gelo o passo e byte a byte o historico, mas dois peers
// em versoes diferentes divergiriam na primeira pisada da Cripta. E a
// SILICA ganha FRATURA POR CAMADA (quebrar fragil enfraquece os vizinhos
// frageis da mesma faixa horizontal) + SEAMS de minerio no worldgen — a
// geracao e a fisica dos setores sedimentares mudam juntas nesta versao.
// Ainda em 16 (mesma leva, nunca lancada separada): o ESTRATO FERRIFERO —
// a linhagem industrial re-trilhada (basalto -> ferrifero -> ferrifero),
// seams + nos de minerio, minerCap alto e conducao por parede
// (FERRIC_VEIN_SCALE) — e o pedestal do poco por estrato no worldgen. E a
// ARMADILHA DE CARRINHO: tramos SURF_RAIL/SURF_RAIL_V no worldgen da
// operacao (Aurix/ferrifero), gatilho por pisada com telegrafo
// (cart_warning) e o carrinho como projetil hostil (kind 'cart') que
// atropela jogador E bicho sem morrer no impacto. E a EXTRACAO DE
// RETORNO: com o Nucleo o poco sela, a entrada de setor profundo vira
// portal de SUBIDA (ascend — mundo regenerado da mesma seed, fauna
// repovoada, contaminacao sem alivio) e a vitoria so fecha na plataforma
// do setor 1.
// 17: FAUNA AFINADA POR BIOMA e a memoria de chefe abatido.
// - Chefe morto NAO repovoa: a extracao de retorno regenera o setor na
//   subida, e o repovoamento carimbava o Bispo de volta na camara — a
//   conquista mais cara da run desmanchando sozinha. `bossesDown` (mascara
//   por setor) entra no estado e no hash autoritativo.
// - Bandos de assinatura: cada estrato passa a receber VARIOS exemplares do
//   proprio bicho (SIGNATURE_PACK), ocupando vagas comuns — a densidade nao
//   muda, muda quem a preenche. A populacao semeada de todo setor 2+ muda.
// - BOMBARDEIRO DE ENXOFRE: onde nao ha micelio (Fenda e Fornalha) o Spore
//   Bomber some da mistura e entra o de enxofre, que estoura em GAS — e gas,
//   ao contrario de esporo, pega fogo.
// - COVEIRO: assinatura do Ferrifero. Eletroima com telegrafo longo ARRASTA
//   o jogador (passo a passo, respeitando colisao) e a prensa vem em
//   seguida. Primeiro corpo do bestiario que tira do jogador a posicao.
// 18: ARENA DO CHEFE POR ESTRATO. A camara do Bispo e a do Guardiao eram a
// ultima sala importante que saia igual em todo bioma — a mesma clareira lisa
// na Catedral, na Cripta e na Fornalha, e e onde o jogador passa mais tempo
// olhando para o chao. Agora ela recebe uma moldura no vocabulario do proprio
// estrato: pilares de cristal que sao cobertura E municao (prismatico), orla
// de agua que devolve a descarga do jogador (aquifero), parede porosa que
// vira passagem nos dois sentidos (sulfur), orla de brasa que abre a couraca
// do Escoriaceo e cobra a mesma barra da arma (fornalha/ferrifero), anel
// fragil que cede em faixa (silica) e chao que ESCORREGA por inteiro
// (glacial). O carimbo roda depois da escolha do ponto do chefe, entao paga a
// propria prova de alcancabilidade e se DESFAZ inteiro se isolar poco ou
// chefe. O terreno semeado de todo setor de chefe muda.
// 19: MATRIZ GERACIONAL. Duas mudancas autoritativas na mesma leva:
// - a cota de modulo por minerio SAI (payOreQuota, ORE_PER_MODULE,
//   oreModulesPaid). Dois peers em versoes diferentes discordariam sobre a
//   existencia de uma escolha pendente no tick em que a 14a lasca cai;
// - o PlayerTuning entra no estado e no HASH autoritativo. Uma expedicao com
//   +12% de vida tem de produzir um digest diferente do de uma run de fabrica,
//   senao o replay do leaderboard verificaria uma contra a outra.
// Tambem aqui: DISCOVERY_CARGO_LOST (bit 13) entra na bitmask de descobertas,
// que ja fazia parte do hash.
// 20: DIRECAO PERSISTENTE E SOPRO CANALIZADO. Tres mudancas autoritativas na
// mesma leva:
// - o comando neutro passa a ter mira ZERO (era a mira fantasma {1,0} que
//   esmagava o facing): dois peers em versoes diferentes discordam do rumo de
//   cada bolt disparado sem mira ativa;
// - o lanca-chamas vira CANALIZACAO (`channelingUntil`): emissoes por tick
//   seguindo a mira, bolt travado durante o canal e cooldown cobrado no FIM —
//   um replay pre-canal re-simulado sob as regras novas produz outra run;
// - a mira persistida e o canal entram no HASH autoritativo, e o bolt que
//   morre em parede firme emite `bolt_impact`.
// O terreno semeado NAO muda: a impressao digital da geracao continua a da 18.
// 21: FACING POR MOVIMENTO. `player.facing` deixa de ser sinonimo da mira:
// andar sem mirar gira o corpo (fora do canal do sopro), e o facing entra no
// hash autoritativo — ele decide a esquiva SEM direcional, entao um replay
// v20 re-simulado sob a regra nova esquiva para outro lado. O terreno semeado
// continua o da 18.
// 22: CHEFES POR BIOMA. Quatro mudancas autoritativas na mesma leva:
// - `bossForBiome` substitui o chefe por numero de setor: UM chefe por run, no
//   setor FINAL, escolhido por estrato x ocupacao (micelio -> Bispo; os demais
//   caem no Guardiao ate cada linha da tabela ganhar corpo). O setor 2 deixa
//   de ter Bispo e o setor 1 nunca tem chefe — a POPULACAO semeada de todo
//   setor muda, e dois peers em versoes diferentes montariam elencos
//   diferentes da mesma seed.
// - O Bispo perde o cuspe generico; a Supernova vira a resposta primaria a
//   distancia (cooldown 300) e o gatilho ferido muda de "nenhum fungo em 14
//   tiles" para "nao PISOU em fungo dentro da janela de busca" — fungo
//   inalcancavel atras de parede deixa de bloquear o ataque para sempre.
// - O Guardiao troca o cuspe pela SALVA LITOCLASTA: leque de tres pedras
//   (kind 'rock', sem biofluido, sem stun) com rajada alternada na segunda
//   fase; a rajada re-arma o release da acao, e os relogios da acao ja entram
//   no hash.
// - O poco do setor 1 sempre revela pelo menos UM Eco (fallback
//   deterministico pela seed quando nao ha ressonancia).
// 23: as duas DESCOBERTAS do Bispo — `DISCOVERY_BISHOP_HEALED` (viu a cura de
// perto, com a linha livre) e `DISCOVERY_BISHOP_NOVA_SURVIVED` (estava dentro
// do disco da Supernova e continuou de pe). A bitmask de descobertas ja fazia
// parte do hash autoritativo, entao dois peers em versoes diferentes divergem
// no primeiro tick de cura testemunhada — e o Codex do perfil abriria
// documentos diferentes para a mesma run.
// 24: o estado do encontro de chefe vira `BossRuntime` — `guardianAwake`,
// `guardianSummoned`, `guardianPath`, `guardianPathAt`, `arenaClosed` e
// `arenaBarrierCells` saem do topo do estado e entram num objeto so, com as
// fases de uma vez viradas BITMASK (`phasesFired`). O hash passa a misturar a
// bitmask no lugar do booleano de invocacao: dois peers em versoes diferentes
// divergem no tick em que a matilha sai.
// 25: DIAMANDIS. Arquetipo novo (entra no fim de HASHED_ARCHETYPES e nos
// contadores de abate), tres acoes novas (`drill`, `demolish`, `beam`), a fase
// de uma vez do colapso do reator (BOSS_PHASE_REACTOR), as celulas marcadas da
// salva no estado hasheado (`bossRuntime.blastCells`) e a Descoberta
// DISCOVERY_DIAMANDIS_CORRIDOR (bit 16). A camara final de todo bioma Aurix
// troca de ocupante: dois peers em versoes diferentes montam elencos
// diferentes da mesma seed.
// 26: A ECONOMIA DOS COVEIROS. Modulos presos ao Diamandis (cada um alimenta
// uma arma) soltam por limiar de vida, e um Coveiro que enxergue um modulo
// solto LARGA o jogador, arranca a peca e a carrega para fora do alcance. O
// chefe perde a arma; a recompensa do abate paga so pelos modulos que ficaram.
// `modulesExposed`/`modulesLost` entram no hash e a Descoberta
// DISCOVERY_DIAMANDIS_MODULE (bit 17) na bitmask: dois peers em versoes
// diferentes discordam de quais armas o chefe ainda tem.
// 27: DEVORADOR BRANCO, e duas materias novas de superficie. SURF_SILT (13) e
// o rastro que ele deixa por baixo; SURF_GLASS (14) e o que sobra quando alguem
// poe calor nele — e sobre vidro ele NAO emerge, que e o contra-jogo inteiro do
// encontro. `igniteCell` ganha o ramo de vitrificacao e DISCOVERY_SILICA_
// VITRIFIED (bit 18) entra na bitmask.
//
// E a linhagem ARIDA passou a terminar em Sumidouros de Silica em vez de
// Fornalha Abissal: sem isso o estrato sedimentar nunca era o ultimo e o chefe
// dele nao tinha onde nascer. O TERRENO SEMEADO de toda run arida muda (ver
// tests/impressao-digital-geracao.test.ts).
// 28: OS SEIS CHEFES DE ESTRATO. Arquicantor, Leviata do Lencol,
// Pulmao-Matriz, Coracao da Fornalha, Rainha da Geada e Magnetarca entram como
// arquetipos (fim de HASHED_ARCHETYPES e dos contadores) com uma acao nova
// (`freeze`) e as posturas de ciclo. A tabela de chefes fica COMPLETA e o
// fallback no Guardiao deixa de responder por qualquer linha.
//
// E duas mudancas de MUNDO, ambas pelo mesmo motivo — um chefe que nao pode
// nascer nao esta implementado:
// - entra a linhagem BASALTICA (basalto do topo ao fundo). O Guardiao e o dono
//   das Galerias e nenhuma linhagem terminava nelas. Uma linhagem a mais
//   remapeia TODA seed (o sorteio e `% LINEAGE_ORDER.length`);
// - o objetivo nao pode mais encostar na moldura do mapa
//   (CORE_BORDER_MARGIN): o 3x3 livre em volta dele e onde o corpo do chefe
//   tem de caber, e num canto ele nao cabia.
// 29: as seis DESCOBERTAS de estrato — silenciar a Catedral, eletrocutar o
// Leviata, incendiar a expiracao do Pulmao, acertar o Coracao na janela fria,
// derreter o lago da Rainha e ficar na faixa do Magnetarca (bits 19..24). A
// bitmask de descobertas ja entrava no hash: dois peers em versoes diferentes
// divergem no primeiro tick em que qualquer uma delas acende.
// 30: o Devorador Branco deixa de EMERGIR e passa a SALTAR. A emergencia era um
// ponto; agora e um arco — ele recua por baixo ate um ponto de decolagem, rompe
// o chao ali e atravessa o ar ate a queda, com cratera nas duas pontas e nada
// no meio. Muda posicao, dano, humor (`DEVOURER_AIRBORNE`) e o hash: o ponto de
// queda entra no estado autoritativo. Duas simulacoes em versoes diferentes
// divergem no primeiro ciclo do chefe.
//
// O contra-jogo cresceu junto, e essa e a razao da mudanca: ele so decola de
// chao SOLTO, entao vitrificar em volta de si empurra a decolagem para longe —
// e arco longo e voo longo, e no ar nao ha areia absorvendo tiro. O vidro
// deixou de so negar a saida e passou a esticar a trajetoria.
// 31: o ciclo do Devorador vira RAJADA. Sao tres arcos mirados em sequencia e
// so entao a abertura — e a abertura deixou de ser "exposto perseguindo devagar"
// e virou PRESO: meio enterrado, imovel, sem cobrar contato e sem areia
// absorvendo tiro. Humor novo (`DEVOURER_STUCK`), contador de saltos no estado
// autoritativo e no hash, e o ponto de queda do arco — que estava faltando no
// hash desde a versao anterior — entram junto.
//
// O que muda de jogo: a pressao passa a SUBIR ate a janela em vez de alternar
// em ritmo constante, e a janela concentra a exposicao num alvo parado. Duas
// simulacoes em versoes diferentes divergem no primeiro pouso.
// 32: LINHAGENS DE ATE SETE SETORES. A profundidade de uma run deixa de ser a
// constante `SECTOR_COUNT` e passa a ser a AUTORIZACAO da geracao, congelada na
// criacao: G-00/G-01 tres setores, G-02 quatro, G-03 cinco, G-04 sete. Cinco
// mudancas autoritativas na mesma leva:
//
// - a configuracao de profundidade (`generation`, `sectorCount`, `coreSectors`)
//   entra no estado e no HASH. Duas runs com a mesma seed e profundidades
//   diferentes sao runs diferentes desde o tick zero, e o replay tem de acusar
//   isso em vez de verificar uma contra a outra;
// - `coreTaken` (booleano) vira `coresTakenMask` (bit por setor), porque de
//   G-03 em diante ha DOIS Nucleos — um no setor 3 e outro no final. A mascara
//   entra no hash no lugar do booleano;
// - CHEFE POR POSICAO: alem do setor final, todo setor de Nucleo tem dono. O
//   selo dele tranca o poco E o pedestal (`descentUnlocked`/`coreUnlocked`), e
//   a coleta do Nucleo com o chefe de pe deixa de existir — o que muda a ordem
//   de eventos de toda run, inclusive as de tres setores;
// - `bossesDown` vira `bossesDownMask` e passa a ser marcada pelo `entityId` do
//   dono do setor em vez de por uma lista de arquetipos escrita a mao. Os oito
//   chefes que a lista nao mencionava passam a ficar abatidos de verdade: antes
//   deste bump, um Arquicantor morto RENASCIA na subida;
// - as linhagens ganham as posicoes 4 a 7 e `biomeProfile` le `depthIntensity`
//   no lugar de `sector - 1` truncado em 2.
//
// O TERRENO SEMEADO DOS SETORES 1 A 3 NAO MUDA — e proposital e esta coberto
// por tests/impressao-digital-geracao.test.ts, que continua na assinatura
// 2694607655. A mesma seed em G-01 e em G-04 produz os mesmos tres primeiros
// setores; o que a geracao muda e ate onde se pode ir. Ainda assim o bump e
// obrigatorio: a ordem de eventos, o hash e a estrutura de chefes mudaram, e
// dois peers em versoes diferentes divergiriam no primeiro selo.
// 33: COLAPSO TERMICO — a escada de fim de luta do Coracao da Fornalha.
//
// Duas fases de uma vez em `bossRuntime.phasesFired`, que ja entrava no hash:
//
// - 45% (`BOSS_PHASE_OVERHEAT`): o TETO cede. Estalactites sao marcadas perto
//   dos jogadores e caem depois de um aviso, cobrando dano e deixando brasa no
//   impacto. As marcas vivem em `bossRuntime.collapseCells` (celula + tick da
//   queda) e entram no hash: duas simulacoes que discordem de onde o teto cai
//   divergem no dano um segundo depois, longe da causa.
// - 10% (`BOSS_PHASE_UNSTABLE`): o constructo perde a forma e solta CICLONES,
//   um `ProjectileKind` novo. Eles atravessam a sala acendendo o que encostam
//   e cobram por tempo (`nextTouchAt`, tambem hasheado), nao por corpo.
//
// E o ABATE apaga a camara: brasa e fogo saem, os ciclones se dissolvem e as
// estalactites ja marcadas sao canceladas. Autoritativo e nao apresentacao —
// um cliente que apagasse o fogo sozinho desenharia chao seguro sobre celulas
// que ainda queimam, e o parceiro morreria num lugar que a tela dele mostrava
// apagado.
//
// As estalactites NAO consomem `state.rng`: elas caem dezenas de vezes por
// encontro, e cada tirada deslocaria a sequencia da run inteira — duas
// partidas com a mesma seed passariam a divergir em tudo o que vem depois de
// um chefe conforme o jogador demorasse mais ou menos para mata-lo. A posicao
// sai de um hash puro de (seed, tick, indice).
//
//
// E as duas correcoes do primeiro playtest de sete setores:
//
// - UM CHEFE POR RUN. Com dois setores de chefe, 38% das runs de G-04
//   enfrentavam o MESMO chefe duas vezes (termica 51%, mineral 48%): o setor 3
//   e o final costumam ser o mesmo estrato — e o que faz uma linhagem arida ser
//   arida — e duas intrusoes Aurix davam dois Diamandis. O setor mais fundo
//   fica com o dono do proprio bioma e o raso cede: com ocupacao, para o chefe
//   do ESTRATO (a cicatriz cede ao veio); sem ocupacao, a camara do Nucleo
//   intermediario e uma camara TOMADA. O terreno nao muda — o que muda e quem
//   ocupa a camara.
// - CORACAO DA FORNALHA. Ele era fixo, so pintava brasa num raio de OITO e nao
//   tinha resposta nenhuma a distancia: um jogador parado a doze tiles matava
//   900 de vida sem risco. A varredura passa a cobrir a camara (raio 15), a
//   cobrar dano NA PASSAGEM (e nao so de quem para na brasa) e a mandar
//   Escoriaceos no comeco de cada superaquecimento — a fauna do proprio
//   estrato, atravessando a janela fria em que o chefe fica vulneravel.
//
//
// O terreno semeado nao muda: nada aqui toca o worldgen.
// 34: A LEVA DE CORRECOES DO PRIMEIRO PLAYTEST DOS DEZ CHEFES.
//
// Guardiao, Rainha da Geada e Pulmao-Matriz saem intactos — foram os tres que
// impuseram a propria frase mecanica e nao ha o que consertar neles. Magnetarca
// fica em observacao. Os outros seis mudam, e os dois primeiros por defeito
// ESTRUTURAL e nao por numero:
//
// - CORACAO DA FORNALHA. Na Fornalha cinza e carvao, e `igniteCell` a devolve
//   como fogo de 110 ticks: com o setor girando por cima da propria cinza, a
//   varredura se realimentava e a camara inteira virava fogo permanente. O
//   jogador nao conseguia distinguir chao perigoso de chao seguro porque nao
//   havia mais chao seguro. A varredura passa a reacender com o COMBUSTIVEL
//   dela (curto), o setor gira menos que a propria abertura (a borda anda em
//   vez de teleportar), e o AVISO e uma cunha derivada de (posicao, tick) nas
//   duas pontas — nao entra no wire nem no hash, e por isso nao pode
//   dessincronizar. A ninhada cai para um Escoriaceo por vez enquanto a
//   primeira fase dura: ela existe para ensinar a sala, nao para cobrar por ela.
// - DEVORADOR BRANCO. Ele saía do portao de aggro comum e por isso nao tinha
//   portao nenhum: cacava desde o tick zero, do outro lado do setor, e a
//   primeira emergencia saia no tick em que notava o jogador. Ganha estado de
//   repouso (`diverEngaged`, compartilhado com o Leviata), um mergulho de
//   divida antes do primeiro arco, vao maior entre os arcos e distancia minima
//   entre duas crateras seguidas.
//
// E os quatro de balanceamento, todos com efeito no hash:
//
// - BISPO: a cura sobre fungo passa a SUPLANTAR o tiro base sustentado (era
//   24/s contra 56/s — menos da metade do que o proprio comentario prometia),
//   com uma reducao pequena de dano enquanto ele pisa no tapete. A Supernova
//   vira uma frente que VIAJA, plantando anel por anel durante a recuperacao da
//   acao — o relogio e o da propria acao, que ja viaja no snapshot.
// - DIAMANDIS: o modulo solto CHAMA Coveiros proprios (a mecanica de sucata
//   existia inteira e quase nunca acontecia, porque o Coveiro e fauna do
//   Ferrifero e o Diamandis nasce na Aurix), e a Salva de Demolicao passa a
//   antecipar a rota do alvo. O anti-kite e de controle de arena: a velocidade
//   dele nao muda.
// - LEVIATA: negada a emergencia, a lamina AVANCA sobre o chao seco. Sem isso,
//   rocha seca nao o atrasava, o eliminava.
// - ARQUICANTOR: o canto passa de cristal em cristal por conectividade e
//   atravessa a nave em camadas, uma por passo da recuperacao. O alcance deixa
//   de ser do corpo e passa a ser da Catedral — e cortar a cadeia vira jogada.
//
// Nada aqui toca o worldgen: o terreno semeado continua identico.
// 35: O DILUVIO — a carta unica do Leviata do Lencol.
//
// Abaixo de 55% de vida, e uma vez so, ele para de disputar margem e levanta o
// lencol: o setor INTEIRO submerge. Depois disso ele nada e emerge em qualquer
// lugar, e a pergunta do encontro troca de "onde ele nao alcanca" para "de onde
// eu solto a corrente".
//
// A decisao tecnica que sustenta tudo: o Diluvio NAO E UMA SUPERFICIE.
// `state.surface` guarda um material por celula, entao grava-lo ali apagaria o
// chao de baixo — e a promessa dele e a oposta, submergir o material anterior
// deixando-o visivel por transparencia. Como o alagamento e total, "esta
// submerso?" nao precisa de mapa: precisa de um centro, de um instante e da
// regra (`isDeluged`). Tres numeros no `bossRuntime` fazem o trabalho que uma
// quarta camada de mundo faria pior — e ela teria de entrar no diff de chunks e
// engordar toda celula alterada do jogo, inclusive nos setores sem Leviata.
//
// E o Diluvio nao e so um buff: quem alaga o setor inteiro entrega ao jogador um
// condutor do tamanho do setor inteiro, e o Leviata e o unico chefe que a
// propria descarga atordoa. O que decide quem ganha o troco e a DISTANCIA — a
// corrente entra num ponto e atenua com o quadrado dele em diante, ate um piso.
// Sem isso o dano plano viraria um botao de vitoria nos dois sentidos.
//
// Muda o hash por tres caminhos: os tres campos novos, o dano de descarga (que
// deixou de ser plano quando ha ponto de origem) e o fogo que a lamina apaga ao
// passar.
// 36: os DUTOS do Aquifero ganham quota na camara do chefe.
//
// Defeito medido, e nao ajuste de gosto: com dez dutos sorteados num mapa de
// 96x96 e espacamento minimo de oito, NENHUMA seed de Aquifero punha um duto de
// boca aberta dentro da arena do Leviata. O Diluvio caía sempre na fonte de
// reserva (o corpo dele), e a leitura que a mecanica existe para produzir — "os
// dutos estao enchendo a sala" — nunca acontecia onde ela importa. Quatro saem
// agora num anel em volta do chefe, antes do sorteio.
//
// Muda a impressao digital da geracao, e so no Aquifero: o bloco inteiro esta
// atras de `profile.pipeCount > 0`.
// 37: o bolt EXPLOSIVO detona na FACE da parede, e nao dentro dela.
//
// O sub-passo do projetil anda ate um terco de tile por vez, entao no instante
// em que a colisao e detectada `proj.x/y` ja esta dentro do bloco solido — e o
// centro da explosao saia dali. Na tela, o clarao abria meio tile ATRAS do
// ponto em que o tiro visivelmente encostou, e o anel de choque (que existe
// para ensinar o alcance do estrago) prometia esse alcance a partir do lugar
// errado. O tiro comum ja usava `solidImpactPoint` para o burst de plasma; o
// explosivo passa a usar o mesmo ponto.
//
// Muda o hash: o raio parte de outro centro, entao o CONJUNTO de celulas que a
// detonacao quebra e acende muda perto da parede. Dois peers em versoes
// diferentes escavariam buracos diferentes com a mesma jogada, e um replay
// pre-37 re-simulado sob a regra nova abriria outro mapa.
//
// Ainda na 37: `solidImpactPoint` passa a devolver a ULTIMA travessia numa
// entrada por quina, e nao a primeira. Quando um sub-passo cruza a linha de x E
// a de y antes de parar dentro do solido, a primeira travessia leva o projetil
// para uma celula VIZINHA (vazia, senao a colisao teria sido com ela) e so a
// segunda o poe na celula atingida. O contato saia, portanto, um tile ao lado
// em todo tiro diagonal.
//
// Era um defeito cosmetico enquanto o ponto so posicionava o burst de plasma —
// e por isso sobreviveu desde a 20, quando `bolt_impact` nasceu. Vira
// autoritativo na mesma leva em que o ponto passa a ser o centro da detonacao,
// e por isso os dois entram na MESMA versao: quem re-simula um replay antigo ja
// vai abrir outro mapa por causa do centro, e separar as duas correcoes em duas
// versoes cobraria duas quebras de compatibilidade pelo preco de uma.
// 38: as LEYLINES — condutor geologico persistente da Catedral Prismatica e
// da ocupacao Aurix (fora do Ferrifero, cuja fiacao e outra identidade).
//
// Muda o hash por tres caminhos. O terreno semeado: corredores dos setores
// com leyline ganham SOLID_LEYLINE/SOLID_LEYLINE_NODE na parede, e as
// ancoras do tracado consomem RNG do gerador (dutos, respiradouros e spawns
// deslocam NESSES setores; todo estrato sem leyline esta atras de
// `profile.leylines > 0` e fica byte a byte). A reacao nova: tiro `energy`
// na leyline arma o segmento em vez de descarregar no impacto. E os relogios
// dos segmentos (`dischargeAt`/`refractoryUntil`/`triggeredBy`), que entram
// no hash autoritativo porque DECIDEM dano — dois peers discordando deles
// divergiriam em vida um segundo depois, longe da causa.
// 39: o RELE das leylines — a juncao roteada (interact, toggle persistente no
// setor) repassa a descarga ao segmento vizinho DORMENTE como ativacao nova,
// telegrafada e refrataria como qualquer outra; a refrataria de 10 s e o que
// impede a cascata de voltar, por construcao e nao por contador. `routed` (por
// juncao) e `relayed` (por segmento) entram no hash autoritativo: os dois
// decidem dano e credito — a ressonancia `current` conta UMA vez por cascata,
// na ativacao original. Dois peers em versoes diferentes divergem no primeiro
// rele. O terreno semeado NAO muda: a adjacencia no<->segmento e derivada
// fora do caminho hasheado (a impressao digital da geracao continua
// 3461746772; os elos de construcao registrados na gravacao sao arrays JS —
// zero RNG, zero grid).
// 40: a rede de leylines DENSIFICA com a profundidade e fica ENCONTRAVEL.
// Tres mudancas na mesma leva (a versao nasceu e evoluiu na mesma branch):
// a Catedral funda (setor 4+) traca a quarta linha e a cicatriz Aurix funda
// expoe duas; o setor 1 traca UMA linha, sempre — medido em 20 mil seeds, a
// abertura tinha 0% de chance e so 37% das runs viam a mecanica em qualquer
// setor; e quando os setores 2-3 nao teriam leyline natural, o primeiro setor
// ELEGIVEL forca uma (leylineGuaranteeSector — funcao pura da seed). Elegivel
// exclui o FERRIFERO: la a parede conectada ja e a fiacao do lugar, e forcar
// leyline por cima contradiria o invariante que `biomeProfile` declara — a
// linhagem industrial, ferrica das posicoes 2 a 7, fica sem garantia e
// aprende a linguagem no setor 1, como todo mundo. O perfil de setor passa a
// sair de UMA fonte (`sectorProfile`), usada tanto pela producao quanto pelos
// testes que medem terreno: paridade por construcao, e nao por copiar a regra
// em cada chamador. O terreno semeado muda em quase toda seed (a linha do
// setor 1 alcanca todas); a impressao digital registra os numeros com o
// porque. Replays pre-40 re-simulados sob a regra nova abririam outro mapa —
// e para isso que este numero sobe.
// 41: o CIRCUITO — a leyline deixa de esperar um item e vira o problema do
// setor. Tres mudancas que alteram a simulacao, e nao so a apresentacao:
//
// 1. A NASCENTE (juncao do maior componente mais proxima da entrada, derivada
//    da seed) nasce roteada e o interact nela LANCA a cascata. E o conserto do
//    defeito de fundo: `energy` so existe com o modulo Conductive, entao sem
//    ele a leyline nao tinha verbo nenhum e a run era indistinguivel de uma
//    sem leylines.
// 2. O CURTO: um segmento com >= LEYLINE_SHORT_CELLS (6) celulas de cristal ou
//    minerio encostadas recusa a carga, e a cascata para nele. O numero e
//    medido, nao estetico — com limiar 1, 73% a 89% dos segmentos nasciam em
//    curto e nenhuma rede da amostra nascia limpa. Liquido NAO entra: a agua
//    do Aquifero e estatica e o jogo nao tem verbo que a remova, entao curto
//    por poca tornaria aquele circuito impossivel em vez de dificil.
// 3. A SUBVERSAO: fechar o circuito (uma unica cascata acendendo TODOS os
//    segmentos do componente) desliga a propriedade que da identidade ao
//    estrato ate a descida — a agua para de conduzir, a brasa devolve a
//    dissipacao, o cristal fica opaco, a silica vitrifica, o respiradouro
//    trava, o gelo para de derreter, o Miner perde a sobrecarga.
//
// `leylineCircuit` (live/closed/reached) entra no hash: ele decide a FISICA do
// setor, e dois peers discordando dele divergiriam na agua conduzindo de um
// lado e nao do outro, muito depois da causa. O terreno semeado NAO muda — a
// derivacao so LE o mundo (a impressao digital da geracao continua
// 1082481898). Sobe porque um replay pre-41 re-simulado sob a regra nova
// veria a cascata parar num curto que antes nao existia.
// 42: MINIGUN. Um modulo novo (`minigun`, tier 3, 300 cargas) entra no
// `MODULE_DEFINITIONS` e portanto no POOL de escolha dos cofres de classe III:
// duas simulacoes em versoes diferentes ofereceriam cartuchos diferentes do
// mesmo cofre da mesma seed. E o `PlayerExtra` ganha `minigun` — rotacao,
// acumulador de cadencia e fase —, tres campos que entram no hash autoritativo
// porque sao eles que decidem em que tick a proxima bala sai. Um peer que
// discordasse da rotacao cruzaria o limiar operacional um tick antes ou depois
// do outro, e a divergencia apareceria como dano que so existe de um lado.
// 43: O RELOGIO DA CONTAMINACAO PASSA A SER RELATIVO A RUN. A taxa por tick
// deixa de ser a constante de parede (~14 min ate 1,0) e vira
// `contaminationPerTick(sectorCount)`, que a divide pela profundidade que a run
// declarou. E quebra de determinismo em toda descida com mais de tres setores:
// a mesma seed e o mesmo log produzem contaminacao diferente, e portanto ondas,
// saturacao e dano diferentes. Sem o bump, um ticket emitido antes do deploy
// seria liquidado depois contra outra simulacao e o jogador receberia por uma
// run que nao foi a dele — silenciosamente, porque nada no caminho compara as
// duas. Descidas de TRES setores ficam bit a bit identicas (3/3 = 1), o que
// limita o estrago do bump ao que ele precisa cobrir.
// 44: A JANELA DO DEVORADOR DEIXA DE SER UMA TORRE. O humor do fim da rajada
// (`DEVOURER_STUCK`, agora `DEVOURER_MAW`) era um alvo imovel e inofensivo:
// nao andava, nao cobrava contato, nao tinha areia absorvendo tiro. Encostar
// era de graca e a abertura nao pedia nada de quem a usava alem de municao.
//
// Agora a mesma janela e uma BOCA. Ele continua imovel e continua sem couraça —
// tudo o que a abertura prometia continua de pe —, mas enquanto ela dura ele
// engole o setor para dentro de si:
//
// - SUCAO por tick sobre todo corpo dentro do disco, jogador e fauna, em
//   sub-passos com colisao (parede segura o arrasto). O alcance CRESCE de zero
//   ao raio cheio ao longo de 4,5 s; a forca a cada distancia e fixa, e cruza a
//   velocidade de caminhada a 3,5 tiles do centro — a linha do sem-volta.
// - A GARGANTA cobra DEVOURER_MAW_BITE_DAMAGE (200, o dobro da vida cheia) de
//   quem chega ao centro. Vale igual para bicho.
// - A boca ENGOLE a silica solta do disco: `SURF_SILT` dentro do alcance vira
//   `SURF_NONE`, tick a tick. Vidro nao e tocado — e o contra-jogo de sempre,
//   agora com uma terceira alavanca (sobre vidro a sucao cai abaixo da
//   caminhada em qualquer ponto do disco).
// - `bossRuntime.mawOpenedAt` entra no estado autoritativo e no HASH: e dele
//   que saem alcance, forca e refeicao.
//
// Muda posicao de todo corpo da camara, dano, superficie e o hash. Duas
// simulacoes em versoes diferentes divergem no primeiro tick de janela — uma
// com o jogador parado onde ele estava, a outra com ele meio tile mais perto —
// e a distancia entre elas so cresce dali em diante.
// 45: Diluvio ganha profundidade e descarga massiva evitavel por bolha de ar.
// 46: O DEVORADOR CRESCE e para de dancar. `DEVOURER_RADIUS` sobe de 0,8 para
// 0,95, junto com a escala 1,4 do atlas (ver CONTENT_VERSION): ele ocupava
// pouco mais da metade da tela dos outros chefes e nao lia como um. Raio decide
// colisao e tamanho de ALVO, entao duas simulacoes em versoes diferentes
// discordam de quais tiros acertam durante a janela de dano.
//
// E o MERGULHO ganha distancia de espreita. Ele perseguia o jogador sem parada
// — medido, a distancia estabilizava em 0,10 tile e oscilava a cada tick, com o
// chefe vibrando em cima dos pes do alvo ("fica dancando ao redor dele"). Agora
// o passo submerso se divide em radial (corrige ate DEVOURER_STALK_RANGE) e
// tangencial (circula com o que sobra), com o sentido da volta saindo da
// paridade do id para ser igual nas duas pontas de uma sala. A posicao dele
// diverge no primeiro tick de mergulho.
//
// Junto vao duas correcoes que a espreita revelou. A direcao do mergulho
// DEGENERA quando o arco pousa em cima do alvo (`normalized(0,0)` e um passo
// nulo, e o corpo ficava plantado dentro do jogador para sempre); passa a cair
// no rumo do corpo, como o arco ja fazia. E a busca da DECOLAGEM passa a
// recusar celulas a menos de DEVOURER_LEAP_MIN_RANGE da queda: ela aceita ate
// tres aneis do ponto ideal e anel e distancia de Chebyshev (canto a 4,24),
// entao a decolagem podia cair a 1,4 tile da queda — arco de comprimento zero,
// e um furo no vidro, porque com o disco inteiro vitrificado ele ainda achava a
// areia colada no alvo e saltava dali.
//
// 47: a ONDA DE CHOQUE do pouso. O corpo do Devorador passou de 3,1 para quase
// 6 tiles (ver CONTENT 28) e a cratera continuava do tamanho da cabeca: o que
// desaba no fim do arco nao e mais uma cabeca. Um anel externo entre
// DEVOURER_ERUPT_RADIUS (2,8) e DEVOURER_SLAM_RADIUS (3,9) cobra
// DEVOURER_SLAM_DAMAGE (10) de quem esta fora da cratera e dentro dele.
//
// Os dois raios sao um par derivado, e o que eles separam e o RECURSO que
// resolve cada um: o arco mais curto voa 0,55 s, uma corrida cobre 2,5 tiles
// nesse tempo e a esquiva acrescenta 1,3. A cratera e o que a corrida resolve;
// o anel e o que so a esquiva resolve. Quem leva a cratera nao leva o anel — e
// o degrau de fora do mesmo golpe, e nao um segundo golpe no mesmo tick.
//
// So no POUSO: a decolagem continua com a cratera sozinha. O jogador ve o arco
// chegando e nao ve o chao abrindo sob ele.
//
// 48: a boca deixa de abrir no TICK do terceiro pouso. Ela abria no mesmo
// quadro em que o corpo caia, e o jogador nao tinha como separar "ele pousou"
// de "a janela abriu" — duas coisas que pedem respostas opostas: sair de perto,
// e chegar perto.
//
// Agora ha DEVOURER_MAW_SETTLE_TICKS (49) entre as duas, e o numero e a soma de
// duas coisas com sentidos diferentes: DEVOURER_MAW_BURY_TICKS (25) e o corpo
// de 5,75 tiles seguindo a cabeca para dentro do buraco a DEVOURER_BURROW_SPEED,
// e DEVOURER_MAW_OPEN_DELAY_TICKS (24) e o silencio depois disso — o unico
// momento do encontro em que ele nao esta na tela, no mesmo vao do telegrafo da
// emergencia.
//
// Ele continua ESPREITANDO durante a espera: a boca abre onde ele chegou, e nao
// onde o terceiro arco caiu. Se abrisse sempre na ultima cratera, os dois
// ultimos segundos de rastro nao diriam nada — e o rastro e o unico aviso que
// este chefe da.
//
// `leapsLeft` ganha o valor DEVOURER_BURST_SPENT (-1) para dizer "a rajada
// acabou". Zero nao servia: zero e o que um chefe recem-nascido tem, e a
// decolagem ja o le como "comece uma rajada inteira".
//
// 49: a NINHADA. `devourer_brood` — catorze filhotes na camara do Devorador,
// e o unico corpo do bestiario cuja definicao e nao fazer nada: dano de contato
// zero, um ponto de vida, alcance de aggro zero e NENHUMA acao no repertorio
// (fluxo proprio, justamente para nunca passar pela acao `contact` de onde todo
// dano de corpo a corpo deste jogo sai).
//
// Eles estao na simulacao e nao no cliente por uma razao de mecanica: sao
// MATERIA no disco da boca. A sucao ja arrasta todo corpo que nao seja chefe,
// entao a ninhada e arrastada e devorada junto — e ver dez filhotes sumindo
// garganta abaixo ensina o raio da coisa melhor que o anel desenhado no chao.
//
// O passo deles e fugir > nao encostar no irmao > voltar para a mae, nessa
// ordem. A separacao tem duas metades: uma FORCA que da forma ao bando antes de
// haver contato, e uma resolucao de POSICAO depois do passo — medido, so a
// forca deixava dois filhotes a 0,3386 tile quando dois raios sao 0,34, e "sem
// sobreposicao" nao se cumpre por ponderacao de vetores.
//
// Pisar neles mata, e NAO conta no placar: o total de abates alimenta o
// leaderboard, e catorze bichinhos inofensivos por camara seriam pontos de
// graca. O evento de morte continua indo (o jogador precisa ver que pisou em
// alguma coisa); o que nao vai e o credito.
export const SIMULATION_VERSION = 49;
// 11: rocha por estrato no atlas de terreno — seis peles novas da parede
// comum, com fragil/minerio/cristal continuando universais.
// 12: a pele de rocha do Estrato Ferrifero entra no atlas de terreno
// (terrain-blocks v4, kind rockFerric no fim da lista).
// 13: props decorativos VOLUMETRICOS viram modelos voxel no atlas
// world-props (v3, kinds decor:<kind>:<variante>) — fumarolas, monolitos e
// a broca deixam o desenho de runtime (que vira fallback).
// 14: crostas dos TRILHOS da operacao (surface-tiles v6: rail e rail-v) —
// o chao da armadilha de carrinho.
// 15: PORTAIS por bioma no atlas world-props (v4): dez chaves animadas
// portal:<estrato|ocupacao> — todas com a mesma gramatica (boca escura +
// cruz de luzes-guia convergentes) — e o poco SELADO (portal:sealed) da
// extracao de retorno. O `descent` generico vira fallback.
// 16: o POOL DE CRIATURAS muda — dois corpos novos no bestiario
// (enemy-sulfur-bomber e enemy-undertaker, com atlas proprios) e o atlas do
// Miner REFEITO. E exatamente o que este campo existe para marcar: sem o
// bump, o conjunto de assets de antes e o de depois se declarariam a mesma
// revisao de conteudo.
// 17: o Seeker Lance vira SEEKER DRONE — atlas novo fx-seeker-drone
// (quadricoptero kamikaze, fly 4f) entra no primeiro pacote de sprites.
// 18: o pool de criaturas ganha o DIAMANDIS. Ele ainda nao tem atlas — desenha
// pelo caminho de fallback, como o Bispo e o Corcel antes de ganharem o deles —
// mas o conjunto de conteudo mudou, e e exatamente isso que este campo marca.
// 19: o pool ganha o DEVORADOR BRANCO e duas crostas de chao (silica solta e
// vidro). As duas ainda nao tem tile no atlas de superficie — desenham pela cor
// de recuo, que a partir desta versao realmente dispara para materia sem tile
// (antes o `?? 0` desenhava chao limpo e a materia ficava invisivel).
// 20: o pool ganha os seis chefes de estrato. Como o Diamandis e o Devorador,
// eles desenham pelo caminho de fallback ate ganharem atlas.
// 21: os OITO chefes ganham atlas voxel e a silica e o vidro ganham tile no
// atlas de superficie (SURFACE_KINDS 13 e 14, manifest de crostas v7). E a
// versao que fecha as tres promessas em aberto das tres anteriores: nada do
// pool de conteudo desenha mais pelo caminho de recuo.
// 22: o Devorador ganha a pose PRESA no atlas (`downed`) — a metade dianteira
// erguida para fora de um colar de silica, com a boca aberta para cima. E a
// unica silhueta vertical do bicho, e a janela de dano do encontro depende dela:
// recortado deitado na linha do chao ele virava um calombo de dez pixels, que
// le como pedra e nao como alvo.
// 23: o atlas `fx-fire-cyclone` — seis quadros de uma coluna de fogo com duas
// espirais defasadas girando em volta. Estreito no chao e aberto no alto, e
// com a paleta ESFRIANDO para cima (`beam` na base, `fire` na ponta): o que
// machuca e a base, e ela tem de ser a parte que puxa o olho. As tres cores da
// coluna estao em EMISSIVE_HEX, entao ele acende sozinho no caminho de brilho.
// 24: as LEYLINES entram no atlas de terreno (terrain-blocks v5, kinds
// leyline e leylineNode no fim da lista, a regra do rockFerric). Ainda sem
// arte dedicada elas desenham pelo fallback de rocha; o bump marca a
// promessa — o pool de materia visivel mudou.
// 25: COFRES POR CLASSE no atlas world-props (v5): salvageCacheT2/T3,
// fechado e aberto, ANEXADOS ao fim da lista. A classe I mantem os nomes
// historicos salvageCache/salvageCacheOpened, que tambem servem de fallback
// para atlas antigo em cache. Puro conteudo visual — tier ja existia na sim.
// 26: a pose PRESA do Devorador vira a BOCA. O atlas `enemy-white-devourer`
// sobe para v2 e muda de canvas (104x94 -> 112x110, ancora 50,71 -> 54,75):
// o corpo erguido saiu e no lugar dele ha uma cratera dentada rente ao chao —
// cinco abas de mandibula descascadas para fora e deitadas na areia, carne
// exposta por baixo delas, um anel de dentes curtos e desiguais e um vao escuro
// que AFUNDA. O humor `downed` passa de 4 quadros a 5 fps para 6 a 11: nao e
// mais uma respiracao, e um espasmo em que nenhuma peca se move junto com a
// vizinha.
//
// O canvas cresceu porque a boca e mais larga que o corpo do bicho, e a ancora
// mudou junto porque `fitSpriteToMargin` reenquadra o sheet inteiro pela uniao
// dos quadros — declarar a ancora velha desenharia o verme dois pixels fora do
// lugar em TODA animacao, e nao so nesta.
//
// Um cliente com o atlas antigo continua desenhando o tronco erguido enquanto a
// simulacao arrasta corpos para dentro de um buraco que ele nao mostra: a pose
// e o unico sinal de que a janela virou uma boca, e ela e o telegrafo do golpe.
// 27: o atlas do Devorador sobe para v3 e o modelo inteiro e multiplicado por
// 1,4 (`DEVOURER_SCALE`), com o canvas indo de 112x110 para 156x152 e a ancora
// de (54,74) para (76,104) — o mesmo fator, para o corpo nao deslocar no chao.
//
// Medido antes da mudanca, na mesma projecao e no mesmo repouso: Guardiao
// 100x113, Diamandis 92x134, Devorador 92x61. Pouco mais da METADE da presenca
// de tela dos companheiros de hierarquia, e o relato de playtest foi direto —
// "nem parece um Boss". Um verme nao compete por altura (a silhueta dele e
// baixa por definicao, e erguer o corpo foi exatamente a ideia que a boca
// substituiu), entao ele compete por comprimento: agora 114x76, na mesma faixa
// de area dos outros dois e o mais largo dos tres.
//
// A boca escala junto porque e a metade dianteira deste mesmo animal aberta —
// escalar uma sem a outra encolheria a cabeca em relacao ao tronco no meio do
// proprio ciclo.
// 28: o CORPO do Devorador sai do sprite. O atlas do chefe passa a desenhar so
// a cabeca e tres aneis de pescoco (os cinco aneis traseiros e o arco saem, e a
// cabeca recua de x=5,4 para x=0,7 — a ancora do sprite tem de ser o ponto que
// a simulacao move, e com o corpo antigo ela caia no meio do tronco), e nasce
// `part-white-devourer-coil`: 68x64, dez quadros que sao POSTOS na fila do
// mais grosso ao mais fino, quatro direcoes.
//
// O cliente pendura os dez aneis no rastro da propria cabeca
// (`devourer-spine.ts`), amostrado por comprimento de arco. O verme passou de
// 3,1 para ~6 tiles sem um pixel a mais no atlas do chefe, e ganhou o que um
// sprite rigido nao da: ele MERGULHA — a elevacao viaja no rastro junto com a
// posicao, entao a cabeca crava na areia enquanto a cauda ainda esta no meio do
// arco.
//
// A espessura do posto 0 e 7,2 e nao 5,14: este atlas nao passa por
// `DEVOURER_SCALE`, entao ele e autorado ja na escala final e o numero do
// pescoco tem de vir multiplicado. Sem isso o corpo saia 40% mais fino que a
// cabeca a que ele se prende.
// 29: a ABERTURA da boca. `enemy-white-devourer` ganha o slot `burst` — dez
// quadros a 10 fps, uma vez so — que vai do chao intacto ate a cratera dentada
// de `downed`.
//
// As pecas nao entram juntas: a areia afunda, a carne aflora no fundo do poco,
// a arcada sobe, as abas descascam para fora e por ultimo os fios atravessam o
// vao. Escalar o modelo inteiro por um fator daria uma boca completa e pequena
// crescendo, que le como um bicho se aproximando — e o chao nao encolhe, ele
// CEDE.
//
// A duracao e derivada e nao escolhida: a garganta so passa a engolir quando o
// alcance da sucao chega a DEVOURER_MAW_BITE_RADIUS, no tick 19,2 da rampa. A
// cratera termina de se escancarar no instante em que ela passa a poder matar
// alguem, e nem um quadro depois.
//
// O ramo `downed` saiu de `devourerBody` para uma funcao propria
// (`devourerMaw(f, open)`) porque os dois slots sao a MESMA geometria em dois
// pontos da mesma rampa; autorar a abertura em separado daria duas bocas
// parecidas que divergiriam no primeiro ajuste de raio.
// 30: `part-devourer-brood`, as minhoquinhas — 28x20, uma linha de bloquinhos
// com um unico elo de carne atras da ponta (o unico contraste do bicho, e a
// unica coisa que diz de que lado ele anda). Tres variantes x seis fases num
// slot so, como os postos do anel de corpo: o cliente escolhe a variante pelo
// id do filhote e a fase pelo relogio.
//
// Tres e nao uma porque um enxame de coisas identicas le como textura animada —
// o olho junta tudo num tapete que se mexe. Comprimentos e ritmos primos entre
// si (5/7/4 elos, ondas de 1/0,7/1,3) fazem com que nem tres vizinhas fiquem em
// fase.
//
// A amplitude do balanco e LIMITADA PELO PASSO, e a primeira versao ignorou
// isso: os elos medem 0,5 e andam de 0,45, entao dois vizinhos que se deslocam
// mais de ~0,3 um em relacao ao outro desencostam. A folha de contato mostrou
// 0,84 e 1,29 de desvio nas duas variantes curtas — a minhoquinha deixava de ser
// uma linha e virava um punhado de cubos soltos.
//
// Junto vai a SECAO do anel de corpo, refeita. A captura do jogo mostrou o que
// nenhum teste pegaria: uma caixa de lado `d` por altura `d * 1,05` e um CUBO, e
// dez cubos bege em fila leem como entulho empilhado. Agora sao cinco degraus de
// largura desigual (estreito no chao, largo na barriga, afinando para o dorso),
// uma crista dorsal correndo o comprimento inteiro — a linha que costura dez
// sprites soltos num corpo so — e o sulco escuro trocado por um colar de silica,
// porque o sulco virava um VAO PRETO sempre que dois vizinhos estavam em alturas
// diferentes no arco do salto. O anel tambem cresceu de 5,2 para 6,6 unidades,
// que e a sobreposicao que o degrau do arco come.
export const CONTENT_VERSION = 30;

export type VersionTriple = {
  protocolVersion: number;
  simulationVersion: number;
  contentVersion: number;
};

export const CURRENT_VERSIONS: VersionTriple = {
  protocolVersion: PROTOCOL_VERSION,
  simulationVersion: SIMULATION_VERSION,
  contentVersion: CONTENT_VERSION,
};

export type VersionCheck = { ok: true } | { ok: false; reason: string; field: keyof VersionTriple };

/** O protocol precisa casar exatamente; sim/content sao avaliados pelo chamador. */
export const checkProtocolVersion = (incoming: Partial<VersionTriple>): VersionCheck => {
  if (incoming.protocolVersion !== PROTOCOL_VERSION) {
    return {
      ok: false,
      field: 'protocolVersion',
      reason: `protocolVersion ${incoming.protocolVersion ?? 'ausente'} != ${PROTOCOL_VERSION}`,
    };
  }
  if (incoming.simulationVersion !== SIMULATION_VERSION) {
    return {
      ok: false,
      field: 'simulationVersion',
      reason: `simulationVersion ${incoming.simulationVersion ?? 'ausente'} != ${SIMULATION_VERSION}`,
    };
  }
  if (incoming.contentVersion !== CONTENT_VERSION) {
    return {
      ok: false,
      field: 'contentVersion',
      reason: `contentVersion ${incoming.contentVersion ?? 'ausente'} != ${CONTENT_VERSION}`,
    };
  }
  return { ok: true };
};
