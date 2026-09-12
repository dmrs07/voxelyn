// Quanto o SOPRO entrega, medido — e contra o que ele e trocado.
//
// O canal bloqueia o disparo comum (`!channeling` em stepPlayer), entao o custo
// dele nao e so o cooldown: sao 2,5 s de tiro que nao acontece. Esta sonda mede
// os dois lados no mesmo cenario.
import {
  FLAMETHROWER_ARC,
  FLAMETHROWER_CHANNEL_TICKS,
  FLAMETHROWER_EMISSION_DAMAGE,
  FLAMETHROWER_EMIT_INTERVAL_TICKS,
  FLAMETHROWER_RANGE,
  SOLID_NONE,
  SURF_NONE,
  TICK_HZ,
  createRun,
  emptyCommand,
  spawnEnemy,
  stepRun,
} from '../dist/src/index.js';

const arena = (targets, gap) => {
  const state = createRun({ seed: 909 });
  const w = state.config.width;
  const px = Math.floor(w / 2);
  const py = Math.floor(state.config.height / 2);
  state.player.x = px + 0.5;
  state.player.y = py + 0.5;
  for (let y = py - 20; y <= py + 20; y++)
    for (let x = px - 20; x <= px + 20; x++) {
      const i = y * w + x;
      state.solid[i] = SOLID_NONE;
      state.surface[i] = SURF_NONE;
      state.surfaceTimer[i] = 0;
    }
  state.enemies = [];
  state.salvageSites = [];
  state.playerExtras[0].aim = { x: 1, y: 0 };
  state.playerExtras[0].ability = 'flamethrower';
  state.playerExtras[0].abilityCooldownUntil = 0;
  // Bonecos ENFILEIRADOS no eixo da mira, um por tile: mede o alcance util e o
  // total ao mesmo tempo. Vida alta para nenhum morrer e sumir da conta.
  const dummies = [];
  for (let i = 0; i < targets; i++) {
    const e = spawnEnemy(state, 'stalker', px + gap + i, py, false);
    e.hp = 100000;
    e.maxHp = 100000;
    e.speed = 0;
    dummies.push(e);
  }
  return { state, dummies, px };
};

const channel = (targets, gap, ticks) => {
  const { state, dummies } = arena(targets, gap);
  const before = dummies.map((d) => d.hp);
  const cmd = { ...emptyCommand(), aim: { x: 1, y: 0 }, ability: true };
  for (let t = 0; t < ticks; t++) {
    stepRun(state, [t === 0 ? cmd : { ...emptyCommand(), aim: { x: 1, y: 0 } }]);
    // Os bonecos ficam onde nasceram: o que se mede e a saida do sopro, nao a
    // capacidade deles de sair do fogo.
    dummies.forEach((d, i) => {
      d.x = state.player.x + gap + i;
      d.y = state.player.y;
      d.speed = 0;
    });
  }
  return dummies.map((d, i) => before[i] - d.hp);
};

const bolt = (ticks) => {
  const { state, dummies } = arena(1, 3);
  const before = dummies[0].hp;
  for (let t = 0; t < ticks; t++) {
    stepRun(state, [{ ...emptyCommand(), aim: { x: 1, y: 0 }, fire: true }]);
    dummies[0].x = state.player.x + 3;
    dummies[0].y = state.player.y;
  }
  return before - dummies[0].hp;
};

/**
 * LATERAL: bonecos lado a lado a tres tiles, perpendiculares a mira.
 *
 * E a medida do ANGULO, e nao do alcance: quantos o cone pega quando o grupo
 * NAO chega enfileirado no eixo — que e como grupo chega de verdade. A medida
 * em fila mede o jato; esta mede a abertura.
 */
const lateral = () => {
  const { state } = arena(0, 3);
  const px = Math.floor(state.config.width / 2);
  const py = Math.floor(state.config.height / 2);
  const spread = [];
  for (let off = -3; off <= 3; off++) {
    const e = spawnEnemy(state, 'stalker', px + 3, py + off, false);
    e.hp = 100000;
    e.maxHp = 100000;
    e.speed = 0;
    spread.push({ e, off, hp: e.hp });
  }
  const cmd = { ...emptyCommand(), aim: { x: 1, y: 0 }, ability: true };
  for (let t = 0; t < FLAMETHROWER_CHANNEL_TICKS; t++) {
    stepRun(state, [t === 0 ? cmd : { ...emptyCommand(), aim: { x: 1, y: 0 } }]);
    spread.forEach((d) => {
      d.e.x = state.player.x + 3;
      d.e.y = state.player.y + d.off;
      d.e.speed = 0;
    });
  }
  return spread.map((d) => ({ off: d.off, dmg: d.hp - d.e.hp }));
};

const CHANNEL = FLAMETHROWER_CHANNEL_TICKS;
const TAIL = 120; // o fogo de chao continua cobrando depois do canal
console.log('');
console.log(
  `canal ${CHANNEL} ticks (${(CHANNEL / TICK_HZ).toFixed(1)} s) · emissao a cada ${FLAMETHROWER_EMIT_INTERVAL_TICKS} · ${FLAMETHROWER_EMISSION_DAMAGE}/emissao · alcance ${FLAMETHROWER_RANGE}`,
);
console.log('');
console.log('DANO NUM ALVO SO, por distancia (canal + 6 s de chao):');
for (const gap of [1, 2, 3, 4, 5, 6]) {
  const [dmg] = channel(1, gap, CHANNEL + TAIL);
  console.log(`  a ${gap} tile(s): ${dmg.toFixed(1).padStart(7)}`);
}
const group = channel(4, 1, CHANNEL + TAIL);
console.log('');
console.log(
  `EM FILA de 4 (1..4 tiles): ${group.map((d) => d.toFixed(0)).join(' + ')} = ${group.reduce((a, b) => a + b, 0).toFixed(0)}`,
);
console.log('');
console.log(
  `O QUE O CANAL CUSTA: ${bolt(CHANNEL).toFixed(0)} de parafuso nos mesmos ${CHANNEL} ticks (o canal BLOQUEIA o tiro)`,
);
console.log('');
const hits = lateral();
console.log('LATERAL a 3 tiles (o grupo que NAO chega enfileirado):');
console.log('  desvio ' + hits.map((h) => String(h.off).padStart(5)).join(''));
console.log('  dano   ' + hits.map((h) => (h.dmg ? h.dmg.toFixed(0) : '-').padStart(5)).join(''));
console.log(`  pegos: ${hits.filter((h) => h.dmg > 0).length} de ${hits.length}`);
console.log('');
