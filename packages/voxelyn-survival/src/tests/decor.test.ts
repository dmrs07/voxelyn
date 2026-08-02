// A camada de props decorativos: derivada, deterministica e fora do jogo.
//
// O que estes testes cobram:
// 1. DERIVACAO: mesma seed => mesma decoracao, em qualquer maquina — e a
//    colocacao nao consome a RNG autoritativa (o hash da simulacao nao muda).
// 2. ZONAS PROIBIDAS: nada de prop no raio da entrada, do poco, dos terminais
//    e cofres, dos respiradouros nem da posicao de chefe.
// 3. HONESTIDADE: prop de chao so em celula aberta e sem materia reativa; o
//    micelio so cresce sobre o proprio tapete; prop de borda tem parede viva.
import { describe, expect, it } from 'vitest';
import { createRun, hashAuthoritativeState, sectorBiome, SOLID_NONE, SOLID_ROCK, SURF_FUNGAL, SURF_WATER } from '@voxelyn/survival-sim';
import { placeDecor, propStillValid, sectorRupture, surfaceRuptureFor } from '../client/decor';

describe('decoracao derivada', () => {
  it('mesma seed, mesma lista — e nada da RNG autoritativa e consumido', () => {
    const a = createRun({ seed: 77 });
    const hashBefore = hashAuthoritativeState(a);
    const decorA = placeDecor(a);
    expect(hashAuthoritativeState(a)).toBe(hashBefore);

    const b = createRun({ seed: 77 });
    expect(placeDecor(b)).toEqual(decorA);
  });

  it('cliente que entra numa sala em andamento ve o MESMO cenario', () => {
    // A colocacao deriva do mundo pristino do setor, nao do snapshot que
    // chegou: um estado ja mutilado (paredes arrancadas, fungo queimado) nao
    // pode deslocar a amostragem e divergir a decoracao entre os clientes.
    const fresh = createRun({ seed: 77 });
    const decorFresh = placeDecor(fresh);

    const midRun = createRun({ seed: 77 });
    for (let i = 0; i < midRun.solid.length; i += 7) midRun.solid[i] = SOLID_NONE;
    for (let i = 0; i < midRun.surface.length; i += 5) midRun.surface[i] = 0;
    expect(placeDecor(midRun)).toEqual(decorFresh);
  });

  it('respeita todas as zonas proibidas do setor', () => {
    for (const seed of [3, 42, 1337]) {
      const state = createRun({ seed, sector: 2 });
      const decor = placeDecor(state);
      expect(decor.length).toBeGreaterThan(10);
      for (const prop of decor) {
        const dEntry = Math.hypot(prop.x - state.entry.x, prop.y - state.entry.y);
        const dCore = Math.hypot(prop.x - state.corePos.x, prop.y - state.corePos.y);
        expect(dEntry, `seed ${seed}: prop na entrada`).toBeGreaterThan(5);
        expect(dCore, `seed ${seed}: prop no poco`).toBeGreaterThan(5);
        for (const site of state.salvageSites) {
          expect(Math.hypot(prop.x - site.terminal.x, prop.y - site.terminal.y)).toBeGreaterThan(3);
          expect(Math.hypot(prop.x - site.cache.x, prop.y - site.cache.y)).toBeGreaterThan(3);
        }
        for (const boss of state.enemies) {
          if (boss.archetype !== 'bishop' && boss.archetype !== 'guardian') continue;
          expect(Math.hypot(prop.x - boss.x, prop.y - boss.y)).toBeGreaterThan(7);
        }
      }
    }
  });

  it('todo prop nasce valido: chao aberto, ancora viva, sem materia por baixo', () => {
    for (const seed of [3, 42, 1337]) {
      const state = createRun({ seed });
      for (const prop of placeDecor(state)) {
        expect(propStillValid(state, prop), `seed ${seed} ${prop.kind}`).toBe(true);
        if (prop.anchor === 'landmark') {
          // O monumento e o UNICO prop ancorado em materia solida: e por isso
          // que a silhueta imensa dele nunca mente sobre colisao.
          expect(state.solid[prop.y * state.config.width + prop.x]).not.toBe(SOLID_NONE);
          continue;
        }
        expect(state.solid[prop.y * state.config.width + prop.x]).toBe(SOLID_NONE);
        if (prop.anchor === 'wall_base' || prop.anchor === 'ceiling') {
          expect(state.solid[prop.wallCell]).not.toBe(SOLID_NONE);
        }
      }
    }
  });

  it('o prop some quando o mundo muda por baixo dele', () => {
    const state = createRun({ seed: 42 });
    const decor = placeDecor(state);
    const wallProp = decor.find((p) => p.anchor === 'wall_base' && p.kind !== 'crate' && p.kind !== 'strut');
    expect(wallProp).toBeDefined();
    if (!wallProp) return;
    // O Bruiser arranca a parede que formava a cascata/leque: sem parede, sem
    // formacao — o prop deixa de desenhar em vez de flutuar.
    state.solid[wallProp.wallCell] = SOLID_NONE;
    expect(propStillValid(state, wallProp)).toBe(false);
  });

  it('landmarks nascem no coracao dos saloes, no maximo dois, e caem com o pedestal', () => {
    let sawLandmark = false;
    for (const seed of [3, 42, 1337]) {
      const state = createRun({ seed });
      const all = placeDecor(state).filter((p) => p.anchor === 'landmark');
      // Ate dois monumentos do ESTRATO; a broca da Aurix (ocupacao) e o
      // terceiro possivel e so existe na cicatriz.
      const landmarks = all.filter((p) => p.kind !== 'drill');
      expect(landmarks.length).toBeLessThanOrEqual(2);
      expect(all.filter((p) => p.kind === 'drill').length).toBeLessThanOrEqual(1);
      for (const mark of all) {
        sawLandmark = true;
        // Pedestal so de rocha COMUM: monumento nunca cobre fragil, minerio
        // nem cristal — os estagios deles sao informacao mecanica.
        expect(state.solid[mark.y * state.config.width + mark.x]).toBe(SOLID_ROCK);
        // O pedestal fica a um anel curto de um centro de salao registrado
        // pela gramatica — o monumento marca o LUGAR, nao um sorteio.
        const near = state.hallCenters.some(
          (c) => Math.max(Math.abs(c.x - mark.x), Math.abs(c.y - mark.y)) <= 3,
        );
        expect(near, `seed ${seed}: landmark longe de qualquer salao`).toBe(true);
        // Minerar o pedestal derruba o monumento.
        const i = mark.y * state.config.width + mark.x;
        expect(propStillValid(state, mark)).toBe(true);
        const was = state.solid[i];
        state.solid[i] = SOLID_NONE;
        expect(propStillValid(state, mark)).toBe(false);
        state.solid[i] = was;
      }
    }
    // Todos os estratos tem gramatica de salao; alguma das seeds precisa
    // produzir um monumento, senao o recurso esta morto sem ninguem notar.
    expect(sawLandmark).toBe(true);
  });

  it('prop de teto pende de parede viva e some quando ela cai', () => {
    let sawCeiling = false;
    for (const seed of [3, 42, 1337]) {
      const state = createRun({ seed });
      const hangers = placeDecor(state).filter((p) => p.anchor === 'ceiling');
      for (const prop of hangers) {
        sawCeiling = true;
        expect(state.solid[prop.y * state.config.width + prop.x]).toBe(SOLID_NONE);
        expect(state.solid[prop.wallCell]).not.toBe(SOLID_NONE);
        // O Bruiser arranca a parede: o teto que pendia dela desaba junto.
        const was = state.solid[prop.wallCell];
        state.solid[prop.wallCell] = SOLID_NONE;
        expect(propStillValid(state, prop)).toBe(false);
        state.solid[prop.wallCell] = was;
        // Mas o CHAO embaixo e livre para jogar: agua, fogo, o que vier — o
        // prop pende do alto e nao esconde nada disso.
        const i = prop.y * state.config.width + prop.x;
        const surf = state.surface[i];
        state.surface[i] = SURF_WATER;
        expect(propStillValid(state, prop)).toBe(true);
        state.surface[i] = surf;
      }
    }
    expect(sawCeiling).toBe(true);
  });

  it('a composicao adensa o mobiliario em volta dos saloes', () => {
    // A regra da composicao por sala: perto de um centro de salao ha MAIS
    // ritmo e micro por celula aberta do que nos corredores. E o contraste
    // que faz o salao ler como lugar — nao a quantidade global.
    for (const seed of [3, 42, 1337]) {
      const state = createRun({ seed });
      const w = state.config.width;
      const nearHall = (x: number, y: number): boolean =>
        state.hallCenters.some((c) => Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) <= 8);

      let openIn = 0;
      let openOut = 0;
      for (let y = 1; y < state.config.height - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (state.solid[y * w + x] !== SOLID_NONE) continue;
          if (nearHall(x, y)) openIn++;
          else openOut++;
        }
      }
      let propsIn = 0;
      let propsOut = 0;
      for (const prop of placeDecor(state)) {
        if (prop.anchor === 'landmark' || prop.anchor === 'ceiling') continue;
        if (nearHall(prop.x, prop.y)) propsIn++;
        else propsOut++;
      }
      expect(openIn, `seed ${seed}: setor sem salao aberto`).toBeGreaterThan(0);
      const densityIn = propsIn / openIn;
      const densityOut = propsOut / Math.max(1, openOut);
      expect(densityIn, `seed ${seed}: salao mais vazio que corredor`).toBeGreaterThan(densityOut);
    }
  });

  it('a cicatriz Aurix tem infraestrutura no chao — e a broca so existe nela', () => {
    // Derivacao pura acha a seed com ocupacao aurix; createRun roda uma vez.
    const found = (() => {
      for (let s = 1; s < 4096; s++) {
        for (let sector = 1; sector <= 3; sector++) {
          if (sectorBiome(s, sector).occupation === 'aurix') return { seed: s, sector };
        }
      }
      throw new Error('nenhuma seed aurix encontrada');
    })();
    const state = createRun(found);
    const decor = placeDecor(state);
    const infra = decor.filter((p) => p.kind === 'walkway' || p.kind === 'rail');
    expect(infra.length).toBeGreaterThan(0);
    for (const prop of infra) {
      expect(prop.anchor).toBe('floor');
      expect(state.solid[prop.y * state.config.width + prop.x]).toBe(SOLID_NONE);
    }
    const drills = decor.filter((p) => p.kind === 'drill');
    expect(drills.length).toBeLessThanOrEqual(1);
    for (const drill of drills) {
      // A broca e monumento: pedestal solido, como qualquer landmark.
      expect(state.solid[drill.y * state.config.width + drill.x]).not.toBe(SOLID_NONE);
    }

    // Fora da cicatriz, nem um parafuso: um setor sem ocupacao nao tem
    // passarela, trilho nem broca.
    const clean = (() => {
      for (let s = 1; s < 4096; s++) {
        if (sectorBiome(s, 2).occupation === 'none') return s;
      }
      throw new Error('nenhuma seed limpa encontrada');
    })();
    const cleanDecor = placeDecor(createRun({ seed: clean, sector: 2 }));
    expect(
      cleanDecor.filter((p) => p.kind === 'walkway' || p.kind === 'rail' || p.kind === 'drill'),
    ).toEqual([]);
  });

  it('a Aurix adapta a infraestrutura ao substrato', () => {
    // Catedral + Aurix => isoladores ceramicos entre os registros da borda.
    const prismaticAurix = (() => {
      for (let s = 1; s < 65536; s++) {
        for (let sector = 2; sector <= 3; sector++) {
          const b = sectorBiome(s, sector);
          if (b.stratum === 'prismatic' && b.occupation === 'aurix') return { seed: s, sector };
        }
      }
      throw new Error('nenhuma seed prismatic+aurix');
    })();
    const cathedral = createRun(prismaticAurix);
    const kinds = new Set(placeDecor(cathedral).map((p) => p.kind));
    expect(kinds.has('insulator')).toBe(true);

    // Ferrifero + Aurix (linhagem industrial, o pareamento canonico): o kit
    // base da operacao, sem isolador nem duto — essas pecas sao resposta ao
    // cristal e ao gas/calor, que o veio principal nao tem.
    const ferricAurix = (() => {
      for (let s = 1; s < 65536; s++) {
        const b = sectorBiome(s, 2);
        if (b.stratum === 'ferric' && b.occupation === 'aurix') return { seed: s, sector: 2 };
      }
      throw new Error('nenhuma seed ferric+aurix');
    })();
    const lode = createRun(ferricAurix);
    const baseKinds = new Set(placeDecor(lode).map((p) => p.kind));
    expect(baseKinds.has('insulator')).toBe(false);
    expect(baseKinds.has('duct')).toBe(false);
    // E a infraestrutura de chao esta la: o lugar que justificou a operacao.
    expect(baseKinds.has('walkway') || baseKinds.has('rail') || baseKinds.has('crate')).toBe(true);
  });

  it('a Ruptura a Superficie e rara, rasa, deterministica — e traz raizes', () => {
    const probe = [{ x: 30, y: 30 }];
    let shallow = 0;
    for (let seed = 1; seed <= 600; seed++) {
      for (const sector of [1, 2]) {
        const a = surfaceRuptureFor(seed, sector, probe);
        expect(surfaceRuptureFor(seed, sector, probe)).toEqual(a);
        if (a) shallow++;
      }
      // Fundo demais nao ha superficie por perto: setor 3+ nunca rompe.
      expect(surfaceRuptureFor(seed, 3, probe)).toBeNull();
    }
    // Raro de verdade, mas existente: na faixa de ~1/6.
    expect(shallow).toBeGreaterThan(1200 * 0.08);
    expect(shallow).toBeLessThan(1200 * 0.3);

    // A fenda so se abre sobre salao que EXISTE: a selecao filtra centros
    // selados pelas provas de alcancabilidade. Seed 36 setor 2 e o
    // contraexemplo historico — o centro cru era SOLID_ROCK.
    const r36 = sectorRupture(createRun({ seed: 36, sector: 2 }));
    if (r36) {
      const w36 = createRun({ seed: 36, sector: 2 });
      expect(w36.solid[r36.y * w36.config.width + r36.x]).toBe(SOLID_NONE);
    }

    // No setor rompido, as raizes pendem em volta da fenda.
    const found = (() => {
      for (let s = 1; s < 4096; s++) {
        if (!surfaceRuptureFor(s, 1, probe)) continue;
        const st = createRun({ seed: s });
        const r = sectorRupture(st);
        if (r) return { state: st, rupture: r };
      }
      throw new Error('nenhuma seed com ruptura viavel');
    })();
    const { state, rupture } = found;
    // A fenda mora numa celula aberta do mundo pristino.
    expect(state.solid[rupture.y * state.config.width + rupture.x]).toBe(SOLID_NONE);
    const roots = placeDecor(state).filter((p) => p.kind === 'root_strand');
    expect(roots.length).toBeGreaterThan(0);
    for (const root of roots) {
      expect(root.anchor).toBe('ceiling');
      expect(Math.max(Math.abs(root.x - rupture.x), Math.abs(root.y - rupture.y))).toBeLessThanOrEqual(8);
    }

    // Sem ruptura, nem uma raiz: a superficie nao vaza para setor intacto.
    const seedWithout = (() => {
      for (let s = 1; s < 4096; s++) {
        if (!surfaceRuptureFor(s, 1, probe)) return s;
      }
      throw new Error('toda seed com ruptura?');
    })();
    const clean = placeDecor(createRun({ seed: seedWithout }));
    expect(clean.some((p) => p.kind === 'root_strand')).toBe(false);
  });

  it('cogumelos so crescem sobre o tapete fungico', () => {
    // A derivacao PURA acha a seed micelial sem construir mundo nenhum;
    // createRun (caro) roda uma unica vez, na seed certa.
    const seed = (() => {
      for (let s = 1; s < 4096; s++) {
        if (sectorBiome(s, 3).occupation === 'mycelial') return s;
      }
      throw new Error('nenhuma seed micelial encontrada');
    })();
    const state = createRun({ seed, sector: 3 });
    const decor = placeDecor(state);
    const shrooms = decor.filter((p) => p.kind === 'mushroom' || p.kind === 'puffball');
    for (const prop of shrooms) {
      expect(state.surface[prop.y * state.config.width + prop.x]).toBe(SURF_FUNGAL);
    }
  });
});
