# Key art — Voxelyn Survival

A splash oficial, renderizada em 3D com os assets e sistemas reais do jogo.

![Voxelyn Survival](./voxelyn-survival-splash-1920x1080.png)

| Arquivo | O que e |
|---|---|
| `voxelyn-survival-splash-3840x2160.png` | **Master 4K**, com branding. A entrega. |
| `voxelyn-survival-splash-3840x2160-clean.png` | 4K sem branding — a base para outros idiomas, plataformas ou recortes. |
| `voxelyn-survival-splash-1920x1080.png` | 1080p com branding, para web. |
| `voxelyn-survival-splash-segmentation.png` | Passe de segmentacao: uma cor por classe de objeto. Serve de **prova visual** — da para conferir a silhueta do Guardiao, os quatro contrafortes do berco e as celulas da Vein sem confiar em nada escrito. |
| `comparison-reference-vs-render.png` | A referencia (esquerda) ao lado do render (direita). |
| `reference-ai-briefing.png` | A imagem gerada por IA que serviu de **briefing**. Nunca entrou na pipeline — ver abaixo. |
| `render-manifest.json` | Proveniencia completa: seed, camera, cada peca com a origem dela, luzes, pos-processamento. |

## Como ela foi feita

Nenhum pixel veio de geracao de imagem. A cena e a area 96x96 que o worldgen do
jogo produz para `createRun({ seed: 518, sector: 1 })` — as Galerias de Basalto —
voxelizada a partir dos modelos canonicos (`guardianModel`, `coreModel`,
`prospectorParts`, `blockModel`, `surfaceModel`, props do atlas `world-props`) e
percorrida por um tracador de raios em perspectiva, um raio por pixel.

A Vein esta acesa porque `floodFrom` e `chargeCells` — as funcoes que o jogo roda
quando um tiro de energia acerta um veio — foram chamadas de verdade sobre este
mundo.

O codigo, o raciocinio e as medicoes estao em
[`packages/voxelyn-survival-content/tools/splash/`](../../../packages/voxelyn-survival-content/tools/splash/README.md).
O relatorio formal de autenticidade, com a rastreabilidade de cada elemento e as
tres divergencias deliberadas em relacao a referencia, esta em
[`AUTHENTICITY.md`](../../../packages/voxelyn-survival-content/tools/splash/AUTHENTICITY.md).

## Regerar

```
pnpm --filter @voxelyn/survival-content render:splash:all
```

Sai em `packages/voxelyn-survival-content/artifacts/` (fora do controle de
versao, por ser saida regeneravel). Os arquivos deste diretorio sao a copia
curada do que interessa guardar: as duas resolucoes de entrega, a versao limpa,
a prova de segmentacao, o comparativo e o manifest.

O render e deterministico — a amostragem por pixel usa deslocamento derivado do
indice da amostra, e nao um gerador aleatorio —, entao regerar produz os mesmos
arquivos bit a bit.
