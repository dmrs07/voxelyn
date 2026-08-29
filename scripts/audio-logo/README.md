# Pipeline do logo sonoro da DaniTools

Gera a assinatura sonora do estúdio. Node puro, sem dependências — a mesma regra
do resto do repositório. A entrega fica em
[`docs/audio/danitools/`](../../docs/audio/danitools/README.md).

```sh
pnpm audio-logo                    # kit completo
pnpm audio-logo:test               # afere o medidor e valida as entregas
node scripts/audio-logo/render.mjs --no-encode --no-stems   # só os WAV mestres
```

## Os arquivos

| Arquivo | O que faz |
|---|---|
| `dsp.mjs` | Primitivas: I/O de WAV, biquads RBJ, transposição por overlap-add, reverb de placa (Freeverb), chorus, bitcrush, compressor, limitador com *lookahead*, PRNG semeado. |
| `synth.mjs` | Instrumentos: osciladores PolyBLEP, supersaw, sinos aditivos, sub do impacto, estalo, riser, arpejo chiptune. |
| `voice.mjs` | A cadeia de voz — quatro camadas derivadas de uma tomada só. |
| `arrangement.mjs` | O arranjo em *stems*, o *ducking* e a masterização. |
| `loudness.mjs` | Medição: BS.1770-4 com gating, picos, correlação, energia por banda, margem da voz. |
| `render.mjs` | Entrada. Escreve WAV, MP3, OGG, stems FLAC, a onda em SVG e o manifesto. |
| `audio-logo.test.mjs` | O que precisa ser verdade para a peça servir de marca. |
| `takes/*.wav` | As tomadas de voz cruas, versionadas. |

## Três decisões que valem explicação

### A voz é síntese, e isso é a escolha

A locução veio do `espeak-ng`, um sintetizador de formantes — chamado **uma vez**,
com o comando que está no manifesto, para gerar `takes/*.wav`. Os WAV estão
versionados, então o render não depende do `espeak` estar instalado.

Dava para gravar uma pessoa. A síntese ganhou por dois motivos: o timbre
quantizado combina com uma marca feita de pixel art, e uma voz sintetizada tem
parâmetro — mudar a pronúncia é editar uma string, não remarcar uma sessão.

### O EQ da voz veio da medição, não do gosto

A tomada crua foi analisada antes de qualquer decisão. Energia relativa ao total,
por banda:

```
60 Hz   120 Hz   250 Hz   500 Hz   1 kHz   2 kHz   4 kHz   8 kHz
-17,0    -8,5     -3,1     -7,1    -9,4   -14,5   -30,8   -34,9
```

Duas coisas saltam: a fonte é **encaixotada em 250 Hz** e é **praticamente vazia
acima de 4 kHz**. Isso decidiu a cadeia inteira:

- 280 Hz leva −4 dB. A caixa é cortada, não mascarada por realce em outro lugar.
- O brilho é **gerado**, não realçado. Uma camada transposta uma oitava acima leva
  o conteúdo de 2–4 kHz para 4–8 kHz e é passa-alta em 2,6 kHz. Levantar um *shelf*
  em 8 kHz num espectro que está 35 dB abaixo só levantaria o ruído do sintetizador.
- O peso vem de uma camada uma oitava abaixo, passa-baixa em 600 Hz — soma peito
  sem reforçar a mesma região que já estava sobrando.

A quarta camada é *bitcrush* de 8 bits a 11 kHz, em passa-banda: a textura de pixel
da marca, dentro da própria voz.

### O arranjo é feito de stems, e o ducking é exato

`arrange()` não mistura enquanto constrói. Cada elemento vai para um par L/R
nomeado — `anacruse`, `impacto`, `acorde`, `voz`, `sinos`, `caudas` — e a soma só
acontece no fim. Isso resolve três coisas de uma vez:

1. **O *ducking* atinge exatamente quem deve.** O acorde, os sinos e as caudas
   abaixam 4,5 dB sob a palavra; a voz não. Numa mixagem somada seria preciso
   abaixar tudo e devolver o ganho à voz por compensação — aproximado e frágil.
2. **A margem da voz vira mensurável.** Com a voz separada da música dá para medir,
   banda por banda, se a palavra passa. É o critério de aprovação da peça, e está
   no teste.
3. **Os stems são entrega.** Quem for editar vídeo reequilibra sem rodar nada.

## O que o teste testa

`audio-logo.test.mjs` não testa se o som ficou bom — isso não é testável. Testa o
que precisa ser verdade para a peça servir de marca registrada:

- **O medidor está aferido.** Caso 1 do EBU Tech 3341: seno de 1 kHz estéreo a
  −23 dBFS tem que medir −23,0 LUFS. Sem isso, toda medição do manifesto é
  decoração.
- **A afinação está certa.** A4 = 440 Hz, oitava exatamente 2×.
- **O render é determinístico.** Duas execuções, amostra por amostra.
- **A palavra passa por cima da música**, com mais de +3 dB de margem em 1–2, 2–4
  e 4–8 kHz.
- **As entregas respeitam o teto** de −1 dBTP e o alvo de loudness (±0,5 LU), sem
  amostra estourada nem não-finita.
- **A peça abre sem ar morto** e termina em silêncio.
- **A soma mono não cancela nada** — menos de 1,5 dB de perda, porque metade do
  público ouve em alto-falante de celular.

## Ressalvas honestas

- O pico inter-amostra é **estimado** por sobreamostragem 8× com interpolação de
  Hermite, não pelo FIR normativo de 4× do BS.1770. Vale como margem de segurança;
  não é certificado de conformidade.
- O `timeStretch` é overlap-add com janela de Hann, sem alinhamento de fase.
  Em ±12 semitons sobre uma palavra curta o artefato é leve e, numa marca de pixel
  art, lê como caráter. Não use essa função esperando qualidade de PSOLA.
- `ffmpeg` é opcional e só faz a codificação. Sem ele saem os WAV mestres e os
  stems em WAV; o resto do pipeline não muda.
