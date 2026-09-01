// O VORTICE DA BOCA do Devorador Branco — a apresentacao da sucao.
//
// Por que a geometria dos graos vive aqui e nao na simulacao, pela mesma razao
// que a altura do salto vive em `leap-arc.ts`: ela nao decide nada. Nenhum grao
// desenhado aqui machuca, empurra ou consome celula — quem come a areia e a
// simulacao, escrevendo `SURF_SILT` de volta para chao limpo, e isso ja chega
// pelo diff de chunks como qualquer outra mudanca de terreno.
//
// O que este arquivo faz e diferente e continua sendo necessario: a areia que a
// simulacao come sai do chao de uma vez, celula por celula, e o que o jogador
// precisa ver e o CAMINHO dela — a materia indo para dentro, dizendo de que
// lado esta o centro e a que velocidade a boca puxa naquele ponto. Sem isso o
// disco limpo que cresce no chao seria um buraco aparecendo, e nao um vortice.
//
// Tudo aqui e funcao pura de (indice, tempo, alcance). Sem estado, sem
// aleatoriedade e sem relogio local: dois clientes da mesma sala desenham o
// mesmo vortice porque recebem as mesmas entradas — e as ENTRADAS que importam
// (o alcance, a forca, a linha do sem-volta) vem de `mawReach`/`mawPull`, na
// simulacao, e nao de numeros copiados para ca.

import {
  DEVOURER_MAW_BITE_RADIUS,
  DEVOURER_MAW_PULL_CORE,
  DEVOURER_MAW_PULL_EDGE,
  DEVOURER_MAW_PULL_FALLOFF,
  DEVOURER_MAW_RADIUS,
  PLAYER_SPEED,
} from '@voxelyn/survival-sim';

/**
 * Quantos graos o vortice carrega de uma vez, NA QUALIDADE ALTA.
 *
 * O desenho escala este numero pelo preset ativo (ver `render.ts`), pela mesma
 * fracao `maxFx / PRESETS.high.maxFx` que o resto dos efeitos do cliente usa.
 * A contagem tem de entrar em `mawStreak` como `count` junto: e ela que espalha
 * as fases, e desenhar um subconjunto dos indices com o total antigo amontoaria
 * os graos sobreviventes todos no mesmo trecho do caminho.
 *
 * Subiu de 44 quando o caminho deixou de ser orbita. Um risco que dava duas
 * voltas cobria meio disco sozinho e poucos bastavam para encher a tela; um
 * risco radial e curto, e o que enche o disco agora e a QUANTIDADE. Setenta e
 * dois espalhados por area (ver a lei do raio em `mawStreak`) dao fluxo continuo
 * sem virar um chuveiro solido, que apagaria o chao que a boca esta comendo.
 */
export const MAW_STREAKS = 145;
/** Quanto tempo um grao leva da borda ate a garganta, em segundos. */
export const MAW_FALL_SECONDS = 0.9;
/**
 * O PASSO DA ESPIRAL: o angulo entre o caminho do grao e a reta que aponta para
 * o centro. Ele e a coisa toda deste efeito.
 *
 * A versao anterior fixava VOLTAS (duas) em vez de passo, e o resultado foi o
 * relato do playtest — "parece que nao suga nada, sao particulas circulando".
 * Ele estava certo, e da para medir: com duas voltas, o percurso tangencial de
 * um grao no raio medio passa de 50 tiles contra 6 de percurso radial. Entre 89%
 * e 96% de cada passo era ORBITA. O desenho dizia "isto gira", e a mecanica diz
 * "isto engole".
 *
 * Fixar o passo em vez das voltas corrige a causa. A 38 graus, cada passo do
 * grao e 56% radial e 44% tangencial — em TODO raio, porque o passo e constante
 * por construcao (ver `mawStreak`). O grao continua girando o bastante para o
 * conjunto ler como vortice e nao como chuva, mas o que ele faz o tempo inteiro
 * e ir para o centro.
 *
 * 38 e nao 45 porque a leitura tem de pender para o lado da succao: a 45 o
 * movimento e meio a meio e o olho fica em duvida sobre qual dos dois e o
 * assunto. Abaixo de ~25 a espiral desaparece e sobra chuva radial, que le como
 * explosao ao contrario.
 *
 * A varredura total sai como CONSEQUENCIA, e nao como numero escolhido:
 * `tan(38 graus) * ln(alcance / garganta)`, cerca de 0,19 volta. Um decimo do
 * que era.
 */
export const MAW_SPIRAL_PITCH_RAD = (38 * Math.PI) / 180;

/**
 * O expoente da lei do raio: `r^Q` cai linear no tempo.
 *
 * Q = 2 e a fisica exata de um sumidouro plano (fluxo conservado: `r * v_r`
 * constante). Foi a primeira tentativa, e ela distribui os graos uniformemente
 * por AREA — o que, num disco, poe metade deles no terco externo do raio. Visto
 * em tela: a borda cheia de riscos e o miolo vazio, que e a leitura oposta da
 * que o efeito existe para dar.
 *
 * Q = 1 espalharia por RAIO (densidade perfeitamente uniforme), mas com
 * velocidade radial constante — e ai o grao nao acelera, e a succao perde a
 * urgencia.
 *
 * 1,2 fica entre os dois e paga os dois: a densidade por unidade de raio cresce
 * so com `r^0,2` (praticamente plana, com o miolo tao povoado quanto a borda) e
 * a velocidade radial ainda sobe da borda ate a garganta. O PASSO da espiral
 * nao depende disto — ele e propriedade da curva, nao da velocidade com que ela
 * e percorrida.
 */
const SINK_Q = 1.2;

/**
 * A distancia em que a sucao iguala a caminhada — a LINHA DO SEM-VOLTA.
 *
 * Resolvida por busca e nao escrita a mao de proposito. Ela e consequencia de
 * quatro constantes de balanceamento (borda, garganta, pico e expoente), e um
 * numero copiado aqui viraria mentira no primeiro ajuste de qualquer uma delas
 * — mentira num anel que o jogo desenha no chao prometendo "ate aqui andar
 * resolve". Um telegrafo que promete errado e pior que nenhum.
 *
 * A busca e por bisseccao sobre a mesma formula da simulacao, e nao chama
 * `mawPull`: a funcao da simulacao recorta pelo alcance do instante, e o que se
 * quer aqui e a forma do campo, que nao depende do relogio.
 */
export const MAW_NO_RETURN_RADIUS = ((): number => {
  const at = (d: number): number => {
    const t = Math.max(
      0,
      Math.min(1, (DEVOURER_MAW_RADIUS - d) / (DEVOURER_MAW_RADIUS - DEVOURER_MAW_BITE_RADIUS))
    );
    return (
      DEVOURER_MAW_PULL_EDGE +
      (DEVOURER_MAW_PULL_CORE - DEVOURER_MAW_PULL_EDGE) * Math.pow(t, DEVOURER_MAW_PULL_FALLOFF)
    );
  };
  // A sucao cresce para dentro, entao a raiz e unica no intervalo. Se a
  // caminhada vencer a garganta (um ajuste futuro de balanco), nao ha linha:
  // devolve a garganta, e o anel some junto com a coisa que ele anunciava.
  if (at(DEVOURER_MAW_BITE_RADIUS) <= PLAYER_SPEED) return DEVOURER_MAW_BITE_RADIUS;
  let lo = DEVOURER_MAW_BITE_RADIUS;
  let hi = DEVOURER_MAW_RADIUS;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) > PLAYER_SPEED) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();

export type MawStreak = {
  /** O RASTRO do grao, do mais antigo ao ponto atual, em tiles a partir do centro. */
  path: ReadonlyArray<{ dx: number; dy: number }>;
  /** 0 a 1 — nasce e morre nas pontas do caminho, sem piscar. */
  alpha: number;
};

/**
 * Quantos pontos formam o rastro de um grao.
 *
 * Foram cinco enquanto o caminho era uma ORBITA de duas voltas: ali o rastro
 * cobria quase 45 graus de arco e uma corda unica cortava a curva de lado a
 * lado — o desenho dizia "estilhaco voando" onde a mecanica diz "areia indo
 * para dentro".
 *
 * Com a espiral de passo constante a varredura inteira caiu para 0,19 volta, e
 * o rastro (STREAK_SPAN do caminho) passou a cobrir 7,6 graus. Medido: a corda
 * unica se afasta do arco em 0,017 tile no pior raio — meio pixel de tile. Os
 * dois pontos do meio deixaram de desenhar qualquer coisa e viraram custo puro.
 *
 * Tres e o minimo que ainda entrega a outra coisa que o rastro precisa dar: a
 * cabeca mais forte que a cauda (ver o desenho em `render.ts`). Com dois pontos
 * ha um segmento so, e um segmento so tem uma opacidade — e opacidade constante
 * e uma linha, e linha nao tem ponta.
 */
const STREAK_POINTS = 3;
/**
 * O comprimento do rastro, em fracao do caminho inteiro.
 *
 * Era 0,024, calibrado quando o caminho era uma orbita e um rastro maior dava
 * meia-volta na tela. Com a espiral de passo constante o rastro ficou RADIAL, e
 * um rastro radial curto e um ponto — e ponto nao tem direcao, que e a unica
 * coisa que este efeito precisa dizer.
 *
 * A 0,09 ele mede cerca de um terco de tile na borda e um tile e pouco colado
 * na garganta, porque a velocidade radial cresce para dentro (ver `mawStreak`).
 * O risco esticando conforme desce e o que vende a ACELERACAO: nao e so que a
 * areia vai para o centro, e que ela vai cada vez mais rapido.
 */
const STREAK_SPAN = 0.11;

/**
 * Onde esta o grao `i` no instante `seconds`, para um alcance `reach`.
 *
 * O progresso e uma serra: cada grao entra na borda, cai ate a garganta e
 * reaparece na borda deslocado por `i / count`, o que espalha os nascimentos no
 * tempo em vez de fazer todos os graos partirem juntos — uma leva unica leria
 * como um anel pulsando, e nao como fluxo.
 *
 * O caminho e uma espiral de passo constante com o raio caindo por conservacao
 * de fluxo — as duas coisas juntas sao o que faz isto ler como succao em vez de
 * como orbita. E a unica parte do desenho que precisa concordar com a fisica, e
 * concorda pela FORMA e nao pelo numero: a forca exata continua sendo assunto de
 * `mawPull`, na simulacao.
 */
/**
 * UM PONTO do caminho da espiral, para o grao `i` no progresso `p`.
 *
 * Extraido porque a poeira e os graos andam pelo MESMO caminho — e se cada um
 * tivesse a sua copia dele, a primeira mudanca de passo ou de lei do raio
 * separaria os dois: a areia iria para um lado e a nuvem que deveria ser a
 * mesma areia iria para outro.
 */
/**
 * O RAIO no progresso `p`, pela lei de conservacao de fluxo.
 *
 * Separado do ponto porque a poeira precisa dele SOZINHO: ela nao fica sobre a
 * espiral, ela rola em volta dela (ver `mawCloud`), e para isso tem de saber
 * onde o eixo do rolo esta antes de se afastar dele.
 */
const mawCoreRadius = (p: number, outerQ: number, innerQ: number): number => {
  const clamped = Math.max(0, Math.min(1, p));
  return Math.pow(Math.max(innerQ, outerQ - clamped * (outerQ - innerQ)), 1 / SINK_Q);
};

/**
 * O ANGULO da espiral num dado raio.
 *
 * Ele segue o log do raio, e essa e a definicao de espiral de passo constante:
 * `theta = tan(passo) * ln(R / r)`. Com ela, a razao entre o que o grao anda
 * para o lado e o que ele anda para dentro e a MESMA em todo raio — o vortice
 * tem uma forma so, da borda a garganta, em vez de virar uma orbita longe e um
 * mergulho perto.
 *
 * O termo do indice usa o angulo aureo para os graos nao se alinharem em raios:
 * `i * 2pi/count` daria um pente girando, que le como roda dentada.
 */
const mawSpiralAngle = (i: number, r: number, reach: number): number =>
  i * 2.39996 + Math.tan(MAW_SPIRAL_PITCH_RAD) * Math.log(reach / r);

const mawPathPoint = (
  i: number,
  p: number,
  reach: number,
  outerQ: number,
  innerQ: number
): { dx: number; dy: number } => {
  const r = mawCoreRadius(p, outerQ, innerQ);
  const theta = mawSpiralAngle(i, r, reach);
  return { dx: Math.cos(theta) * r, dy: Math.sin(theta) * r };
};

/** Onde o grao morre: a garganta, ou um terco do alcance enquanto ela nao existe. */
export const mawInnerRadius = (reach: number): number =>
  Math.min(DEVOURER_MAW_BITE_RADIUS, reach * 0.34);

export const mawStreak = (
  i: number,
  seconds: number,
  reach: number,
  count = MAW_STREAKS
): MawStreak => {
  // ONDE O GRAO MORRE. A garganta, quando ela ja existe — e enquanto nao existe,
  // um terco do alcance do instante.
  //
  // A garganta e um raio FIXO e o alcance CRESCE de zero: durante o primeiro
  // segundo da janela o alcance ainda e menor que ela. Interpolar direto para
  // DEVOURER_MAW_BITE_RADIUS invertia o caminho nesse trecho — o grao nascia no
  // alcance (pequeno) e voava para FORA, ate um raio que a simulacao ainda nao
  // tocava.
  const inner = mawInnerRadius(reach);
  const outerQ = Math.pow(reach, SINK_Q);
  const innerQ = Math.pow(inner, SINK_Q);
  const at = (p: number): { dx: number; dy: number } =>
    mawPathPoint(i, p, reach, outerQ, innerQ);
  const raw = seconds / MAW_FALL_SECONDS + i / count;
  const p = raw - Math.floor(raw);
  const path: Array<{ dx: number; dy: number }> = [];
  for (let k = STREAK_POINTS - 1; k >= 0; k--) {
    path.push(at(p - (STREAK_SPAN * k) / (STREAK_POINTS - 1)));
  }
  // ACENDE devagar na borda e APAGA de repente na garganta.
  //
  // As duas pontas eram simetricas, e a simetria custava o clima: um grao que
  // ja vinha desbotando no ultimo quinto do caminho esvaziava justamente a
  // regiao onde a convergencia acontece, e o vortice ficava com um miolo palido
  // — o oposto do que a cena diz, que e que tudo termina ali.
  //
  // Nascer devagar continua sendo necessario (um grao que aparecesse pronto na
  // borda pareceria materia caindo do teto). Morrer, nao: ele nao esta sumindo,
  // esta sendo engolido, e engolido acontece de uma vez.
  const fade = Math.min(1, p / 0.14, (1 - p) / 0.05);
  return { path, alpha: Math.max(0, fade) };
};

/**
 * As NUVENS DE SILICA: a poeira que a boca levanta enquanto puxa.
 *
 * Os riscos dizem o CAMINHO da areia; eles nao dizem que ha ar sujo ali. Um
 * vortice de verdade nao move so grao — ele levanta uma cortina, e e a cortina
 * que da volume ao efeito e peso ao chao que esta sendo comido. Sem ela o disco
 * fica com a aparencia de riscos desenhados sobre um piso limpo, que e
 * exatamente o que ele e.
 *
 * A poeira anda pelo MESMO caminho dos graos (`mawPathPoint`), e nao por um
 * paralelo: e a mesma materia indo para o mesmo lugar, e duas geometrias
 * separadas divergiriam na primeira mudanca de passo. O que muda e a escala do
 * tempo — a nuvem desce mais devagar que o grao, porque poeira em suspensao nao
 * cai na mesma velocidade que o que ela deixou para tras.
 */
export type MawCloud = {
  dx: number;
  dy: number;
  /**
   * Altura acima do chao, em TILES — a metade de cima do rolo do toro.
   *
   * Em tiles e nao em pixels porque quem sabe converter altura de mundo em
   * deslocamento de tela e o renderer; este arquivo nao conhece o zoom. Zero
   * significa "rente ao chao", que e onde a nuvem passa metade do ciclo: a
   * metade de BAIXO do rolo esta dentro do buraco, e la ela nao e desenhada
   * mais fundo — ela e desenhada mais apagada.
   */
  liftTiles: number;
  /** Raio da mancha, em tiles. */
  radius: number;
  alpha: number;
};

/** Quantas nuvens o vortice carrega, na qualidade alta. Escaladas pelo preset. */
export const MAW_CLOUDS = 22;
/**
 * Quanto mais devagar a poeira desce, contra o grao.
 *
 * Ela nao pode acompanhar: duas coisas na mesma velocidade pelo mesmo caminho
 * viram uma so, e a nuvem deixaria de ser um segundo plano para virar um risco
 * gordo. A 2,4 ela atravessa o disco em pouco mais de dois segundos enquanto o
 * grao leva 0,9 — o bastante para o olho separar as duas camadas e ler
 * profundidade em vez de repeticao.
 */
export const MAW_CLOUD_DRAG = 2.4;

/**
 * Quantas voltas POLOIDAIS a poeira da no caminho da borda ate a garganta.
 *
 * "Poloidal" e a volta em torno do proprio tubo do anel — a que faz a nuvem
 * subir por fora, tombar por cima e mergulhar por dentro. E o eixo que faltava:
 * a poeira andava pela mesma espiral dos graos, so mais devagar, e por isso ela
 * era um grao gordo e nao uma segunda camada. Um vortice de verdade nao e um
 * disco de coisas girando; e um ANEL que rola sobre si mesmo enquanto encolhe.
 *
 * 1,5 volta na travessia inteira: pouco o bastante para o olho seguir UMA nuvem
 * subindo e caindo (a mais de duas ela vira cintilacao), e mais que uma para o
 * rolo aparecer como ciclo em vez de um arco unico.
 */
export const MAW_TORUS_TURNS = 1.5;
/**
 * A grossura do tubo, como fracao do raio do anel.
 *
 * E o quanto a nuvem se afasta do eixo do rolo para fora e para dentro. Com ele
 * o caminho deixa de ser monotonico — ela chega a andar PARA FORA por um trecho
 * —, e e exatamente isso que separa um toro de uma espiral.
 *
 * O numero saiu de uma MEDIDA, e a primeira tentativa (0,3 com 1,7 volta)
 * falhou nela: contando passo a passo, 46 de cada 106 iam para fora — quase
 * empate. Isso e o mesmo defeito que este vortice ja teve uma vez, so que na
 * poeira em vez de nos graos: "parece que nao suga nada, sao particulas
 * circulando". Com 0,22 e 1,5 volta a razao vai a 3,2 para 1 — o rolo continua
 * visivel e a succao volta a ser a leitura dominante, que e a ordem certa das
 * duas.
 */
export const MAW_TORUS_TUBE = 0.22;

/**
 * O quanto o tubo AFINA ate a garganta.
 *
 * O anel colapsa sobre o proprio eixo enquanto entra no sumidouro — e o que um
 * vortice faz de verdade, e tambem o que garante que toda nuvem termine na
 * garganta em vez de parar num anel a meio caminho. Sem ele, medido, uma nuvem
 * em cada tres acabava a travessia do lado de FORA do rolo e nunca chegava ao
 * centro: o efeito virava um anel parado no meio do disco.
 *
 * Nao vai a 1: um tubo de grossura zero na chegada apagaria o rolo justamente
 * onde o vortice e mais forte.
 */
export const MAW_TORUS_TAPER = 0.85;
/**
 * A altura maxima do rolo, em tiles, com o alcance cheio.
 *
 * Nao e a grossura do tubo: um toro geometricamente redondo teria 2,2 tiles de
 * altura no alcance cheio, e nessa projecao 2:1 isso poe a poeira 115 px acima
 * do chao — uma coluna, e nao um vortice rente ao solo. O anel aqui e ACHATADO
 * de proposito, e o achatamento e o que mantem a leitura no chao onde a mecanica
 * acontece.
 */
export const MAW_TORUS_RISE = 0.62;

/**
 * A nuvem `i` no instante `seconds`.
 *
 * Ela nao segue a espiral dos graos: ela ROLA em volta dela. O eixo do rolo e o
 * mesmo raio que os graos percorrem (`mawCoreRadius`, a mesma lei de fluxo) e a
 * nuvem orbita esse eixo — para fora e para cima na crista, para dentro e para
 * baixo no vale. E o corte de um vortice TOROIDAL: a materia nao so vai para o
 * centro, ela tomba sobre si mesma enquanto vai.
 *
 * Foi a segunda correcao do mesmo relato de playtest. A primeira tirou a orbita
 * dos graos ("parece que nao suga nada, sao particulas circulando"); esta tira
 * a chatice da poeira, que era uma copia lenta dos graos e por isso nao
 * acrescentava camada nenhuma — duas coisas no mesmo caminho leem como uma so.
 *
 * `lift` sai daqui em TILES de altura e nao em pixels: quem sabe converter
 * altura de mundo em deslocamento de tela e o renderer, e este arquivo nao pode
 * saber o zoom. Ela ENCOLHE e escurece no mergulho porque esta entrando no
 * buraco — a garganta a comprime e a borda a esconde.
 */
export const mawCloud = (i: number, seconds: number, reach: number): MawCloud => {
  const inner = mawInnerRadius(reach);
  const outerQ = Math.pow(reach, SINK_Q);
  const innerQ = Math.pow(inner, SINK_Q);
  // O deslocamento por indice usa um IRRACIONAL, e nao `i / contagem` como os
  // graos. A diferenca importa porque a contagem muda com o preset de
  // qualidade: `i / contagem` so espalha bem quando quem desenha passa a
  // contagem certa junto (foi um defeito real do lado dos graos), enquanto uma
  // sequencia de baixa discrepancia se espalha sozinha para QUALQUER numero de
  // nuvens. Por isso esta funcao nao precisa saber quantas existem.
  //
  // E e um irracional diferente do angulo aureo dos graos de proposito: com o
  // mesmo, cada nuvem nasceria exatamente sobre um grao e as duas camadas
  // andariam coladas.
  const phase = (i * 0.7548776662) % 1;
  const raw = seconds / (MAW_FALL_SECONDS * MAW_CLOUD_DRAG) + phase;
  const p = raw - Math.floor(raw);

  // O EIXO do rolo: onde a nuvem estaria se ela fosse um grao.
  const core = mawCoreRadius(p, outerQ, innerQ);
  // A volta em torno desse eixo. A fase de partida vem do MESMO irracional que
  // espalhou o nascimento, deslocada — sem isso todas as nuvens estariam na
  // mesma altura ao mesmo tempo, e o anel inteiro subiria e desceria como um
  // pistao em vez de rolar.
  const phi = (p * MAW_TORUS_TURNS + phase * 3.3) * Math.PI * 2;
  const swirl = Math.cos(phi);
  const roll = Math.sin(phi);
  // O tubo afina para a garganta: o anel colapsa sobre o proprio eixo enquanto
  // entra no sumidouro.
  const tube = MAW_TORUS_TUBE * (1 - p * MAW_TORUS_TAPER);
  // Para fora na crista, para dentro no vale — e nunca alem de nenhuma das duas
  // bordas do disco.
  //
  // O piso na GARGANTA e uma escolha e nao uma consequencia. Um toro honesto
  // mandaria a poeira para dentro do buraco no vale do rolo, e fisicamente e
  // exatamente para la que ela vai. Mas a garganta e onde a boca mata na hora
  // (`DEVOURER_MAW_BITE_RADIUS`), e ela e a unica coisa deste efeito que o
  // jogador NAO pode ler errado: cobri-la de poeira para ganhar um detalhe de
  // movimento trocaria a leitura que decide a vida do jogador por realismo.
  // Quem conta o mergulho aqui e o tamanho e o alfa da mancha, que despencam no
  // vale — nao a posicao dela.
  const r = Math.min(reach, Math.max(inner, core * (1 + tube * swirl)));
  const theta = mawSpiralAngle(i * 3 + 1, core, reach);
  // O raio base sai do ALCANCE, e nao de um numero fixo: a boca abre de zero, e
  // uma nuvem de tamanho constante seria maior que o proprio vortice no comeco
  // da janela.
  //
  // 0,135 e pequeno de proposito. A primeira versao usava 0,26 — quase dois
  // tiles por mancha — e o resultado, visto em captura, foram bolhas chapadas
  // espalhadas pelo disco: cada uma lia como uma SOMBRA no chao, nao como
  // poeira. Poeira nao tem contorno; ela e feita de muitas coisas pequenas se
  // sobrepondo, e e por isso que sao vinte e duas menores em vez de dezesseis
  // grandes.
  const base = reach * 0.135;
  const fade = Math.min(1, p / 0.18, (1 - p) / 0.12);
  // Alta e cheia na crista, rasa e apagada no mergulho: e o unico jeito de uma
  // elipse chapada no chao contar de que lado do rolo ela esta.
  const up = 0.5 + 0.5 * roll;
  return {
    dx: Math.cos(theta) * r,
    dy: Math.sin(theta) * r,
    liftTiles: MAW_TORUS_RISE * (reach / DEVOURER_MAW_RADIUS) * Math.max(0, roll),
    radius: base * (0.62 + 0.5 * up) * (1 - 0.45 * p),
    alpha: Math.max(0, fade) * (0.4 + 0.6 * up),
  };
};
