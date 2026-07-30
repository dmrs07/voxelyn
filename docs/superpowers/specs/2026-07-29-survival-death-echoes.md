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
8. O eco observa o botão usar; nunca o consome. O comando chega inteiro à simulação.
9. A fog of war revela luzes, nunca silhuetas.

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
- versões de simulação e conteúdo que produziram a topologia;
- o rastro dos últimos segundos, quando a morte durou o bastante para ter um.

O storage é separado do estado autoritativo, limitado às mortes recentes e tolerante a dados inválidos.

### Rastro final

A janela é amostrada pelo relógio, não pelo quadro: até 24 amostras a cada 120 ms, cerca de 2,9 s. Cada amostra guarda deslocamento em oitavos de tile a partir da célula da morte, o octante da mira e se havia disparo em curso.

Uma janela com menos de duas amostras não vira rastro — uma morte de dois quadros não tem história para contar. Um rastro corrompido no storage é descartado sozinho, sem levar junto a carcaça: o corpo e a causa são a parte que ensina, e a reprodução é acessória.

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
- Prospector na pose final de morte, com material e cacos escolhidos pela causa;
- o corpo respeita a iluminação dinâmica do mundo; somente o farol da caixa-preta permanece emissivo no escuro;
- nenhuma colisão, loot, alerta ou alteração da simulação.

#### Carcaça por causa

A causa autoritativa escolhe o corpo antes de escolher o texto. Sete estados, cada um com tint, material de casco e cacos próprios: carbonizada (fogo, superaquecimento), fulminada (descarga), rompida (explosão), esmagada (contato e pedra), corroída (gás e cuspe), colonizada (esporos) e íntegra (apagou no escuro, causa desconhecida).

O laudo aparece no painel com a mesma palavra que o corpo desenha, para o texto confirmar o que o jogador já viu no chão.

#### Farol e fog of war

O farol da caixa-preta é a única coisa que atravessa o escuro. Ele denuncia que há algo ali sem revelar o quê — silhueta, cacos e causa continuam presos à luz do mundo.

A cor do farol não varia com o tipo de morte. Um farol que dissesse "aqui alguém queimou" transformaria a escuridão num mapa de causas, e a caixa-preta existe para ser lida de perto.

A mesma regra vale para o parceiro no co-op: o corpo dele obedece à iluminação como todo o resto do mundo, e o que sobra no escuro é o visor com um halo que cresce conforme a luz cai. O Prospector local nunca some — a câmera está nele.

#### Auditoria pelo botão usar

A transmissão não abre por proximidade. Ao alcance, a carcaça mostra o convite `USAR — PAREAR CAIXA-PRETA`; o mesmo botão que abre terminal e cofre abre o laudo, e um segundo aperto o fecha. Afastar-se além do alcance de transmissão derruba o vínculo, e a descida o encerra junto com o mundo antigo.

O eco **observa** o comando e nunca o consome: `interact` chega inteiro à simulação. Parear com um corpo não pode custar ao jogador o revive, a descida ou a extração que ele pediu no mesmo aperto — e um comando roubado faria a run gravada divergir da run jogada no replay do servidor.

Pareado, o painel traz serial corporativo, laudo da carcaça, causa e a linha de lição, sem cobrir o HUD nem sair das safe areas. O serial é derivado do id do eco — dá identidade ao corpo sem identificar ninguém, e mantém a invariante 6 intacta. Junto dele, o holograma reproduz os últimos segundos em laço: o trajeto inteiro fraco ao fundo, as marcas de cada disparo e a sombra do Prospector com a direção da mira.

O holograma não desenha o inimigo. A cápsula guarda a causa, não a posição de quem matou. Num eco reprojetado o trajeto pode atravessar uma parede do mapa atual: ele é a transmissão de outro lugar, não um fantasma preso a esta geometria.

O ato de parear é a base das etapas seguintes — é ele que a recuperação de módulo vai custar em contaminação e alerta.

## Etapa 2 — pool comunitário

Somente ecos provenientes de simulação autoritativa podem entrar no pool:

- co-op: o servidor já simulou a run e pode associar causa e corpo corretos;
- solo: apenas depois de re-simular o command log.

O servidor armazena cápsulas sem PII e entrega uma amostra limitada. O cliente continua reprojetando-as localmente enquanto forem visuais.

## Etapa 3 — contrato de seed compartilhada

Uma seed diária ou semanal produz os mesmos três setores para todos. Nesse modo, ecos podem usar a coordenada real quando ela continuar válida.

No modo ranqueado, permanecem informativos. Muitas mortes próximas são agregadas para evitar um cemitério de entidades.

## Etapa 4 — herança de módulo

Recuperar o módulo danificado é a primeira interação do eco que muda a run, e por isso é a primeira que sai deste caminho.

Um eco que concede carga, cobra contaminação e emite alerta deixa de ser apresentação: ele entra no `SurvivalState`, no hash autoritativo e no replay. Isso exige um `RunManifest` imutável escolhido antes do tick zero, verificado por `seed + comandos + echoManifestId`, e o pool comunitário não pode ser consultado de novo durante a re-simulação — ele pode ter mudado.

O que já existe e essa etapa reaproveita:

- o pareamento como ato explícito, com custo e recompensa anunciados antes do aperto;
- o laudo, que já mostra o que a carcaça carregava.

O que falta é inteiramente autoritativo: manifesto, campo de módulo na cápsula, e o custo aplicado pela simulação — nunca pelo cliente.
