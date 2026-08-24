# CATATHON

**O maior hackathon do mundo. Todo dev e um gato fofissimo. Tudo que pode dar
errado vai dar errado.**

Um spin-off do monorepo Voxelyn: gestao sistemica leve — entre Overcooked, Game
Dev Story e o caos social de um hackathon as 3h47 da manha. Voce nao escreve
codigo: voce carrega gatos, interpreta um desafio vago, respeita um grafo de
dependencias e sobrevive ate a demo.

## Jogar

```bash
pnpm install
pnpm --filter @voxelyn/catathon dev    # http://localhost:5183
```

**No dedo (primario):** arrasta um gato para a mesa dele · segura o dedo em
cima = carinho (e o "shipa" do Bigode) · botao `petisco` e tocar no gato ·
botao `quadro` abre o grafo, com `cortar` por tarefa · emergencia = leva
alguem ao rack.

**No teclado:** `1-4` pega/solta gato · `Q W E R` mesas · `Z` puff · `X` rack ·
`C` cafe · `P` carinho no selecionado · `T` arma petisco.

## A equipe

| gato | disciplina | personalidade | mania |
| --- | --- | --- | --- |
| **Bigode** (siames) | backend | perfeccionista: nao deixa mergear sem teu "shipa" | territorial |
| **Cheeto** (laranja) | frontend | cowboy: +25% velocidade, shipa sem testar, atalhos geniais | morde o cabo do build |
| **Almofada** (maine coon) | devops | calmo: metade do estresse | cochila no rack |
| **Smoking** (tuxedo) | design | julga em silencio: sofre com bug vivo | dorme na caixa (recupera mais rapido) |

## As regras que importam

- **O projeto e um GRAFO.** O dashboard espera a API, que espera o schema.
  Backend parado trava frontend — alocar gatos e orquestrar, nao distribuir.
- **Bug nasce de estresse.** Gato estressado na mesa senta no teclado; fora
  dela, o Cheeto pode morder o cabo. Carinho e a valvula; petisco (3) e o botao
  de panico.
- **Pontas soltas custam pontos; cortar escopo nao.** A decisao de cortar e o
  fim de jogo inteiro.
- **Bola de pelo no repositorio** trava o merge; ignorada por 50s, o build
  quebra PARA SEMPRE. Manda o gato mais descansado — o de sempre pode estar
  dormindo, e essa triagem e o jogo.
- **Tres juizes, tres lentes:** arquitetura (core e pontas soltas),
  estabilidade (bugs vivos), experiencia (polimento e a trilha de design). O
  crash da demo e sorteado com o rng da partida: vergonha reprodutivel.

## Disciplina de engenharia

A mesma dos irmaos maiores (Survival, Iliada): simulacao autoritativa sem DOM
(verificado por teste), ticks inteiros a 30Hz, RNG semeado serializavel, hash
FNV-1a, `(semente, comandos)` reproduz a partida inteira.

Os testes provam que a partida **sabe ser perdida** (parado: build quebrado,
demo crashada, em qualquer semente) e **sabe ser vencida** (um bot decente
chega ao podio) — e que cada traco de personalidade tem efeito mecanico.

```bash
pnpm --filter @voxelyn/catathon test     # 17 testes de simulacao
pnpm --filter @voxelyn/catathon build
pnpm --filter @voxelyn/catathon smoke    # fumaca de TOQUE: joga so com dedos
```

Docs: [`docs/design-contract.md`](docs/design-contract.md) ·
[`docs/reuse-matrix.md`](docs/reuse-matrix.md)

## Adiado com nome (nao esquecido)

Recrutamento/draft e camada de carreira (Rio, Toquio, Global Catathon) · salao
de patrocinadores e workshops · boxes rivais · multiplayer (a sim ja e
determinista; falta so transporte) · atlas assado para os gatos (hoje sao
sprites procedurais em codigo).
