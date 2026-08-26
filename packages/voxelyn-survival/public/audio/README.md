# Trilha composta do Voxelyn Survival

Este diretório recebe `voxelyn-survival-theme.flac` — a trilha do compositor,
em loop, tocada em **todos os estratos** no lugar dos oito temas procedurais
(que continuam no bundle como backup: fallback automático quando este arquivo
não carrega, e escolha explícita em Opções → Trilha).

## Contrato (do compositor, preservado pelo código)

- **Sem perda**: o asset é FLAC (lossless). Nunca trocar por mp3/ogg — o teste
  `soundtrack.test.ts` cobra a extensão.
- **Imagem estéreo intacta**: a trilha foi mixada com as laterais ocupadas e o
  centro (~40% interno do campo) livre para os sons do jogo. Duas camadas de
  graves coexistem por design. O caminho de áudio não soma para mono, não
  pana, não filtra (ver `src/client/audio/soundtrack-bus.ts`).
- **SFX > música, sempre**: mesmo teto (`MUSIC_CEILING`) e mesmo ducking da
  música procedural.
- **Loop sem emenda**: `AudioBufferSourceNode` com `loop=true` (gapless com
  precisão de amostra).

## Como gerar o asset a partir do arquivo do compositor

```sh
node scripts/prepare-soundtrack.mjs <arquivo-do-compositor>
```

O script analisa (LUFS, true peak, mid/side em banda cheia e <120 Hz, bordas
do loop), empacota em FLAC sem alterar o áudio e imprime o `COMPOSED_TRIM`
calibrado para colar em `src/client/audio/soundtrack.ts`.

O arquivo não versionado aqui ainda? O jogo toca o backup procedural e nada
quebra — inclusive o install offline do PWA (a trilha é entrada OPCIONAL do
precache em `public/sw.js`).
