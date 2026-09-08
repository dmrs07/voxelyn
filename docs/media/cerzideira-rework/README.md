# Cerzideira — rework da luta

A luta passa a ter uma regra central: cortar o único fio ativo derruba a Cerzideira; sair da marca evita a agulhada. As suturas de exploração continuam funcionando fora da câmara.

![Ciclo da Cerzideira](./01-ciclo-da-cerzideira.png)

Esta imagem usa estados da simulação, atlas publicados e a função de desenho dos avisos. As paredes frontais estão em corte para facilitar a leitura. Não é uma captura de navegador.

## O que mudou

- Perseguição no chão a 4 tiles/s e deslocamento suspenso a 12 tiles/s. O voo ultrapassa obstáculos internos; caminhada e pouso verificam o corpo inteiro.
- Âncora, origem, destino, pouso e impacto ficam registrados na ação. O aviso não muda de lugar durante o ataque. Há uma antecipação curta e limitada do movimento do jogador ao escolher o destino.
- Dano, som e efeito da agulhada saem no terceiro quadro de `attack`: quatro ticks depois do pouso. O corpo não causa dano contínuo durante o voo.
- Cortar o fio cancela o golpe, pousa a Cerzideira em espaço livre e abre 36 ticks de vulnerabilidade, com multiplicador de dano de 1,5. Depois ela se reposiciona antes de escolher outro apoio.
- Após duas investidas, a Cerzideira convoca até três crias e um Costureiro. Eles agacham, marcam o pouso, saltam e se recuperam. A morte da matriz encerra os auxiliares e seus ataques.
- Abaixo de metade da vida, ela encadeia duas investidas usando apoios diferentes e repõe auxiliares com maior frequência.
- A câmara não fecha passagens, chicoteia fios nem derruba cargas. Esses comportamentos continuam nas suturas da colônia.
- O atlas da Cerzideira mantém oito direções autoradas, sem espelhamento, e o raster de câmera das diagonais. A cria tem modelo próprio; os três corpos têm pose de voo.

## Jogar e reproduzir

Baixe [cerzideira-preview.zip](./cerzideira-preview.zip), extraia e abra `index.html`. Selecione **A Cerzideira**. O pacote inclui a arena, a simulação e o renderer do jogo.

WASD move, mouse mira/dispara e Espaço esquiva. Nas ferramentas da arena, o painel de suturas permite pausar, cortar o fio ativo, romper sua âncora, avançar um tick e ativar a segunda fase. O painel mostra os ticks de decolagem, pouso e impacto.

```sh
pnpm build:survival
pnpm test:survival
node packages/voxelyn-survival/scripts/preview-seamstress-rework.mjs
node packages/voxelyn-survival/scripts/export-costureiros-preview.mjs /tmp/cerzideira-preview
```

## Evidências e limites

`simulation-events.json` registra os eventos que produziram a prancha. `playtest-results.json` registra quatro controladores automáticos na arena de seed 36, setor 7, com 100 HP e módulo perfurante. Eles não usam a habilidade equipada. O cenário de corte injeta um segmento de tiro cruzando cada fio, para testar a interrupção.

Nos ensaios, o limite permaneceu em quatro auxiliares e nenhum tick de caminhada terminou com a Cerzideira dentro de terreno sólido. Ficar parado atirando terminou em derrota; circular atirando continuou sendo uma estratégia viável. Esses resultados verificam comportamento e regressões, não substituem o ajuste de dificuldade com jogadores.

Build de produção, lint, testes focados e verificações por pacote foram executados. Os testes de mundo e pontaria que excederam o tempo em execução concorrente passaram isolados. O teste preexistente do MCP que cria 500 mundos excedeu seu prazo de 20 segundos neste ambiente; os outros 24 testes do pacote passaram. Ambiente: Node 24.19.0; o projeto declara Node 22.

O navegador remoto bloqueou URLs locais, portanto o pacote jogável não recebeu inspeção interativa nesta sessão. A inspeção visual cobre a prancha da simulação e os atlas; os testes cobrem impacto, interrupções, pouso, auxiliares, hash, apresentação e reconexão durante o voo.

O validador de conteúdo manteve os limites existentes: 159,52 MiB no boot e 46,31 MiB sob demanda, abaixo dos tetos de 160 e 48 MiB. Versões: protocolo 36, simulação 69, conteúdo 37.
