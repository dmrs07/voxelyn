# itch.io — configuração da página do projeto

O que preencher no formulário de edição do projeto, e por quê. Isto é o que
decide se o jogo **aparece** no Browse e na busca do itch: um post de devlog
bonito não indexa nada sozinho.

> **Aviso de verificação.** `itch.io` é bloqueado pelo proxy de rede deste
> ambiente, então nada aqui foi conferido contra a documentação viva deles. É
> conhecimento geral do funcionamento do site, e o formulário é a fonte da
> verdade — em especial a lista de tags sugeridas, que o autocomplete oferece e
> que muda com o tempo. Confira em `itch.io/docs/creators/getting-indexed`
> antes de considerar a página pronta.

---

## Tags: os dois sistemas que não se misturam

Há **duas** coisas chamadas "tag" neste repositório, e elas não têm relação:

| Onde | O que é | Onde mora |
| --- | --- | --- |
| Página do projeto | As tags do itch, que alimentam Browse e busca | este documento |
| Posts de rede social | Hashtags de LinkedIn/Instagram (`#gamedev`) | `docs/devlog/social/NNN.json` |

E o **post de devlog** não tem tag nenhuma: ele tem um *post type* (Updates,
Game Design, Announcement…), que é o campo `POST TYPE` no topo dos arquivos
`NNN.itch.md`. Um devlog não indexa o jogo — quem faz isso é a página.

---

## Tags da página (máximo 10)

Ordenadas pelo que mais traz gente. Todas descrevem o que o jogo **é**, e não
o que ele gostaria de ser:

```
roguelike
extraction
survival
pixel-art
procedural-generation
top-down
mining
voxel
singleplayer
co-op
```

Por que estas:

- **roguelike** e **survival** são as páginas de Browse com mais tráfego que
  descrevem o jogo honestamente. (O jogo tem meta-progressão entre runs —
  gerações e upgrades comprados —, então `roguelite` também é defensável; vale
  testar qual traz mais visita, mas não use as duas: gasta um slot para dizer a
  mesma coisa.)
- **extraction** é o gênero que a premissa realmente descreve — descer, pegar o
  Núcleo, sair vivo — e é onde está o público que quer exatamente isso.
- **pixel-art** e **voxel** são busca visual: muita gente filtra por estética
  antes de filtrar por gênero.
- **singleplayer** e **co-op** entram como tag porque no itch essas categorias
  SÃO tags (diferente da Steam, onde são campo próprio). O co-op é online e de
  dois jogadores (`MAX_PLAYERS = 2`).

O que **não** entra, e o motivo:

| Não use | Por quê |
| --- | --- |
| `free` | Preço é campo próprio. A tag desperdiça um slot. |
| `browser`, `html5`, `webgl` | Plataforma é campo próprio, e o itch já marca jogos jogáveis no navegador. |
| `voxelyn`, `aurix` | Tag com o nome do próprio jogo ou do estúdio não é buscada por ninguém que ainda não te conhece. |
| `game`, `indie` | Universais demais para filtrar coisa alguma. |
| `fun`, `hard`, `atmospheric` | Adjetivo não é categoria; ninguém navega por eles. |

---

## Os outros campos que decidem indexação

- **Classification:** Games (não Tool, não Assets).
- **Kind of project:** HTML — e marque **"This file will be played in the
  browser"** no upload. É o que põe o botão de jogar na página.
- **Genre:** Action. O jogo é ação em tempo real; "Adventure" descreveria outro
  ritmo.
- **Pricing:** decidido explicitamente, mesmo sendo grátis. Projeto sem preço
  definido não indexa.
- **Short description:** a frase que aparece no card do Browse, e não um repeteco
  do título. Ver o `Tagline` do dispatch de divulgação.
- **Cover image:** 630×500. É o card inteiro na listagem — sem ela o projeto
  aparece como um retângulo vazio no meio de vizinhos ilustrados.
- **Screenshots:** do jogo rodando, não de menu.
- **Visibility:** Public. Draft e restricted não entram no índice de jeito nenhum.

## Viewport do jogo no navegador

O jogo é PWA e trata safe-area de celular, então uma moldura generosa (ou a
opção de fullscreen) serve melhor que uma caixa fixa pequena.
