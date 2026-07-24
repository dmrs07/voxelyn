# Fase 3 — Nova direção visual: primeiro pacote (2026-07-24)

Substituição progressiva dos sprites que falharam pelo pipeline da art bible
(`docs/art/voxelyn-survival-art-bible.md`). Este é o **primeiro pacote** — não
substitui todos os assets de uma vez (regra da spec).

## O que entrou

Pacote `@voxelyn/survival-content` com o pipeline completo:

- **Contrato de manifest** (`SpriteManifestEntry`) + resolvedor de frames
  (`resolveFrame`, `frameAtTime`, `dirFromFacing`). Os manifests JSON em
  `assets/atlases/*.json` são a fonte da verdade do layout.
- **Gerador procedural** (`tools/`): paleta mestra da art bible, rasterização,
  desenhistas por entidade, empacotamento em atlas de linha única com `frameMap`
  computado, emissão de PNG + manifest. Determinístico e reproduzível — cada
  frame é processado/validado, não um dump cru de IA.
- **Validador automatizado** (`tools/validate.mjs`, art bible §12): dimensões,
  alpha binário, conformidade de paleta com a paleta mestra, completude do
  `frameMap`, sanidade de `flipPairs`, detecção de frames vazios (exceto caudas
  de morte).
- **Sprite viewer** (`/sprites.html`): todas as animações, fundos claro/escuro/
  fungo, zoom inteiro, escala real, anchor e hitbox, direção e velocidade
  configuráveis, metadados por sprite.

## Primeiro pacote (5 ids, validados dentro do jogo)

| ID | Frame | Animações | Direções |
| --- | --- | --- | --- |
| `player-prospector` | 24×32 | idle, walk, attack, hit, die | 4 (dr/ur + flips) |
| `enemy-stalker` | 24×24 | idle, walk, hit, die | 4 |
| `enemy-spitter` | 24×24 | idle, walk, attack, hit, die | 4 |
| `fx-projectile-bolt` | 16×16 | fly | 1 |
| `fx-impact-burst` | 16×16 | burst | 1 |

## Integração no cliente

- `SpriteBank` carrega atlases via vite (`?url` + import JSON), deriva o estado
  de animação no cliente (idle/walk/hit/die a partir de movimento/vida — a sim
  autoritativa não carrega intent de animação) e desenha com `pixelated`.
- **Fallback vetorial preservado**: arquétipos ainda sem sprite (bruiser,
  bomber, guardian) continuam desenhados como silhuetas vetoriais. Nenhum
  buraco visual durante a migração incremental.
- Tiros do jogador usam o sprite `fx-projectile-bolt`; cuspe inimigo permanece
  vetorial ácido (leitura de perigo distinta).

## Antes / depois

- Antes: `docs/audit/baseline/2026-07-24-survival-slice-desktop-1280x720.png`
  (prospector como "ovo" branco vetorial).
- Depois: `docs/audit/baseline/2026-07-24-survival-sprites-desktop-1280x720.png`
  e `...-mobile-844x390.png` (prospector pixel-art com lâmpada biolum e tanque).
- Sprite viewer: `docs/audit/baseline/2026-07-24-sprite-viewer.png`.
- Atlas do player ampliado 8×: `docs/audit/baseline/2026-07-24-player-atlas-zoom8x.png`.

## Legibilidade mobile

Sprites desenhados com `imageSmoothingEnabled=false` e zoom inteiro; silhuetas
fortes e paleta de perigo reservada mantêm projéteis, inimigos e o jogador
distinguíveis em 844×390. Efeitos não escondem gameplay (art bible §14).

## Próximos passos (fora deste PR)

1. Segundo pacote: `enemy-bruiser`, `enemy-spore-bomber`, `enemy-guardian`.
2. Props: `prop-exit-core`, `prop-terminal`, `prop-portal`, `prop-crystal`,
   `prop-fungal-cluster`, `loot-cache`, obstáculos.
3. Tiles de material (rocha, chão fúngico, minério, biofluido, trilhos).
4. Explorar concept art por IA para elevar o detalhe mantendo silhueta/paleta.
