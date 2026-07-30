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

Somente ecos provenientes de simulação autoritativa entram no pool. Há exatamente duas portas.

**Co-op.** O servidor já simulou a morte e é o único que consegue associar causa e corpo: `summary.deathCause` descreve o que encerrou a SALA, mas `playerExtras[slot].lastDamage` descreve o que matou aquele Prospector. A captura acontece no MESMO tick da morte, e não no fim da run — `descend` reposiciona todos os jogadores na entrada do mapa novo, inclusive os mortos, então uma captura tardia leria a coordenada do setor 3 para quem morreu no setor 1.

O co-op não contribui rastro. Reconstruí-lo exigiria amostrar a posição de cada slot a cada dois ticks dentro do laço autoritativo, e o holograma não vale custo no caminho que roda a 20 Hz para todas as salas. O que o co-op contribui é a associação causa↔posição, que é a parte que o cliente não consegue provar sozinho.

**Solo.** Apenas depois de re-simular o command log. O cliente manda a seed e o que pressionou; o servidor descobre sozinho onde e de que o Prospector morreu, e constrói a cápsula com a própria topologia. Não existe campo de posição, de causa nem de topologia para preencher — logo não existe o que mentir. Uma cápsula enviada pronta seria uma afirmação do cliente sobre o mundo, e o pool perderia para sempre o direito de um dia conceder qualquer coisa.

O rastro do solo também sai da re-simulação, e é autoritativo de graça: a simulação já teve de percorrer aqueles ticks. O passo dele vem do TICK e não do relógio de quadro, então viaja dentro da cápsula em `stepMs` — o consumidor lê o campo em vez de presumir qualquer um dos dois.

### Fração determinística

Uma em quatro mortes verificadas entra no pool. O ranking recebe só quem extraiu; o pool receberia a maioria esmagadora das runs, e a spec já pedia uma amostra em vez de todas.

O portão decide sobre o **digest canônico**, depois da verificação. A primeira versão decidia antes, sobre o comprimento e o começo do Base64 cru, e era grátis de burlar: bastava anexar blocos de comando válidos depois do tick terminal até cair num comprimento que passasse. A re-simulação para no tick terminal e a canonicalização apaga a cauda, então todas as variantes davam a mesma morte e o mesmo digest — o portão decidia sobre bytes que não faziam parte da run.

A fração guarda **storage, não CPU**. Qualquer portão que o cliente consiga calcular é moído por um cliente que simule localmente, e todo cliente simula — é a mesma simulação. A CPU é protegida pelo limite por origem e pelo orçamento de uma re-simulação concorrente, que não dependem de nada que o cliente escolha. Fingir o contrário custaria a três quartos das mortes honestas a chance de virar carcaça, em troca de uma barreira que se atravessa com padding.

O hash usa o finalizador do murmur3 sobre o FNV-1a — sem ele, `% 4` lê os bits baixos do FNV, que distribuem mal, e a taxa medida ia de 11% a 31% conforme a entrada.

### Armazenamento

Tabela `death_echoes`, SEPARADA do leaderboard e da telemetria. O repositório já distingue dado competitivo verificado de dado diagnóstico não verificado, e um eco com recompensa não pode nascer de telemetria arbitrária; misturar as três apagaria essa fronteira no dia em que a Etapa 4 fizer um eco valer uma carga de módulo.

Colunas explícitas em vez do `topology_signature` empacotado que o esboço previa: custam o mesmo e permitem responder no console do banco as perguntas que a operação faz — em que profundidade as pessoas morrem, quantas mortes em biofluido — sem decodificar um inteiro à mão. `seed`, dimensões, célula e direção não são opcionais: sem elas a cápsula não pode ser reconstruída, e sem seed o contrato coletivo perde a coordenada real.

Deduplicação pela run de origem, no banco e não na aplicação: duas instâncias ou dois POSTs simultâneos correriam entre o "já existe?" e o insert, e o índice único é a única barreira sem janela.

A identidade de uma morte de co-op carrega um nonce da INSTÂNCIA. Sala, setor, tick e slot não bastam: `seedCounter` volta a zero em cada boot e `baseSeed` é o mesmo, então a primeira sala depois de dois deploys recebe a mesma seed, um jogador parado morre de contaminação no mesmo tick e no mesmo slot, e a segunda morte — legítima — bate na restrição de unicidade e desaparece do pool. Duas instâncias com a mesma `baseSeed` têm o problema idêntico.

A amostra devolve os MENOS manifestados primeiro. Não é aleatória: aleatório concentraria exposição por azar e tornaria a amostra irreprodutível em teste. Menos manifestado primeiro espalha a exposição sozinho e caminha para a expiração — depois de manifestado algumas vezes o eco sai do pool, porque uma carcaça que reaparece indefinidamente deixa de ser ocorrência e vira mobília.

### Limites

Mortes com menos de 15 segundos não entram: quem morreu nos primeiros segundos não tem história, e a carcaça diria apenas "alguém entrou e morreu". Nenhum texto livre de jogador é persistido, e o id da cápsula é derivado do digest — anônimo por construção, e é dele que sai o serial que o jogador lê.

O orçamento de re-simulação é UM para o processo inteiro, compartilhado com o ranking: as duas rotas disputam o mesmo event loop que roda o tick autoritativo. A consulta que recusa antes de ler o corpo é separada da reserva, e a reserva fica colada ao `try` — uma reserva feita cedo teria de ser liberada em cada retorno antecipado, e esquecer um deles transforma a rota em 503 permanente.

### Mesclagem no cliente

A memória local vem sempre PRIMEIRO na disputa pelas células do setor: a run em que o jogador morreu ontem diz mais a ele do que a de um estranho. O pool preenche o resto, até quatro corpos por setor. Duplicatas por id são removidas — o pool pode devolver a cápsula que este mesmo cliente enviou, e o próprio corpo aparecendo duas vezes leria como defeito.

**Todos os quatro corpos são auditáveis.** A spec §7 fala de "um eco interativo por setor", e esse limite pertence à RECUPERAÇÃO de módulo (Etapa 4), que muda a run: dois módulos herdados por setor seria economia, não arqueologia. Auditar não custa nada — não concede recurso, não alerta ninguém, não entra no hash — e uma carcaça que ignora o botão usar, parada ao lado de outra que responde e sem nenhuma diferença visível, lê como defeito. O que §7 protege de fato é o número de CORPOS, e esse teto é respeitado.

O pool chega por HTTP DEPOIS do tick zero, e isso é seguro precisamente porque eco é apresentação: não entra em `SurvivalState`, no hash nem no replay. Uma cápsula que atrasou aparece um pouco depois no chão e nada mais acontece. No dia em que um eco der módulo, este caminho deixa de servir.

O pool é pedido uma vez por setor, porque a resposta CONTA uma manifestação de cada cápsula devolvida: refazer o pedido a cada quadro queimaria o pool inteiro em segundos.

## Etapa 3 — Desafio Semanal (seed compartilhada)

**Dois nomes, de propósito.** No código e no wire ele é um `contract`, porque é isso que a companhia emite — a mesma voz de «Unidade de Prospecção 7B-119». Para o jogador ele é o **DESAFIO SEMANAL**, porque o que ele precisa entender ao bater o olho no menu é que existe um evento de comunidade acontecendo agora, e não que recebeu mais uma ordem de serviço. A empresa emite contratos; a comunidade joga desafios.

A cadência padrão é **semanal**. Um desafio diário troca de mapa antes de a comunidade formar memória sobre ele: as primeiras cápsulas de hoje só existem depois que alguém morreu hoje, e à noite o mapa some. Uma semana dá tempo de o chão encher de gente — que é a experiência inteira do modo — e transforma "eu também morri ali" numa conversa que dura mais que um dia. A cadência diária continua disponível em `?cadence=daily` para operação e teste.

Uma seed semanal (ou diária) produz os mesmos três setores para todos. A implementação inteira é fixar `forcedSeed`: não há mundo persistido, servidor de terreno nem estado compartilhado, porque a run já era reproduzível por um número e os três setores já derivavam dele. Publicar o número basta — e é essa economia que faz o contrato valer a pena.

O id e a seed vêm do CALENDÁRIO, em UTC, e não são sorteados nem guardados. Duas instâncias do servidor, um cliente offline e um teste chegam ao mesmo contrato para o mesmo instante sem trocar uma palavra, e um contrato que dependesse de uma linha no banco morreria com ela. A cadência semanal usa semana ISO-8601 completa: uma regra caseira pularia ou repetiria na virada de ano, que é justamente quando alguém está olhando.

O cliente NÃO confia na seed anunciada: recebe o id e recalcula. Um servidor comprometido — ou uma resposta em cache de outro dia — poderia anunciar o id de hoje com a seed de ontem, e todo mundo naquele contrato jogaria mapas diferentes achando que jogava o mesmo.

Dentro do contrato o pool é consultado POR SEED. É isso que devolve as cápsulas daquele mapa exato, e elas projetam como `exact` porque seed, dimensões e versões correspondem: a experiência muda de "alguém morreu numa situação parecida com esta" para "alguém morreu exatamente aqui".

O contrato ANUNCIADO e o contrato EM VIGOR nesta run são coisas separadas. O primeiro é o cartaz na parede; só o segundo estreita a consulta. Enquanto eram a mesma variável, toda descida comum com servidor alcançável caía no ramo filtrado por seed — o pool geral nunca era consultado, e quem nunca tocou no contrato recebia apenas as cápsulas daquele mapa. A modalidade é declarada por quem INICIA a run, nunca herdada do que o servidor anunciou.

### Agrupamento

Com coordenadas reais e todo mundo no mesmo mapa, a mesma câmara letal acumula dezenas de cápsulas — e cinquenta carcaças no mesmo lugar deixam de ser aviso e viram cemitério. Mortes dentro de seis tiles colapsam num corpo que conta quantas foram.

**O agrupamento roda ANTES da projeção**, e a ordem é o ponto inteiro. Agrupar depois significaria agrupar o que sobrou do teto de corpos: vinte cápsulas da mesma câmara viravam quatro corpos, o sobrevivente anunciava no máximo quatro perdas, e as dezesseis descartadas nunca eram contadas. Pior, as que disputavam a mesma célula exata perdiam a disputa e eram espalhadas para células topológicas sem relação nenhuma — o contrato produzia corpos em lugares onde ninguém morreu. Agrupando antes, o teto passa a valer para CÂMARAS, que é o que "no máximo quatro corpos por setor" sempre quis dizer.

Só agrupa o que veio do mesmo mundo. Duas cápsulas de seeds diferentes têm células de origem sem relação, e aproximá-las por coordenada seria comparar endereços de cidades diferentes.

O sobrevivente é o PRIMEIRO da lista, não uma média: um corpo inventado no centro de massa não morreu em lugar nenhum. Ele passa a representar as outras, e o painel diz "causa predominante" em vez de "a causa", porque a causa narrada continua sendo a de uma morte real.

### Ranqueado significa informativo

O contrato nasce ranqueado, e ranqueado exige que ecos exatos permaneçam visuais. Se dessem módulo ou mudassem inimigos, quem entrasse à noite jogaria contra um mapa diferente de quem jogou de manhã, e o placar compararia duas coisas que não são a mesma.

A garantia é estrutural e não uma regra a lembrar: nada em `PlacedDeathEcho` concede recurso. Um teste afirma a ausência dos campos de recompensa para quebrar no dia em que alguém adicionar um.

## Etapa 4 — herança de módulo

Recuperar o módulo danificado é a primeira interação do eco que muda a run, e por isso é a primeira que sai deste caminho.

Um eco que concede carga, cobra contaminação e emite alerta deixa de ser apresentação: ele entra no `SurvivalState`, no hash autoritativo e no replay. Isso exige um `RunManifest` imutável escolhido antes do tick zero, verificado por `seed + comandos + echoManifestId`, e o pool comunitário não pode ser consultado de novo durante a re-simulação — ele pode ter mudado.

O que já existe e essa etapa reaproveita:

- o pareamento como ato explícito, com custo e recompensa anunciados antes do aperto;
- o laudo, que já mostra o que a carcaça carregava.

O que falta é inteiramente autoritativo: manifesto, campo de módulo na cápsula, e o custo aplicado pela simulação — nunca pelo cliente.
