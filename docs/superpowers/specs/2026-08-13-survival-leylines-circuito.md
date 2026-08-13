# O Circuito — a leyline deixa de esperar energia e passa a ser um problema

**Data:** 2026-08-13
**Escopo:** design. Nenhum pacote alterado neste corte.
**Status:** proposta, para aprovação antes de qualquer código.
**Versões:** nenhuma. Enquanto for documento, `SIMULATION`, `PROTOCOL` e
`CONTENT` ficam onde estão.
**Sucede:** `2026-08-11-survival-leylines.md` na pergunta "qual é o papel delas".
O traçado, o wire, a apresentação e o relé continuam valendo; o que este
documento revoga é a resposta de que orientação bastava.

---

## 1. O problema, medido

O playtest do dono: *"as leylines são chatas e não cumprem nenhum papel
fundamental. Simplesmente passam despercebidas, se você não tiver nenhum tipo de
source de energy."*

Cinco fatos do código sustentam a queixa, e nenhum deles é de gosto:

1. **Um verbo só, atrás de um item opcional.** Só `cls === 'energy'` interage com
   a linha (`materials.ts:285`), e `energy` só existe se o módulo `conductive`
   estiver ativo e com carga (`materials.ts:82`) — uma das duas opções de um
   cofre de tier 2. Sem ele, `stepLeylines` sai no primeiro `if` (`run.ts:529`)
   e a run inteira é indistinguível de uma sem leylines.
2. **A corrente que o jogo já produz não alcança a linha.** Quebrar cristal
   (`cells.ts:630`), eletrificar poça, o Dilúvio do Leviatã, o Arco Condutivo —
   a habilidade que a ressonância `current` ensina — nenhuma delas arma um
   segmento. A leyline é o único condutor do jogo que não conduz a eletricidade
   do jogo.
3. **O papel declarado "principal" é redundante.** Orientação já é a
   ramificação de Levantamento inteira (`survey-overlay.ts`: beacon de
   objetivo, traço de salvage, scanner de minério, memória de rota, vetor de
   retorno). E o traçado segue o campo BFS entrada → salão → região profunda,
   que é a direção que o jogador já anda por construção do mapa.
4. **Zero acoplamento.** `pathing.ts`, `entities.ts`, `bosses.ts` e
   `abilities.ts` não têm uma única referência a leyline. Um sistema que nenhum
   outro lê não pode ser fundamental — é uma propriedade da estrutura, não uma
   opinião sobre o design.
5. **Mesmo com o módulo, raramente é a jogada certa.** 26 de dano plano, 0,8 s
   de telégrafo, 10 s de refratária, e só acerta quem estiver encostado na
   parede — contra quatro tiros por segundo do disparo comum. A ressonância
   `current` que a ativação paga já sai de graça de quebrar um cristal.

A conclusão que este documento aceita: **o papel principal estava errado, não
subdimensionado.** Mais leylines, mais garantidas e mais luminosas — o que os
três cortes anteriores fizeram — não conserta um sistema cujo único verbo é
opcional.

---

## 2. A decisão que rege tudo

> A leyline deixa de ser um condutor que espera um item e passa a ser **o
> CIRCUITO do setor**. O circuito pode ser FECHADO: levar uma cascata da
> NASCENTE até o COLETOR, atravessando junções que o jogador roteia. Fechar é um
> puzzle opcional de leitura e preparação, na escala do setor inteiro, e a
> dificuldade dele é a matéria do estrato. O prêmio é pequeno, é sempre do mesmo
> tipo, e dura até a próxima descida: **a propriedade que dá identidade ao
> estrato para de valer.**

Três consequências que decidem o resto do documento:

- **A rede deixa de depender do módulo.** A nascente dispara por interact. Quem
  nunca viu um cofre de tier 2 tem o sistema inteiro disponível.
- **O prêmio não é um número no personagem.** É uma regra do MUNDO que desliga.
  Isso preserva a proibição de "nó como altar de buff" do spec anterior sem
  precisar de exceção.
- **O prêmio corta dos dois lados** (ver §5). É o que mantém a ajuda pequena sem
  precisar de um multiplicador tímido.

---

## 3. As três peças novas

Todas derivadas da geometria que o worldgen já desenha: **nenhuma tirada de RNG
nova**, no mesmo espírito de `deriveLeylineNodes` (`worldgen.ts:225-247`).

### Nascente

A junção da rede mais próxima da entrada. Interact (E) no raio que a junção já
usa (`LEYLINE_NODE_INTERACT_RADIUS = 1.45`) **lança** uma cascata: o segmento
adjacente entra em `carregando` e o ciclo que já existe faz o resto.

É esta peça que mata o gate. A partir dela, a leyline tem um verbo disponível no
primeiro minuto de qualquer run, sem item, sem desbloqueio e sem sorte.

### Coletor

A junção mais próxima da âncora profunda — a célula em `distFromEntry >=
0.82 · maxPath` que o traçado já escolhe (`worldgen.ts:1502-1527`). Receber uma
cascata que nasceu na nascente **fecha o circuito**.

O worldgen entrega a rede com três pontas: a perna do salão, a perna funda e o
ramo que morre a seis células de um terminal (`worldgen.ts:1532-1541`). Nascente
e coletor são duas delas; a terceira é um beco. **O beco não é um acidente do
gerador — é a primeira peça do puzzle**, e o orçamento de §4 existe para que
deixá-lo fechado seja uma decisão.

### Curto

Um segmento cujo entorno impede a cascata de atravessar. O curto é onde mora a
dificuldade, e ele tem **duas famílias**, porque o jogo não tem matéria
condutiva em todo estrato:

- **Vazamento** — a matéria do estrato rouba a carga e a cascata morre ali.
  Existe onde existe condutor: água e biofluido (`isConductiveSurface`,
  `cells.ts:70`), cristal, veio de minério.
- **Acesso** — a carga passaria, mas o jogador não consegue chegar à junção para
  roteá-la. Existe onde o estrato ataca a permanência: gás, brasa, chão que cede.

Distinguir as duas importa: a primeira se conserta mudando o MUNDO, a segunda se
conserta mudando o MOMENTO. Um estrato que só tivesse vazamento viraria um jogo
de limpar terreno; um que só tivesse acesso viraria um jogo de esperar.

---

## 4. Por que é difícil

### 4.1 O obstáculo é o estrato

| Estrato | O curto | Família | O conserto, com verbos que já existem |
| --- | --- | --- | --- |
| `aquifer` | água/biofluido encostados na linha | vazamento | drenar quebrando rocha, ou congelar a lâmina |
| `glacial` | gelo derretido conduz enquanto não recongela (`ICE_REFREEZE_TICKS = 280`, ~14 s) | vazamento | a janela é o inimigo: fechar antes de derreter, ou dentro dos 14 s |
| `prismatic` | cristal adjacente ressoa e rouba a carga | vazamento | quebrar antes — e quebrar cristal já paga `current` (`cells.ts:635`) |
| `ferric` | a parede inteira é fiação (`FERRIC_VEIN_SCALE = 3`) e sangra a carga | vazamento | esgotar o veio minerando até `SOLID_ORE_SPENT` — o estrato mais caro |
| `sulfur` | pulmão de gás na junção; faísca em gás explode (`materials.ts:348`) | acesso | esperar o ciclo do respiradouro (`VENT_CYCLE_TICKS = 200`) ou ventilar |
| `furnace` | brasa segurando o calor da arma (`EMBER_HEAT_DECAY_SCALE = 0.35`) | acesso | apagar com água ou gelo antes de parar ali |
| `silica` | chão frágil: o caminho até a junção cede | acesso | vitrificar a sílica solta (`SURF_SILT` → `SURF_GLASS`, `cells.ts:287-296`) |
| `basalt` | nenhum | — | o setor 1 fecha de primeira: é o tutorial da linguagem |

A simetria que faz o desenho valer a pena: **o estrato te impede de subvertê-lo
com exatamente a propriedade que você quer desligar.** A água do Aquífero é o
curto e é o prêmio. A brasa da Fornalha é o obstáculo e é o prêmio. O puzzle e a
recompensa são a mesma frase lida em duas direções.

### 4.2 O orçamento de junções roteadas

A cascata só atravessa junção `routed` (`run.ts:556-572`), e rotear passa a ter
teto: **no máximo K junções roteadas ao mesmo tempo** no setor. Rotear a
(K+1)-ésima desfaz a mais antiga — FIFO determinístico, no hash, sem sorteio.

É isto que transforma "aperte todos os botões" em decisão: com a rede tendo três
pontas e o orçamento menor que o número de junções, o beco tem de ficar fechado,
e descobrir qual ponta é beco exige ler a rede — não tentar.

**K não é fixado aqui.** Ver §9: a rede típica precisa ser medida antes.

### 4.3 O custo é tempo e contaminação, nunca dano

Atravessar a rede é atravessar o setor da entrada até a banda profunda, duas
vezes se o conserto obrigar a voltar. A contaminação sobe sempre e escala com o
setor (`run.ts:2354-2385`), e a terceira estrela tem orçamento de tempo
(`TARGET_SECTOR_TICKS`). O jogador paga o circuito com os recursos que o jogo já
cobra dele, e é isso que mantém a ajuda "pequena" sem precisar diminuí-la.

Errar também custa: 10 s de refratária por segmento queimado
(`LEYLINE_REFRACTORY_TICKS`).

---

## 5. A recompensa — a subversão do estrato

Fechar o circuito **desliga a propriedade-identidade do estrato até a descida**.

| Estrato | O que para de valer | O que isso custa a você também |
| --- | --- | --- |
| `aquifer` | a lâmina deixa de conduzir | você perde eletrificar poça, que é uma das melhores jogadas do jogo |
| `glacial` | a lâmina para de derreter; o deslize cessa | derreter gelo era rota e condução |
| `prismatic` | os cristais ficam opacos (`SOLID_CRYSTAL_DULL`) — o Arquicantor perde munição | quebrar cristal era sua fonte grátis de `current` |
| `ferric` | os Miners perdem o gatilho de sobrecarga (`MINER_RAGE_HEAT = 66.6`) | nada: aqui o prêmio é assimétrico, e é o estrato mais caro de fechar |
| `sulfur` | os respiradouros travam desligados | gás + faísca era uma bomba que você podia armar |
| `furnace` | a brasa devolve a dissipação de calor | nada: a brasa é pressão só sobre o jogador |
| `silica` | a sílica solta vira vidro: o Devorador Branco perde o chão por onde sobe | você gasta de uma vez o contra-jogo territorial dele |

**O princípio, e é ele que responde ao pedido de "ajuda pequena":** você não
ganha um poder, você **desliga uma regra** — e a regra servia aos dois lados.
Duas linhas da tabela são assimétricas de propósito (`furnace` e `ferric`),
porque brasa e sobrecarga de Miner são pressões que só existem contra o
jogador; nos dois casos o preço está no custo de fechar, não no prêmio.

O prazo sai de graça: `descend` e `ascend` já zeram relógios e `routed`
(`sectors.ts:403` e `:521`), porque "os relógios do setor velho descreviam
paredes que já não existem".

---

## 6. O módulo deixa de ser gate e vira atalho

Um tiro `energy` num segmento continua armando **aquele** segmento, exatamente
como hoje. Quem tem o `conductive` injeta a cascata no meio da rede e pula a
metade de cima do circuito.

Isso é melhor para o módulo do que o desenho atual: hoje ele é a chave de uma
porta que quase ninguém abre; ali ele é uma otimização de um problema que todo
mundo tem. E a carga continua sendo cobrada no armamento (`run.ts:2014-2020`).

---

## 7. Invariantes

1. **Opcional de verdade.** A nascente só dispara por interact. Quem ignora a
   rede joga exatamente o jogo de hoje e não leva um ponto de dano por ela.
2. **Nenhum número do personagem muda.** A subversão mexe no mundo, nunca no
   Prospector. É a diferença entre buff e terreno.
3. **A economia fica intocada.** Nenhuma subversão rende minério — por isso o
   Ferrífero ganha "os Miners perdem o gatilho" e não rendimento de veio.
4. **Legível sem HUD.** Toda subversão muda a aparência do mundo: a lâmina para
   de faiscar, o cristal apaga, o respiradouro fecha. Nada disso precisa de
   ícone.
5. **Determinístico e autoritativo.** Nascente, coletor e curtos derivam da seed
   e do grid. O estado novo (circuito fechado, orçamento de roteamento) entra no
   hash e no wire, como `routed` já entra.
6. **A geração nunca depende do circuito.** O worldgen já pula uma linha quando
   o mapa é pequeno demais (`worldgen.ts:1526`), com a nota de que leyline "não
   é requisito de solucionabilidade". Isso continua valendo — ver §8.

---

## 8. O que fica de fora, e por quê

- **Cura.** Já é a Célula de Purga. Um segundo curador dilui o consumível que
  hoje é uma decisão real.
- **Melhorar habilidade.** Colide de frente com a Ressonância do Poço
  (`abilities.ts:10-34`), que é o lugar onde habilidade se decide, e faria a
  oferta do poço competir com uma parede.
- **Prêmio que atravessa a descida.** Faria o jogador ir atrás do circuito em
  todo setor. Vira imposto, não escolha — e o sistema todo já zera na troca de
  setor por construção.
- **Pulso ambiental automático.** Continua fora, e agora com uma razão nova
  além da do spec anterior: sem ele, ignorar a rede é gratuito, e é isso que
  autoriza o puzzle a ser difícil.
- **Descarga da linha inteira.** Inalterado: o teto por segmento continua
  estrutural (`LEYLINE_SEGMENT_MAX_CELLS = 56`).

E o que este desenho **não resolve**, dito na cara:

- **Uma seed pode não ter circuito.** Se o worldgen pulou a linha, ou se a rede
  saiu com junções órfãs demais, não há o que fechar. Aceito: é bônus, nunca
  requisito. Mas a apresentação tem de deixar claro quando não há circuito, ou o
  jogador vai procurar um puzzle que não existe — que é a versão nova do bug de
  descobribilidade que já nos pegou uma vez.
- **O setor 1 é sempre basalto**, então o tutorial é um circuito sem obstáculo.
  Se isso lê como anticlímax é uma pergunta de playtest, não de spec (§9).

---

## 9. Perguntas que só o playtest responde

1. **Quanto vale K?** Antes de fixar, medir quantas junções e quantos segmentos
   uma seed típica entrega por linha. O teste existente
   (`leylines-worldgen.test.ts:102`) só garante que existe *alguma* junção
   articulando dois segmentos — não quantas. Se a rede típica tiver três
   junções, K=2 é um puzzle; se tiver dez, K=2 é uma parede.
2. **O curto mata a cascata ou só a atenua?** Matar é legível e binário; atenuar
   permite circuitos "quase" fechados e uma recompensa parcial, ao custo de uma
   regra a mais para o jogador ler.
3. **O setor 1 deve mesmo ser trivial?** Um curto de mentirinha ensinaria o
   verbo do conserto junto com o da rede.
4. **No Ferrífero, "os Miners perdem o gatilho" é pequeno o bastante?** É o
   estrato com a maior densidade deles, então o prêmio pode ser grande demais
   justamente onde o puzzle é mais caro — o que pode ser certo ou pode ser um
   pico de dificuldade recompensado duas vezes.
5. **A nascente precisa ser encontrável?** Ela fica perto da entrada por
   construção, mas "perto da entrada" num mapa de 96×96 ainda é um lugar que se
   procura.

---

## 10. Trabalho futuro (herdado e revisto)

Do spec de 2026-08-11, seguem valendo: sobrecarga (descarga total do nó) e
decor/landmark dedicado — este último passa a ter um destino óbvio, que é dar
cara à **nascente**.

Sai da lista: "pulso ambiental rítmico", agora recusado por razão de desenho e
não adiado (§8).
