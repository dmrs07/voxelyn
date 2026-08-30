# Trilha composta do Voxelyn Survival

**Música por Clevo (@clevoclevoclevo)** — composta para o jogo, usada com
permissão do autor (ver `THIRD_PARTY_NOTICES.md`).

Este diretório recebe os dois slots do pipeline de trilha:

- `voxelyn-survival-theme.flac` — a trilha da **run**, em loop, tocada em
  todos os estratos no lugar dos oito temas procedurais (que continuam no
  bundle como backup: fallback automático quando este arquivo não carrega, e
  escolha explícita em Opções → Trilha).
- `voxelyn-survival-menu.flac` — a trilha de **abertura** (tela de título e
  overlays do terminal), em loop; cala sob o véu quando a descida começa.
  Ausente, o menu fica em silêncio — o comportamento histórico.

## Contrato (do compositor, preservado pelo código)

- **Sem perda**: o asset é FLAC (lossless). Nunca trocar por mp3/ogg — o teste
  `soundtrack.test.ts` cobra a extensão.
- **Imagem estéreo intacta**: a trilha foi mixada com as laterais ocupadas e o
  centro (~40% interno do campo) livre para os sons do jogo. Duas camadas de
  graves coexistem por design. O caminho de áudio não soma para mono, não
  pana, não filtra (ver `src/client/audio/soundtrack-bus.ts`).
- **SFX > música, sempre**: mesmo teto (`MUSIC_CEILING`) e mesmo ducking da
  música procedural. O teto põe a trilha em **−21 LUFS** no jogo com o slider no
  máximo; sob um telegrafo o ducking a devolve a −30 LUFS. Em repouso ela passa
  do menor telegrafo de propósito — a proteção mora no duck, não na margem
  estática. O trim é calibrado por `prepare-soundtrack.mjs`, que mira o mesmo
  −21; teto e alvo do script andam juntos.
- **Loop sem emenda**: `AudioBufferSourceNode` com `loop=true` (gapless com
  precisão de amostra).

## Como gerar o asset a partir do arquivo do compositor

```sh
node scripts/prepare-soundtrack.mjs <arquivo-do-compositor>              # run
node scripts/prepare-soundtrack.mjs <arquivo-do-compositor> --slot menu  # abertura
```

O script analisa (LUFS, true peak, mid/side em banda cheia e <120 Hz, bordas
do loop), empacota em FLAC sem alterar o áudio e imprime o trim calibrado
(`COMPOSED_TRIM` ou `MENU_TRIM`) para colar em
`src/client/audio/soundtrack.ts`.

O arquivo não versionado aqui ainda? O jogo toca o backup procedural e nada
quebra — inclusive o install offline do PWA (a trilha é entrada OPCIONAL do
precache em `public/sw.js`).
