# Voxelyn Survival — Chefes por estrato e ocupação

## O problema

Os chefes eram decididos pelo **número do setor**: Bispo no 2, Guardião no 3,
qualquer que fosse a geologia. Uma Catedral Prismática terminava no mesmo Guardião de
basalto, e o Bispo aparecia em mapas onde o micélio era um enxerto plantado à força
só para a luta dele existir.

## A regra nova — `bossForBiome` (`src/bosses.ts`)

```ts
bossForBiome({ stratum, occupation, depth });
```

Prioridade:

1. **Uma ocupação forte substitui o chefe do estrato.**
2. **Sem ocupação dominante, entra o chefe natural do estrato.**

| Categoria | Mapa | Chefe | Status |
| --- | --- | --- | --- |
| Ocupação | Contaminação Micelial | Bispo | **implementado** |
| Ocupação | Cicatriz Aurix | Diamandis | fallback → Guardião |
| Estrato | Galerias de Basalto | Guardião | **implementado** |
| Estrato | Catedral Prismática | Arquicantor | fallback → Guardião |
| Estrato | Aquífero Negro | Leviatã do Lençol | fallback → Guardião |
| Estrato | Fenda Sulfurosa | Pulmão-Matriz | fallback → Guardião |
| Estrato | Fornalha Abissal | Coração da Fornalha | fallback → Guardião |
| Estrato | Sumidouros de Sílica | Devorador Branco | fallback → Guardião |
| Estrato | Cripta Glacial | Rainha da Geada | fallback → Guardião |
| Estrato | Estrato Ferrífero | Magnetarca | fallback → Guardião |

A tabela conceitual (`BossId`) é completa desde já; os arquétipos entram um a um em
`IMPLEMENTED_BOSS`, com o Guardião como fallback jogável. Assim seleção, documentos e
codex podem falar do Diamandis antes de o Diamandis lutar.

### Um chefe por run

- **Setor 1 nunca tem chefe** — é onde a run ensina. E o poço dele **sempre revela
  pelo menos um Eco**, mesmo sem ressonância acumulada (fallback determinístico pela
  seed): um poço calado na primeira descida ensinaria que o poço não oferece nada.
- **Setores do meio não têm chefe obrigatório** — três chefes fragmentariam toda
  descida. A identidade deles é a fauna de assinatura.
- **O chefe final é escolhido pelo mapa final da linhagem.** A linhagem hídrica
  termina em Aquífero + Matriz Micelial → Bispo; as intrusões sorteadas (um setor
  final `none` pode ganhar ocupação micelial) também trazem o Bispo.
- A câmara de chefe continua carimbada pelo worldgen em todo setor (moldura por
  estrato incluída); só o setor final a ocupa.
- `bossesDown` continua por setor: chefe abatido não repovoa.
- O bolso micelial do Bispo poupa o anel do pedestal (`PEDESTAL_KEEPOUT`): o fosso
  de água/brasa do objetivo é funcional e é mais antigo que a colônia — exceto o 3x3
  do próprio chefe, que nasce sempre sobre tapete.

## Bispo — Supernova como resposta primária

Ver `docs/bosses/voxelyn-survival-bosses.md` (atualizado). Resumo do que mudou:

- **Saiu do ramo genérico de gosma.** O Bispo não compartilha mais o cuspe do
  Spitter — um chefe do chão responde com o chão.
- **Supernova em luta normal**: jogador dentro do raio + recarga pronta (300 ticks)
  → telégrafo radial de 1,5 s. Dano 360°, fungo replantado **somente no release**.
- **Gatilho ferido corrigido**: era "nenhum fungo detectável em 14 tiles", e uma
  célula isolada atrás de uma parede bloqueava o ataque para sempre. Agora: ferido e
  fora do fungo ele recua; se não **pisa** em fungo dentro de
  `BISHOP_NOVA_SEEK_TICKS` (4 s), a Supernova sai.
- Segundo ataque temático futuro (candidato): **Erupção Litúrgica** — o cajado marca
  três células fúngicas próximas ao jogador e, após um windup curto, raízes explodem
  nesses pontos. Continua sendo um chefe do chão, não um Spitter gigante.

## Guardião — Salva Litoclasta (pedras, não gosma)

O release do ranged dele criava um projétil `spit` com biofluido — visual e
mecanicamente, o chefe das Galerias de Basalto estava cuspindo. Agora:

- **Leque de três pedras**: central com interceptação da posição prevista (sem
  homing, como a pedra do Britador), laterais com ±`GUARDIAN_FAN_SPREAD` (~22°).
  Três corredores legíveis.
- `kind: 'rock'`, **sem biofluido**, **sem stun** (o stun de pedra virou flag
  `stuns` do projétil e é exclusivo do arremesso único do Britador — três pedras
  encadeando atordoamento seria stun-lock).
- Velocidade **6** (< 7 do cuspe), hitbox visível (raio 0,42), colide com parede
  sólida e quebra frágil pela classe cinética que já existe.
- **Segunda fase (< 50% de vida)**: alterna leque (negar espaço) com **rajada** de
  três pedras em sequência (`GUARDIAN_VOLLEY_INTERVAL_TICKS`), com correção de mira
  entre disparos (perseguir movimento). A rajada re-arma o release da própria ação,
  então os relógios hasheados acompanham sozinhos.
- Tudo o mais fica: atravessar/destruir paredes, investida, cerco da arena,
  invocação, guarda do Núcleo.

## Ordem recomendada de desenvolvimento (restante)

1. ~~Gatilho da Supernova + remover cuspe do Bispo~~ ✔
2. ~~Salva Litoclasta do Guardião~~ ✔
3. ~~`bossForBiome()` sem dependência de setor~~ ✔
4. Generalizar o estado específico do Guardião (`guardianAwake`, `guardianPath`,
   `guardianSummoned`, `arenaClosed`) num `bossRuntime` — pré-requisito para dois
   chefes coexistirem no mesmo mundo sem disputar campos.
5. **Diamandis** (Cicatriz Aurix) — o próximo chefe novo: broca de avanço, salva de
   demolição, feixe de prospecção, colapso do reator, e os Coveiros recuperando
   módulos (luta mais fácil × recompensa maior). Usa peças que o jogo já tem —
   pedra, destruição de parede, calor, módulos, Coveiros, sucata.
6. **Devorador Branco** (Sumidouros de Sílica) — linha de vibração, emergir por
   baixo, vitrificar o chão como contra-jogo.
7. Documentos de chefe desbloqueados por **entendimento do encontro** (primeiro
   encontro → classificação corporativa; presenciar o golpe principal → relatório
   técnico; primeira derrota → incidente; condição especial → ordem executiva;
   descoberta composta → não classificado), junto de cada chefe — não numa etapa
   posterior.
