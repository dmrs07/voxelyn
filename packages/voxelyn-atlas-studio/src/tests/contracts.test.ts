// O projeto criado a partir do contrato do jogo tem de ser um SUBSTITUTO: o que
// sair dele precisa cair no lugar do par PNG+JSON antigo sem o jogo perceber
// nada alem do desenho novo. E isso que estes testes cobram.
import { describe, expect, it } from 'vitest';
import { GAME_CONTRACTS, createProjectFromContract } from '../contracts';
import { modelKey } from '../types';

const frostQueen = (): (typeof GAME_CONTRACTS)[number] =>
  GAME_CONTRACTS.find((c) => c.id === 'enemy-frost-queen')!;

describe('GAME_CONTRACTS', () => {
  it('embarca os manifests do pacote de conteudo', () => {
    expect(GAME_CONTRACTS.length).toBeGreaterThan(10);
    expect(GAME_CONTRACTS.map((c) => c.id)).toContain('enemy-frost-queen');
    expect(GAME_CONTRACTS.map((c) => c.id)).toContain('player-prospector');
  });

  it('todo contrato tem moldura, ancora e animacoes utilizaveis', () => {
    for (const c of GAME_CONTRACTS) {
      const m = c.manifest;
      expect(m.frameWidth, c.id).toBeGreaterThan(0);
      expect(m.frameHeight, c.id).toBeGreaterThan(0);
      expect(m.anchorX, c.id).toBeLessThan(m.frameWidth);
      expect(m.anchorY, c.id).toBeLessThan(m.frameHeight);
      expect(Object.keys(m.animations).length, c.id).toBeGreaterThan(0);
    }
  });

  it('a lista sai ordenada e sem id repetido', () => {
    const ids = GAME_CONTRACTS.map((c) => c.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('createProjectFromContract', () => {
  it('copia a moldura e as animacoes do manifest, campo a campo', () => {
    const c = frostQueen();
    const p = createProjectFromContract(c);
    expect(p.spriteId).toBe('enemy-frost-queen');
    expect(p.frameWidth).toBe(c.manifest.frameWidth);
    expect(p.frameHeight).toBe(c.manifest.frameHeight);
    expect(p.anchorX).toBe(c.manifest.anchorX);
    expect(p.anchorY).toBe(c.manifest.anchorY);
    expect(p.hitbox).toEqual(c.manifest.hitbox);
    expect(p.footprint).toEqual(c.manifest.footprint);
    expect(p.animations).toEqual(c.manifest.animations);
  });

  it('sobe a versao — reexportar com a antiga deixaria o cache servir o sprite velho', () => {
    const c = frostQueen();
    expect(createProjectFromContract(c).version).toBe(c.manifest.version + 1);
  });

  it('e voxel, com as 4 direcoes autoradas e sem flipPairs', () => {
    const p = createProjectFromContract(frostQueen());
    expect(p.mode).toBe('voxel');
    expect(p.authoredDirs).toEqual(['dr', 'dl', 'ur', 'ul']);
    expect(p.flipPairs).toEqual({});
  });

  it('nasce com um modelo VAZIO por frame de cada animacao', () => {
    const c = frostQueen();
    const p = createProjectFromContract(c);
    let esperados = 0;
    for (const [anim, def] of Object.entries(c.manifest.animations)) {
      esperados += def.frames;
      for (let f = 0; f < def.frames; f++) {
        expect(p.models![modelKey(anim, f)], `${anim}/${f}`).toEqual({});
      }
    }
    expect(Object.keys(p.models!).length).toBe(esperados);
    expect(p.frames).toEqual({});
  });

  it('nao compartilha estado com o manifest embarcado', () => {
    const c = frostQueen();
    const p = createProjectFromContract(c);
    p.animations.idle.frames = 99;
    p.hitbox.w = 99;
    expect(c.manifest.animations.idle.frames).not.toBe(99);
    expect(c.manifest.hitbox.w).not.toBe(99);
  });

  it('cada chamada gera uma chave de projeto propria', () => {
    const c = frostQueen();
    expect(createProjectFromContract(c).key).not.toBe(createProjectFromContract(c).key);
  });

  it('vale para TODA entidade do catalogo, nao so para a testada', () => {
    for (const c of GAME_CONTRACTS) {
      const p = createProjectFromContract(c);
      expect(p.mode, c.id).toBe('voxel');
      expect(Object.keys(p.models!).length, c.id).toBe(
        Object.values(c.manifest.animations).reduce((n, d) => n + d.frames, 0),
      );
    }
  });
});
