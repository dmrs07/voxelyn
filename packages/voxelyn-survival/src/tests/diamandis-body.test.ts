// O CORPO COMPOSTO DO DIAMANDIS, conferido sem canvas.
//
// O que esta suite protege: a peca certa no estado certo (presa, solta, fora),
// a animacao dela seguindo o chassi, o encaixe caindo onde o manifest diz e
// na ORDEM certa em relacao ao chassi (atras ou na frente, por rumo), o
// Coveiro carregando a peca pelo eletroima, a peca caida virando lasca no
// prazo, e o frenesi lido como espasmo, tint e maquinario mais rapido — tudo
// deterministico e nulo com movimento reduzido.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BOSS_MODULE_DRILL,
  BOSS_MODULE_SCANNER,
  BOSS_MODULE_TOWER,
  DIAMANDIS_MODULE_COUNT,
} from '@voxelyn/survival-sim';
import {
  DIRS8_BY_ANGLE,
  dirFromFacing,
  dirFromFacing8,
  type SpriteManifestEntry,
} from '@voxelyn/survival-content';
import chassisJson from '@voxelyn/survival-content/assets/atlases/enemy-diamandis.json';
import drillJson from '@voxelyn/survival-content/assets/atlases/part-diamandis-drill.json';
import rackJson from '@voxelyn/survival-content/assets/atlases/part-diamandis-rack.json';
import mastJson from '@voxelyn/survival-content/assets/atlases/part-diamandis-mast.json';
import armJson from '@voxelyn/survival-content/assets/atlases/part-diamandis-arm.json';
import undertakerJson from '@voxelyn/survival-content/assets/atlases/enemy-undertaker.json';
import {
  composeDiamandisParts,
  DIAMANDIS_PART_NAMES,
  DiamandisPresentation,
  diamandisPartAnim,
  diamandisPartAtlas,
  diamandisPartState,
  FLOOR_LAND_MS,
  FLOOR_SHATTER_MS,
  floorPieceLift,
  frenzyTint,
  frenzyTwitch,
  MACHINERY_SPEEDUP_PER_STACK,
  machineryClock,
  manifestDir,
  NO_TWITCH,
  reactorIntensity,
  RIP_JOLT_MS,
  socketScreenPoint,
  DIAMANDIS_ARM_ATLAS,
  DIAMANDIS_ARM_SOCKETS,
  pummelArmFrame,
} from '../client/diamandis-body';
import {
  ARCHETYPE_DIRECTIONS,
  DIAMANDIS_CHASSIS_ATLAS,
  DIAMANDIS_PART_ATLASES,
  ON_DEMAND_ATLASES,
} from '../client/sprites';

const chassis = chassisJson as unknown as SpriteManifestEntry;
const undertaker = undertakerJson as unknown as SpriteManifestEntry;
const parts: SpriteManifestEntry[] = [drillJson, rackJson, mastJson].map(
  (m) => m as unknown as SpriteManifestEntry,
);

/** Um vetor de mundo no centro de cada um dos oito rumos de tela. */
const FACING8: Record<string, [number, number]> = {
  r: [1, -1],
  dr: [1, 0],
  d: [1, 1],
  dl: [0, 1],
  l: [-1, 1],
  ul: [-1, 0],
  u: [-1, -1],
  ur: [0, -1],
};

const compose = (over: Partial<Parameters<typeof composeDiamandisParts>[0]> = {}) =>
  composeDiamandisParts({
    chassis,
    parts,
    exposed: 0,
    lost: 0,
    chassisAnim: 'idle',
    facingX: 1,
    facingY: 0,
    elapsedMs: 0,
    nowMs: 0,
    stacks: 0,
    footX: 100,
    footY: 200,
    zoom: 2,
    ...over,
  });

describe('as pecas e os indices da simulacao', () => {
  it('cada modulo da simulacao tem uma peca, na ordem fixa de remocao', () => {
    expect(DIAMANDIS_PART_NAMES.length).toBe(DIAMANDIS_MODULE_COUNT);
    expect(DIAMANDIS_PART_NAMES[BOSS_MODULE_DRILL]).toBe('drill');
    expect(DIAMANDIS_PART_NAMES[BOSS_MODULE_TOWER]).toBe('rack');
    expect(DIAMANDIS_PART_NAMES[BOSS_MODULE_SCANNER]).toBe('mast');
    for (let m = 0; m < DIAMANDIS_MODULE_COUNT; m++) {
      expect(DIAMANDIS_PART_ATLASES).toContain(diamandisPartAtlas(m));
    }
    expect(diamandisPartAtlas(7)).toBeNull();
  });

  it('o estado sai dos dois bitmasks, e perdido vence solto', () => {
    expect(diamandisPartState(0, 0, 0)).toBe('mounted');
    expect(diamandisPartState(0, 1, 0)).toBe('loose');
    expect(diamandisPartState(0, 1, 1)).toBe('gone');
    expect(diamandisPartState(2, 0b100, 0)).toBe('loose');
    expect(diamandisPartState(1, 0b100, 0)).toBe('mounted');
  });

  it('presa, a peca segue o chassi; solta, tem vida propria; fora, nao existe', () => {
    expect(diamandisPartAnim('mounted', 'idle', 0)).toBe('idle');
    expect(diamandisPartAnim('mounted', 'walk', 0)).toBe('idle');
    expect(diamandisPartAnim('mounted', 'attack', 1)).toBe('attack');
    expect(diamandisPartAnim('mounted', 'hit', 2)).toBe('hit');
    // So a broca gira no especial; as outras caem no ataque.
    expect(diamandisPartAnim('mounted', 'special', BOSS_MODULE_DRILL)).toBe('special');
    expect(diamandisPartAnim('mounted', 'special', BOSS_MODULE_TOWER)).toBe('attack');
    expect(diamandisPartAnim('mounted', 'die', 0)).toBeNull();
    expect(diamandisPartAnim('loose', 'attack', 0)).toBe('loose');
    expect(diamandisPartAnim('gone', 'idle', 0)).toBeNull();
  });

  it('cada atlas de peca tem as quatro vidas, e a broca o giro', () => {
    for (const part of parts) {
      for (const anim of ['idle', 'attack', 'hit', 'loose', 'carried', 'floor']) {
        expect(part.animations[anim], `${part.id}.${anim}`).toBeDefined();
      }
      expect(part.directions).toBe(8);
    }
    expect(parts[BOSS_MODULE_DRILL].animations.special).toBeDefined();
  });
});

describe('o chassi de oito rumos', () => {
  it('e o unico arquetipo em oito rumos, e a histerese sabe disso', () => {
    expect(chassis.directions).toBe(8);
    expect(ARCHETYPE_DIRECTIONS.diamandis).toBe(8);
    expect(ARCHETYPE_DIRECTIONS.undertaker).toBe(4);
    expect(chassis.id).toBe(DIAMANDIS_CHASSIS_ATLAS);
  });

  it('publica os tres encaixes em todos os oito rumos', () => {
    for (const dir of DIRS8_BY_ANGLE) {
      for (const name of DIAMANDIS_PART_NAMES) {
        const socket = chassis.sockets?.[dir]?.[name];
        expect(socket, `${dir}.${name}`).toBeDefined();
        expect(socket!.x).toBeGreaterThanOrEqual(0);
        expect(socket!.x).toBeLessThan(chassis.frameWidth);
        expect(socket!.y).toBeGreaterThanOrEqual(0);
        expect(socket!.y).toBeLessThan(chassis.frameHeight);
        expect(typeof socket!.depth).toBe('number');
      }
    }
  });

  it('escolhe o rumo pelo numero de direcoes do manifest', () => {
    for (const [dir, [fx, fy]] of Object.entries(FACING8)) {
      expect(manifestDir(chassis, fx, fy)).toBe(dir);
      expect(dirFromFacing8(fx, fy)).toBe(dir);
      expect(manifestDir(undertaker, fx, fy)).toBe(dirFromFacing(fx, fy));
    }
  });

  it('o encaixe cai no pe do sprite mais o deslocamento do manifest, no zoom', () => {
    const socket = chassis.sockets!.dr.drill;
    const point = socketScreenPoint(chassis, 'dr', 'drill', 100, 200, 2);
    expect(point).toEqual({
      x: 100 + (socket.x - chassis.anchorX) * 2,
      y: 200 + (socket.y - chassis.anchorY) * 2,
      depth: socket.depth,
    });
    expect(socketScreenPoint(chassis, 'dr', 'nope', 0, 0, 1)).toBeNull();
    expect(socketScreenPoint(chassis, 'zz', 'drill', 0, 0, 1)).toBeNull();
  });

  it('um rumo espelhado reflete o encaixe de origem em torno da ancora', () => {
    const mirrored: SpriteManifestEntry = {
      ...chassis,
      flipPairs: { dl: 'dr' },
      sockets: { dr: chassis.sockets!.dr },
    };
    const own = socketScreenPoint(chassis, 'dr', 'drill', 100, 200, 1)!;
    const flip = socketScreenPoint(mirrored, 'dl', 'drill', 100, 200, 1)!;
    expect(flip.y).toBe(own.y);
    expect(flip.x - 100).toBeCloseTo(-(own.x - 100));
  });
});

describe('a composicao em volta do chassi', () => {
  it('com tudo preso, monta as tres pecas presas, na animacao do chassi', () => {
    const drawn = compose({ chassisAnim: 'attack' });
    expect(drawn.map((p) => p.module).sort()).toEqual([0, 1, 2]);
    for (const p of drawn) {
      expect(p.anim).toBe('attack');
      expect(p.atlas).toBe(diamandisPartAtlas(p.module));
    }
  });

  it('a peca perdida some; a solta balanca', () => {
    const drawn = compose({ exposed: 0b011, lost: 0b001 });
    expect(drawn.find((p) => p.module === BOSS_MODULE_DRILL)).toBeUndefined();
    expect(drawn.find((p) => p.module === BOSS_MODULE_TOWER)?.anim).toBe('loose');
    expect(drawn.find((p) => p.module === BOSS_MODULE_SCANNER)?.anim).toBe('idle');
  });

  it('uma peca cujo atlas ainda nao chegou fica de fora, as outras entram', () => {
    const drawn = compose({ parts: [parts[0], null, parts[2]] });
    expect(drawn.map((p) => p.module).sort()).toEqual([0, 2]);
  });

  it('de frente (dr), a broca fica na frente do chassi e o rack atras', () => {
    const drawn = compose({ facingX: 1, facingY: 0 });
    const drill = drawn.find((p) => p.module === BOSS_MODULE_DRILL)!;
    const rack = drawn.find((p) => p.module === BOSS_MODULE_TOWER)!;
    expect(drill.behind).toBe(false);
    expect(rack.behind).toBe(true);
    // A lista ja vem em ordem: as de tras primeiro.
    expect(drawn.indexOf(rack)).toBeLessThan(drawn.indexOf(drill));
  });

  it('de costas (ul), inverte: a broca vai para tras e o rack para a frente', () => {
    const drawn = compose({ facingX: -1, facingY: 0 });
    expect(drawn.find((p) => p.module === BOSS_MODULE_DRILL)!.behind).toBe(true);
    expect(drawn.find((p) => p.module === BOSS_MODULE_TOWER)!.behind).toBe(false);
  });

  it('a ordem vem do manifest: atras e profundidade negativa, em todo rumo', () => {
    for (const [dir, [fx, fy]] of Object.entries(FACING8)) {
      for (const p of compose({ facingX: fx, facingY: fy })) {
        const socket = chassis.sockets![dir][DIAMANDIS_PART_NAMES[p.module]];
        expect(p.behind, `${dir}.${p.module}`).toBe(socket.depth! < 0);
      }
    }
  });

  it('o encaixe da peca e o do rumo do chassi, no pe e no zoom pedidos', () => {
    const drawn = compose({ facingX: 1, facingY: 1, footX: 40, footY: 90, zoom: 3 });
    const mast = drawn.find((p) => p.module === BOSS_MODULE_SCANNER)!;
    const socket = chassis.sockets!.d.mast;
    expect(mast.x).toBe(40 + (socket.x - chassis.anchorX) * 3);
    expect(mast.y).toBe(90 + (socket.y - chassis.anchorY) * 3);
  });

  it('e deterministica: as mesmas entradas dao a mesma lista', () => {
    const a = compose({ exposed: 0b010, nowMs: 1234, elapsedMs: 77, stacks: 1 });
    const b = compose({ exposed: 0b010, nowMs: 1234, elapsedMs: 77, stacks: 1 });
    expect(a).toEqual(b);
  });
});

describe('o maquinario sobrevivente acelera com o frenesi', () => {
  it('cada peca arrancada acrescenta a mesma fracao ao relogio', () => {
    expect(machineryClock(1000, 0)).toBe(1000);
    expect(machineryClock(1000, 1)).toBeCloseTo(1000 * (1 + MACHINERY_SPEEDUP_PER_STACK));
    expect(machineryClock(1000, 2)).toBeCloseTo(1000 * (1 + 2 * MACHINERY_SPEEDUP_PER_STACK));
    expect(machineryClock(1000, -3)).toBe(1000);
  });

  it('as pecas presas correm mais rapido; a solta nao', () => {
    // `attack` nao repete: no mesmo instante da pose, mais frenesi = quadro mais
    // adiantado (ou igual, se ja chegou ao ultimo).
    const slow = compose({ chassisAnim: 'attack', elapsedMs: 120, stacks: 0 });
    const fast = compose({ chassisAnim: 'attack', elapsedMs: 120, stacks: 2 });
    const drillSlow = slow.find((p) => p.module === BOSS_MODULE_DRILL)!.frame;
    const drillFast = fast.find((p) => p.module === BOSS_MODULE_DRILL)!.frame;
    expect(drillFast).toBeGreaterThan(drillSlow);
    const looseA = compose({ exposed: 0b100, nowMs: 500, stacks: 0 });
    const looseB = compose({ exposed: 0b100, nowMs: 500, stacks: 2 });
    expect(looseA.find((p) => p.module === BOSS_MODULE_SCANNER)!.frame).toBe(
      looseB.find((p) => p.module === BOSS_MODULE_SCANNER)!.frame,
    );
  });
});

describe('o reator e o tint do frenesi', () => {
  it('sem pecas perdidas nao ha tint; com tres, o reator esta no maximo', () => {
    expect(frenzyTint(0, 1000)).toBeUndefined();
    expect(reactorIntensity(0)).toBe(0);
    expect(reactorIntensity(3)).toBe(1);
    expect(reactorIntensity(9)).toBe(1);
  });

  it('cresce com as pecas perdidas e nunca cobre o corpo', () => {
    const one = frenzyTint(1, 0)!;
    const three = frenzyTint(3, 0)!;
    expect(three.alpha).toBeGreaterThan(one.alpha);
    for (let t = 0; t < 4000; t += 50) {
      expect(frenzyTint(3, t)!.alpha).toBeLessThan(0.4);
    }
  });
});

describe('os espasmos', () => {
  it('nao existem sem frenesi nem arranque, e nunca com movimento reduzido', () => {
    for (let t = 0; t < 10000; t += 37) {
      expect(frenzyTwitch(0, t, 5, -1e9, false)).toBe(NO_TWITCH);
      expect(frenzyTwitch(3, t, 5, t - 10, true)).toBe(NO_TWITCH);
    }
  });

  it('o arranque sacode forte e para em menos de meio segundo', () => {
    const joltAt = 5000;
    const early = frenzyTwitch(0, joltAt + 20, 1, joltAt, false);
    expect(Math.hypot(early.dx, early.dy)).toBeGreaterThan(1);
    expect(frenzyTwitch(0, joltAt + RIP_JOLT_MS, 1, joltAt, false)).toBe(NO_TWITCH);
    expect(RIP_JOLT_MS).toBeLessThanOrEqual(500);
  });

  it('em frenesi vem em RAJADAS: ha instantes parados e instantes sacudindo', () => {
    let moving = 0;
    let still = 0;
    for (let t = 0; t < 20000; t += 16) {
      const tw = frenzyTwitch(2, t, 9, -1e9, false);
      if (tw === NO_TWITCH) still++;
      else moving++;
    }
    expect(moving).toBeGreaterThan(0);
    expect(still).toBeGreaterThan(moving);
  });

  it('mais pecas fora = mais tempo sacudindo', () => {
    const movingFor = (stacks: number): number => {
      let n = 0;
      for (let t = 0; t < 60000; t += 16) {
        if (frenzyTwitch(stacks, t, 9, -1e9, false) !== NO_TWITCH) n++;
      }
      return n;
    };
    expect(movingFor(3)).toBeGreaterThan(movingFor(1));
  });

  it('e deterministico e pequeno', () => {
    for (let t = 0; t < 8000; t += 16) {
      const a = frenzyTwitch(3, t, 4, 100, false);
      const b = frenzyTwitch(3, t, 4, 100, false);
      expect(a).toEqual(b);
      expect(Math.abs(a.dx)).toBeLessThan(8);
      expect(Math.abs(a.dy)).toBeLessThan(8);
    }
  });
});

describe('a peca caida e a lasca', () => {
  const dropped = (module: number, x: number, y: number) =>
    ({ module, x, y, state: 'dropped' }) as const;

  it('pousa em menos de 200 ms e depois fica no chao', () => {
    expect(floorPieceLift(0)).toBeGreaterThan(5);
    expect(floorPieceLift(FLOOR_LAND_MS)).toBe(0);
    expect(floorPieceLift(FLOOR_LAND_MS + 300)).toBe(0);
    expect(FLOOR_LAND_MS).toBeLessThan(FLOOR_SHATTER_MS);
  });

  it('estilhaca entre meio segundo e um segundo depois de cair', () => {
    expect(FLOOR_SHATTER_MS).toBeGreaterThanOrEqual(500);
    expect(FLOOR_SHATTER_MS).toBeLessThanOrEqual(800);
    const pres = new DiamandisPresentation();
    pres.onBossModule(dropped(0, 5, 5), 1000);
    expect(pres.floor.length).toBe(1);
    expect(pres.shattered(1000 + FLOOR_SHATTER_MS - 1)).toEqual([]);
    expect(pres.floor.length).toBe(1);
    const gone = pres.shattered(1000 + FLOOR_SHATTER_MS);
    expect(gone.map((p) => p.module)).toEqual([0]);
    expect(pres.floor.length).toBe(0);
  });

  it('a lasca do mesmo tick fica com a peca e voa dela, nao do Coveiro', () => {
    const pres = new DiamandisPresentation();
    pres.onBossModule(dropped(1, 12, 7), 2000);
    expect(pres.claimOre(12, 7, 16, 2000)).toBe(true);
    // Uma segunda lasca no mesmo ponto (outra fonte) nao e desta peca.
    expect(pres.claimOre(12, 7, 3, 2000)).toBe(false);
    // Lasca noutro ponto, ou tarde demais, tambem nao.
    expect(pres.claimOre(13, 7, 16, 2000)).toBe(false);
    pres.onBossModule(dropped(2, 1, 1), 3000);
    expect(pres.claimOre(1, 1, 16, 3200)).toBe(false);
    const gone = pres.shattered(2000 + FLOOR_SHATTER_MS);
    expect(gone.find((p) => p.module === 1)?.ore).toBe(16);
  });

  it('uma peca por modulo; perder e resetar limpam', () => {
    const pres = new DiamandisPresentation();
    pres.onBossModule(dropped(0, 1, 1), 0);
    pres.onBossModule(dropped(0, 9, 9), 10);
    expect(pres.floor.length).toBe(1);
    expect(pres.floor[0].x).toBe(9);
    pres.onBossModule({ module: 0, x: 0, y: 0, state: 'lost' }, 20);
    expect(pres.floor.length).toBe(0);
    pres.onBossModule(dropped(2, 1, 1), 30);
    pres.onBossModule({ module: 1, x: 0, y: 0, state: 'detached' }, 40);
    expect(pres.joltAt).toBe(40);
    pres.reset();
    expect(pres.floor.length).toBe(0);
    expect(pres.joltAt).toBeLessThan(0);
  });

  it('expor nao poe nada no chao', () => {
    const pres = new DiamandisPresentation();
    pres.onBossModule({ module: 0, x: 3, y: 3, state: 'exposed' }, 0);
    expect(pres.floor.length).toBe(0);
  });
});

describe('o Coveiro carregador', () => {
  it('publica o encaixe do eletroima nos quatro rumos autorados', () => {
    for (const dir of undertaker.authoredDirs) {
      const socket = undertaker.sockets?.[dir]?.magnet;
      expect(socket, dir).toBeDefined();
      // A meio corpo: acima do pe, dentro do quadro.
      expect(socket!.y).toBeLessThan(undertaker.anchorY);
      expect(socket!.y).toBeGreaterThan(0);
    }
  });

  it('a peca carregada pende do encaixe: a ancora dela e o topo', () => {
    for (const part of parts) {
      // A pose `carried` foi autorada com o ponto de suspensao na ancora;
      // o corpo da peca fica abaixo dela (ver diamandis-parts.test no pacote).
      expect(part.animations.carried.loop).toBe(true);
    }
  });
});

describe('os atlas sob demanda batem com o orcamento do validador', () => {
  it('a lista do cliente e a do validate.mjs sao a mesma', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../voxelyn-survival-content/tools/validate.mjs'),
      'utf8',
    );
    const match = source.match(/ON_DEMAND_ATLASES = new Set\(\[([^\]]*)\]\)/);
    expect(match).not.toBeNull();
    const ids = [...match![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(ids).toEqual([...ON_DEMAND_ATLASES].sort());
    // Sob demanda sao as tres FERRAMENTAS mais o BRACO. O braco nao esta em
    // `DIAMANDIS_PART_ATLASES` porque aquela lista e indexada por modulo da
    // simulacao, e ele nao e um modulo — nao solta, nao e carregado, nao cai.
    expect(ids).toEqual([...DIAMANDIS_PART_ATLASES, DIAMANDIS_ARM_ATLAS].sort());
  });
});

describe('os bracos: dois, laterais, e sempre no corpo', () => {
  const arm = armJson as unknown as SpriteManifestEntry;
  const arms = (over: Partial<Parameters<typeof composeDiamandisParts>[0]> = {}) =>
    compose({ arm, ...over }).filter((p) => p.atlas === DIAMANDIS_ARM_ATLAS);

  it('sao DOIS encaixes, esquerdo e direito, e nao um por ferramenta', () => {
    expect(DIAMANDIS_ARM_SOCKETS).toEqual(['armLeft', 'armRight']);
    expect(DIAMANDIS_ARM_SOCKETS.length).toBeLessThan(DIAMANDIS_PART_NAMES.length);
  });

  it('desenhados com a maquina INTEIRA, e nao so depois de perder ferramenta', () => {
    // A versao anterior fazia o braco "nascer" com o arranque, um por
    // ferramenta. Um humanoide nao ganha bracos no meio da luta: eles estao la
    // desde o primeiro quadro, so pendurados ao lado do corpo.
    const draws = arms({ lost: 0 });
    expect(draws.length).toBe(2);
    for (const d of draws) expect(d.anim).toBe('idle');
  });

  it('nao acrescenta braco a cada ferramenta arrancada — continuam dois', () => {
    for (let lost = 0; lost < 1 << DIAMANDIS_PART_NAMES.length; lost++) {
      expect(arms({ lost }).length, `lost=${lost}`).toBe(2);
    }
  });

  it('perdida a primeira ferramenta eles sobem para a GUARDA, e socam juntos', () => {
    for (const d of arms({ lost: 1 })) expect(d.anim).toBe('special');
    const punching = arms({ lost: 1, pummelFrame: 2 });
    expect(punching.map((d) => d.anim)).toEqual(['attack', 'attack']);
    // Os dois lados no MESMO quadro: bracos de uma mesma maquina se movem
    // juntos, e um defasado leria como avaria.
    expect(punching[0].frame).toBe(punching[1].frame);
    expect(punching[0].frame).toBe(2);
  });

  it('nenhum braco ocupa um indice de modulo', () => {
    // O campo `module` e o indice da simulacao no resto da lista; um braco nao
    // e um modulo, e nao pode passar por um.
    for (const d of arms({ lost: 7 })) expect(d.module).toBeLessThan(0);
  });

  it('o soco avisa em dois quadros e desce em dois, seja o aviso curto ou longo', () => {
    for (const windup of [8, 14]) {
      const action = { kind: 'pummel', startedAt: 0, releaseAt: windup, endsAt: windup + 6 };
      const seen = new Set<number>();
      for (let t = 0; t < action.endsAt; t++) seen.add(pummelArmFrame(action, t) as number);
      expect([...seen].sort(), `windup ${windup}`).toEqual([0, 1, 2, 3]);
    }
    expect(pummelArmFrame({ kind: 'contact', startedAt: 0, releaseAt: 4, endsAt: 8 }, 2)).toBe(
      undefined,
    );
  });
});
