import type { PlayerState, PowerUpId } from '../game/types';
import { clampPlayerHp } from '../entities/player';

export type PowerUpDefinition = {
  id: PowerUpId;
  name: string;
  description: string;
  apply: (player: PlayerState) => void;
};

export const POWER_UP_POOL: Record<PowerUpId, PowerUpDefinition> = {
  vital_boost: {
    id: 'vital_boost',
    name: 'Nucleo Vital',
    description: '+20 HP maximo e cura imediata de 20.',
    apply: (player) => {
      player.maxHp += 20;
      player.hp += 20;
      clampPlayerHp(player);
    },
  },
  attack_boost: {
    id: 'attack_boost',
    name: 'Lamina Micelial',
    description: '+3 de dano base.',
    apply: (player) => {
      player.attack += 3;
    },
  },
  swift_boots: {
    id: 'swift_boots',
    name: 'Servos de Impulso',
    description: 'Movimento 10% mais rapido (cooldown menor).',
    apply: (player) => {
      player.moveCooldownMs = Math.max(45, Math.round(player.moveCooldownMs * 0.9));
    },
  },
  iron_skin: {
    id: 'iron_skin',
    name: 'Casca Reforcada',
    description: '+1 de reducao de dano.',
    apply: (player) => {
      player.damageReduction += 1;
    },
  },
  vampiric_spores: {
    id: 'vampiric_spores',
    name: 'Esporos Vampiricos',
    description: 'Recupera 1 HP ao acertar ataques.',
    apply: (player) => {
      player.lifeOnHit += 1;
    },
  },
  fungal_regen: {
    id: 'fungal_regen',
    name: 'Regeneracao Fungica',
    description: 'Regenera 1 HP por segundo.',
    apply: (player) => {
      player.regenPerSecond += 1;
    },
  },
};

export const POWER_UP_IDS = Object.keys(POWER_UP_POOL) as PowerUpId[];
