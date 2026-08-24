# Catathon — o som

Implementacao da direcao de audio ("uma orquestra de escritorio aconchegante:
sintetizadores macios, percussao de mesa, teclados mecanicos, ronronares e a
ambiencia do pavilhao"). Fatia vertical: tudo sintetizado em WebAudio, nenhum
arquivo de som.

## O que esta valendo

**Tom unico.** Re maior, em TUDO — musica, UI, eventos, ate o erro. Um bug sao
tres notas de madeira descendo; um bloqueio poe o acorde SUSPENSO na cama
harmonica em vez de uma buzina. Testado: nenhuma nota do sistema sai da
escala (`theory.test.ts`).

**O motivo.** D–F#–A–G–D: sobe curioso, hesita, resolve em casa. Fragmentado
na camada de flow; por cima do acorde da submissao na vitoria; SEM RESOLVER,
num piano de feltro pequeno, na derrota — os gatos perderam um hackathon, o
mundo nao acabou.

**Camadas adaptativas** (`theory.stickyLayers`, pura e testada):

| camada | liga quando |
| --- | --- |
| bed | sempre — piano eletrico + pad-ronronar (serrote grave com tremolo de 24Hz, o ronronar ressintetizado em harmonia) |
| work | ≥1 gato trabalhando — bumbo abafado, rim, baixo redondo |
| flow | ≥3 trabalhando — shaker, teclado-como-percussao, fragmentos do motivo |
| tension | bloqueio (bola de pelo, cabo, bug vivo, build quebrado) — harmonia suspensa, rim mancando; o baixo segue confiante por baixo |
| deadline | ultimo quinto do relogio — pulso denso; urgencia por ritmo, nunca por volume |
| exhaustion | energia media < 0.35 — passa-baixa no MUNDO INTEIRO: 4h da manha como filtro |

Entrada imediata, saida pegajosa de um compasso, medida em TICK DE SIMULACAO.
A primeira versao esperava fronteira de compasso no agendador de audio, e numa
aba oculta (o headless dos testes, um telefone de tela apagada) `setInterval`,
`AudioContext.currentTime` e `performance.now` congelam juntos em rajadas —
tres failsafes medidos nesses relogios falharam um atras do outro. O unico
relogio que anda com o jogo e o da simulacao; as notas ja saem quantizadas por
passo de qualquer forma.

**Vozes por personalidade** (`vocals.ts`): cooldown de 4s por gato, vaga
global (dois gatos nunca vocalizam juntos — excecao unica: a celebracao da
equipe, escalonada), 1 em 3 interacoes fica em silencio. O Almofada faz "mrrp"
grave e atrasado; o Cheeto e imediato, agudo, e as vezes responde a uma
interacao que nao era com ele (1 em 8).

**Digitacao procedural** (`typing.ts`): Bigode firme e regular, Cheeto em
rajadas com silencio longo, Almofada lento e grave, Smoking moderado com
pausas. Cansaco desacelera os dedos — da para OUVIR quem precisa de petisco.
Build travado silencia todo mundo: o silencio subito e o proprio aviso.

**O ritual da submissao** (§7 da direcao): musica congela, pacotes clicam,
transferencias sobem em estereo, pausa de tensao — e o acorde Dmaj9 quente com
trinos escalonados, ou o tropeço + thunk de coral.

**Mesa de som** (`mixer.ts`): cinco barramentos com controle independente no
painel `som` (musica, efeitos, teclados, ambiente, gatos), persistidos;
ducking de -4dB nos criticos ("um bolso na musica, nao forca bruta"); pan por
posicao de cena; ventilacao do rack AFINADA NA TONICA.

## Por que nao ha um `voxelyn-audio` compartilhado (ainda)

O Survival tem 3.8k linhas de audio proprias; extrair o comum exigiria
refatora-lo — e a regra desta entrega e nao tocar jogos existentes. Os
assentos daqui (transport / mixer / voices / grafo / ducking / preferencias)
espelham os do Survival de proposito: quando houver um segundo consumidor de
verdade, a promocao e mecanica. O que ja esta pronto para extrair: a matematica
de distancia do mixer do Survival, o buffer de ruido, o padrao de voice
renderer.

## Adiado com nome

Zonas e oclusao espaciais (divisorias abafando agudos) · anuncios de PA ·
biblioteca de vozes felinas gravadas (a direcao esta certa: gato crivel pede
sample curado; a sintese atual e o prototipo) · as nove fases musicais com
andamentos proprios (a fatia usa UMA faixa de 96 BPM cujo arco vem das
camadas) · modo streamer-safe · presets de faixa dinamica.
