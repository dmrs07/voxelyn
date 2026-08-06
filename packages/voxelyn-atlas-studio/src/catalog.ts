// Catalogo "Abrir do jogo": os pares PNG+JSON das seis entidades-nucleo,
// embarcados no bundle (e portanto no precache offline). Abrir uma entidade
// daqui fatia o atlas real em um projeto PIXEL editavel — os modelos voxel
// originais vivem em codigo (tools/entities.mjs) e nao sao recuperaveis do
// PNG, entao o modo voxel e para personagens novos.
import prospectorPng from '@atlases/player-prospector.png?url';
import prospectorJson from '@atlases/player-prospector.json?url';
import stalkerPng from '@atlases/enemy-stalker.png?url';
import stalkerJson from '@atlases/enemy-stalker.json?url';
import spitterPng from '@atlases/enemy-spitter.png?url';
import spitterJson from '@atlases/enemy-spitter.json?url';
import bomberPng from '@atlases/enemy-spore-bomber.png?url';
import bomberJson from '@atlases/enemy-spore-bomber.json?url';
import bruiserPng from '@atlases/enemy-bruiser.png?url';
import bruiserJson from '@atlases/enemy-bruiser.json?url';
import guardianPng from '@atlases/enemy-guardian.png?url';
import guardianJson from '@atlases/enemy-guardian.json?url';

export type CatalogEntry = {
  id: string;
  label: string;
  png: string;
  json: string;
};

export const GAME_CATALOG: CatalogEntry[] = [
  {
    id: 'player-prospector',
    label: 'Prospector (jogador)',
    png: prospectorPng,
    json: prospectorJson,
  },
  { id: 'enemy-stalker', label: 'Stalker (predador)', png: stalkerPng, json: stalkerJson },
  { id: 'enemy-spitter', label: 'Spitter (cuspidor)', png: spitterPng, json: spitterJson },
  { id: 'enemy-spore-bomber', label: 'Spore Bomber', png: bomberPng, json: bomberJson },
  { id: 'enemy-bruiser', label: 'Bruiser (britador)', png: bruiserPng, json: bruiserJson },
  { id: 'enemy-guardian', label: 'Guardian (chefe)', png: guardianPng, json: guardianJson },
];
