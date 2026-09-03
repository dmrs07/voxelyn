// A impressao digital da GERACAO.
//
// Este arquivo tem um proposito so: transformar "a geracao mudou" de acidente
// silencioso em falha barulhenta.
//
// O terreno semeado e contrato. O replay do leaderboard e a verificacao de
// morte solo re-simulam a partir da seed, e a sala de co-op assume que as duas
// maquinas geraram o mesmo mundo — por isso `SIMULATION_VERSION` existe. Mas
// nada obrigava ninguem a lembrar disso: ate aqui, mudar o worldgen e esquecer
// o bump so aparecia como uma fixture semeada quebrando em algum outro pacote,
// com sintoma que nao aponta para a causa ("fixture nao morreu", uma assercao
// de `duplicate` falhando). Duas vezes isso custou uma rodada de investigacao.
//
// SE ESTE TESTE FALHAR, leia assim: a geracao mudou. Ou foi sem querer — e o
// diff e o defeito — ou foi de proposito, e ai a mudanca vem acompanhada de
// bump de `SIMULATION_VERSION` e do numero novo colado aqui embaixo. Nunca
// atualize o numero sozinho para "consertar" o teste: e o numero que prova que
// alguem olhou.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SECTOR_COUNT, RUN_SEED_MIX, WORLD_H, WORLD_W } from '../src/constants';
import { sectorSeed } from '../src/sectors';
import { sectorProfile } from '../src/strata';
import { generateWorld, type GeneratedWorld } from '../src/worldgen';

/** FNV-1a de 32 bits, o mesmo espirito do hash autoritativo da run. */
const mix = (h: number, v: number): number => Math.imul(h ^ (v >>> 0), 0x01000193) >>> 0;

/**
 * Tudo o que a geracao decide, num numero.
 *
 * Enumera os campos EXPLICITAMENTE, como `hashAuthoritativeState`: um `for...in`
 * faria o hash mudar quando alguem so acrescentasse um campo de apresentacao, e
 * ai o teste gritaria por uma mudanca que nao afeta o contrato. Campo novo que
 * o jogador sente entra aqui a mao.
 */
const fingerprint = (world: GeneratedWorld): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < world.solid.length; i++) h = mix(h, world.solid[i]);
  for (let i = 0; i < world.surface.length; i++) h = mix(h, world.surface[i]);
  for (const p of [world.entry, world.corePos, world.guardianSpawn]) {
    h = mix(h, p.x);
    h = mix(h, p.y);
  }
  for (const s of world.salvageSites) {
    h = mix(h, s.id);
    h = mix(h, s.tier);
    h = mix(h, s.terminal.x);
    h = mix(h, s.terminal.y);
    h = mix(h, s.cache.x);
    h = mix(h, s.cache.y);
  }
  for (const p of world.ventPositions) {
    h = mix(h, p.x);
    h = mix(h, p.y);
  }
  for (const p of world.enemySpawns) {
    h = mix(h, p.x);
    h = mix(h, p.y);
  }
  for (const t of world.railTracks) {
    h = mix(h, t.x);
    h = mix(h, t.y);
    h = mix(h, t.dx);
    h = mix(h, t.dy);
    h = mix(h, t.len);
  }
  // `openCells` e `arenaCells` entram porque sao exatamente as estruturas que
  // a moldura da arena invalidava: se um refactor as deixar diferentes, o
  // sintoma tem de ser ESTE teste, e nao um bicho emparedado tres etapas
  // depois.
  //
  // CADA CELULA, e nao o tamanho da lista. A primeira versao misturava so
  // `.length`, e uma regressao que trocasse QUAIS celulas estao abertas sem
  // mexer na contagem — um pilar que fecha uma e abre outra, exatamente o tipo
  // de coisa que um refactor de ordem produz — passaria verde. A assinatura
  // existe para provar byte-identidade; provar "mesma quantidade" nao serve.
  for (const c of world.openCells) h = mix(h, c);
  for (const c of world.arenaCells) h = mix(h, c);
  // Os centros de salao NAO sao so apresentacao: `client/decor.ts` ancora neles
  // os landmarks monumentais e SORTEIA a Ruptura a Superficie. Mudar quais sao
  // muda o que o jogador ve, entao entram no contrato como o resto.
  for (const p of world.hallCenters) {
    h = mix(h, p.x);
    h = mix(h, p.y);
  }
  return h >>> 0;
};

/**
 * O mesmo mundo que `createRun({ seed, sector })` monta — e agora isto e
 * verdade POR CONSTRUCAO.
 *
 * A montagem do perfil passou por `sectorProfile`, a fonte unica que a
 * producao usa. Enquanto este helper remontava o perfil por conta propria, a
 * assinatura media um mundo SEM a garantia da descida — ou seja, ela nao
 * cobria o terreno real de nenhuma das seeds que recebem leyline forcada, e
 * uma quebra de compatibilidade nesses setores passaria por aqui em silencio.
 */
const worldFor = (seed: number, sector: number): GeneratedWorld =>
  generateWorld(
    sectorSeed((seed ^ RUN_SEED_MIX) >>> 0, sector),
    WORLD_W,
    WORLD_H,
    sectorProfile(seed, sector),
  );

describe('impressao digital da geracao', () => {
  // 64 seeds x 3 setores = 192 mundos. Cobre as seis linhagens, os oito
  // estratos e os dois setores de chefe com folga; uma amostra menor deixaria
  // ramos inteiros do worldgen fora da assinatura.
  const SEEDS = 64;

  it('o terreno semeado NAO mudou (senao: bump de SIMULATION_VERSION)', () => {
    let h = 0x811c9dc5;
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (let sector = 1; sector <= DEFAULT_SECTOR_COUNT; sector++) {
        h = mix(h, fingerprint(worldFor(seed, sector)));
      }
    }
    // Assinatura da SIMULATION_VERSION 18 (a arena do chefe por estrato).
    //
    // Conferida nos DOIS lados do refactor do gerador: `origin/main` (5126232,
    // sem TerrainDraft) e esta branch produzem o mesmo numero. E o que sustenta
    // "a geracao saiu byte a byte identica" — sem isso seria so afirmacao.
    // 2694607655 (era 1444846605). Tres mudancas de proposito, na mesma leva
    // dos chefes de estrato, todas com bump de SIMULATION_VERSION:
    //
    // 1. a linhagem ARIDA passou a terminar em Sumidouros de Silica em vez de
    //    Fornalha Abissal — sem isso o estrato sedimentar nunca era o ultimo e
    //    o Devorador Branco nao tinha onde existir;
    // 2. entrou a linhagem BASALTICA (basalto do topo ao fundo), pelo mesmo
    //    motivo aplicado ao Guardiao: com a tabela de chefes completa, ele e o
    //    dono das Galerias, e nenhuma linhagem terminava nelas. Uma linhagem a
    //    mais remapeia TODA seed (o sorteio e `% LINEAGE_ORDER.length`);
    // 3. o objetivo deixou de poder encostar na moldura do mapa
    //    (CORE_BORDER_MARGIN): o 3x3 livre em volta dele e onde o corpo do
    //    chefe tem de caber, e num canto ele nao cabia.
    //
    // 2377998545 (era 2694607655), na SIMULATION_VERSION 35: o AQUIFERO ganhou
    // DUTOS. Uma mudanca de proposito, e a unica desta leva que toca o terreno.
    //
    // Ela muda o numero por dois caminhos, e vale registrar os dois: os canos
    // ocupam celulas que eram rocha (o `solid` muda) e o sorteio deles consome
    // a RNG do gerador, o que desloca tudo o que vem depois — respiradouros e
    // spawns — nos setores de Aquifero. Nenhum outro estrato e afetado: o bloco
    // inteiro esta atras de `profile.pipeCount > 0`, e so o Aquifero o levanta.
    //
    // O que NAO muda e o contrato de alcancabilidade: os dutos entram depois de
    // todas as provas do gerador e so por cima de celulas que ja eram solidas,
    // entao nenhuma rota deixou de existir por causa deles.
    // 1850403982 (era 2377998545), na SIMULATION_VERSION 36: os dutos do
    // Aquifero passaram a ter QUOTA na camara do chefe.
    //
    // O defeito era medido, e nao estetico. Com dez dutos sorteados num mapa de
    // 96x96 e espacamento minimo de oito, varreram-se as seeds de Aquifero e
    // nenhuma punha um duto de boca aberta dentro da arena do Leviata: o
    // Diluvio caía sempre na fonte de reserva (o corpo dele), e a leitura que a
    // mecanica inteira existe para produzir — "os dutos estao enchendo a sala" —
    // nunca acontecia no unico lugar onde ela importa. Quatro deles agora saem
    // num anel em volta do chefe, antes do sorteio; o resto continua espalhado,
    // porque o Aquifero e um lugar que bombeava agua e nao um lugar com quatro
    // canos em volta de um monstro.
    //
    // So o Aquifero muda: o bloco esta atras de `profile.pipeCount > 0`.
    // 3461746772 (era 1850403982), na SIMULATION_VERSION 38: entraram as
    // LEYLINES — o condutor geologico persistente da Catedral Prismatica e da
    // ocupacao Aurix (fora do Ferrifero, que ja tem a fiacao dele).
    //
    // A mudanca toca o terreno por dois caminhos, como os dutos: celulas de
    // rocha viram SOLID_LEYLINE/SOLID_LEYLINE_NODE ao longo dos corredores
    // (o `solid` muda), e as ancoras do tracado consomem a RNG do gerador,
    // deslocando dutos, respiradouros e spawns nos setores COM leyline. A
    // amostra de 64 seeds cobre a linhagem mineral (prismatic dos setores 2-3)
    // e as intrusoes Aurix a partir do setor 2, entao a assinatura muda.
    //
    // O que NAO muda: a abertura do mapa (a gravacao so troca rocha por rocha
    // depois de todas as provas — ha teste dedicado de byte-identidade da
    // abertura em leylines-worldgen.test.ts) e todo estrato sem leyline, cujo
    // bloco inteiro esta atras de `profile.leylines > 0`.
    // 3910080846 (era 3461746772), ainda na SIMULATION_VERSION 40 (a versao
    // nunca foi lancada — nasceu e mudou na mesma branch): DESCOBRIBILIDADE
    // das leylines. Medido em 20 mil seeds, o setor 1 tinha 0% de chance de
    // leyline e so 37% das runs encontravam a mecanica em qualquer setor —
    // tres cortes de sistema que a maioria nunca via.
    //
    // Duas mudancas de proposito: o setor 1 traca UMA linha, sempre (a boca
    // do Veio ensina "siga a veia" no primeiro minuto), e quando os setores
    // 2-3 nao teriam leyline natural o setor 2 forca uma
    // (leylineGuaranteeSector — funcao pura da seed, mesma em createRun e nas
    // trocas de setor). O basalto de abertura deixa de ser byte a byte
    // historico DE PROPOSITO, e por isso a assinatura muda em quase toda
    // seed da amostra.
    //
    // O que NAO muda: a abertura de todo mapa (a gravacao segue trocando so
    // rocha por rocha, depois das provas — o teste de byte-identidade em
    // leylines-worldgen.test.ts continua valendo) e o contrato de pureza:
    // o terreno de (seed, setor) continua identico em qualquer geracao,
    // porque a garantia varre so os setores 2-3, que toda run alcanca.
    // 1082481898 (era 3910080846), ainda na SIMULATION_VERSION 40: a
    // assinatura passou a MEDIR O MUNDO DE PRODUCAO, e duas coisas mudaram
    // com isso.
    //
    // 1. O helper `worldFor` remontava o perfil por conta propria e nao
    //    aplicava a garantia da descida — entao o numero anterior nao cobria
    //    o setor 2 de nenhuma das seeds que recebem leyline forcada, e uma
    //    quebra de compatibilidade ali passaria por este guard em silencio.
    //    Agora ele chama `sectorProfile`, a mesma fonte unica do `createRun`
    //    e das trocas de setor: a paridade vale por construcao.
    // 2. A garantia deixou de poder cair no FERRIFERO. A linhagem industrial
    //    tem as posicoes 2 a 7 ferricas, entao a versao anterior forcava uma
    //    leyline no setor 2 de toda run industrial — contradizendo no mundo
    //    de verdade o invariante que `biomeProfile` declara e que o teste do
    //    estrato cobra. `leylineGuaranteeSector` agora escolhe o primeiro
    //    setor ELEGIVEL e devolve null quando nao ha nenhum.
    //
    // O contrato de alcancabilidade e o de pureza seguem intactos: a gravacao
    // continua trocando so rocha por rocha depois das provas, e o terreno de
    // (seed, setor) continua identico em qualquer geracao.
    // 2080667893, na SIMULATION_VERSION 54: a Catedral Prismatica passou a
    // recuar a rotunda para dentro da moldura quando o Nucleo nasce perto da
    // borda. A mudanca e intencional: garante espaco para a orbita inteira e
    // os sete tiles de cada braco do canto do Arquicantor. O mesmo bump tambem
    // cobre a abertura da arena e a rede cristalina acrescentadas neste rework.
    // A margem agora deriva do alcance de 12 tiles introduzido na v54; assim
    // nenhum braco novo termina fora da arena que o worldgen reservou.
    expect(h >>> 0, 'a geracao mudou — veja o cabecalho deste arquivo').toBe(2080667893);
  }, 120_000);

  it('a geracao e REPRODUZIVEL na mesma versao', () => {
    // O par do teste de cima. Sem ele, uma geracao que dependesse de algo
    // instavel (ordem de iteracao de Set, `Date.now`, RNG global) so apareceria
    // como uma assinatura que muda sozinha entre execucoes — e a primeira
    // reacao seria colar o numero novo, escondendo o defeito de vez.
    for (const [seed, sector] of [[7, 3], [141, 3], [205, 3], [210, 2]] as const) {
      expect(fingerprint(worldFor(seed, sector))).toBe(fingerprint(worldFor(seed, sector)));
    }
  }, 30_000);
});
