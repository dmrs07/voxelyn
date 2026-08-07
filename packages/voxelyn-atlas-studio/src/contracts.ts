// CONTRATOS DO JOGO: todo manifest de atlas de
// packages/voxelyn-survival-content/assets/atlases, embarcado no bundle.
//
// Existe para fechar o buraco entre "quero refazer um bicho do jogo em voxel" e
// "tenho de reproduzir o contrato dele na mao". Abrir o atlas pelo catalogo da
// um projeto PIXEL — os modelos voxel originais vivem em codigo e nao voltam do
// PNG. Entao quem quer REMODELAR precisava criar um projeto do zero e depois
// acertar, na tela de configuracoes, tamanho de frame, ancora, hitbox,
// footprint e a lista de animacoes com frames/fps/loop de cada uma. Sao mais de
// vinte campos, todos capazes de invalidar o export se saírem trocados.
//
// Aqui o contrato vem inteiro do manifest de verdade, e o autor so faz arte.
import type { Project, SpriteManifestEntry } from './types';
import { modelKey } from './types';

/** Todos os manifests do pacote de conteudo, resolvidos em tempo de build. */
const MANIFESTS = import.meta.glob<SpriteManifestEntry>('@atlases/*.json', {
  eager: true,
  import: 'default',
});

export type GameContract = {
  id: string;
  label: string;
  manifest: SpriteManifestEntry;
};

/** Nome legivel a partir do id (`enemy-frost-queen` -> `Frost Queen`). */
const labelOf = (id: string): string => {
  const parts = id.split('-');
  const kind = parts[0];
  const rest = parts.slice(1).join(' ');
  const nome = rest.replace(/\b\w/g, (c) => c.toUpperCase());
  const prefixo = kind === 'enemy' ? 'Inimigo' : kind === 'player' ? 'Jogador' : kind;
  return `${nome} (${prefixo})`;
};

export const GAME_CONTRACTS: GameContract[] = Object.entries(MANIFESTS)
  .map(([path, manifest]) => ({
    id:
      manifest?.id ??
      path
        .split('/')
        .pop()!
        .replace(/\.json$/, ''),
    label: labelOf(manifest?.id ?? ''),
    manifest,
  }))
  .filter((c) => !!c.manifest?.animations)
  .sort((a, b) => a.id.localeCompare(b.id));

/**
 * Projeto VOXEL vazio com o contrato exato da entidade.
 *
 * A versao sobe em UM: o que sair daqui substitui o par PNG+JSON no jogo, e o
 * `SpriteBank` usa a versao para invalidar o cache — reexportar com a versao
 * antiga faria o cliente continuar servindo o sprite velho.
 *
 * `flipPairs` e zerado e as quatro direcoes passam a ser autoradas: em modo
 * voxel elas saem por ROTACAO do mesmo modelo, entao espelhar nao faz sentido
 * e um par herdado do manifest antigo deixaria duas direcoes sem frame.
 */
export const createProjectFromContract = (contract: GameContract): Project => {
  const m = contract.manifest;
  const now = Date.now();
  const project: Project = {
    key: `p${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    spriteId: m.id,
    name: contract.label,
    version: (m.version ?? 1) + 1,
    frameWidth: m.frameWidth,
    frameHeight: m.frameHeight,
    anchorX: m.anchorX,
    anchorY: m.anchorY,
    directions: 4,
    authoredDirs: ['dr', 'dl', 'ur', 'ul'],
    flipPairs: {},
    hitbox: { ...m.hitbox },
    footprint: { ...m.footprint },
    animations: structuredClone(m.animations),
    frames: {},
    mode: 'voxel',
    models: {},
    prompt: m.generation?.prompt ?? '',
    createdAt: now,
    updatedAt: now,
  };
  // um modelo por frame, todos vazios: o autor monta o primeiro e propaga
  for (const [anim, def] of Object.entries(project.animations)) {
    for (let f = 0; f < def.frames; f++) project.models![modelKey(anim, f)] = {};
  }
  return project;
};
