# Direção de arte — o booth que gatos construíram

> Norte: manter o pixel/voxel compacto e o roxo noturno, mas substituir o
> vazio por relações espaciais, aumentar os gatos, dar função ao letreiro,
> transformar computadores isolados em estações felinas e fazer cada cor
> importante representar um estado real do projeto.

## As três regras da cena

1. **Hierarquia por valor.** Parede mais escura (`#252334`), chão 10–15% mais
   claro (`#343145` / losangos `#3D394F`), móveis intermediários, gatos em
   contraste forte. A cena funciona em escala de cinza. O padrão do chão tem
   contraste interno baixo de propósito: ele sugere profundidade, não disputa
   com personagens.
2. **Tudo toca o chão.** Cada objeto tem sombra de contato desenhada por
   MISTURA de pixel (`mixPx`), com queda para a borda — nunca um retângulo
   chapado. Luminosos (monitores, letreiro, servidor) abrem pequenas poças de
   luz pelo mesmo mecanismo. Dois degraus, nunca bloom.
3. **Cada cor importante é um estado.** Ciano `#54C6D4` = atividade, verde
   `#65D39A` = build vivo, âmbar `#F0B552` = alerta, coral `#EB6767` = erro,
   violeta `#8C72F2` = seleção. Decoração não usa cor de estado.

## Composição (480×270)

```
chips do HUD (DOM, sobre a faixa alta da parede)
LETREIRO = PAINEL DO PROJETO (y 30–70)
corredor do pavilhão (y 74–92): silhuetas, HALL C · 1248, luzes vizinhas
ESTAÇÃO backend        QUADRO CENTRAL        ESTAÇÃO frontend
ESTAÇÃO design         ÁREA SOCIAL           ESTAÇÃO devops
DESCANSO (sofá+caixa)                        SERVIDOR (acima da barra)
feed (DOM, 3 linhas)              barra de ações (DOM, base escura)
```

- **O letreiro trabalha.** Alterna `CATATHON`, `FEATURES n/12`, estado do
  build e `FALTA nHmm`; na última hora vira `SHIP IT!` piscando. A régua
  inferior mostra as quatro trilhas (feito/total na cor da trilha), pips de
  bugs e a barra verde de entregas.
- **Estações por disciplina.** Mesas completas (tampo claro, pernas, teclado
  largo, cabo ao chão, almofada na cor da trilha), monitores diferentes:
  frontend = janelas coloridas; backend = terminal escuro + torre local;
  design = tela clara + tablet + planta; devops = dois monitores com
  gráficos. Quando há gato trabalhando o conteúdo anima e uma barra de 1px na
  beira da tela espelha o progresso da tarefa VIVA da trilha.
- **O quadro central** tem um post-it por tarefa: cor da trilha, verde com
  tick quando shipada, X quando cortada. É a cópia física do painel de
  projeto.
- **O servidor** é grande, tem cor de estado, ventilador girando, e um cabo
  que sobe até o painel com um pulso viajando enquanto o build vive.
- **Clutter progressivo.** Canecas, latas, post-its, pizza e papel amassado
  aparecem em marcos de tempo, derivados só de `state.tick`: a mesma partida
  produz o mesmo lixo, e a janela conta a história do hackathon.
- **O corredor** vende a escala do evento com paralaxe barata: silhuetas de
  competidores passando, luzes de booths vizinhos vazando, placa
  `HALL C 1248`.

## Gatos

30% maiores que a primeira versão — personagem manda mais que móvel. Cada um
carrega o **crachá** (lanyard) da própria trilha. **Orelhas e rabo respondem
ao estresse**: acima de 0.6, orelhas achatam e o rabo cai — o humor é legível
na silhueta, não só na ficha. Seleção = contorno claro de 1px + sombra
violeta sob as patas (nada orbitando o personagem).

## HUD

- Topo em chips com hierarquia: prazo primeiro (maior), build com cor de
  estado, projeto `n/12`, bugs só quando existem (e já com peso de alarme).
- Ações numa **barra contextual** com base escura translúcida no canto
  inferior direito: `projeto` e `petisco` (ação na palavra, inventário na
  badge `×n`). `som` mora no canto de configurações, topo direito — não é um
  verbo da partida.

## Lição de engenharia paga aqui

`height: 100%` num item de grid com linha `auto` é circular; o navegador cai
no aspect-ratio intrínseco do canvas e o elemento fica MAIS ALTO que a tela —
o fundo da cena era cortado no celular. O canvas agora é `position: absolute;
inset: 0`, e o mapeamento de toque (contain) bate com o que o olho vê.

## Adiado com nome (P1/P2)

Atlas assado para gatos e móveis · variações de acessório (headset, lenço,
mochila) · ciclo de iluminação do pavilhão · incidentes físicos (caneca
derrubada) · reações coletivas a falhas e conquistas · drones de câmera e
confete no corredor.
