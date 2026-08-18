# Voxelyn Survival — changelog

O que mudou entre os builds publicados no itch.io, na voz que o jogador lê.

Diferente de `entries/`, que conta como o trabalho foi feito, um por PR: aqui
entra só o que **muda a partida**. PR que mexe em documentação, pipeline de
devlog ou ferramenta não aparece — se o jogador não sente, não é changelog.

Cada seção é um build. O cabeçalho traz a data, o commit de onde o zip saiu e as
versões de simulação e protocolo, porque são elas que decidem se um cliente
antigo ainda conversa com o servidor.

---

## Build 2026-08-17 — `81e744c`

`SIMULATION` 40 → 41 · `PROTOCOL` 24 → 25 · `CONTENT` 24 (inalterado)

> **Co-op online:** o protocolo mudou. Abas abertas desde o build anterior
> precisam recarregar a página para entrar numa sala — o cliente antigo cai com
> aviso de versão incompatível em vez de dessincronizar em silêncio.

### A contaminação parou de ser enfeite

O medidor de contaminação subia até 100% e, ao chegar lá, não fazia mais nada. A
última onda agendada morava em 85%, então encher a barra deixava o jogador no
estado **mais seguro** da run: todas as consequências já tinham acontecido.

Agora o topo da barra é um prazo.

- **Saturação (100%): o ar cobra.** Uma pancada por segundo, escalando enquanto
  você continuar ali. Parado e com vida cheia: ~25% da vida nos primeiros dez
  segundos, morte perto dos vinte. Dá para correr até a extração. Não dá para
  ficar, e muito menos para lutar.
- **A onda tardia não acaba mais.** Passado 85%, a leva de inimigos volta a cada
  35 s em vez de nunca. O trecho mais contaminado do setor era o mais vazio.
- **Descer é o alívio.** O carryover derruba a contaminação abaixo do limiar, e
  os relógios da saturação zeram junto — descer mais fundo é a única coisa que
  limpa o ar.
- **A selagem ambiental comprada vale contra ele.** Saturação conta como dano
  ambiental, então o upgrade que você paga protege do ar, e não só da fumaça.
- **Morte por saturação tem tela própria.** "Você pisou numa nuvem" e "você
  ficou tempo demais" são lições diferentes.
- **Abatido no co-op não paga duas vezes.** Quem está caído já está no relógio
  do bleedout; a janela de resgate continua inteira.

**HUD:** a faixa de três pixels sem número virou leitura de verdade — engrossa
com o perigo, percorre ácido → fogo → sangue, mostra a porcentagem a partir do
primeiro limiar e, na saturação, troca o número pela instrução
`AR SATURADO — SAIA`, pulsando junto com a pancada.

### As leylines viraram um quebra-cabeça opcional

As linhas de energia na parede não faziam nada sem o módulo `conductive` — uma
das duas opções de um cofre de tier 2. Sem ele, a run era indistinguível de uma
sem leylines. Elas agora são o **circuito do setor**.

- **A nascente.** A junção mais perto da entrada aceita `USAR` e lança uma
  cascata pela rede inteira. Sem item, sem desbloqueio, disponível no primeiro
  minuto de qualquer run.
- **Fechar o circuito** significa acender **todos** os segmentos numa cascata só
  — o que exige abrir cada junção, da entrada até a banda profunda.
- **O curto.** Um segmento com 6+ células de cristal ou minério encostadas sangra
  a carga e recusa acender. O conserto é o verbo central do jogo: quebre o
  cristal, esgote o veio. A Catedral Prismática é quase sempre o problema; o
  basalto do setor 1 quase nunca.
- **O prêmio: a subversão do estrato.** Fechar **desliga a propriedade que dá
  identidade ao estrato** até a próxima descida. A lâmina do Aquífero para de
  conduzir; o gelo da Cripta para de derreter; o cristal da Catedral fica opaco e
  o Arquicantor perde munição; os respiradouros da Fenda travam; a brasa da
  Fornalha devolve a dissipação de calor; a sílica solta vira vidro e o Devorador
  Branco perde o chão por onde sobe.
- **E ele corta dos dois lados.** Você não ganha um poder, você desliga uma
  regra — e a regra servia aos dois. Sem lâmina condutiva você também perde
  eletrificar poça; sem cristal você perde sua fonte grátis de `current`.
- **O módulo `conductive` deixou de ser porta e virou atalho.** Um tiro `energy`
  ainda acende o segmento que acertar, o que serve para alcançar um ramo solto —
  pagando uma carga por segmento.

**Avisos honestos:** cerca de 19% dos setores não têm circuito nenhum (a rede
saiu curta demais), e o setor 1 é basalto — circuito sem obstáculo e sem prêmio,
de propósito, porque é onde a linguagem se ensina. O estrato Ferrífero não tem
leyline e não vai ter: lá a parede conectada já **é** a fiação.

### Nada mais mudou

Os outros dois PRs desta janela (#146, #147) mexeram só no pipeline de devlog e
em documentação. Nenhuma linha de simulação, render ou conteúdo.
