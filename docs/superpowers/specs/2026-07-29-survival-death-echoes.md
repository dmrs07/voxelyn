# Ecos do Veio — memória espacial entre runs

## Problema

A run terminava e o Veio esquecia tudo. O jogador recebia uma tela de resultado, mas o espaço jogável não carregava nenhuma consequência das tentativas anteriores. Isso enfraquecia a leitura de mundo persistente: morrer era estatística, não arqueologia.

A solução é guardar uma cápsula mínima de cada morte local e reprojetá-la em runs futuras como uma carcaça de Prospector com caixa-preta. A carcaça não muda o mapa nem a simulação; ela só ensina, por presença e causa, que alguém já falhou ali.

## Invariantes

1. O mapa nunca é alterado para acomodar um eco.
2. Eco não colide, não concede recurso, não alerta inimigos e não muda resultado.
3. Ausência ou corrupção de storage nunca impede a run.
4. Uma posição ruim produz ausência, não worldgen adulterado.
5. Mesma seed só significa mesma coordenada quando a topologia ainda é compatível.
6. Nenhum nome ou texto livre de jogador é persistido.
7. A etapa local não inventa uma relação entre causa e posição no co-op.

## Etapa 1 — cápsulas locais

### Captura

A cápsula é capturada somente para runs solo terminadas em morte e contém:

- seed e setor;
- dimensões do mapa;
- célula original e direção do corpo;
- causa autoritativa do `RunSummary`;
- progresso relativo entre entrada e objetivo;
- abertura da vizinhança 3×3;
- superfície sob a morte;
- proximidade de minério;
- ticks da run;
- versões de simulação e conteúdo que produziram a topologia.

O storage é separado do estado autoritativo, limitado às mortes recentes e tolerante a dados inválidos.

### Projeção

Para cada setor, no máximo um eco é escolhido. A coordenada original é usada somente quando seed, dimensões e versões correspondem e a célula continua segura. Caso contrário, a cápsula é reprojetada para uma célula topologicamente semelhante.

São excluídas células próximas de:

- entrada;
- objetivo;
- Guardião ou Bispo;
- inimigos;
- terminais e cofres.

As candidatas recebem uma pontuação por:

- diferença de progresso;
- diferença de abertura;
- compatibilidade de superfície;
- proximidade de minério;
- desempate determinístico por seed, eco e índice da célula.

A coordenada original só pode ser reutilizada quando seed, dimensões, `SIMULATION_VERSION`
e `CONTENT_VERSION` ainda correspondem. Storage legado ou uma versão anterior continua
válido para reprojeção topológica, mas nunca recebe a classificação `exact`.

Nenhuma candidata aceitável significa nenhum eco.

### Apresentação

- no máximo uma carcaça local por setor;
- Prospector na pose final de morte, com tint enferrujado;
- o corpo respeita a iluminação dinâmica do mundo; somente o pulso curto da caixa-preta permanece emissivo no escuro;
- caixa-preta emissiva curta e legível;
- ao se aproximar, mostrar a causa da morte sem cobrir o HUD ou sair das safe areas;
- nenhuma colisão, loot, alerta ou alteração da simulação.

## Etapa 2 — pool comunitário

Somente ecos provenientes de simulação autoritativa podem entrar no pool:

- co-op: o servidor já simulou a run e pode associar causa e corpo corretos;
- solo: apenas depois de re-simular o command log.

O servidor armazena cápsulas sem PII e entrega uma amostra limitada. O cliente continua reprojetando-as localmente enquanto forem visuais.

## Etapa 3 — contrato de seed compartilhada

Uma seed diária ou semanal produz os mesmos três setores para todos. Nesse modo, ecos podem usar a coordenada real quando ela continuar válida.

No modo ranqueado, permanecem informativos. Muitas mortes próximas são agregadas para evitar um cemitério de entidades.
