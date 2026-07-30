# Ressonância do Poço — habilidades que nascem do que a run foi

## Problema

O Prospector tinha UMA habilidade, fixa, para sempre: o pulso cinético. Ele não
mata; empurra e dissipa nuvem. Como única resposta ativa do arsenal, ele fazia o
botão de habilidade ser a mesma decisão em todas as runs — e uma decisão que não
muda não é decisão.

Adicionar habilidades novas é fácil. O difícil é **como o jogador as obtém**, e as
saídas óbvias todas cobram caro:

- **junto dos módulos, no terminal** — habilidade é sempre mais forte que módulo,
  então ela vence toda escolha em que aparecer e o módulo vira consolação;
- **drop de chefe** — o Bispo só existe no setor 2 e o Guardião no 3, então o
  setor 1 inteiro é jogado sem poder trocar, e a run acaba logo depois do último;
- **loadout no menu** — exige meta-progressão persistente, que o jogo não tem, e
  tira a decisão de dentro da descida.

## A decisão

Durante o setor, o Veio **registra as reações que o jogador provocou**. Ao chegar
ao poço, dois Ecos demonstram habilidades derivadas dessas ações. Pegar um
substitui a habilidade atual; descer direto mantém a que já se tem.

Três propriedades saem de graça:

1. **Não compete com módulo.** A decisão acontece no poço, não no terminal.
2. **Não exige meta-progressão.** Nada persiste entre runs; a oferta nasce do que
   aconteceu nesta descida.
3. **O estilo de jogo daquela run vira a progressão dela.** O jogo não pergunta
   que build você quer — ele observa a que você já estava jogando e oferece o
   próximo degrau dela.

## Invariantes

1. A oferta é congelada na primeira chegada ao poço.
2. Sem ressonância não há oferta. O poço não é corredor obrigatório.
3. A habilidade equipada é estado autoritativo: entra no hash e no replay.
4. Nenhuma habilidade cobra recurso além do cooldown.
5. Nenhuma habilidade supera o tiro comum em DPS sustentado.
6. Toda ressonância é ganhável com o kit básico.

## Ressonância

Quatro reações, e não uma por evento do jogo: a oferta precisa distinguir
**estilos**, e um registro fino demais devolveria sempre a habilidade do último
acidente em vez da do hábito.

| Reação | Registrada quando o jogador… | Ensina |
| --- | --- | --- |
| `fire` | faz o chão mudar para chama ou fungo aquecido | Sopro Térmico |
| `current` | provoca uma descarga — com módulo condutivo ou quebrando cristal | Arco Condutivo |
| `blast` | detona uma explosão, inclusive abatendo um Portador de perto | Lança Rastreadora |
| `kinetic` | empurra ou dissipa com o pulso | — (o pulso é o início) |

**Só conta o que o jogador causou.** Um incêndio que o Portador começou sozinho não
ensina nada sobre ele, e deixá-lo contar faria a oferta descrever o comportamento
dos inimigos.

Há um teto por tipo. Sem ele, uma poça grande eletrificada uma vez somaria
cinquenta células e afogaria o resto do registro — a oferta precisa saber com que
**frequência** o jogador recorre a cada reação, não o tamanho do maior acidente.

### Autoria é registrada no instante em que ela ainda existe

O crédito de fogo olha o **chão mudar de estado**, e não um evento de ignição. O
fungo aquecido só vira chama vários ticks depois, dentro de `stepCells`, longe de
qualquer coisa que saiba quem atirou. O impacto é o único momento em que a autoria
ainda está na mão.

O crédito de corrente é dado à **descarga**, e não ao atordoamento de quem por
acaso estava na poça: eletrificar biofluido vazio continua sendo o jogador
escolhendo corrente, e quem quebra cristal para abrir caminho também está usando
corrente.

O cristal descarrega com `source: 'environment'`, e isso **não muda**. Aquela
origem existe para o escalonamento de dano — cristal quebrado fere o próprio
Prospector sem o desconto de fogo amigo, que é a lição do material. Reaproveitá-la
como autoria diria que ninguém provocou nada, então o crédito é dado no ponto onde
o tiro do jogador causou a descarga.

## Co-op

As ofertas viajam nas `WorldFlags`, junto de cofres abertos e núcleo retirado. O
cliente online **não simula**: elas nascem do tally de ressonância do servidor, que
ele nem espelha, então não há nada no espelho dele de onde deduzi-las. Sem viajar,
o co-op emitia `well_offers` e o jogador não via Eco nenhum — nem onde escolher,
nem o quê. O `full_resync` também as carrega, para quem cai perto do poço voltar
enxergando a escolha que ainda está lá.

O cliente **substitui a lista inteira** em vez de casar por índice: as ofertas não
têm identidade estável entre setores — nascem no poço e somem na descida —, e um
merge posicional deixaria um Eco do setor anterior no mapa novo.

A oferta lê a ressonância de quem está **mais perto** do poço. No co-op os dois
jogaram o mesmo setor de formas diferentes, e escolher a de um deles é mais honesto
do que somar as duas: uma média de estilos não descreve estilo nenhum. Empate exato
mantém o slot menor, que é determinístico.

## O poço

Os Ecos acordam quando alguém chega a `WELL_OFFER_REVEAL` do poço, e a oferta é
**congelada** ali. Recalcular a cada tick faria os dois Ecos trocarem de habilidade
enquanto o jogador anda entre eles — e a ressonância muda enquanto ele anda,
porque andar até o poço também provoca reações.

Revelar acontece mais longe do que pegar. O jogador tem de **ver os dois** e poder
comparar antes de chegar em qualquer um; se a revelação acontecesse ao alcance de
pegar, ele descobriria a segunda opção depois de já ter tomado a primeira.

Pegar tem prioridade sobre descer na cadeia de `interact`: os dois acontecem ao
lado do poço, e quem apertou usar em cima de um Eco quis o Eco. As outras ofertas
somem junto — a escolha é uma, e um Eco que continua ali convida a voltar e trocar
de novo.

O cooldown **zera** na troca. Herdá-lo puniria justamente quem usou a habilidade
que tinha para chegar vivo até ali.

Nada disso acontece no setor final: lá o ponto é o núcleo do Guardião, e parar
para escolher habilidade no meio da arena seria o pior lugar possível para um menu.

A descida zera a ressonância e apaga os Ecos. Sem isso, o poço do setor 2
ofereceria o estilo com que o jogador atravessou o setor 1.

## As habilidades

Todas com cooldown **maior** que o do pulso. O pulso é o início e também o mais
fraco: ele empurra e limpa gás, mas não mata. As outras matam, e a janela entre
usos é o que impede cada uma de virar a arma primária.

**Sopro Térmico** — cone curto e largo que acende o chão que atravessa. Dano e
superfície saem da mesma varredura: a chama que fica é o que continua matando
depois, e sem ela seria um tiro largo com nome bonito. Vale em corredor, e vira
armadilha no próprio recuo.

O cone **não acende matéria por conta própria**: ele pede a `igniteCell`, como toda
outra fonte de chama do jogo. Fungo úmido passa pelo estado fumegante que avisa,
gás recebe o flash curto do próprio material, e o evento de ignição acontece.
Escrever `SURF_FIRE` direto pulava tudo isso — uma habilidade nova que ensina outra
física para o mesmo material é pior do que uma habilidade que falta. Só chão nu
recebe a chama diretamente, porque ali não há o que "pegar" fogo.

**Lança Rastreadora** — um míssil, dano alto, curva lenta. Um só, e não uma salva,
porque a habilidade tem de ser uma decisão e não um segundo gatilho. A correção é
limitada por tick, e é isso que a impede de ser infalível: contra um alvo que muda
de direção ela erra a curva e passa reto.

**Arco Condutivo** — salta entre inimigos próximos e **não precisa de poça**. Essa
é a diferença que justifica ele existir ao lado do módulo condutivo. Pedra não
conduz, pela mesma regra do módulo: duplicar a exceção criaria uma segunda verdade
sobre o Britador.

## Fora do escopo

O HUD ainda não mostra permanentemente qual habilidade está equipada — a
assimilação é anunciada na mensagem e o rótulo aparece sobre cada Eco, mas um
indicador fixo perto do botão de habilidade continua faltando.
