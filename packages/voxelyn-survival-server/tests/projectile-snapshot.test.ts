// O contrato de FORMA do projetil no fio: os modulos que mudam o corpo do
// tiro (armed/piercing/bouncy/siphon) viajam no ProjectileSnapshot ja
// filtrados por cargas VIVAS — o cliente co-op desenha o que o tiro ainda
// consegue fazer, nunca o que ele apenas carrega. O sifao entrou aqui quando
// ganhou corpo proprio (a serpente verde): sem a flag no fio, a serpente so
// existia no solo.
import { describe, expect, it } from 'vitest';
import {
  MODULE_DEFINITIONS,
  consumeModuleCharge,
  grantOrRechargeModule,
  type Projectile,
} from '@voxelyn/survival-sim';
import { GameRoom } from '../src/room.js';

const boltWithSiphon = (owner: number): Projectile => ({
  kind: 'bolt',
  id: 900001,
  owner,
  x: 5,
  y: 5,
  vx: 0,
  vy: 0,
  damage: 1,
  modules: { siphon: true },
  distanceTravelled: 0,
  hostile: false,
  leavesBiofluid: false,
  ttl: 40,
});

describe('sifao no snapshot de projetil', () => {
  it('a flag viaja quando o dono ainda tem carga, e cai quando a carga acaba', () => {
    const room = new GameRoom('r1', 42, 2, 'ABCD');
    const slot = room.attach('cliente-a');
    expect(slot).not.toBeNull();
    if (!slot) return;
    const player = room.state.players[slot.slot];
    const extra = room.state.playerExtras[slot.slot];
    grantOrRechargeModule(extra, 'siphon', room.state.tick);
    room.state.projectiles.push(boltWithSiphon(player.id));

    const withCharge = room.buildSnapshot(slot, [], [], []);
    expect(withCharge.projectiles.find((p) => p.id === 900001)?.siphon).toBe(true);

    const charges = MODULE_DEFINITIONS.siphon.defaultCharges ?? 1;
    for (let i = 0; i < charges; i++) consumeModuleCharge(extra, 'siphon', 0, []);
    const drained = room.buildSnapshot(slot, [], [], []);
    expect(drained.projectiles.find((p) => p.id === 900001)?.siphon).toBe(false);
  });
});
