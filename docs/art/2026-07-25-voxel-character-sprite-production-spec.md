# Voxelyn Survival — Production Spec: personagens voxel isométricos

**Data:** 2026-07-25  
**Escopo:** `packages/voxelyn-survival`, `packages/voxelyn-survival-content`  
**Base obrigatória:** `docs/art/voxelyn-survival-art-bible.md`

## 1. Objetivo

Substituir os personagens procedurais/fallback atuais por um conjunto coerente de **sprites pré-renderizados com aparência voxel**, altamente legíveis, isolados e animados, para as seis entidades principais do Voxelyn Survival:

- `player-prospector`;
- `enemy-stalker`;
- `enemy-spitter`;
- `enemy-bruiser`;
- `enemy-spore-bomber`;
- `enemy-guardian`.

Os sprites devem ser inspirados na linguagem de pose, volume, progressão de ataque e decomposição das seis folhas de referência fornecidas na tarefa original, mas precisam ser **designs autorais do universo Voxelyn**, sem copiar personagens, paletas, proporções ou detalhes identificáveis das referências.

A meta não é apenas trocar desenhos. O resultado deve formar um pipeline de produção reproduzível, com turnaround consistente, animações coerentes entre direções, manifests completos, validação automatizada e integração real no jogo.

## 2. Resultado visual esperado

- Perspectiva isométrica 2:1, câmera fixa e coerente com o terreno.
- Aparência de modelo voxel pré-renderizado, com volumes facetados e leitura tridimensional clara.
- Silhuetas individualizadas: nenhum personagem pode parecer apenas uma recoloração ou variação de escala de outro.
- Materiais reconhecíveis em movimento: metal, quitina, fungo, rocha, esporos e cristal devem reagir à luz de maneiras diferentes.
- Key light sempre no topo-esquerda, conforme a Art Bible.
- Detalhes suficientes para leitura em zoom 2×, sem virar ruído quando exibidos no viewport mobile de 844×390.
- Outline seletivo e escuro, nunca preto puro.
- Emissivos reservados para identidade, perigo e timing de ataque.

## 3. Interpretação das direções

Os quatro lados do personagem não são vistas ortográficas de frente, costas, esquerda e direita. São quatro facings diagonais do espaço isométrico:

| ID | Leitura visual | Vetor de mundo |
| --- | --- | --- |
| `dr` | frente em 3/4, voltado para baixo-direita da tela | `+x` |
| `dl` | frente em 3/4, voltado para baixo-esquerda da tela | `+y` |
| `ur` | costas em 3/4, voltado para cima-direita da tela | `-y` |
| `ul` | costas em 3/4, voltado para cima-esquerda da tela | `-x` |

### Regra de autoria

Para este pacote, a regra padrão é **autorizar e renderizar as quatro direções individualmente**. Não usar `flipPairs` por conveniência.

Flip horizontal só pode ser aceito quando:

1. a entidade for realmente simétrica;
2. arma, antena, mochila, núcleo, cicatriz, lâmina e emissivos não mudarem de lado de forma incorreta;
3. a comparação lado a lado no sprite viewer não revelar quebra de volume ou iluminação;
4. a decisão estiver documentada no manifest.

O `player-prospector`, o `enemy-stalker`, o `enemy-spore-bomber` e qualquer criatura com arma ou detalhe lateral devem, por padrão, ter quatro direções autoradas.

## 4. Isolamento e composição dos frames

Cada frame deve:

- ter fundo transparente real;
- não conter checkerboard embutido;
- não conter sombra elíptica de contato, pois ela pertence ao engine;
- não compartilhar pixels com o frame vizinho;
- preservar pelo menos 2 px lógicos de respiro em todas as bordas;
- usar alpha binário, exceto partículas e gases nos níveis permitidos pela Art Bible;
- manter o mesmo anchor de pés/base durante toda a animação;
- evitar jitter involuntário do centro de massa;
- separar hitbox e footprint da arte.

Poeira, estilhaços, ácido, fumaça e fragmentos podem transbordar visualmente o footprint, mas não podem alterar a colisão lógica.

## 5. Pipeline de produção obrigatório

A produção deve seguir esta ordem por entidade:

1. **Silhouette sheet** em fundo claro e escuro.
2. **Turnaround neutro** com `dr`, `dl`, `ur`, `ul`.
3. **Voxel master** ou representação volumétrica equivalente, com materiais e pontos assimétricos definidos.
4. **Key poses** de cada animação.
5. **Inbetweens derivados das key poses**, nunca frames independentes gerados sem continuidade.
6. Renderização em resolução de trabalho alta.
7. Downsample nearest-neighbor para a resolução lógica aprovada.
8. Quantização para a paleta do Veio Fúngico.
9. Normalização de alpha, anchor e canvas.
10. Montagem do atlas e do manifest.
11. `validate-sprites`/validador equivalente verde.
12. Comparação no sprite viewer e em cena real.

A fonte de verdade deve continuar sendo reproduzível. Não adicionar apenas um PNG opaco sem registrar origem, parâmetros e versão no manifest.

## 6. Escala e resolução

A Art Bible continua sendo a restrição principal. Os modelos podem ser produzidos em resolução alta, porém o export lógico deve preservar a relação com os tiles e a escala do mundo.

Baseline recomendado:

| Entidade | Categoria lógica | Canvas inicial de export |
| --- | --- | --- |
| `player-prospector` | humanoide | 24×32 |
| `enemy-stalker` | criatura pequena/larga | 32×32 |
| `enemy-spitter` | criatura pequena/média | 32×32 |
| `enemy-bruiser` | criatura grande | 40×48 |
| `enemy-spore-bomber` | criatura média | 32×40 |
| `enemy-guardian` | chefe/grande | 48×56 ou 56×64 |

Esses valores são ponto de partida, não licença para cortar membros ou efeitos. Um aumento de canvas é permitido quando:

- o footprint lógico permanece inalterado;
- o personagem continua coerente com a escala do cenário;
- o sprite viewer comprova ganho real de legibilidade;
- os testes de anchor, borda e atlas são atualizados.

Não ampliar todos indiscriminadamente. O guardian deve parecer enorme por massa e silhueta, não apenas por aplicar `scale()` no mesmo desenho.

## 7. Contrato mínimo de animações

Todos os personagens vivos devem possuir:

| Animação | Frames | FPS | Loop |
| --- | ---: | ---: | --- |
| `idle` | 4 | 6 | sim |
| `walk` | 6 | 10 | sim |
| `attack` | 4 | 12 | não |
| `hit` | 2 | 12 | não |
| `die` | 5 | 10 | não |

Animações adicionais devem representar comportamento real da simulação, não decoração desconectada.

### Continuidade

- `idle → walk` e `walk → idle` não podem produzir teleport visual.
- O primeiro frame de `attack` deve partir da pose-base ou de uma antecipação curta.
- O frame de impacto precisa ser visualmente identificável.
- `die` nunca volta para `idle` e termina em pose estável ou frame vazio apenas quando a entidade é removida imediatamente após a animação.
- Efeitos de morte devem permanecer orientados de acordo com a direção inicial, sem girar o personagem para uma direção genérica.

## 8. Direção individual por personagem

### 8.1 `player-prospector` — explorador mecânico do Veio

Inspiração funcional da primeira referência: pequeno robô explorador, cabeça arredondada, visor luminoso, membros mecânicos finos, aro/ferramenta circular e morte por desmontagem.

Design Voxelyn:

- capacete de mineração branco-pálido/metal envelhecido;
- visor bioluminescente frio em ciano;
- pequena antena ou lâmpada superior;
- tanque ou módulo fúngico nas costas;
- aro industrial amarelo-óxido na cintura, reinterpretado como ferramenta modular de mineração/defesa;
- pernas articuladas finas, claramente distintas das criaturas orgânicas.

Animações e comportamento:

- `walk`: passada mecânica, compressão leve dos joelhos e balanço controlado do módulo dorsal;
- `attack`: o aro/ferramenta se desloca ou gira, com arco emissivo curto e frame de impacto claro;
- `hit`: visor pisca e o torso recua sem perder o anchor;
- `die`: desmontagem progressiva em peças, faíscas e fumaça; não simplesmente afundar no chão;
- futuro `dodge`: deslocamento curto com inclinação do corpo;
- futuro `ability`: pulso radial de energia do módulo central.

Assimetria obrigatória: ferramenta, tanque e lâmpada devem manter o lado correto em todas as direções.

### 8.2 `enemy-stalker` — predador quitinoso de lâmina

Inspiração funcional da segunda referência: criatura vermelha agachada, corrida predatória, membro cortante dourado e golpes largos.

Design Voxelyn:

- carapaça quitinosa em vermelho de dano, magenta escuro e tons minerais;
- silhueta inclinada para frente, pernas traseiras prontas para arrancada;
- um membro anterior transformado em lâmina mineral/fúngica de alto contraste;
- cabeça baixa, olhos ou fendas emissivas pequenas;
- leitura de assassino rápido, não de tanque.

Animações e comportamento:

- `walk`: corrida baixa com centro de massa avançado;
- `attack`: antecipação curta seguida de corte em arco; o efeito não pode esconder o corpo inteiro;
- `hit`: perda rápida de equilíbrio;
- `die`: colapso segmentado da carapaça, com membros cedendo antes do torso;
- `special` opcional: `lunge` de 6 frames quando houver evento correspondente na simulação.

A lâmina deve permanecer no mesmo lado anatômico nas quatro direções. Portanto, não usar flip por padrão.

### 8.3 `enemy-spitter` — anfíbio fúngico corrosivo

Inspiração funcional da terceira referência: criatura verde esguia, olhos salientes, boca expressiva, ataque de cuspe e morte por liquefação.

Design Voxelyn:

- corpo fungo-anfíbio alongado;
- olhos ou bolsas sensoriais bulbosas;
- boca larga e bolsa de ácido visível;
- braços longos e mãos/pés aderentes;
- verde fúngico como base, reservando `acid` para saliva, bolsa inflada e impacto.

Animações e comportamento:

- `walk`: passada irregular, braços atrasando o movimento;
- `attack`: bolsa da garganta infla, cabeça recua, cuspe é liberado no frame de impacto e há recuperação curta;
- `hit`: perda momentânea de pressão da bolsa;
- `die`: corpo desaba e se dissolve em poça corrosiva/fúngica, com redução de volume coerente;
- `special`: pode reutilizar a sequência de cuspida quando a sim distinguir windup e release.

Não transformar o corpo inteiro em verde neon. A cor ácida deve indicar ataque e perigo imediato.

### 8.4 `enemy-bruiser` — geodo de impacto

Inspiração funcional da quarta referência: golem compacto de rocha e cristal, ataques pesados/rotacionais e morte por desmoronamento.

Design Voxelyn:

- massa mineral baixa e larga;
- placas de rocha sobre um núcleo púrpura emissivo;
- braços ou ombros grandes para comunicar impacto;
- peso visual concentrado próximo ao chão;
- cristais e fissuras assimétricos para impedir leitura de “bola de pedra genérica”.

Animações e comportamento:

- `walk`: passos curtos, corpo atrasado pelo peso, pequenas lascas no contato;
- `attack`: golpe de ombro ou braço com antecipação e follow-through pesado;
- `hit`: fissura/núcleo pisca, com recuo mínimo pela massa;
- `die`: placas cedem em etapas, núcleo apaga e o corpo termina como pilha de entulho;
- `special`: ground slam ou giro de impacto somente quando conectado à ação real da criatura.

### 8.5 `enemy-spore-bomber` — portador de esporos instáveis

Inspiração funcional da quinta referência: figura encapuzada com único olho luminoso, orbe explosivo, lançamento e morte em nuvem púrpura.

Design Voxelyn:

- corpo coberto por manto fúngico ou placas que lembram um capuz;
- um olho/núcleo emissivo central;
- saco de esporos ou cápsula perfurada carregada junto ao corpo;
- partículas discretas em idle, aumentando apenas durante o windup;
- silhueta compacta e instável, diferente do spitter esguio.

Animações e comportamento:

- `walk`: passos curtos, carga oscilando com atraso;
- `attack`: preparação e arremesso de orbe quando houver ataque à distância;
- `hit`: vazamento curto de esporos;
- `die`: expansão, explosão controlada em nuvem e assentamento em restos/pó;
- `special`: inflar/armar explosão em 4–6 frames, com telegraph inequívoco.

O emissivo laranja/vermelho deve marcar a iminência da explosão; o púrpura permanece identidade mineral/fúngica.

### 8.6 `enemy-guardian` — titã mineral do Veio

Inspiração funcional da sexta referência: gigante simiesco, braços de pedra enormes, postura de esmagamento, golpes no chão, escavação e morte como montanha de entulho.

Design Voxelyn:

- maior massa do elenco;
- torso escuro e compacto;
- antebraços/mãos de rocha clara desproporcionalmente grandes;
- máscara, crista ou placa frontal pálida;
- núcleo violeta protegido no peito;
- postura de guardião territorial, não apenas bruiser ampliado.

Animações e comportamento:

- `walk`: passada pesada, possível apoio dos punhos, deslocamento mínimo do anchor;
- `attack`: esmagamento vertical ou varrida de braço com telegraph longo;
- `hit`: fragmentos pequenos, núcleo pisca, corpo quase não recua;
- `die`: joelhos cedem, braços sustentam a massa por um instante e o corpo desmorona em formação rochosa persistente;
- `special`: ground slam, invocação mineral ou mergulho no solo, conforme a ação real disponível na simulação.

O guardian deve continuar identificável em silhueta sem partículas, emissivos ou cor.

## 9. Atlas e manifests

Estrutura esperada:

```text
packages/voxelyn-survival-content/assets/
  concepts/
    player-prospector/
    enemy-stalker/
    enemy-spitter/
    enemy-bruiser/
    enemy-spore-bomber/
    enemy-guardian/
  atlases/
    player-prospector.v02.png
    player-prospector.v02.json
    ...
```

Nome de frame conceitual:

```text
<entity-id>/<anim>/<dir>/<frame>
```

Exemplo:

```text
enemy-stalker/attack/ul/002
```

Os manifests devem registrar:

- versão incrementada;
- quatro direções;
- `authoredDirs` reais;
- `flipPairs` vazio quando não houver espelhamento;
- dimensões e anchor;
- hitbox e footprint preservados;
- animações, FPS e loop;
- paleta;
- ferramenta/origem da geração;
- prompt e referência interna suficientes para reprodução;
- hash ou seed quando aplicável.

## 10. Integração no jogo

### 10.1 Remover fallback progressivamente

- Não apagar o fallback antes de cada atlas novo carregar e renderizar corretamente.
- A substituição deve ser por entidade e coberta por teste.
- Ao final do pacote, os seis personagens não podem depender do fallback vetorial em condições normais.
- O fallback permanece como safety net para falha de carregamento, com log explícito e telemetria em desenvolvimento.

### 10.2 Estados de animação

O cliente já resolve direção e frames pelo manifest. A integração deve garantir:

- `idle` quando a velocidade estiver abaixo do threshold;
- `walk` durante deslocamento;
- `attack` disparado pelo evento/estado real de ataque, sem inferência frágil baseada apenas em proximidade;
- `hit` ao receber dano, com prioridade curta sobre `idle`/`walk`;
- `die` ao atingir zero HP, sem interrupção por outro estado;
- `special` quando a simulação expuser o comportamento correspondente.

A simulação continua autoritativa. A camada visual pode guardar timestamps/animation intent, mas não pode alterar dano, cooldown, colisão ou determinismo.

No online, qualquer dado novo necessário para distinguir `attack`, `hit`, `die` ou `special` deve entrar no protocolo de maneira versionada e testada. Não criar animação falsa exclusiva do cliente que contradiga o servidor.

## 11. Validação automatizada

Além das validações já existentes, adicionar ou confirmar testes para:

- todas as seis entidades presentes no índice de atlases;
- quatro direções resolvíveis por animação;
- contagem canônica de frames;
- nenhum frame obrigatório vazio;
- alpha válido;
- cores pertencentes à paleta declarada;
- conteúdo sem tocar as bordas;
- anchor constante e dentro do canvas;
- `flipPairs` não apontando para direção ausente;
- versão incrementada quando o PNG mudar;
- fallback usado apenas quando o asset falhar;
- estado `die` não reiniciando ou voltando para `idle`;
- direção visual estável durante ataque e morte;
- ausência de jitter excessivo entre frames consecutivos.

O teste de jitter pode medir a bounding box do conteúdo relativo ao anchor e falhar apenas para deslocamentos incompatíveis com a animação declarada, tolerando lunge, salto, fragmentos e dissolução.

## 12. Validação visual obrigatória

Capturar e anexar ao PR:

1. silhouette sheet de cada entidade em fundo claro;
2. silhouette sheet de cada entidade em fundo escuro;
3. turnaround com quatro direções;
4. sprite viewer exibindo `idle`, `walk`, `attack`, `hit` e `die`;
5. cena desktop;
6. cena mobile landscape em 844×390;
7. comparação antes/depois;
8. quadro com as seis entidades lado a lado na escala real do jogo.

Critérios de aprovação:

- identificação de cada arquétipo em menos de 200 ms;
- diferença clara entre stalker e spitter;
- diferença clara entre bruiser e guardian;
- perigo do bomber legível antes da explosão;
- visor do prospector visível sem competir com projéteis;
- nenhuma animação some sob partículas próprias;
- nenhuma direção parece pertencer a outro modelo;
- nenhuma morte parece apenas `scaleY → 0` ou recorte vertical genérico.

## 13. Estratégia de entrega

Produzir em slices, sem sacrificar fidelidade:

### Slice A — fundação e personagem

- pipeline de voxel master/render/downsample;
- `player-prospector` completo;
- validação do fluxo no sprite viewer e em mobile.

### Slice B — inimigos pequenos

- `enemy-stalker` completo;
- `enemy-spitter` completo;
- integração de ataques e mortes específicas.

### Slice C — inimigos pesados

- `enemy-bruiser` completo;
- `enemy-spore-bomber` completo;
- telegraphs de slam/explosão.

### Slice D — guardian e fechamento

- `enemy-guardian` completo;
- remoção do fallback normal para os seis personagens;
- quadro de escala final;
- regressão visual e de performance.

Cada slice deve ser um PR revisável. Não abrir seis PRs simultâneos com pipelines divergentes.

## 14. Performance e carregamento

- Preferir um atlas por entidade ou agrupamento coerente, evitando dezenas de requests pequenos.
- Não aumentar memória de textura sem medir.
- Registrar dimensões finais e bytes por atlas no PR.
- Carregamento deve continuar compatível com PWA/offline.
- Falha de um atlas não deve impedir o restante do jogo de iniciar.
- Não introduzir filtragem bilinear; manter `imageSmoothingEnabled = false`.
- Não criar modelos voxel 3D completos em runtime apenas para obter sprites, salvo decisão arquitetural separada e medida.

## 15. Fora de escopo

- copiar ou redesenhar fielmente os personagens das referências;
- trocar a câmera isométrica;
- migrar o jogo inteiro para renderização 3D;
- alterar balanceamento de HP, dano, velocidade ou spawn;
- produzir props e tiles neste mesmo pacote;
- adicionar dezenas de animações cosméticas antes de concluir as obrigatórias;
- remover o fallback antes da validação dos novos atlases;
- gerar spritesheets finais diretamente por IA sem turnaround, key poses, normalização e validação.

## 16. Definition of Done

A tarefa estará concluída quando:

- as seis entidades tiverem design voxel autoral e silhueta própria;
- cada uma possuir quatro direções isométricas consistentes;
- `idle`, `walk`, `attack`, `hit` e `die` estiverem presentes e integradas;
- os especiais necessários estiverem produzidos ou explicitamente faseados conforme a simulação;
- todos os atlases e manifests forem reproduzíveis e validados;
- o jogo usar os novos assets em desktop, mobile e PWA;
- o fallback não for utilizado no fluxo normal para nenhuma das seis entidades;
- os testes, builds e validadores do monorepo estiverem verdes nas áreas tocadas;
- o PR apresentar evidência visual completa e comparação antes/depois;
- uma revisão final verificar Art Bible, legibilidade, direção, anchor, performance e consistência entre frames.

## 17. Instrução de execução para o agente

Antes de implementar, leia integralmente:

- `docs/art/voxelyn-survival-art-bible.md`;
- `docs/art/2026-07-24-phase3-first-pack-notes.md`;
- `packages/voxelyn-survival-content/tools/generate.mjs`;
- `packages/voxelyn-survival-content/tools/entities.mjs`;
- `packages/voxelyn-survival-content/tools/validate.mjs`;
- `packages/voxelyn-survival-content/src/manifest.ts`;
- o sprite viewer e a integração do `SpriteBank` no cliente;
- o fallback voxel atual em `packages/voxelyn-survival/src/client/voxel-fallback.ts`.

Não trate os sprites atuais como direção final. Eles são baseline técnico e safety net. Preserve o que já funciona no contrato, mas redesenhe o conteúdo visual e as animações com a qualidade descrita nesta spec.

Ao finalizar cada slice:

1. rode os testes e builds relevantes;
2. gere os atlases de forma reproduzível;
3. rode o validador;
4. capture as evidências visuais;
5. documente decisões de direção, escala, flips e assimetrias;
6. peça revisão focada em arte, integração, regressão e performance;
7. corrija os achados antes de avançar para o slice seguinte.
