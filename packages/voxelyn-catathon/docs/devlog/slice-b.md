# Devlog — Slice B: cada run é outra run

*CATATHON · dois commits (sim/gerador + cliente) · 51 testes · PR #156*

## O que este slice entrega

O brief pedia variabilidade: "cada run sorteia uma equipe possível, um
projeto problemático e um espaço imperfeito". O Slice B constrói exatamente
isso — um **gerador puro sobre a semente** (`gen.ts`) e a sim generalizada
para jogar com qualquer time. O replay virou `(semente, equipe contratada,
comandos)`: o recrutamento é decisão do jogador, então entra como argumento,
não como sorteio.

## O gerador

- **Candidatos**: 30 raças (aparência + toques de comportamento — raça
  nunca determina profissão), 5 especializações (as 4 trilhas +
  freestyler a 0.75 em tudo; tech lead, PO/PM e AI engineer **adiados com
  nome** — precisam de mecânicas próprias de revisão/priorização), 4 tiers
  que mudam a forma de jogar: o júnior começa a 0.78 e **aprende durante a
  run** (+0.18), mas shipa sujo (+12% bug); o sênior conserta 1.4× e shipa
  2× mais limpo; o especialista voa na trilha (1.3×) e afunda fora dela.
- **Traits**: 12, todos mecânicos — 6 que ajudam (caçador de bugs, dorme
  rápido, digitação polidáctila, pitchador nato, gambiarra elegante, zen)
  e 6 que atrapalham (dorme no teclado, zoomies noturnos, produção direta
  em main, detesta legado, medo de palco, guloso). Dois vêm no currículo;
  **um fica oculto**, age desde o início e se revela aos 30% da run — a
  incerteza saudável do recrutamento: você observa o comportamento antes
  de saber o nome dele.
- **Moedas**: tampinhas, bolinhas (=10) e peixinhos (=100). Orçamento de
  420 por run; júnior ~12 tampinhas, pleno ~64, sênior ~230, especialista
  ~400 — "dá para três ou quatro, dependendo do tier", como o e-mail diz.
- **Projetos**: nome (RonroMed, FishFlow, BoxBox…), briefing composto
  (domínio × público × restrição), 3 formas de grafo curadas e testadas
  acíclicas, custos com jitter, a lente da banca **anunciada** (1.25× numa
  dimensão) e um **risco oculto** por edição: a integração do sponsor cai
  no meio da run, o hype esfria a plateia mais rápido, ou dados sensíveis
  encarecem cada bug.
- **Layouts**: 6 booths curados com modificadores mecânicos — Open Booth
  (moral de equipe 1.5×, mais distração), Cubículos (foco, menos moral
  social), Ilha Central, Server Corner (conserta 1.3×), Quiet Zone,
  Perto da Cafeteria (comer 0.6×). Worldgen livre vira sopa; layout com
  opinião vira jogo.

## O recrutamento

Diegético, como o brief pediu: um e-mail do recrutador com o desafio da
edição (nome, briefing, lente da banca, booth) e seis crachás em anexo —
raça, tier, especialização, dois traits visíveis, o `???` do oculto, uma
frase de currículo ("oito anos de experiência em derrubar objetos de
mesas") e o custo nas três moedas. Fechar equipe exige 3–4 contratados
dentro do orçamento, e o botão nasce desabilitado.

## Defeitos que os portões pegaram (a colheita deste slice)

1. **Os mapas de voz e teclado eram chaveados pelos ids clássicos** —
   com time gerado, `PROFILES[id].base` dava undefined e **matava o loop
   inteiro do jogo** no meio do arrasto. A fumaça pegou; o timbre agora vem
   da personalidade (que sempre foi a intenção da direção de som).
2. **Quatro tiers caros no quarteto de cobertura** estouravam o orçamento
   e a única equipe completa era incontratável. O gerador rebaixa o mais
   caro deterministicamente até caber — e o portão de teste ficou.
3. O bot de pitch gastava as quatro habilidades e, quando a demo travava,
   **todo mundo estava em cooldown** (4s) com a janela de crise aberta
   (3s). O bot aprendeu a guardar um gato de prontidão — e essa é
   literalmente uma dica de gameplay descoberta por teste.
4. A fumaça cortava escopo pelo rótulo fixo 'autoscaling' — que agora é
   gerado. Todos os portões viraram dinâmicos (o gato de backend DA RUN, o
   rótulo real de o3, a habilidade de um não-cowboy — o cursor do cowboy
   pode derrubar o gauge de propósito).

## Números

- 51 testes (eram 41): o gerador é testado **jogando** — determinismo por
  semente, cobertura das quatro trilhas nos quatro primeiros, orçamento
  sempre jogável, grafos acíclicos em 40 sementes, run gerada atravessando
  até a banca. Os arquétipos clássicos seguem intactos via `CLASSIC_TEAM`.
- Fumaça: recrutamento de verdade (6 currículos, equipe vazia não fecha,
  4 contratados) + todos os portões anteriores em modo dinâmico.

## Adiado com nome (→ Slices C/D)

Progressão de carreira e persistência de moedas · tech lead/PO/AI engineer
· exigências mecânicas do especialista (workstation própria, catnip) ·
apetrechos compráveis · eventos sociais/éticos · daily seed · achievements
· compatibilidade entre gatos · rivais persistentes.
