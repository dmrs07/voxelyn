# Creditos e licenca — sprites dos gatos

Os sprites dos gatos do CATATHON vem do pack **"Animated Cat Sprites"** de
**girlypixels**: <https://girlypixels.itch.io/animated-cat-sprites>.

Termos do pack (publicados na pagina; o zip nao traz arquivo de licenca):

> You can modify and use these assets in commercial projects, however, you
> cannot redistribute or resell these assets.

Como este repositorio e PUBLICO, os arquivos crus do pack **nao sao
commitados** — commita-los seria redistribuicao. O fluxo e:

1. O zip comprado fica fora do repo (extraido em `assets-src/`, gitignorado).
2. `scripts/import-cats.mjs` gera `src/client/assets/catSprites.ts` — uma
   representacao indexada lossless apenas dos frames que o jogo usa,
   embutida no bundle do BUILD (uso em projeto, permitido pela licenca).
3. Recolors/overlays (colares, oculos, gravata do PM) sao camadas do
   Catathon por cima dos frames originais, nunca redesenho.

Ao publicar o jogo, creditar: *cat sprites by girlypixels (itch.io)*.
