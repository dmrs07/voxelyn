// O terreno derivado nunca esta vencido.
//
// Esta e a garantia que a etapa do `TerrainDraft` existe para dar, e ela e
// cobrada pelo RESULTADO, nao pela disciplina de quem escreve o codigo.
//
// O historico: `openCells` e `distFromEntry` eram calculados num ponto da
// geracao e consumidos muito depois, por `blobSurface`, `pickOpenFar`,
// `chooseBandCell` e os trilhos — nenhum deles reconfere o terreno. Quem
// carimbasse chao no meio tinha de lembrar de reparar as duas a mao. A arena do
// chefe nao lembrou, e custou TRES defeitos distintos, achados um a um, cada um
// depois de uma correcao que parecia completa:
//
//   1. bicho nascendo dentro de um pilar (seed 205 s3);
//   2. chao orfao continuando em `openCells` (seed 141 s3, celula 8251);
//   3. site de tier 3 escolhido pela distancia de um mundo extinto (seed 210
//      s2: caiu em 135 quando a banda de 82% do novo maximo pedia 136).
//
// Os tres sao o MESMO defeito. Auditar consumidor por consumidor foi o que
// falhou — duas vezes. Entao aqui nao se audita nada: refaz-se o flood e o BFS
// do zero sobre o terreno que a geracao entregou, e cobra-se igualdade. Se
// alguem no futuro carimbar terreno sem passar pela barreira do draft, ESTE
// teste falha, nao importa qual consumidor teria sofrido.
import { describe, expect, it } from 'vitest';
import { RUN_SEED_MIX, DEFAULT_SECTOR_COUNT, SOLID_NONE, WORLD_H, WORLD_W } from '../src/constants';
import { sectorSeed } from '../src/sectors';
import { sectorProfile } from '../src/strata';
import { createTerrainDraft, floodOpen, generateWorld } from '../src/worldgen';

// Pela fonte unica (`sectorProfile`), e nao por remontagem: o terreno medido
// aqui e o que a run gera, garantia da descida inclusa.
const worldFor = (seed: number, sector: number) =>
  generateWorld(
    sectorSeed((seed ^ RUN_SEED_MIX) >>> 0, sector),
    WORLD_W,
    WORLD_H,
    sectorProfile(seed, sector),
  );

/** Devolve o laco de eventos ao vitest no meio da varredura — ver arena-chefe.test.ts. */
const breathe = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
const BREATHE_EVERY = 8;

describe('o terreno derivado nunca esta vencido', () => {
  it('`openCells` bate com um flood refeito sobre o terreno FINAL', async () => {
    for (let seed = 1; seed <= 120; seed++) {
      if (seed % BREATHE_EVERY === 0) await breathe();
      for (let sector = 1; sector <= DEFAULT_SECTOR_COUNT; sector++) {
        const world = worldFor(seed, sector);
        const fresh = floodOpen(world.solid, WORLD_W, WORLD_H, world.entry.x, world.entry.y);
        expect(
          world.openCells.length,
          `seed ${seed} s${sector}: openCells tem ${world.openCells.length}, o flood final tem ${fresh.size}`,
        ).toBe(fresh.size);
        // Tamanho igual nao basta: as celulas tem de ser AS MESMAS. Um pilar
        // que fechasse uma celula e abrisse outra manteria a contagem.
        for (const cell of world.openCells) {
          expect(
            fresh.has(cell),
            `seed ${seed} s${sector}: openCells guarda ${cell % WORLD_W},${Math.floor(cell / WORLD_W)}`,
          ).toBe(true);
        }
      }
    }
  }, 120_000);

  it('toda celula de `openCells` esta mesmo ABERTA', async () => {
    // O sintoma mais grosseiro dos tres: era assim que o cuspidor da seed 205
    // nascia dentro de um pilar de cristal.
    for (let seed = 1; seed <= 120; seed++) {
      if (seed % BREATHE_EVERY === 0) await breathe();
      for (let sector = 1; sector <= DEFAULT_SECTOR_COUNT; sector++) {
        const world = worldFor(seed, sector);
        for (const cell of world.openCells) {
          expect(
            world.solid[cell],
            `seed ${seed} s${sector}: ${cell % WORLD_W},${Math.floor(cell / WORLD_W)} em openCells mas solido`,
          ).toBe(SOLID_NONE);
        }
      }
    }
  }, 120_000);
});

describe('a barreira de escrita do draft', () => {
  const W = 24;
  const H = 24;
  const entry = { x: 2, y: 2 };

  /** Um retangulo aberto de (1,1) a (W-2,H-2). */
  const abrirTudo = () => {
    const draft = createTerrainDraft(W, H);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) draft.setSolid(y * W + x, SOLID_NONE);
    }
    return draft;
  };

  it('fechar uma celula REFAZ o derivado na leitura seguinte', () => {
    const draft = abrirTudo();
    const antes = draft.derived(entry).openCells.length;
    draft.setSolid(10 * W + 10, 1);
    expect(
      draft.derived(entry).openCells.length,
      'o derivado ficou com o chao de antes da parede',
    ).toBe(antes - 1);
  });

  it('trocar rocha por MINERIO nao refaz nada: abertura nao mudou', () => {
    // A outra metade do contrato, e a que faz a barreira valer a pena. Se toda
    // escrita invalidasse, as quatro passadas de decoracao — que so trocam
    // rocha por rocha, milhares de celulas — refariam o flood a cada uma.
    const draft = abrirTudo();
    draft.setSolid(10 * W + 10, 1); // uma parede de rocha
    const primeiro = draft.derived(entry);
    draft.setSolid(10 * W + 10, 3); // vira minerio: continua solida
    const segundo = draft.derived(entry);
    expect(segundo.openCells, 'recalculou a toa: a abertura nao mudou').toBe(primeiro.openCells);
    expect(segundo.distFromEntry).toBe(primeiro.distFromEntry);
  });

  it('duas leituras seguidas custam UMA conta', () => {
    const draft = abrirTudo();
    expect(draft.derived(entry).openCells).toBe(draft.derived(entry).openCells);
  });

  it('escavar DEPOIS de uma leitura precoce tambem invalida', () => {
    // O cenario que a primeira versao desta etapa deixava passar, e que so
    // aparece se alguem ler cedo: as escavacoes (`carveBlob`, o prune de
    // bolsoes, o ruido inicial) escreviam CRU, com a desculpa de que rodam
    // antes de haver o que invalidar. A desculpa dependia da ordem — e com
    // `halls: 'none'` nao ha pedestal nem arena carimbando depois para
    // consertar por acidente, entao a leitura final devolveria a topologia
    // velha. Agora nao ha isencao: toda escrita passa pela barreira.
    const draft = createTerrainDraft(W, H);
    for (let y = 1; y < 6; y++) {
      for (let x = 1; x < 6; x++) draft.setSolid(y * W + x, SOLID_NONE);
    }
    const antes = draft.derived(entry).openCells.length;
    // Uma escavacao do tipo que `carveBlob` faz — COLADA na regiao aberta, se
    // nao o flood da entrada nao a alcanca e a contagem nao mudaria nem com a
    // invalidacao funcionando (foi assim que a primeira versao deste teste
    // falhou: media a coisa certa no lugar errado).
    draft.setSolid(3 * W + 6, SOLID_NONE);
    expect(draft.derived(entry).openCells.length, 'abrir chao novo nao refez o derivado').toBe(
      antes + 1,
    );
  });

  it('trocar o buffer inteiro (o automato) tambem invalida', () => {
    const draft = abrirTudo();
    const antes = draft.derived(entry).openCells.length;
    const fechado = new Uint8Array(draft.solid);
    fechado[10 * W + 10] = 1;
    draft.replaceSolid(fechado);
    expect(draft.derived(entry).openCells.length).toBe(antes - 1);
  });
});
