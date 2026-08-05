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
import { RUN_SEED_MIX, SECTOR_COUNT, WORLD_H, WORLD_W } from '../src/constants';
import { sectorSeed } from '../src/sectors';
import { biomeProfile, sectorBiome } from '../src/strata';
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

/** O mesmo mundo que `createRun({ seed, sector })` monta. */
const worldFor = (seed: number, sector: number): GeneratedWorld => {
  const profile = biomeProfile(sectorBiome(seed, sector), sector);
  return generateWorld(sectorSeed((seed ^ RUN_SEED_MIX) >>> 0, sector), WORLD_W, WORLD_H, profile);
};

describe('impressao digital da geracao', () => {
  // 64 seeds x 3 setores = 192 mundos. Cobre as seis linhagens, os oito
  // estratos e os dois setores de chefe com folga; uma amostra menor deixaria
  // ramos inteiros do worldgen fora da assinatura.
  const SEEDS = 64;

  it('o terreno semeado NAO mudou (senao: bump de SIMULATION_VERSION)', () => {
    let h = 0x811c9dc5;
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (let sector = 1; sector <= SECTOR_COUNT; sector++) {
        h = mix(h, fingerprint(worldFor(seed, sector)));
      }
    }
    // Assinatura da SIMULATION_VERSION 18 (a arena do chefe por estrato).
    //
    // Conferida nos DOIS lados do refactor do gerador: `origin/main` (5126232,
    // sem TerrainDraft) e esta branch produzem o mesmo numero. E o que sustenta
    // "a geracao saiu byte a byte identica" — sem isso seria so afirmacao.
    // 2796116346 (era 1444846605): a linhagem ARIDA passou a terminar em
    // Sumidouros de Silica em vez de Fornalha Abissal — sem isso o estrato
    // sedimentar nunca era o ultimo, e o Devorador Branco, que so pode nascer
    // na camara final, nao tinha onde existir. Acompanhado de bump de
    // SIMULATION_VERSION, como o cabecalho manda.
    expect(h >>> 0, 'a geracao mudou — veja o cabecalho deste arquivo').toBe(2796116346);
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
