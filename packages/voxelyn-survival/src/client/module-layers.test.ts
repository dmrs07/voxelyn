// As camadas de modulo, conferidas pelo que elas PROMETEM.
//
// O desenho em si precisa de canvas e de sete atlas carregados; a regra que
// decide o que aparece nao precisa de nenhum dos dois, e e ela que erra em
// silencio — uma arma a mais na tela nao quebra teste nenhum, so mente para o
// jogador sobre o que esta disparando.

import { describe, expect, it } from 'vitest';
import { MODULE_DEFINITIONS, isWeaponModule, type ModuleId } from '@voxelyn/survival-sim';
import { MODULE_LAYER_SPRITE_IDS, moduleLayerSpriteId } from '@voxelyn/survival-content';
import { MINIGUN_FAN_FRAMES, fanFrameFor, weaponComposition } from './sprites';
import { MINIGUN_MOUNTED_SPIN, mountedModules } from './presentation';
import { BARREL_TURNS_PER_SECOND, advanceBarrelPhase } from './minigun-view';
import minigunLayerManifest from '@voxelyn/survival-content/assets/atlases/layer-module-minigun.json';

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

/**
 * O canhao MONTADO nao pode depender so da lista de modulos.
 *
 * Os dois furos que este bloco tranca foram achados por revisao depois de a
 * sobreposicao procedural ser aposentada — ela era guiada por rotacao, e trocar
 * para a lista reabriu os dois de uma vez.
 */
describe('quando o canhao esta montado', () => {
  const stopped = { spin: 0, barrelPhase: 0 };
  const spinning = { spin: 0.6, barrelPhase: 0.2 };

  it('sem rotacao e sem lista, nao ha canhao', () => {
    expect(mountedModules([], stopped)).toEqual([]);
    expect(mountedModules([], undefined)).toEqual([]);
  });

  it('o PARCEIRO REMOTO monta pela rotacao, que e tudo o que este cliente tem', () => {
    // `activeModules` vem de `playerExtras`, que so existe para o viewer. Sem
    // esta soma o parceiro dispara dezesseis balas por segundo com o tiro comum
    // desenhado na mao.
    expect(mountedModules([], spinning)).toEqual(['minigun']);
  });

  it('o canhao LOCAL sobrevive a desaceleracao depois da bala 300', () => {
    // `moduleHasCapacity` cai no tick em que a ultima bala sai; os canos levam
    // dez ticks para parar. Trocar de arma no meio disso e trocar exatamente
    // quando o jogador esta olhando.
    expect(mountedModules([], { spin: 0.4, barrelPhase: 0.9 })).toEqual(['minigun']);
    expect(weaponComposition(mountedModules([], { spin: 0.4, barrelPhase: 0.9 })).weapon).toBe('minigun');
  });

  it('nao duplica quando a lista e a rotacao concordam', () => {
    expect(mountedModules(['minigun'], spinning)).toEqual(['minigun']);
  });

  it('a rotacao ACRESCENTA e nunca remove', () => {
    const equipped = ['piercing', 'explosive'] as const;
    expect(mountedModules(equipped, stopped)).toEqual(equipped);
    expect(mountedModules(equipped, spinning)).toEqual([...equipped, 'minigun']);
  });

  it('o limiar nao e zero — a integracao local deixa residuo', () => {
    expect(mountedModules([], { spin: MINIGUN_MOUNTED_SPIN, barrelPhase: 0 })).toEqual([]);
    expect(mountedModules([], { spin: MINIGUN_MOUNTED_SPIN * 2, barrelPhase: 0 })).toEqual(['minigun']);
  });
});

/**
 * A ventoinha anda pelo ANGULO, e nao pelo relogio da animacao.
 *
 * A simulacao passa ~450 ms subindo antes de emitir o primeiro `action_start` e
 * desce sem emitir nenhum; e durante a rajada ela republica a acao a cada
 * quatro ticks, o que reancora `visualActionElapsed` e reinicia a animacao de
 * quatro quadros antes de ela terminar. Preso a `attack`, o conjunto ficaria
 * parado nas duas transicoes e gaguejaria no meio.
 */
describe('o quadro da ventoinha', () => {
  it('a contagem daqui e a que o atlas assou', () => {
    // O numero vive em `prospector-modules.mjs` (as posicoes de orbita) e aqui
    // (a escolha do quadro). Divergindo, a ventoinha saltaria uma posicao ou
    // repetiria outra, e nenhum dos dois lados reclamaria sozinho.
    for (const anim of Object.values(minigunLayerManifest.animations)) {
      expect((anim as { frames: number }).frames).toBe(MINIGUN_FAN_FRAMES);
    }
  });

  it('cobre as quatro posicoes ao longo de uma volta', () => {
    const seen = new Set([0, 0.3, 0.55, 0.8].map(fanFrameFor));
    expect(seen.size).toBe(MINIGUN_FAN_FRAMES);
  });

  it('nao sai da animacao nas bordas', () => {
    for (const phase of [0, 0.999999, 1, -0.0001]) {
      const frame = fanFrameFor(phase);
      expect(frame).toBeGreaterThanOrEqual(0);
      expect(frame).toBeLessThan(MINIGUN_FAN_FRAMES);
    }
  });

  it('gira durante o SPIN-UP, quando nao ha acao de ataque nenhuma', () => {
    // Meio segundo de aceleracao, antes de a primeira bala sair: se a ventoinha
    // dependesse de `attack`, este trecho inteiro sairia parado.
    let phase = 0;
    const seen = new Set([fanFrameFor(phase)]);
    for (let i = 0; i < 30; i++) {
      phase = advanceBarrelPhase(phase, 0.5, 1000 / 60);
      seen.add(fanFrameFor(phase));
    }
    expect(seen.size).toBe(MINIGUN_FAN_FRAMES);
  });

  it('uma volta do conjunto e uma volta da ventoinha', () => {
    // `BARREL_TURNS_PER_SECOND` voltas por segundo na rotacao maxima, e cada
    // volta passa pelas quatro posicoes uma vez.
    let phase = 0;
    let wraps = 0;
    for (let i = 0; i < 120; i++) {
      const next = advanceBarrelPhase(phase, 1, 1000 / 120);
      if (next < phase) wraps++;
      phase = next;
    }
    expect(wraps).toBe(BARREL_TURNS_PER_SECOND);
  });
});
