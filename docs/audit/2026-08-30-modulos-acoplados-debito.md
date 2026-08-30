# Débito técnico dos módulos acoplados (2026-08-30)

Os módulos deixaram de ser glifos de HUD e viraram volume voxel montado na arma
do Prospector. O trabalho está fechado e testado, mas ele deixa cinco coisas em
aberto — quatro decisões conscientes e um defeito anterior que passou a ficar
visível. Este documento existe para nenhuma delas ser redescoberta por acidente
daqui a três meses.

Cada item tem: **o que acontece**, **por que ficou assim**, **o que custaria
consertar** e **onde mexer**. Os que forem baratos podem ser puxados isolados;
os caros dependem de decisões que não são de desenho.

---

## 1. O deslocamento da boca só corrige o eixo lateral

**O que acontece.** O tiro é desenhado saindo da boca da arma, e não do eixo do
corpo — mas só no eixo *lateral*. O componente **para a frente** existe e não é
aplicado.

Medido nos voxels do modelo, em tiles:

| arma | frente (boca) | frente (nascimento) | diferença |
| --- | ---: | ---: | ---: |
| Cravador | 0,438 | 0,400 | 0,038 |
| Minigun | 0,750 | 0,400 | **0,350** |

**Por que ficou assim.** Um deslocamento no eixo do movimento é indistinguível
de um projétil que saiu alguns quadros antes: a 22 tiles por segundo, 0,35 tile
são 16 ms. Aplicá-lo exigiria o cliente conhecer a distância de nascimento que a
simulação escolhe (`player.x + dir.x * 0.4`), duplicando um número que hoje só a
simulação decide — uma segunda fonte de verdade para comprar um efeito que
ninguém vê.

**O que custaria consertar.** Duas rotas, e a segunda é melhor:

1. Publicar a distância de nascimento do lado da simulação e o cliente subtrair.
   Barato, mas cria o acoplamento que a omissão evita.
2. **Nascer o projétil na boca**, na própria simulação. Aí não há o que corrigir
   no desenho — a posição autoritativa passa a ser a posição visível. Custa uma
   mudança de simulação (hash, versão de protocolo) e um passe de balanceamento:
   0,35 tile a mais de alcance efetivo na Minigun não é nada, mas 0,31 tile de
   deslocamento lateral muda de que lado de uma quina o tiro passa.

**Onde mexer.** `packages/voxelyn-survival/src/client/combat-plane.ts`,
`muzzleLateralTiles` — e a rota 2 em `run.ts`, `fireMinigunRound` e o bloco do
bolt.

---

## 2. O parceiro remoto não mostra os seis módulos acoplados

**O que acontece.** No co-op online, o Prospector do parceiro aparece com a arma
limpa mesmo com módulos instalados. A **Minigun aparece** (ela é reconstruída
pela rotação, via `mountedModules`); os seis acoplados, não.

**Por que ficou assim.** `activeModules` vive em `playerExtras`, que este cliente
só tem do próprio jogador. O `EntitySnapshot` do parceiro carrega posição, vida e
ação, e nada mais. É o mesmo silêncio que o calor do cano já tem, e pela mesma
razão: inventar uma build para o parceiro seria desenhar um estado que ninguém
mediu.

**O que custaria consertar.** Há duas rotas e nenhuma é de graça:

1. **Sem tocar no protocolo.** `module_selected` e `module_expired` já carregam
   `slot`, então um registro por slot — o mesmo padrão de `MinigunViews` —
   reconstruiria a lista dos eventos. O furo é conhecido e não é pequeno: um
   cliente que entra no meio da run ou reconecta recebe `full_resync`, que não
   carrega evento nenhum, e ficaria com a arma do parceiro limpa até a próxima
   troca de módulo dele.
2. **Com um campo no protocolo.** Uma lista de `ModuleId` no `EntitySnapshot`
   fecha o furo. São poucos bytes por jogador por snapshot, e cobra versão nova
   de protocolo.

**Onde mexer.** `packages/voxelyn-survival/src/client/presentation.ts`,
`gunStateOf` — e, na rota 2, `EntitySnapshot` em
`packages/voxelyn-survival-protocol/src/messages.ts`.

---

## 3. Em `ul` a arma some atrás do corpo

**O que acontece.** No rumo `ul` a arma e tudo montado nela ficam atrás do
chassi, então a build do jogador não é legível nesse quarto das direções.

**Por que ficou assim.** Não é regressão nem escolha: a arma é montada no ombro
**direito**, e quando o bot olha para `ul` esse ombro está do lado oposto ao da
câmera. O Cravador já tinha exatamente isso — `PLAYER_GUN_BEHIND_DIRS` existe
justamente para desenhá-lo atrás do tronco nesse rumo, em vez de deixá-lo
flutuando sobre o peito.

**O que custaria consertar.** Nada barato e nada obviamente certo. As saídas
seriam mover a arma para o eixo do corpo (perde a assimetria que faz o rumo do
bot ser legível), montar uma segunda arma no ombro esquerdo (muda o personagem),
ou desenhar a arma por cima do corpo sempre (era o comportamento antigo, e ela
flutuava sobre o peito). **Recomendo aceitar como é.**

**Onde está registrado.** `PLAYER_GUN_BEHIND_DIRS`, em
`packages/voxelyn-survival-content/src/manifest.ts`.

---

## 4. `ricochet` e `siphon` herdam a ordem de profundidade errada em `ur`

**O que acontece.** Os módulos herdam de qual lado do tronco a **arma** cai, em
cada rumo, porque estão parafusados nela. No rumo `ur` essa herança erra para
dois deles: `ricochet` e `siphon` ficam no flanco *externo*, que é o lado que a
câmera vê nessa direção, e deveriam vir à frente.

Medido a partir dos voxels, pixels em disputa com o tronco no rumo `ur`:

| módulo | pixels disputados | deveria estar à frente |
| --- | ---: | ---: |
| `ricochet` | 36 | 100% |
| `siphon` | 342 | 100% |
| os outros cinco | 126–1251 | 0–14% |

**Por que ficou assim.** A alternativa é uma tabela de rumos por módulo. Ela
resolveria os 378 pixels e criaria sete tabelas para manter à mão a cada ajuste
de montagem — e um módulo caindo do lado oposto ao da arma em que ele está
montado é pior do que os pixels que a herança erra.

**O que custaria consertar.** Barato e mecânico, se valer a pena: a mesma medida
que o teste já faz pode **gerar** a tabela por módulo em vez de conferir a
herança, do mesmo jeito que `PLAYER_GUN_BEHIND_DIRS` é gerado hoje para a arma.

**Onde está registrado.**
`packages/voxelyn-survival-content/tests/prospector-module-depth.test.mjs`.

---

## 5. A rajada da Minigun reinicia a animação do tronco cinco vezes por segundo

**Este é o único item que não nasceu neste trabalho.** Ele veio com a Minigun
autoritativa e ficou visível agora, porque a ventoinha precisou de um relógio
próprio para escapar dele.

**O que acontece.** A rajada agregada publica `action_start` a cada
`MINIGUN_BURST_EVENT_TICKS` (quatro ticks, 200 ms) com um `startTick` novo. O
cliente apaga o relógio visual sempre que o `startTick` muda, então a animação
de `attack` **reinicia a cada 200 ms**. São quatro quadros a 12 fps: em 200 ms
ela chega ao terceiro, e **o quarto quadro nunca é desenhado** enquanto o
gatilho estiver preso.

O comentário em `run.ts` afirma o contrário — que o `endTick` cobre a janela
seguinte e por isso a pose fica contínua. Ele cobre o *intent*; não cobre o
relógio, que é reancorado pelo `startTick`.

O clarão de boca sobrevive por sorte: `PROSPECTOR_MUZZLE_FLASH_FRAME` é o quadro
1, que cai dentro dos três que chegam a ser desenhados.

**O que custaria consertar.** Duas rotas, ambas pequenas:

1. **Na simulação:** não republicar `action_start` enquanto o anterior ainda não
   venceu — só estender o `endTick`. Muda o fluxo de eventos, então cobra um
   olhar no que mais consome `action_start`.
2. **No cliente:** manter o relógio quando a ação é a MESMA e a janela nova
   encosta na anterior, reancorando só quando há de fato uma ação nova. Fica
   contido na apresentação, que é onde o defeito se manifesta.

**Onde mexer.** `packages/voxelyn-survival-sim/src/run.ts`, no `stepMinigun`; e
`packages/voxelyn-survival/src/client/presentation.ts`, em `ingest` e
`visualActionElapsed`.

---

## Uma decisão em aberto, que não é débito

A **posição do volume da arma no corpo** — hoje no peito alto, logo abaixo da
ombreira direita — não foi revisitada neste trabalho. Ela pode estar certa; só
não foi objeto de decisão. Mover é barato (é uma caixa em `prospector.mjs`, e
`gunAnchor` leva os módulos junto de graça), mas mover às cegas custa um passe de
regeração de atlas e pode piorar. Fica registrado como pergunta, e não como
tarefa.
