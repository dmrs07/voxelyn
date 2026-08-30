// As camadas de modulo, conferidas pelo que elas PROMETEM.
//
// O desenho em si precisa de canvas e de sete atlas carregados; a regra que
// decide o que aparece nao precisa de nenhum dos dois, e e ela que erra em
// silencio — uma arma a mais na tela nao quebra teste nenhum, so mente para o
// jogador sobre o que esta disparando.

import { describe, expect, it } from 'vitest';
import { MODULE_DEFINITIONS, isWeaponModule, type ModuleId } from '@voxelyn/survival-sim';
import { MODULE_LAYER_SPRITE_IDS, moduleLayerSpriteId } from '@voxelyn/survival-content';
import { weaponComposition } from './sprites';

const ALL_MODULES = Object.keys(MODULE_DEFINITIONS) as ModuleId[];

describe('cobertura de arte dos modulos', () => {
  // O pacote de conteudo nao depende da simulacao de proposito — o pipeline de
  // arte so precisa de `@voxelyn/core`, e inverter isso acoplaria a geracao de
  // sprites ao balanceamento. O preco dessa separacao e que a lista de atlas la
  // e literal, e pode divergir do `ModuleId` daqui. Este teste e quem paga.
  it('todo modulo da simulacao tem uma camada assada', () => {
    for (const id of ALL_MODULES) {
      expect(MODULE_LAYER_SPRITE_IDS, `modulo ${id} sem atlas`).toContain(moduleLayerSpriteId(id));
    }
  });

  it('nenhum atlas sobrando para um modulo que nao existe', () => {
    const expected = ALL_MODULES.map(moduleLayerSpriteId).sort();
    expect([...MODULE_LAYER_SPRITE_IDS].sort()).toEqual(expected);
  });

  it('o id de camada troca sublinhado por hifen, como o gerador', () => {
    expect(moduleLayerSpriteId('return_disc')).toBe('layer-module-return-disc');
    expect(moduleLayerSpriteId('piercing')).toBe('layer-module-piercing');
  });
});

describe('o que a arma mostra', () => {
  it('sem modulo, o Cravador limpo', () => {
    const c = weaponComposition([]);
    expect(c.weapon).toBeNull();
    expect(c.attachments).toEqual([]);
  });

  it('os acoplados se empilham — os cinco cabem juntos', () => {
    const mounted = ['piercing', 'conductive', 'explosive', 'siphon', 'ricochet'];
    const c = weaponComposition(mounted);
    expect(c.weapon).toBeNull();
    expect(c.attachments).toEqual(mounted);
  });

  it('a Minigun SUBSTITUI a arma em vez de se somar a ela', () => {
    const c = weaponComposition(['minigun']);
    expect(c.weapon).toBe('minigun');
  });

  /**
   * A matriz de compatibilidade de `modules.ts`, desenhada.
   *
   * Com a Minigun ativa, nenhum dos seis vale na bala — eles continuam
   * instalados, com as cargas intactas, e voltam sozinhos quando a bala 300 sai.
   * O metal conta essa regra sem uma linha de HUD, e e por isso que ele tem de
   * sumir: uma arma coberta de acessorios que nao fazem nada seria uma promessa
   * falsa em cima de um modulo que ja e forte.
   */
  it('com a Minigun montada, os acoplados somem do metal', () => {
    const c = weaponComposition(['piercing', 'minigun', 'explosive', 'ricochet']);
    expect(c.weapon).toBe('minigun');
    expect(c.attachments).toEqual([]);
  });

  it('a regra vale para TODO modulo com a tag weapon, e nao so para o literal', () => {
    // O dia em que existir uma segunda arma, este teste falha aqui em vez de
    // no jogo. `weaponComposition` compara com 'minigun' porque hoje ela e a
    // unica; se deixar de ser, a comparacao precisa virar `isWeaponModule`.
    const weapons = ALL_MODULES.filter(isWeaponModule);
    expect(weapons).toEqual(['minigun']);
  });
});
