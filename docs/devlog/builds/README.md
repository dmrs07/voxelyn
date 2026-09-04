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

O `.md` é a fonte, escrito à mão, e é o que se lê no GitHub. As outras duas saem dele:

```sh
node scripts/devlog/build-post.mjs docs/devlog/builds/AAAA-MM-DD-slug.md
```

O `.html` é a **página**: hero com a key art sem branding, imagens em figura com legenda, e a
faixa do Clevo tocando dentro do post. Abre com dois cliques, não depende de servidor, e é o
arquivo para mandar para alguém. Os caminhos das imagens são relativos, então `media/` viaja
junto.

O `.itch.html` é o de **colar no itch.io**, e é markup semântico puro de propósito. O editor de
devlog de lá é rich text e SANEIA a colagem: `<style>`, `<iframe>` e atributos de classe não
sobrevivem. Um embed colado de lá sumiria sem avisar, então imagem e vídeo viram linhas
vermelhas de marcação que a pessoa troca pelos botões da barra de ferramentas. Um slot visível
é melhor que uma deleção silenciosa. As instruções e a ordem das imagens ficam no comentário do
topo do próprio arquivo.

## O que NÃO entra num post destes

A régua é o leitor: alguém que joga, ou que quer jogar. Entra como a mecânica foi pensada, o que
não estava divertido e virou o quê, e o ofício por trás da arte e do som. Não entra a
engenharia defensiva que só existe para o jogo não quebrar: versão de protocolo, migração de
banco, o que entra no hash, ordem de slot em co-op, teto de storage, número de testes. Nada
disso muda uma decisão de quem está lendo, e cada parágrafo gasto nisso é um parágrafo que não
foi gasto no Devorador.

## As imagens

Screenshots de UI e de gameplay são capturadas do build daquele dia, servido de `dist/` e
dirigido por Chromium (mesma ideia de `scripts/devlog/lib/capture.mjs`: semear o storage de
jogador veterano, esperar o canvas pintar em vez de cronometrar no escuro). Folhas de atlas
e comparativos antes/depois vêm das ferramentas que os produziram.

## Posts

| Data | Post | Cobertura |
| --- | --- | --- |
| 2026-09-04 | [Sixteen days, and the floor started keeping score](2026-09-04-the-floor-keeps-score.md) ([página](2026-09-04-the-floor-keeps-score.html)) | PRs #154 a #200 |
