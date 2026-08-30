# Voxelyn Survival — Art Bible v2

> **v2 — grade voxel subdividida.** Cada unidade autorada dos modelos passou a
> render 2×2×2 voxels finos (`MODEL_SCALE = 2` no pipeline de conteúdo), então
> todo atlas tem o **dobro da resolução para o mesmo tamanho de mundo**: os
> canvases e âncoras dobraram em pixels de atlas, e o cliente desenha tudo com
> `zoom / ATLAS_SCALE` — no zoom típico de 2×, cada pixel de atlas cai em 1
> pixel de tela. As medidas LÓGICAS (tile de 32×16, proporções entre entidades,
> hitboxes e footprints em tiles) não mudaram. Orçamentos de §2 revisados junto:
> PNG ≤ 1 MiB por atlas, ≤ 6 MiB no pacote, RGBA decodificado ≤ 96 MiB
> (validados em `tools/validate.mjs`).

Direção artística obrigatória para todos os assets do Voxelyn Survival. Nenhum sprite entra no
jogo sem obedecer a este documento e passar pela validação automatizada
(`scripts/validate-sprites` — ver §12).

Baseline do que falhou (e por quê): `docs/audit/2026-07-24-phase0-audit.md` §4–5.

## 1. Identidade visual

O Voxelyn Survival se passa dentro do **Veio** — uma mina abandonada que foi colonizada por um
organismo fúngico-mineral. Não é fantasia genérica nem cópia de nenhum jogo existente. A imagem
deve comunicar, em ordem de prioridade:

1. **Legibilidade de perigo** — o jogador identifica em <200 ms o que mata.
2. **Subterrâneo vivo** — paredes com veios orgânicos, pulsação sutil, bioluminescência.
3. **Mineração abandonada** — trilhos, suportes de madeira apodrecida, terminais mortos,
   metal oxidado; a civilização saiu às pressas.
4. **Opressão** — escuridão dominante; a luz é recurso, não padrão.

Proibido: assets de pacote gratuito, estética de fazenda/pasto, mistura de pixel art limpa com
imagens borradas/semi-realistas, personagens com perspectivas diferentes entre si.

## 2. Especificações técnicas base

| Parâmetro | Valor |
| --- | --- |
| Grade voxel | 1 unidade autorada = 2×2×2 voxels finos (`MODEL_SCALE = 2`); voxel fino = 4×2 px na projeção; meio-passo (0.5) é a unidade de detalhe fino |
| Resolução de atlas | 2 px de atlas por px lógico (`ATLAS_SCALE = 2`); no zoom 2× do jogo o desenho é 1:1 |
| Tile lógico | 32×16 px lógicos (losango isométrico 2:1) = 64×32 px de atlas |
| Altura de parede/andar | 14 px lógicos (7 unidades autoradas) |
| Perspectiva | Isométrica 2:1 (dimétrica), câmera fixa, sem rotação |
| Personagem padrão (Prospector) | 88×112 px de atlas |
| Criatura pequena (stalker/spitter/bomber) | 64×64 px de atlas |
| Criatura grande (bruiser) | 96×136 px de atlas |
| Chefe final (guardian) | 112×128 px de atlas — o único canvas desta classe; a hierarquia de tamanho sobre o bruiser é contrato |
| Elites e chefes (miner/corcel/bispo) | 96×120 / 160×168 / 112×124 px de atlas |
| Projéteis/impactos | 32×32 px de atlas |
| Profundidade de cor | Paleta indexada; máx. 20 cores por atlas incluindo outline (`tools/validate.mjs`) |
| Transparência | Alpha binário: 0 ou 255 em TODO atlas; efeitos translúcidos vivem em sistemas de FX de runtime, nunca no atlas |

## 3. Anchors e footprint

- Anchor de toda entidade: **centro do losango do tile ocupado**, em px do canvas do frame.
  Convenção: `anchorX = frameWidth / 2`, `anchorY = frameHeight - 6` para humanoides (os 6 px
  finais reservam a elipse de contato com o chão).
- Footprint (células ocupadas para colisão/oclusão) é definido no manifest, nunca inferido da arte.
- Hitbox é **separada da arte** e definida em células lógicas no manifest (`hitbox: {w, h}` em
  frações de tile). A arte pode transbordar o tile; a hitbox não.

## 4. Iluminação e sombreamento

- Luz key global: **topo-esquerda** (mesma direção do `LIGHT_DIR {-0.6,-0.4}` já usado pelo
  terreno). Todos os sprites sombreiam consistentemente com ela.
- Cada sprite tem no máximo 3 valores por matiz: luz, meio-tom, sombra.
- Luzes emissivas (cristais, fungos, telas) usam as cores de acento (§6) e podem ignorar a key
  light — são as únicas fontes de saturação alta na cena.
- Sombra de contato: elipse escura alpha 128, desenhada pelo engine (não embutida no sprite).

## 5. Outline e silhueta

- Outline de 1 px **seletivo**: apenas entidades interativas (jogador, criaturas, loot,
  interativos). Cor do outline: sombra mais escura do próprio sprite (nunca preto puro
  `#000000`).
- Cenário/props não interativos: sem outline (recuam para o fundo).
- Teste de silhueta obrigatório: cada entidade nova deve ser aprovada primeiro como
  **silhouette sheet** (preenchimento chapado) sobre fundo claro e escuro. Se duas entidades se
  confundem em silhueta a 100% de zoom do jogo, uma delas volta para redesign.

## 6. Paleta mestra

Paleta global do bioma 1 ("Veio Fúngico"). Sprites usam subconjuntos; nenhuma cor fora dela sem
aprovação registrada no manifest.

Ambiente (dessaturado, escuro):

| Papel | Hex |
| --- | --- |
| Escuridão / fundo | `#0b0e14` |
| Rocha sombra | `#1d2430` |
| Rocha base | `#2e3a4d` |
| Rocha luz | `#46566e` |
| Terra/óxido escuro | `#3d2f28` |
| Metal enferrujado | `#6e4a33` |
| Madeira podre | `#4a3b2a` |
| Osso/pálido | `#b8a98f` |

Vida fúngica (identidade do jogo):

| Papel | Hex |
| --- | --- |
| Fungo escuro | `#1f3d33` |
| Fungo base | `#2f6b4f` |
| Fungo luz / esporos | `#66c28a` |
| Bioluminescência (acento frio) | `#59f2c2` |

Perigo e feedback (reservadas — nunca usar em cenário neutro):

| Papel | Hex |
| --- | --- |
| Corrosivo / ácido | `#a8e63c` |
| Fogo / explosão | `#ff7a2f` |
| Dano / sangue-fluido | `#d93b4c` |
| Eletricidade | `#7ab8ff` |
| Loot / interação | `#ffd166` |
| Jogador (acento) | `#e8f1ff` |

Regra de contraste: entidade viva sempre ≥ 2 passos de valor acima do chão sob ela. Saturação
alta = perigo ou recompensa, **nunca decoração**.

## 7. Animação

| Animação | Frames | FPS | Obrigatória para |
| --- | --- | --- | --- |
| `idle` | 4 | 6 | todas as entidades vivas |
| `walk` | 6 | 10 | jogador, criaturas móveis |
| `attack` | 4 | 12 | jogador, criaturas com ataque |
| `hit` | 2 | 12 | todas as entidades com HP |
| `die` | 5 | 10 | todas as entidades com HP |
| `special` | 4–6 | 10 | spitter (cuspir), bomber (inflar), guardian (invocar) |
| `revive` (co-op) | 6 | 8 | jogador |

- Direções: **4** (DR, DL, UR, UL). DL e UL podem ser flip horizontal de DR/UR somente se o
  design for simétrico (sem marcas assimétricas); a decisão fica registrada no manifest
  (`directions: 4` com `flipPairs`).
- Key poses primeiro, inbetweens depois. Nada de gerar 6 frames independentes por IA.
- Movimento por deslocamento de silhueta (squash & stretch discreto ≤ 2 px), sem sub-pixel.

## 8. Nomenclatura e estrutura de arquivos

```
packages/voxelyn-survival-content/assets/
  atlases/
    <entity-id>.v<NN>.png          # ex.: player-prospector.v01.png
    <entity-id>.v<NN>.json         # manifest do atlas (ver §9)
  concepts/                        # arte de exploração (nunca carregada pelo jogo)
    <entity-id>/moodboard-*.png
    <entity-id>/silhouettes-*.png
    <entity-id>/turnaround-*.png
  palettes/
    veio-fungico.v01.gpl
```

- IDs em kebab-case: `player-prospector`, `enemy-stalker`, `enemy-bruiser`, `enemy-spitter`,
  `enemy-spore-bomber`, `enemy-guardian`, `prop-terminal`, `prop-portal`, `prop-crystal`,
  `prop-fungal-cluster`, `prop-exit-core`, `fx-projectile-bolt`, `fx-impact-burst`,
  `loot-cache`.
- Nome de frame dentro do atlas: `<id>/<anim>/<dir>/<frame>` (ex.: `enemy-stalker/walk/dr/003`).
- Proibido nome opaco (o caso `9+BtwY.png` do baseline é o anti-exemplo canônico).

## 9. Manifest de sprites (contrato)

Todo atlas tem um manifest JSON validado em CI contra este tipo:

```ts
type SpriteAnimationDefinition = {
  frames: number;
  fps: number;
  loop: boolean;
};

type SpriteManifestEntry = {
  id: string;                 // kebab-case, único
  version: number;            // incrementa a cada re-export
  atlas: string;              // caminho relativo do PNG
  frameWidth: number;
  frameHeight: number;
  anchorX: number;
  anchorY: number;
  directions: number;         // 4; flipPairs documenta flips
  flipPairs?: Record<string, string>; // ex.: { dl: 'dr', ul: 'ur' }
  hitbox: { w: number; h: number };   // frações de tile, separado da arte
  animations: Record<string, SpriteAnimationDefinition>;
  palette: string;            // id da paleta usada
  generation?: {              // rastreabilidade de IA
    tool: string;
    prompt: string;
    seedOrRef?: string;
  };
};
```

## 10. Pipeline de produção (obrigatório)

Ordem fixa por entidade — nenhuma etapa pode ser pulada:

1. Moodboard/direção (concepts/, IA permitida e incentivada).
2. Silhouette sheet aprovada em fundo claro E escuro, na escala real do jogo.
3. Turnaround consistente (4 direções) da pose neutra.
4. Key poses das animações obrigatórias.
5. Inbetweens (desenhados ou gerados a partir das keys — nunca frames soltos de IA).
6. Normalização programática: quantizar para a paleta, remover alpha parcial, alinhar anchor,
   recortar para o frame size.
7. Montagem do atlas + manifest.
8. Validação automatizada (§12) verde.
9. Teste in-game no sprite viewer (§13) e em cena real, em zoom 2× num viewport 844×390.
10. Só então o PR substitui o asset antigo. Comparação antes/depois no PR.

Papel da IA: concepts, silhuetas, key poses, props, texturas-base, variações controladas.
**Nunca**: spritesheet final sem passar por 6–9.

## 11. Primeiro pacote de assets (ordem de produção)

1. `player-prospector` (personagem principal) — completo (todas as animações).
2. `enemy-stalker`, `enemy-spitter` — completos.
3. `fx-projectile-bolt`, `fx-impact-burst` — completos.
4. `enemy-bruiser`, `enemy-spore-bomber` — completos.
5. `enemy-guardian` — completo.
6. Props: `prop-exit-core`, `prop-terminal`, `prop-portal`, `prop-crystal`,
   `prop-fungal-cluster`, `loot-cache`, obstáculos.
7. Tiles de material (rocha, chão fúngico, minério, biofluido, trilhos).

Validar 1–3 dentro do jogo antes de produzir 4–7.

## 12. Validação automatizada

Script de CI verifica para cada manifest/atlas:

- arquivo PNG existe e dimensões batem com `frames × frameWidth/Height`;
- nenhum frame 100% vazio;
- nenhum pixel com alpha fora de {0,255} (ou {0,64,128,192,255} para `fx-*`);
- nenhum pixel de conteúdo tocando a borda do frame (bleeding de atlas);
- cores ⊆ paleta declarada;
- anchor dentro do frame;
- animações obrigatórias presentes por categoria de entidade;
- versão incrementada quando o hash do PNG muda.

## 13. Sprite viewer interno

Página interna (`/dev/sprites` no cliente) com: todas as animações de todos os manifests;
fundo claro/escuro alternável; zoom inteiro 1×–8×; escala real do jogo; overlay de hitbox,
anchor e footprint; seletor de direção; velocidade configurável; comparação lado a lado entre
versões de um mesmo id.

## 13.5 Cartuchos de módulo: entrada, uso e saída

Os sete cartuchos Aurix (`module-hardware.ts`) são pixel art **procedural**, não atlas:
chassi comum (corpo de aço, conector traseiro de três aletas, placa de identificação âmbar)
mais **um** componente funcional dominante, tudo numa prancheta de 32×26 unidades ancorada
em pixels inteiros. A regra de silhueta do §5 vale entre eles como vale entre criaturas: se
dois cartuchos se confundem a 100% de zoom, um volta para redesign.

O caso da **Minigun** documenta como a regra se aplica, e ela precisou de duas tentativas.

A primeira punha um **pente de quatro canos** no lugar de destaque, e falhava no teste pelo
motivo mais direto possível: contra o **perfurante**, que também é um tubo comprido apontado
para a direita, o cartucho não tinha nada de diferente a dizer. Pior, os canos eram
`steel`/`steelLight` sobre o tampo `steelLight` do chassi e sumiam — o que o olho pegava era
o bloco de culatra em osso, um **retângulo vertical claro**, exatamente a forma errada para
um conjunto rotativo horizontal. A peça dominante tinha acabado sendo a errada por acidente.

A versão atual troca o componente dominante em vez de ajustar o desenho: a peça é a
**munição**. Caixa com fita rolando no terço esquerdo, carcaça de motor com aletas no meio,
e o cano reduzido a um **toco grosso**. Isso resolve as duas confusões de uma vez — não é um
tubo (separa do perfurante) e não tem peça redonda dominante (separa do disco) — e de quebra
acerta a fantasia: a arma não se define por girar, se define por trezentas balas. A carcaça
com aletas é a segunda leitura, e é ela que explica o spin-up antes de o jogador senti-lo.

Uma nota de paleta que custou uma iteração: a variante intermediária usava **ciano** na
ventoinha e no LED. Ciano nesta bancada já significa perfurante, ricochete e disco de
retorno — usá-lo num quarto cartucho mancharia o código de cor dos quatro de uma vez. O
acento da Minigun é o **âmbar do latão**, que é literalmente do que ela é feita.

A rotação entra por parâmetro (`spin`), nunca por relógio interno: o mesmo desenho serve ao
cartucho **parado** na bancada do terminal e ao cartucho **encaixado** no bot, cuja rotação é
estado autoritativo da simulação. Um relógio próprio faria a vitrine girar sozinha.

Três momentos usam a MESMA arte, e é isso que faz o cartucho ser um objeto e não três
ícones:

| Momento | Onde | Como aparece |
| --- | --- | --- |
| Escolha | Terminal de recuperação | Aceso (`lit` acompanha o boot do CRT) |
| Incorporação | Voo em arco até o Prospector | Aceso, encolhendo, com rastro discreto |
| Ejeção | Objeto de cena no chão | Apagado (`lit` parcial); a Minigun ainda quente |

A incorporação e a ejeção são **apresentação pura** (`module-props.ts`): a concessão do
módulo acontece na simulação, no tick do comando, e o evento que dispara a animação é um
relato do que já aconteceu. Nada nelas atrasa, condiciona ou confirma nada — origem que não
resolve vira um clarão curto sobre o próprio bot, e a seleção nunca depende da animação.

No Prospector, a arma é uma **sobreposição procedural** sobre o sprite (`minigun-mount.ts`),
e não quadros novos no atlas: oito rumos × as posições de cano seriam dezenas de quadros por
animação para uma peça que dura vinte segundos de run. A silhueta segue a do cartucho —
caixa de munição atrás, toco grosso na frente, **duas** linhas de cano e não quatro finas,
porque nesta escala um feixe de tubos finos vira um borrão cinza de três pixels.

A regra que faz a rotação funcionar em poucos pixels: **rotação não se lê por movimento
angular, e sim por alternância** — aqui quem alterna é a ventoinha da culatra, três pixels em
órbita, o mesmo elemento que gira no cartucho. Um desenho girado de verdade num raio de três
pixels lê como tremor.

E o que gira é um **ângulo acumulado**, nunca a velocidade de rotação. A velocidade satura em
1 durante toda a rajada; usá-la como fase congela os canos exatamente no trecho em que eles
giram mais rápido. `minigun-view.ts` integra o ângulo a partir da velocidade autoritativa, e
é ele que a apresentação consome.

O clarão de boca é pequeno e frequente, nunca uma flor de fogo: dezesseis por segundo com o
clarão do tiro comum cobririam o inimigo que o jogador está mirando, e a arma passaria a
esconder o próprio alvo. Fumaça só perto do travamento, pela mesma razão.

## 14. Renderização e atmosfera (sistemas, não assets)

- Iluminação localizada: escuridão base + raio de luz do jogador + luzes emissivas pontuais.
- Fog of war reaproveitando o sistema atual, mais escuro (não-cinza).
- Hit flash branco 2 frames; screen shake ≤ 4 px e ≤ 180 ms.
- Partículas com orçamento (baseline atual `MAX_PARTICLES=160` é o teto mobile).
- **Cápsulas e props de módulo têm teto próprio e pool de reuso** (`casings.ts`,
  `module-props.ts`): 48 cápsulas por jogador, 8 cartuchos ejetados, 4 voos de incorporação.
  O anel de cápsulas é alocado uma vez e recicla a mais velha — trezentas balas por cartucho
  custam zero alocação em regime. O jogo dispara logicamente mais balas do que desenha
  latão quando a carga aperta, e está certo assim: a impressão de abundância vem da
  **amostragem**, não de uma relação 1:1 que o alvo móvel não sustentaria.
- Materiais reativos sempre com marcador visual próprio (brilho/bolhas/faísca) — a paleta de
  perigo (§6) é o canal de comunicação.
- Nada disso pode reduzir a legibilidade de: projéteis, inimigos, líquidos perigosos, saída,
  loot, telegraph de ataques. Legibilidade vence beleza em qualquer conflito.
