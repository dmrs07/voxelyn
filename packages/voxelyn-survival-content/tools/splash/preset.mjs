// O PRESET: tudo que fixa a imagem, num lugar so.
//
// A regra de reprodutibilidade do briefing e que o render possa ser refeito com
// um comando. Isso exige que nada que afete a imagem viva espalhado por
// argumentos de linha de comando ou por constantes enterradas nos modulos: seed,
// setor, janela, encenacao, camera, exposicao e graduacao moram aqui, e o script
// de render apenas os le.
//
// A SEED, E COMO ELA FOI ESCOLHIDA
// --------------------------------
// `runSeed: 518, sector: 1` — "Galerias de Basalto", estrato BASALTO, gramatica
// espacial `columns`. A escolha foi medida, nao visual: `scout-seed.mjs` roda o
// gerador do jogo sobre centenas de seeds e pontua cada mundo pelo que a
// composicao exige.
//
// O CRITERIO MUDOU UMA VEZ, e a razao vale ficar registrada. A primeira busca
// pontuava o COMPRIMENTO do segmento de leyline, e a seed vencedora tinha um de
// 27 celulas — que na pratica atravessava o mapa inteiro deixando apenas DUAS
// celulas perto do berco, a treze tiles uma da outra. Um condutor assim nao
// desenha a Vein da referencia: desenha dois pontos soltos.
//
// A medicao seguinte perguntou outra coisa — quantas celulas do condutor caem a
// menos de 16 tiles do berco, com que extensao e com que salto maximo entre
// elas —, e tambem mediu a alternativa: cadeias conectadas de MINERIO. O
// resultado descartou o minerio como fonte da Vein e vale registrar como fato do
// jogo: em 2.700 setores medidos, a maior cadeia de minerio conectado tem 15
// celulas e a mediana e UMA. O minerio do Voxelyn e bolsao, nao veio longo; o
// condutor de longa distancia e a leyline, exatamente como os specs de leyline
// dizem.
//
// Esta seed foi a melhor sob o criterio novo: sete celulas de condutor num
// trecho de 7,2 tiles com salto maximo de 2,2, descendo em diagonal continua de
// uma JUNCAO da rede em (81,83) ate o berco em (75,92), e a maior arena aberta
// em volta do nucleo (0,72) entre as candidatas de basalto.
//
// A run e construida com `createRun({ seed: 518, sector: 1 })`, que e a MESMA
// chamada que o jogo faz.
export const PRESET = {
  id: 'guardian-core',
  world: {
    runSeed: 518,
    sector: 1,
    width: 96,
    height: 96,
  },

  // A JANELA voxelizada, em tiles da area 96x96. Cobre tudo que a camera
  // enxerga com folga nas bordas — voxelizar a area inteira custaria 113 milhoes
  // de celulas por atributo para mostrar um quinto disso.
  window: { x0: 58, y0: 70, x1: 96, y1: 96, depthTiles: 9.0 },

  // ENCENACAO. Ver `stageEncounter` em scene.mjs para a fronteira entre o que o
  // gerador fez e o que a direcao decidiu.
  //
  // O Prospector fica em (82,83), celula aberta ENCOSTADA na juncao da rede em
  // (81,83) — o bot esta parado exatamente onde o condutor articula, que e a
  // leitura que a tagline afirma. O Guardiao avancou de (78,92), onde nasce, ate
  // (78,87): meio caminho entre o bot e o berco, sobre a linha que liga os dois,
  // fechando o acesso. Sao 5 tiles de avanco pela propria arena dele.
  //
  // A distancia entre os tres encolheu de proposito em relacao a primeira
  // montagem. O motivo e geometrico e foi medido: numa camera em perspectiva, o
  // tamanho de um sujeito na tela e o espacamento entre sujeitos escalam pelo
  // MESMO fator (ambos sao razao entre um comprimento e a profundidade vezes a
  // tangente do campo). Nao ha camera que deixe os tres grandes e espalhados ao
  // mesmo tempo: com 21 tiles entre bot e berco, o Guardiao ocupava 18% da
  // altura do quadro contra os 35% da referencia. A unica alavanca real e o
  // espacamento no MUNDO — e encurta-lo tambem melhora a ficcao, porque um
  // impasse a onze tiles e um impasse, e a vinte e um e uma paisagem.
  staging: {
    prospector: { x: 81, y: 85 },
    // Rotacao 0 mantem a frente do modelo em -y. O bot esta a nordeste do
    // Guardiao e a camera olha de leste: girar 2 poe as costas para a camera, e
    // 0 mostra a frente com o visor visivel.
    prospectorTurns: 2,
    guardian: { x: 78, y: 89 },
    // Rotacao 1 apresenta a face LARGA do Guardiao (17 unidades no eixo x contra
    // 7,5 no y) para uma camera que olha de leste, e vira o visage para o
    // quadrante do Prospector. Com rotacao 0 ele apareceria de perfil e a
    // cidadela-montanha viraria uma laje estreita.
    guardianTurns: 1,
  },

  // PROPS. Equipamento Aurix real do atlas `world-props`, posto em celulas
  // abertas conferidas contra o terreno. E a camada que o briefing chama de
  // encounter dressing, e esta declarada separada por isso.
  // PROPS. Equipamento Aurix real do atlas `world-props`, em celulas de chao
  // abertas conferidas contra o terreno e escolhidas pela posicao que ocupam no
  // quadro (medida por projecao, nao por estimativa).
  //
  // Os quatro pontos de salvamento que o worldgen desta area gerou ficam TODOS
  // fora do enquadramento — o mais proximo, o terminal de classe III em (75,81),
  // projeta em x = -0,14, atras da borda esquerda. Entao estes props sao
  // encenacao declarada, e nao worldgen: modelos reais do jogo, posicoes
  // escolhidas pela composicao.
  props: [
    {
      kind: 'salvageTerminalIdle',
      tile: { x: 74, y: 86 },
      frame: 0,
      origin: 'encenacao: terminal Aurix ao fundo a esquerda — o unico ponto ambar do lado frio do quadro',
      turns: 1,
    },
    {
      kind: 'salvageCacheT3',
      tile: { x: 83, y: 90 },
      origin: 'encenacao: cofre de classe III no primeiro plano direito, sob a area do branding',
      turns: 0,
    },
    {
      kind: 'decor:crate:0',
      tile: { x: 84, y: 88 },
      origin: 'encenacao: caixa Aurix dando massa ao canto direito sem competir com o chefe',
      turns: 0,
    },
  ],

  /** Luzes ambar: so onde ha equipamento Aurix energizado. */
  propLights: [
    { tile: { x: 74, y: 86 }, height: 9, intensity: 2.4, radius: 5 },
    { tile: { x: 83, y: 90 }, height: 5, intensity: 1.5, radius: 4 },
  ],

  // A CAMERA, e a encenacao junto com ela, sao SAIDA de `solve-frame.mjs`.
  //
  // A busca varre as celulas de chao abertas encostadas no condutor (candidatas a
  // Prospector), as celulas abertas entre o bot e o berco (candidatas a
  // Guardiao) e uma grade de orbita, elevacao, recuo, lente e altura de alvo,
  // minimizando o desvio ate os alvos MEDIDOS na referencia. Restricoes duras
  // vindas dos gates do briefing entram como filtro e nao como penalidade: o
  // berco tem de estar mais longe que o chefe, o chefe mais longe que o bot, e a
  // separacao horizontal entre chefe e berco tem de passar de 0,18 da altura do
  // quadro para o cradle nunca ficar escondido.
  //
  // Resultado: desvio total de 0,0065 sobre nove medidas (tres sujeitos x
  // posicao horizontal, vertical e altura). A lente de 28 graus verticais e uma
  // 40mm equivalente — a busca chegou nela sozinha depois que o teto de campo de
  // visao caiu de 38 para 34 graus, e o desvio ate melhorou, o que diz que a
  // grande angular nao estava comprando composicao e sim distorcao.
  camera: {
    position: { x: 90.36, y: 84.98, z: 7.31 },
    target: { x: 78.0, y: 89.0, z: 0.4 },
    fovY: 28,
    roll: 0,
  },

  // POS-PROCESSAMENTO. Ver post.mjs para o que cada numero faz.
  post: {
    exposure: 0.82,
    // Bloom so no que EMITE, e a partir do passe emissivo — nunca por limiar de
    // brilho sobre a imagem final, que e o que produz o halo continuo e chapado
    // que o briefing rejeita.
    bloom: { strength: 0.3, radius: 0.018, iterations: 5 },
    // Graduacao: leve elevacao do preto para nada esmagar, e um empurrao frio
    // nas sombras contra um leve calor nos meios-tons.
    // GRADUACAO: sombra levemente fria contra meio-tom levemente quente.
    //
    // Os pesos foram medidos e nao escolhidos. O basalto do Voxelyn e azul na
    // paleta ([46 58 77]), e a caverna e iluminada por luz fria — somando os
    // dois, o render saia com media de canal (8 23 41) contra os (20 28 28) da
    // referencia, ou seja, azul demais para o proprio material dizer alguma
    // coisa. Esfriar as sombras ainda MAIS, como fazia a primeira versao desta
    // tabela, empurrava na direcao errada.
    //
    // Aqui a sombra quase nao e tocada e o meio-tom recebe o empurrao quente. E
    // a separacao de temperatura que faz a rocha iluminada ler como pedra e nao
    // como gelo, sem recorrer ao teal-and-orange chapado que o briefing rejeita
    // — a correcao e de poucos por cento por canal, nao uma camada de cor.
    grade: {
      lift: 0.016,
      shadowTint: [0.95, 0.99, 1.06],
      midTint: [1.10, 1.01, 0.90],
      saturation: 1.06,
      contrast: 1.08,
    },
    vignette: 0.16,
  },

  /** Amostras por pixel. 4 e o suficiente com voxels: as bordas sao retas. */
  samples: 4,
};
