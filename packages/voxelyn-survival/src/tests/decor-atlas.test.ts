// O contrato entre a decoracao e o atlas world-props.
//
// Props com massa sao desenhados do atlas (modelos voxel rasterizados);
// pedrinhas, cacos e o teto translucido continuam em runtime. Este teste
// impede a deriva silenciosa entre as duas pontas: um kind volumetrico sem
// frame no atlas cairia para o fallback de papelao sem ninguem notar.
import { describe, expect, it } from 'vitest';
import propManifest from '@voxelyn/survival-content/assets/atlases/world-props.json';
import { decorAtlasName } from '../client/decor-draw';
import type { DecorativeProp, PropKind } from '../client/decor';

const VOLUMETRIC: PropKind[] = [
  'fallen_column', 'stalagmite', 'flow_curtain', 'fumarole_cone', 'slag_block',
  'ice_spike', 'crate', 'strut', 'insulator', 'duct', 'mushroom',
  'monolith', 'great_prism', 'stalagnate', 'strata_arch', 'great_fumarole',
  'slag_monolith', 'frost_obelisk', 'magnet_core', 'drill',
  // Segunda varredura: medios, infra Aurix e pendentes minerais de teto.
  'walkway', 'rail', 'calcite_basin', 'crystal_fan', 'slab_pile',
  'fallen_plate', 'sulfur_mound', 'cinder_pile', 'frost_stone', 'lodestone',
  'ore_spur', 'hanging_spur', 'crystal_chandelier', 'stalactite',
  'hanging_slab', 'sulfur_drip', 'soot_fang', 'icicle', 'canary_cage',
];

// Runtime por MERITO: pedrinhas/cacos (silhueta basta) e os pendentes que
// balancam por relogio (frame estatico mataria a deriva).
const RUNTIME_ONLY: PropKind[] = [
  'rubble', 'basalt_shard', 'crystal_shards', 'puffball',
  'spore_veil', 'cable_hook', 'root_strand',
];

const propOf = (kind: PropKind, variant: number): DecorativeProp => ({
  kind, x: 0, y: 0, wallCell: -1, variant, anchor: 'floor',
});

describe('decoracao volumetrica no atlas', () => {
  const names = new Set((propManifest as { kinds: Array<{ name: string }> }).kinds.map((k) => k.name));

  it('todo kind volumetrico tem as DUAS variantes no atlas', () => {
    for (const kind of VOLUMETRIC) {
      expect(names.has(`decor:${kind}:0`), `${kind}:0 ausente do atlas`).toBe(true);
      expect(names.has(`decor:${kind}:1`), `${kind}:1 ausente do atlas`).toBe(true);
      // E o mapeamento do cliente aponta para um frame que existe.
      for (const variant of [0, 7, 512, 999]) {
        const name = decorAtlasName(propOf(kind, variant));
        expect(name, `${kind} sem nome de atlas`).not.toBeNull();
        expect(names.has(name as string), `${name} nao existe no atlas`).toBe(true);
      }
    }
  });

  it('micros e teto continuam em runtime — atlas nao os conhece', () => {
    for (const kind of RUNTIME_ONLY) {
      expect(decorAtlasName(propOf(kind, 3)), `${kind} deveria ser runtime`).toBeNull();
    }
  });
});
