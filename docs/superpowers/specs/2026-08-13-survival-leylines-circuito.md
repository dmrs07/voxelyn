# O Circuito — a leyline deixa de esperar energia e passa a ser um problema

**Data:** 2026-08-13
**Escopo:** design. Nenhum pacote alterado neste corte.
**Status:** implementado. O desenho abaixo é o que o código faz, e ele difere
da proposta original em três pontos — todos derrubados por medição, todos
registrados aqui com o número que os derrubou.
**Versões:** `SIMULATION` 40→41, `PROTOCOL` 24→25. `CONTENT` fica em 24 (nenhum
asset mudou).
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
> CIRCUITO do setor**. O circuito pode ser FECHADO: uma ÚNICA cascata, lançada
> na NASCENTE, tem de acender **todos** os segmentos da rede. Fechar é um
> objetivo opcional de escala do setor, e a dificuldade dele é a matéria do
> estrato. O prêmio é pequeno, é sempre do mesmo tipo, e dura até a próxima
> descida: **a propriedade que dá identidade ao estrato para de valer.**

Três consequências que decidem o resto do documento:

- **A rede deixa de depender do módulo.** A nascente dispara por interact. Quem
  nunca viu um cofre de tier 2 tem o sistema inteiro disponível.
- **O prêmio não é um número no personagem.** É uma regra do MUNDO que desliga.
  Isso preserva a proibição de "nó como altar de buff" do spec anterior sem
  precisar de exceção.
- **O prêmio corta dos dois lados** (ver §5). É o que mantém a ajuda pequena sem
  precisar de um multiplicador tímido.

---

## 3. As peças novas

Todas derivadas da geometria que o worldgen já desenha: **nenhuma tirada de RNG
nova**, no mesmo espírito de `deriveLeylineNodes` (`worldgen.ts:225-247`).

### Nascente

A junção da rede mais próxima da entrada. Interact (E) no raio que a junção já
usa (`LEYLINE_NODE_INTERACT_RADIUS = 1.45`) **lança** uma cascata: **todos** os
segmentos elegíveis que ela toca entram em `carregando`, e o ciclo que já existe
faz o resto. Elegível = dormente, fora da refratária e sem curto.

Armar todos, e não escolher um, é consequência direta de o alvo ser a rede
inteira: não existe "direção certa" a privilegiar — o segmento que aponta para a
entrada também precisa acender. Sob o desenho antigo (uma corrente indo até um
coletor) escolher importaria, e escolher errado mandaria a tentativa para trás;
com a rede como alvo, dividir é o mecanismo, não um efeito colateral.

É esta peça que mata o gate. A partir dela, a leyline tem um verbo disponível no
primeiro minuto de qualquer run, sem item, sem desbloqueio e sem sorte.

### O que era o COLETOR, e por que ele não existe

A proposta original mandava levar a corrente da nascente até um **coletor** na
banda profunda, roteando as junções do caminho sob um orçamento `K`. **A
medição matou os dois.** Em 637 setores com rede (seeds 1–200 × setores 1–7):

| | |
| --- | --- |
| Setores com circuito possível | 81,2% |
| Sem nenhuma junção articulada → sem circuito | 18,8% |
| Circuitos que exigiam rotear **1 junção** | **71,6%** |
| 2 junções | 27,7% |
| 3 junções | 0,8% |

Mediana de **uma** junção, nos sete estratos. E há um segundo motivo, este
estrutural: o relé arma **todos** os vizinhos dormentes, então a cascata inunda
o subgrafo roteado — mesmo com três junções não existia escolha de rota, só
"rotear tudo". Um orçamento `K` menor que o caminho tornaria o circuito
impossível; maior, irrelevante. Não havia número certo.

Exigir a **rede inteira** resolve os dois de uma vez: o mesmo grafo raso vira um
objetivo de escala do setor (percorrer a linha da entrada ao fundo abrindo cada
junção), sem inventar topologia que o gerador não entrega.

### Curto

Um segmento com **≥ 6 células distintas de cristal ou minério encostadas**
(vizinhança de oito) sangra a carga e **recusa a ativação** — por lançamento,
por relé ou por tiro `energy`. A cascata para ali, e o evento `leyline_short`
diz qual segmento, para o obstáculo não ser confundido com a mecânica quebrada.

O número é medido, não estético. Com limiar 1 ("qualquer vizinho condutor"):

| Limiar | Segmentos em curto | Redes 100% limpas |
| --- | --- | --- |
| 1 célula | 73% a 89% | **0%** |
| 6 células | 9% a 39% | 61% a 74% |

Com 1, a regra deixava de ser obstáculo e virava imposto. Com 6, a distribuição
por estrato diz a coisa certa:

| Estrato | Segmentos em curto | Redes com ≥1 curto |
| --- | --- | --- |
| Catedral Prismática | 39% | 96% |
| Cripta Glacial | 27% | 62% |
| Aquífero Negro | 20% | 57% |
| Fenda Sulfurosa | 17% | 43% |
| Fornalha Abissal | 14% | 43% |
| Basalto | 9% | 27% |
| Sumidouros de Sílica | 9% | 26% |

A Catedral — o estrato **do** cristal — é quase sempre o problema, e o basalto
do setor 1 quase sempre ensina a rede sem obstáculo. O conserto é o verbo
central do jogo: quebrar o cristal, esgotar o veio até `SOLID_ORE_SPENT`. A
regra lê o grid a cada pergunta, então o segmento volta a conduzir no tick
seguinte, sem nenhum estado novo para sincronizar.

**Líquido não entra, e a ausência é deliberada.** A proposta original mandava a
água curto-circuitar a linha — mas a água do Aquífero é *estática* e o jogo não
tem verbo que a remova. Curto por poça tornaria aquele circuito **impossível**
em vez de difícil. O que a água faz continua sendo o que sempre fez: conduzir a
descarga contra quem estiver nela.

## 4. Por que é difícil

### 4.1 O obstáculo é o estrato

O curto da §3 é a regra nova, e ela morde onde o estrato tem cristal ou veio. O
resto da pressão **já existia no jogo e não precisou de código**: o gás da Fenda
machuca quem para na junção, a brasa da Fornalha segura o calor da arma, o chão
da Sílica cede, o Devorador e os Miners moram lá. Percorrer a rede inteira é
justamente o que expõe o jogador a tudo isso.

| Estrato | O que atrapalha fechar | É regra nova? |
| --- | --- | --- |
| Catedral Prismática | cristal encostado na linha (96% das redes) | sim — o curto |
| Cripta Glacial | veio e cristal, e o degelo mudando o chão sob você | sim — o curto |
| Fenda Sulfurosa | pulmão de gás na junção; faísca em gás explode | não, já existia |
| Fornalha Abissal | brasa segurando o calor (`EMBER_HEAT_DECAY_SCALE`) | não, já existia |
| Sumidouros de Sílica | chão frágil no caminho até a junção | não, já existia |
| Basalto | nada | — o setor 1 é o tutorial |

A simetria que faz o desenho valer a pena: **o estrato atrapalha com a mesma
propriedade que você quer desligar.** O cristal da Catedral é o curto e é o
prêmio; a brasa da Fornalha é o obstáculo e é o prêmio. O puzzle e a recompensa
são a mesma frase lida em duas direções.

### 4.2 A rede inteira, e não um caminho

Não há orçamento de roteamento — a medição da §3 mostrou que ele não morde. O
que cobra é a **extensão**: a cascata só atravessa junção `routed`, então fechar
exige abrir **cada** junção da rede, e a rede vai da entrada à banda profunda
por construção do traçado. O trabalho é percorrer o setor, não deduzir uma rota.

A honestidade que isso pede: a dificuldade do circuito é **logística e
territorial**, não combinatória. O gerador não entrega um grafo com escolhas, e
fingir que entrega seria pior do que dizer o que ele é.

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
| `sulfur` | os respiradouros travam desligados | gás + faísca era uma bomba que você podia armar |
| `furnace` | a brasa devolve a dissipação de calor | nada: a brasa é pressão só sobre o jogador |
| `silica` | a sílica solta (`SURF_SILT`) vira vidro: o Devorador Branco perde o chão por onde sobe | você gasta de uma vez o contra-jogo territorial dele |

**O princípio, e é ele que responde ao pedido de "ajuda pequena":** você não
ganha um poder, você **desliga uma regra** — e a regra servia aos dois lados.
Uma linha da tabela é assimétrica de propósito (`furnace`), porque a brasa é
pressão que só existe contra o jogador; ali o preço está no custo de fechar,
não no prêmio.

O prazo sai de graça: `descend` e `ascend` já zeram relógios e `routed`
(`sectors.ts:403` e `:521`), porque "os relógios do setor velho descreviam
paredes que já não existem".

---

## 6. O módulo deixa de ser gate e vira alternativa cara

Um tiro `energy` num segmento continua armando **aquele** segmento, exatamente
como antes — e, se houver cascata do circuito viajando, o segmento aceso conta
como alcançado. Isso dá ao `conductive` um papel que ele não tinha: **acender à
mão um trecho que o roteamento não alcança** (uma junção órfã, um ramo que a
gravação deixou solto), pagando uma carga por segmento.

O que ele **não** faz é pular o circuito. Fechar exige a rede toda na mesma
cascata, e a nascente é a única ponta que a alcança inteira pelo relé; substituir
o percurso por tiros custaria uma carga por segmento e o mesmo deslocamento.

A diferença que importa é de papel: antes o módulo era a chave de uma porta que
quase ninguém abria — sem ele a leyline não tinha verbo nenhum. Agora ele é uma
otimização de um problema que todo mundo tem. A carga continua sendo cobrada no
armamento (`run.ts:2014-2020`).

---

## 7. Invariantes

1. **Opcional de verdade.** A nascente só dispara por interact. Quem ignora a
   rede joga exatamente o jogo de hoje e não leva um ponto de dano por ela.
2. **Nenhum número do personagem muda.** A subversão mexe no mundo, nunca no
   Prospector. É a diferença entre buff e terreno.
3. **A economia fica intocada.** Nenhuma subversão rende minério, e nenhuma
   toca a cota: o prêmio muda o terreno, nunca o que ele paga.
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
- **O setor 1 é sempre basalto**, então o tutorial é um circuito sem obstáculo
  e sem prêmio. É deliberado (§9), mas se lê como anticlímax é playtest.
- **O Ferrífero não tem circuito, e nunca vai ter por este caminho.**
  `biomeProfile` não traça leyline em setor ferrífero e `leylineGuaranteeSector`
  o exclui da garantia — medido: 3294 setores ferríferos numa varredura de 4000
  seeds, **zero** com leyline, e nenhum deles no setor 1, onde a regra da boca do
  Veio poderia resgatá-los. A primeira versão desta spec listava um obstáculo e
  um prêmio ferríferos, e o código chegou a trazer o prêmio: **código morto**,
  removido. O invariante "Ferrífero nunca" é load-bearing (lá a parede conectada
  já É a fiação, e o review do #144 já o defendeu uma vez); quebrá-lo para dar
  circuito ao estrato custaria mais do que o circuito vale.
- **A dificuldade não é combinatória.** Quem esperava um quebra-cabeça de rota
  vai achar um percurso longo e exposto. O gerador não entrega o grafo que o
  outro desenho pediria — ver §4.2.

---

## 9. O que a medição respondeu, e o que sobra para o playtest

**Respondido antes do código** (as três perguntas que a proposta deixou abertas):

1. **K não existe.** Mediana de uma junção entre as pontas, e o relé inunda o
   subgrafo — nenhum valor de K seria simultaneamente possível e restritivo.
2. **O curto MATA a cascata**, não atenua. Binário é legível, e "quase fechado"
   pediria uma segunda regra de recompensa parcial que o prêmio pequeno não
   comporta.
3. **O setor 1 fica trivial de propósito.** Basalto tem 9% de segmentos em curto
   e nenhuma propriedade para subverter: o primeiro circuito da run ensina a
   linguagem sem pagar prêmio, que é o papel dele.

**Sobra para o playtest:**

- **O circuito compensa o tempo que custa?** O preço é atravessar o setor duas
  vezes com a contaminação subindo. Se não compensar, o botão de ajuste é o
  prêmio, não a dificuldade.
- **18,8% dos setores não têm circuito.** A apresentação ainda não diz isso — a
  nascente simplesmente não existe lá, e o jogador pode procurar um puzzle que
  não há. É o candidato mais forte a próximo corte.
- **O Ferrífero fica de fora do sistema inteiro, e isso incomoda.** É o estrato
  com a maior densidade de Miners e a identidade mais elétrica de todas — a
  parede que conduz —, e é justamente o único que nunca vê um circuito. A saída
  não é dar leyline a ele (ver §8); seria dar ao veio ferrífero um verbo
  próprio, de outro sistema. Fica registrado como dívida de design.
- **A nascente é encontrável?** Ela fica perto da entrada por construção, mas
  "perto da entrada" num mapa de 96×96 ainda é um lugar que se procura.

## 10. Trabalho futuro (herdado e revisto)

Do spec de 2026-08-11, seguem valendo: sobrecarga (descarga total do nó) e
decor/landmark dedicado — este último passa a ter um destino óbvio, que é dar
cara à **nascente**.

Sai da lista: "pulso ambiental rítmico", agora recusado por razão de desenho e
não adiado (§8).
