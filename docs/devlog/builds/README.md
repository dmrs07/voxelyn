# Build notes

Posts sobre uma ENTREGA, e não sobre um PR.

O pipeline de `docs/devlog/entries/` publica o histórico retroativo do projeto, um post por
PR, na ordem em que o trabalho foi feito. Ele é uma fila (`plan.json`) e não aceita um post
que cubra quarenta e sete PRs de uma vez sem quebrar a numeração e o índice.

Estas notas de build são a outra coisa: escritas na data real, cobrindo tudo o que mudou
entre um zip entregue e o próximo, para quem joga. Elas não entram no `plan.json`, não
recebem número de fila e não são regeradas por script nenhum.

## O que fica aqui

```
docs/devlog/builds/
  AAAA-MM-DD-slug.md            # o post do repositório, escrito à mão
  AAAA-MM-DD-slug.html          # a página pronta: imagens embutidas e trilha tocando
  AAAA-MM-DD-slug.itch.html     # a mesma coisa em HTML cru, para colar no itch.io
  media/                        # as imagens referenciadas pelos posts
```

São três saídas do mesmo texto, e cada uma existe por um motivo diferente.

O `.md` é a fonte, e é o que se lê no GitHub.

O `.html` é a **página**: hero com a key art sem branding, imagens em figura com legenda,
e a faixa do Clevo tocando dentro do post pelo player do YouTube. Abre com dois cliques,
não depende de servidor, e é o arquivo para mandar para alguém que não lê repositório.
Os caminhos das imagens são relativos, então a pasta `media/` viaja junto.

O `.itch.html` é o de colar: marca cada imagem com uma linha `[ IMAGE N ... ]`, porque o
editor do itch é rich text e não sobe imagem por markup. A linha é apagada e a imagem
entra pelo botão da barra de ferramentas, na ordem listada no comentário do topo.

## As imagens

Screenshots de UI e de gameplay são capturadas do build daquele dia, servido de `dist/` e
dirigido por Chromium (mesma ideia de `scripts/devlog/lib/capture.mjs`: semear o storage de
jogador veterano, esperar o canvas pintar em vez de cronometrar no escuro). Folhas de atlas
e comparativos antes/depois vêm das ferramentas que os produziram.

## Posts

| Data | Post | Cobertura |
| --- | --- | --- |
| 2026-09-04 | [Sixteen days, and the floor started keeping score](2026-09-04-the-floor-keeps-score.md) ([página](2026-09-04-the-floor-keeps-score.html)) | PRs #154 a #200 |
