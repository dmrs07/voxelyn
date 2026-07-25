# Voxelyn Survival — Production Spec: personagens voxel isométricos

**Data:** 2026-07-25  
**Escopo:** `packages/voxelyn-survival`, `packages/voxelyn-survival-content`, `packages/voxelyn-survival-sim`, `packages/voxelyn-survival-protocol` e `packages/voxelyn-survival-server`  
**Base obrigatória:** `docs/art/voxelyn-survival-art-bible.md`

## 1. Objetivo

Substituir os personagens procedurais/fallback atuais por sprites pré-renderizados com aparência voxel, isolados, legíveis e animados para:

- `player-prospector`;
- `enemy-stalker`;
- `enemy-spitter`;
- `enemy-bruiser`;
- `enemy-spore-bomber`;
- `enemy-guardian`.

As folhas anexadas são referência de linguagem de pose, volume, telegraph, impacto e decomposição. Os designs finais devem ser autorais do universo Voxelyn, sem copiar personagens, proporções, paletas ou detalhes identificáveis.

A entrega inclui arte, pipeline reproduzível, manifests, integração com a simulação autoritativa, protocolo online, tombstones visuais, validação automatizada, PWA/offline e evidências in-game.

## 2. Resultado visual esperado

- Perspectiva isométrica 2:1, câmera fixa e coerente com o terreno.
- Aparência de modelo voxel pré-renderizado, com volumes facetados e leitura tridimensional clara.
- Silhuetas individualizadas; nenhuma entidade pode ser apenas recoloração ou escala de outra.
- Materiais distintos: metal, quitina, fungo, rocha, esporos e cristais.
- Key light no topo-esquerda.
- Boa leitura em zoom 2× e no viewport mobile 844×390.
- Outline seletivo de 1 px usando a sombra mais escura do próprio sprite.
- Saturação alta reservada a perigo, ataque, interação e recompensa.

## 3. Direções isométricas

| ID | Leitura visual | Vetor de mundo |
| --- | --- | --- |
| `dr` | frente em 3/4, baixo-direita da tela | `+x` |
| `dl` | frente em 3/4, baixo-esquerda da tela | `+y` |
| `ur` | costas em 3/4, cima-direita da tela | `-y` |
| `ul` | costas em 3/4, cima-esquerda da tela | `-x` |

A regra padrão deste pacote é autorar as quatro direções. `flipPairs` só é permitido quando a entidade for realmente simétrica e a comparação no viewer comprovar que iluminação, volumes, arma, antena, mochila, lâmina, núcleo e marcas laterais continuam corretos.

Prospector, stalker e bomber devem usar quatro direções autoradas. Para os demais, qualquer flip precisa ser justificado no manifest.

## 4. Isolamento, alpha e efeitos

Cada frame de entidade deve:

- usar fundo transparente real, sem checkerboard embutido;
- usar exclusivamente alpha 0 ou 255;
- não conter sombra elíptica de contato;
- preservar ao menos 2 px de respiro nas bordas;
- manter anchor estável;
- evitar jitter involuntário;
- não compartilhar pixels com frames vizinhos;
- respeitar hitbox e footprint definidos no manifest.

Fumaça, gases, nuvens, arcos, ácido em voo e partículas com alpha parcial devem ser assets separados `fx-*`, sincronizados por eventos autoritativos. Atlases de entidade permanecem binários. Fragmentos sólidos podem existir no frame de morte desde que mantenham alpha binário e não alterem colisão.

Orçamento padrão de efeitos por ação: até 1 emissor principal e 24 partículas visíveis por entidade; o preset de qualidade pode reduzir esse teto.

## 5. Pipeline obrigatório

1. Silhouette sheet em fundo claro e escuro.
2. Turnaround neutro `dr`, `dl`, `ur`, `ul`.
3. Voxel master ou representação volumétrica equivalente.
4. Key poses de cada animação.
5. Inbetweens derivados das key poses.
6. Render em resolução de trabalho alta.
7. Downsample nearest-neighbor para a resolução lógica.
8. Quantização para a paleta aprovada.
9. Normalização de alpha, anchor, canvas e limite de cores.
10. Montagem do atlas e manifest.
11. Validador verde.
12. Teste no sprite viewer, desktop, mobile e PWA offline.

A fonte de verdade deve ser reproduzível. Todo manifest registra ferramenta, prompt, seed/referência e versão.

## 6. Escala e resolução

Esta spec mantém os canvases canônicos da Art Bible:

| Entidade | Categoria | Canvas lógico |
| --- | --- | --- |
| `player-prospector` | humanoide | 24×32 |
| `enemy-stalker` | pequena | 24×24 |
| `enemy-spitter` | pequena | 24×24 |
| `enemy-spore-bomber` | pequena | 24×24 |
| `enemy-bruiser` | grande | 40×48 |
| `enemy-guardian` | grande | 40×48 |

Guardian e bruiser devem se diferenciar por ocupação, massa, proporção e silhueta dentro do mesmo canvas grande. Alterar esses tamanhos exige primeiro versionar a Art Bible e, na mesma entrega, atualizar viewer, manifests, validador, escala em cena e testes de regressão.

Limites de ocupação:

- pelo menos 2 px livres em cada borda;
- humanoide ocupa aproximadamente 16×24 px;
- pequenas não podem exceder a leitura de um tile lógico;
- grandes podem transbordar visualmente o tile, mas usam footprint explícito e escala de desenho 1:1.

## 7. Paleta e limite de cores

Usar apenas a paleta mestra `veio-fungico.v01`. Esta entrega não adiciona púrpura ou magenta.

Mapeamento aprovado:

- carapaça do stalker: `blood`, `rust`, `rockShadow` e `rock`;
- núcleos minerais de bruiser/guardian: `electric` ou `biolum` sobre `rockShadow`/`rock`;
- bomber: `fungusDark`, `rockShadow`, `fire`, `blood` e `biolum`;
- ácido: apenas `acid` nos pontos de perigo imediato.

Cada atlas de entidade pode usar no máximo 16 cores RGB distintas. Transparente não conta. Outline, sombras internas e highlights contam. O validador deve verificar o limite por sprite/atlas e também por frame, evitando que um atlas passe usando toda a paleta mestra.

Qualquer nova paleta exige `veio-fungico.v02`, atualização da Art Bible, `ALLOWED_HEX`, manifests e testes no mesmo PR.

## 8. Contrato de animações

### 8.1 Entidades vivas

| Animação | Frames | FPS | Loop |
| --- | ---: | ---: | --- |
| `idle` | 4 | 6 | sim |
| `walk` | 6 | 10 | sim |
| `attack` | 4 | 12 | não |
| `hit` | 2 | 12 | não |
| `die` | 5 | 10 | não |

### 8.2 Prospector em co-op

| Animação | Frames | FPS | Loop |
| --- | ---: | ---: | --- |
| `downed` | 4 | 6 | sim |
| `revive` | 6 | 8 | não |

Estados distintos:

- `downed`: player continua `alive === true`, não age e aguarda revive/bleedout;
- `revive`: começa no evento autoritativo de revive e interrompe imediatamente `downed`;
- `die`: apenas morte terminal (`alive === false`), após bleedout ou quando não existe aliado de pé.

Prioridade visual:

1. tombstone de morte terminal;
2. `revive` até concluir;
3. `downed` enquanto `playerExtras.downed`;
4. `hit`;
5. `attack`/`special`;
6. `walk`;
7. `idle`.

`revive` pode voltar a `idle`/`walk` ao terminar. `die` nunca volta. A morte terminal é apresentada por tombstone visual mesmo após a entidade sair do estado autoritativo.

## 9. Intenção autoritativa de animação

A implementação deve introduzir um evento semântico versionado de início de ação:

```ts
type ActionKind = 'attack' | 'special' | 'detonate';

type ActionStartEvent = {
  t: 'action_start';
  entity: number;
  archetype: string;
  action: ActionKind;
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  startTick: number;
  releaseTick: number;
  endTick: number;
};
```

O estado ativo também deve viajar em `EntitySnapshot` para late join/full resync:

```ts
type EntityActionSnapshot = {
  kind: ActionKind;
  startTick: number;
  releaseTick: number;
  endTick: number;
  facingX: number;
  facingY: number;
};
```

Regras:

- o cliente não infere ataques por proximidade;
- o evento identifica exatamente a entidade e a direção;
- ataques inimigos com antecipação começam antes do dano/projétil;
- `shot` passa a carregar `owner` para rastreabilidade;
- dano de contato é aplicado no `releaseTick`, se o alvo ainda estiver no alcance;
- o renderer converte `(serverTick - startTick)` em progresso da animação;
- no solo, usa-se o mesmo evento e o mesmo estado; não existem dois contratos visuais.

## 10. Windup autoritativo do bomber

O bomber não detona mais instantaneamente ao entrar no raio. A simulação deve possuir ação `detonate`:

- começa ao atingir o raio de ativação;
- emite `action_start` com entidade, facing e ticks;
- dura pelo menos 10 ticks a 20 Hz;
- durante o windup, o bomber para ou desacelera de forma determinística;
- a explosão e a morte ocorrem no `releaseTick`;
- se morrer por dano antes do release, mantém a regra atual de detonar ao morrer, mas emite morte/tombstone e FX coerentes;
- o estado viaja em snapshots e full resync;
- testes cobrem início, não detonação antecipada, release, morte durante windup e reconexão no meio do telegraph.

## 11. Tombstones de morte

O cliente mantém tombstones visuais independentes do array autoritativo:

```ts
type VisualTombstone = {
  entity: number;
  archetype: string;
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  elite: boolean;
  startedAtTick: number;
  expiresAtTick: number;
};
```

O evento `death` deve incluir facing, elite e tick. Ao recebê-lo, o renderer cria/atualiza o tombstone antes de a entidade ser removida. O tombstone:

- desenha `die` até o último frame;
- preserva posição e direção;
- não possui hitbox, HP ou interação;
- expira após a duração do manifest;
- funciona em solo e online;
- não duplica ao receber evento repetido/reconectar;
- sobrevive à remoção do inimigo no snapshot seguinte.

Players mortos também usam tombstone. Players abatidos não.

## 12. Direção individual por personagem

### `player-prospector`

Pequeno explorador mecânico: capacete pálido, visor `biolum`, lâmpada/antena, módulo fúngico dorsal, aro industrial `loot`/`rust`, pernas articuladas.

- `walk`: passada mecânica e balanço dorsal;
- `attack`: ferramenta/aro se desloca com impacto curto;
- `hit`: visor pisca e torso recua;
- `downed`: ajoelha/desmonta parcialmente, mas mantém núcleo funcional;
- `revive`: remonta e reacende o visor;
- `die`: desmontagem progressiva em peças sólidas; fumaça/faíscas em `fx-*` separado.

Ferramenta, tanque e lâmpada mantêm o lado anatômico nas quatro direções.

### `enemy-stalker`

Predador quitinoso baixo, vermelho mineral, centro de massa avançado e uma lâmina lateral `loot`/`fire`.

- corrida baixa;
- `attack` com antecipação e corte em arco separado `fx-*` quando necessário;
- `hit` perde equilíbrio;
- `die` colapsa por segmentos.

A lâmina impede uso de flip.

### `enemy-spitter`

Anfíbio fúngico esguio, olhos bulbosos, boca larga e bolsa de ácido.

- caminhada irregular;
- `attack` infla a garganta antes do `releaseTick`;
- `hit` perde pressão;
- `die` desaba em massa/poça sólida; spray e gás ficam em `fx-*`.

O corpo não pode ser neon; `acid` marca apenas bolsa, saliva e impacto.

### `enemy-bruiser`

Geodo compacto, baixo e largo, placas `rock`/`bone`, núcleo `electric`, braços pesados.

- passos curtos e pesados;
- golpe de ombro/punho com follow-through;
- pouco recuo em `hit`;
- morte por desmoronamento em entulho.

### `enemy-spore-bomber`

Portador compacto com capuz fúngico, olho emissivo e cápsula perfurada.

- carga oscila ao caminhar;
- `special`/`detonate` expande a silhueta e muda emissivos de `biolum` para `fire`/`blood`;
- `die` termina em restos sólidos; nuvem usa `fx-*` separado.

O telegraph depende do windup autoritativo da seção 10.

### `enemy-guardian`

Titã mineral, torso escuro, antebraços claros enormes, máscara pálida e núcleo `electric`.

- passada pesada e apoio dos punhos;
- esmagamento/varrida com telegraph longo;
- quase não recua em `hit`;
- morre cedendo joelhos, apoiando os braços e virando formação de entulho.

Deve continuar distinguível do bruiser sem cor ou emissivos.

## 13. Manifest, footprint e nomes estáveis

Os arquivos carregáveis mantêm nomes estáveis:

```text
assets/atlases/player-prospector.png
assets/atlases/player-prospector.json
```

A versão vive em `manifest.version`. Não usar `.v02` no filename nesta entrega. Isso preserva gerador, imports estáticos do Vite, viewer e precache. O versionamento do arquivo físico só poderá ser adotado junto de uma migração completa para índice dinâmico/aliases.

Contrato de footprint:

```ts
type SpriteFootprint = {
  w: number;       // largura em tiles lógicos
  h: number;       // altura em tiles lógicos
  offsetX: number; // deslocamento do centro em tiles de mundo
  offsetY: number;
};
```

- origem padrão: centro do tile sob o anchor;
- `offsetX = 0` e `offsetY = 0` para entidades centradas;
- pequenas e player usam inicialmente `{w: 1, h: 1, offsetX: 0, offsetY: 0}`;
- bruiser/guardian podem usar footprint maior, definido explicitamente conforme colisão existente;
- hitbox continua independente;
- gerador, tipo TS, manifests, validador e overlay do viewer devem aceitar e exibir o campo;
- manifests antigos sem footprint recebem fallback compatível `{w: 1, h: 1, offsetX: 0, offsetY: 0}` durante uma versão de transição.

Os manifests também registram quatro direções, `authoredDirs`, `flipPairs`, dimensões, anchor, hitbox, animações, paleta, até 16 cores, ferramenta, prompt e seed/referência.

## 14. Integração no jogo

- Adicionar os seis atlases ao `SpriteBank` e ao índice.
- Manter fallback apenas como safety net de carregamento, com aviso único em desenvolvimento.
- Ao fim do pacote, nenhuma das seis entidades usa fallback no fluxo normal.
- `idle` e `walk` derivam de movimento somente quando não existe estado de prioridade maior.
- `attack`, `special`, `detonate`, `downed`, `revive` e `die` dependem do contrato autoritativo.
- A camada visual não altera dano, cooldown, colisão ou determinismo.
- Full resync carrega ação ativa; eventos seguintes mantêm a linha do tempo.

## 15. Validação automatizada

Adicionar ou confirmar testes para:

- seis entidades no índice e no `SpriteBank`;
- quatro direções resolvíveis;
- contagem canônica de frames;
- `downed`/`revive` no prospector;
- nenhum frame obrigatório vazio;
- alpha binário em entidade;
- cores dentro da paleta e no máximo 16 por atlas e frame;
- 2 px de borda livre;
- anchor dentro do canvas;
- footprint válido e fallback de compatibilidade;
- `flipPairs` válidos;
- versão incrementada quando PNG mudar;
- largura/altura e bytes dentro do orçamento;
- action state em sim, snapshots e full resync;
- ataque aplicado no `releaseTick`;
- windup do bomber;
- tombstone após remoção;
- `downed → revive → idle/walk`;
- bleedout `downed → die`;
- direção estável em ataque e morte;
- jitter de bounding box relativo ao anchor.

Outline e sombras internas entram na contagem de 16 cores. Transparência não.

## 16. Validação visual

Capturar no PR:

1. silhouette sheet clara e escura;
2. turnaround das quatro direções;
3. viewer com todas as animações;
4. `downed`, `revive` e morte terminal do prospector;
5. telegraph e release do bomber;
6. tombstone após desaparecimento do snapshot;
7. cena desktop;
8. cena mobile 844×390;
9. quadro das seis entidades na escala real;
10. comparação antes/depois.

Critérios:

- arquétipo identificável em menos de 200 ms;
- stalker diferente de spitter;
- bruiser diferente de guardian;
- bomber legível antes da explosão;
- nenhuma direção parece outro modelo;
- nenhum efeito esconde a ação;
- nenhuma morte é apenas `scaleY → 0` ou recorte vertical genérico.

## 17. PWA/offline reproduzível

A validação obrigatória inclui:

1. build de produção do cliente;
2. inspeção do service worker gerado, confirmando que todos os PNG/JSON usados pelo `SpriteBank` aparecem em `self.__VOXELYN_PRECACHE__` ou no manifest de precache equivalente;
3. primeira instalação online;
4. fechamento da aba;
5. bloqueio de rede;
6. reload offline;
7. início de run solo e abertura do sprite viewer sem requests falhos de atlas.

Adicionar teste de build que falha quando um asset importado pelo jogo não estiver no precache. Atlases não podem depender de URL externa.

## 18. Orçamentos mensuráveis

Por atlas de entidade:

- largura máxima: 4096 px;
- altura máxima: canvas canônico da entidade;
- PNG máximo: 512 KiB;
- memória RGBA decodificada: máximo 8 MiB.

Pacote dos seis:

- PNG transferido total: máximo 2,5 MiB;
- memória RGBA total: máximo 24 MiB;
- no máximo 6 requests de PNG e 6 manifests, salvo bundling mais eficiente;
- carregamento frio dos atlases: p95 ≤ 1,5 s em perfil Slow 4G do browser;
- frame de render em 844×390: p95 ≤ 16,7 ms e nenhum frame > 50 ms durante 60 s de combate;
- sem aumento superior a 10% no tempo de build do pacote de conteúdo.

Se um atlas exceder largura, o packer deve criar múltiplas linhas/páginas e o manifest deve mapear `sx`/`sy`; não reduzir frames nem aumentar canvas silenciosamente. Se exceder bytes/memória, simplificar frames, paleta ou efeitos antes do merge. Os números devem constar no PR.

## 19. Estratégia de entrega

### Slice A — contrato e prospector

- corrigir spec;
- footprint;
- action state/evento;
- tombstones;
- `player-prospector` com quatro direções, `downed` e `revive`;
- viewer e testes.

### Slice B — pequenos

- stalker e spitter completos;
- ataques autoritativos e projéteis identificados por owner.

### Slice C — pesados

- bruiser e bomber;
- windup autoritativo do bomber;
- FX separados.

### Slice D — guardian e fechamento

- guardian completo;
- fallback apenas de erro;
- PWA/offline;
- performance e evidências.

Os slices podem ser commits separados no mesmo PR desta execução. Cada slice deve terminar verde antes do próximo.

## 20. Fora de escopo

- copiar as referências;
- migrar o jogo para 3D em runtime;
- trocar câmera;
- alterar balanceamento além do timing estritamente necessário ao windup autoritativo;
- props e tiles;
- novas paletas nesta entrega;
- animações cosméticas antes das obrigatórias;
- alpha parcial dentro de atlas de entidade;
- filenames versionados sem migração completa;
- spritesheets finais gerados por IA sem pipeline e validação.

## 21. Definition of Done

- seis entidades com design voxel autoral;
- quatro direções consistentes;
- `idle`, `walk`, `attack`, `hit`, `die` em todas;
- `downed` e `revive` no prospector;
- bomber com windup autoritativo;
- action state em solo, snapshot e full resync;
- tombstones de morte funcionando;
- manifests estáveis, footprint e limite de 16 cores;
- atlases reproduzíveis e validados;
- nenhum fallback no fluxo normal;
- desktop, mobile e PWA offline funcionando;
- orçamentos cumpridos;
- testes/builds verdes;
- evidência visual e comparação antes/depois.

## 22. Instrução de execução para o agente

Ler integralmente:

- `docs/art/voxelyn-survival-art-bible.md`;
- `docs/art/2026-07-24-phase3-first-pack-notes.md`;
- `packages/voxelyn-survival-content/tools/generate.mjs`;
- `packages/voxelyn-survival-content/tools/entities.mjs`;
- `packages/voxelyn-survival-content/tools/validate.mjs`;
- `packages/voxelyn-survival-content/src/manifest.ts`;
- sprite viewer, `SpriteBank`, renderer e fallback voxel;
- simulação de entidades/downed/revive;
- protocolo, room snapshots e cliente de rede;
- service worker/build PWA.

Não tratar os sprites atuais como direção final. Preservar contratos válidos, corrigir os pontos incompatíveis descritos nesta spec e executar os slices em ordem.

Ao terminar cada slice:

1. gerar os atlases de forma reproduzível;
2. rodar validador, testes e builds relevantes;
3. capturar evidências;
4. registrar dimensões, bytes, memória e performance;
5. revisar direção, anchor, footprint, protocolo, PWA e regressões;
6. chamar `@codex` no PR;
7. corrigir os achados antes de avançar.
