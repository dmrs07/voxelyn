# Catathon — contrato de design (vertical slice)

## A fantasia

O maior hackathon do mundo, num centro de convencoes voxel. Todo dev e um gato
fofissimo. Voce nao escreve codigo: voce monta a equipe, transforma um desafio
vago num grafo de dependencias, mantem quatro gatos produtivos por 48 horas
ficticias e sobrevive a demo ao vivo.

**Recurso central: coerencia, nao vida.** Muitas features nao salvam uma
submissao incoerente. Pontas soltas custam pontos; cortar escopo e uma decisao
de primeira classe.

## O laco (slice de ~8 minutos reais = 48h ficticias)

1. O desafio chega ("plataforma de acessibilidade com IA, mas sustentavel").
2. Quatro gatos, quatro disciplinas: backend, frontend, design, devops.
3. Doze tarefas num GRAFO — o dashboard precisa da API, que precisa do schema.
4. Mao-de-deus: pegar, soltar, fazer carinho, dar petisco, CORTAR escopo.
5. Incidentes sistemicos nascem dos gatos, nunca de popup: sentar no teclado
   cria bug; morder o cabo derruba o build; bola de pelo trava o repositorio.
6. Demo com tres juizes de criterios diferentes; crash e sorteado com o rng da
   partida — vergonha reprodutivel.

## O estado (autoritativo, sem DOM, semeado, com hash)

`(semente, comandos)` reproduz a partida inteira. Mesma disciplina do Survival
e da Iliada. Tudo que o cliente mostra vem de eventos da simulacao.

## Nao-objetivos do slice (adiados de proposito)

- Recrutamento/draft e camada de carreira (Rio, Toquio, Global Catathon).
- Salao de patrocinadores, workshops, boxes rivais, sabotagem social.
- Multiplayer (a sim ja e determinista; o transporte fica para depois).
- "Motor de hackathon" generico. O slice e UM hackathon jogavel de ponta a
  ponta — jogavel cedo vale mais que arquitetura especulativa.

## Regra arquitetural

Reusar capacidades de ENGINE do Voxelyn; nao herdar identidade do Survival.
Nada de mineracao re-skinada, inimigo renomeado de bug, arma virando teclado.
