# Ativos de assinatura — milestones de Persistência Mnêmica

**Data:** 2026-08-04  
**Base:** `claude/codex-narrativo-ia-trail-q8plat`  
**Escopo:** `voxelyn-survival-server` e catálogo narrativo compartilhado pelo cliente

---

## 1. Decisão

O arco do Corcel Fúngico deixa de ser uma exceção isolada e passa a estabelecer
uma regra do mundo: o Veio pode preservar **intenções mentais intensas** e
reconstruí-las usando a matéria do estrato.

A Aurix Dynamics chama o fenômeno, quando precisa nomeá-lo, de **Persistência
Mnêmica Operacional**. Documentos de campo também usam “Eco”, mas nenhum texto
confirma que uma alma ou uma pessoa inteira sobreviveu.

O Veio conserva mais facilmente:

- uma tarefa que alguém se recusou a abandonar;
- uma ordem repetida até a morte;
- um gesto de cuidado sem destino correto;
- um pedido coletivo sem resposta;
- uma rota ou promessa que deixou de existir;
- revolta, culpa, amor e negação.

A matéria determina o corpo. A memória determina o padrão. O resultado pode ser
continuidade, cópia, resíduo, interpretação do observador ou algo novo. Essa
ambiguidade é permanente.

---

## 2. Modelo de progressão

A infraestrutura existente de `LoreUnlockTrigger` já aceita:

```ts
{ kind: 'asset'; archetype: EnemyArchetype; minKills?: number }
```

A ficha corporativa base continua abrindo no primeiro abate confirmado pelo
replay autoritativo. Cada Ativo de assinatura ganha quatro documentos
posteriores:

| Abates acumulados | Função narrativa |
| ---: | --- |
| 1 | ficha corporativa inicial existente |
| 3 | incompatibilidade técnica ou comportamental |
| 6 | antecedente humano documentado |
| 10 | reclassificação, censura ou ordem executiva |
| 15 | documento não classificado que aproxima memória e criatura |

Os limiares são baixos por design. Eles não aparecem na interface e não viram
missão de farming. Saltar de 2 para 15 desbloqueia todos os documentos
intermediários no mesmo settlement.

A contagem vem somente de `assetKills`, acumulada na liquidação re-simulada. O
Registro local e `localStorage` não têm autoridade narrativa.

---

## 3. Arcos

| Ativo | Código de campo | Persistência | Matéria | Comportamento preservado |
| --- | --- | --- | --- | --- |
| Corcel Fúngico | EQ-02 | Major, família e revolta | micélio/fogo | levar a guerra para dentro de um sonho |
| Ressonante | CRIST-01 | grupo soterrado | cristal/som | pedir socorro e reconhecer resposta |
| Lampreia de Lama | AQU-03 | socorrista | lama/água | segurar e conduzir à superfície de um mapa morto |
| Fole | SULF-08 | operadora de ventilação | pressão/calor | continuar respirando por quem já morreu |
| Scoriac | VULC-05 | chefe de segurança | escória/calor | manter uma contenção fechada |
| Espectro Glacial | GLAC-02 | líder de levantamento | gelo/frio | reunir a equipe num ponto que não existe |

### 3.1 Ressonante

Progressão documental:

1. `AX-ENG-017` — formação hostil que responde antes do estímulo;
2. `AX-ENG-019` — a assinatura é o protocolo humano 3–2–3;
3. `AX-INC-035` — um resgate ouviu o padrão e foi cancelado por custo;
4. `AX-EXE-044` — “pedido”, “resposta” e “sobreviventes” são proibidos;
5. `AX-UNK-053` — após a queda do corpo cristalino, as paredes continuam.

O Eco é coletivo. O horror não é provar que os trabalhadores ainda estão ali,
mas descobrir que o Veio aprendeu a forma de pedir socorro.

### 3.2 Lampreia de Lama

1. `AX-PRC-018` — predador aquático que causa perda de carga;
2. `AX-ENG-024` — a preensão procura o ponto estrutural em que uma pessoa
   seguraria;
3. `AX-INC-036` — “segura em mim. Não solta”; duas pessoas, um corpo;
4. `AX-EXE-045` — “resgate” vira termo proibido;
5. `AX-UNK-054` — o arrasto segue antigos poços de acesso já selados.

A criatura pode estar afogando ou tentando salvar. Ela preservou o gesto, mas
não uma superfície válida.

### 3.3 Fole

1. `AX-INC-022` — espécime de pressão descrito como coincidência ambiental;
2. `AX-ENG-026` — cadência idêntica ao ventilador manual VA-7;
3. `AX-INC-037` — a operadora continua a alavanca depois da morte da equipe;
4. `AX-EXE-046` — ventilação de baixas confirmadas é proibida;
5. `AX-UNK-055` — a contagem do Fole começa no número seguinte ao arquivo.

Cada manifestação continua a sequência. Não fica estabelecido se a operadora
persiste ou se só a tarefa encontrou outro corpo.

### 3.4 Scoriac

1. `AX-INC-026` — territorialidade rebaixada por custo regulatório;
2. `AX-ENG-027` — as vedações reproduzem comportas industriais removidas;
3. `AX-INC-038` — “não abram esta porta”; doze trabalhadores do lado isolado;
4. `AX-EXE-047` — a condecoração é revogada e o caso alimenta o classificador;
5. `AX-UNK-056` — a criatura ainda sela o lado pressurizado da antiga porta.

A pergunta permanece: impede a entrada da Aurix ou ainda evita que algo saia?

### 3.5 Espectro Glacial

1. `AX-INC-028` — presença estimada que subtrai calor da leitura;
2. `AX-ENG-028` — aparições seguem a rota L-6 removida dos mapas;
3. `AX-INC-039` — “sigam minha voz”; a chamada continua após a morte da equipe;
4. `AX-EXE-048` — dezessete minutos são classificados como buffer de onze
   segundos;
5. `AX-UNK-057` — a voz substitui os nomes antigos por IDs recém-atribuídos.

O fenômeno não apenas repete: adapta a chamada ao observador atual.

---

## 4. Catálogo e cronologia

A branch-base possui 68 documentos. A entrega acrescenta 20 milestones de
Ativo, resultando em **88 documentos**:

- 1 público;
- 30 protocolos;
- 4 marcos geracionais;
- 15 fichas base de Ativo;
- 24 milestones de Ativo, incluindo os 4 do Corcel;
- 13 documentos de Descoberta;
- 1 documento composto.

Os novos códigos ocupam os atos existentes:

- engenharia: `AX-ENG-019`, `024`, `026`, `027`, `028`;
- incidente: `AX-INC-035` a `039`;
- executivo: `AX-EXE-044` a `048`;
- não classificado: `AX-UNK-053` a `057`.

A cronologia continua editorial e global. Ordem de desbloqueio não altera a
posição do documento no arquivo.

---

## 5. Relações

Cada ficha base aponta para a incompatibilidade técnica. Cada documento aponta
para o passo seguinte do próprio arco e os finais se relacionam com:

- o Major e o Corcel (`AX-UNK-046`);
- atividade após perda estrutural (`AX-INC-027`);
- rotas impossíveis (`AX-UNK-044`);
- respostas entre Eco e reator (`AX-UNK-047`);
- a linha de continuidade G-04;
- classificação de ameaça e contenção.

Relacionados bloqueados continuam mascarados. O mapa de relações não deve
revelar título, categoria ou condição futura.

---

## 6. Interface

Nenhuma nova UI específica é necessária. O mecanismo existente já:

- inclui todo fragmento desbloqueado cujo gatilho menciona o arquétipo no índice
  `Ver docs`;
- filtra o Codex pelo Ativo;
- mostra bolinha quando algum documento relacionado está não lido;
- marca apenas o documento efetivamente aberto;
- preserva retorno ao Registro.

A interface nunca mostra `minKills`, próximo marco ou porcentagem do arco.

---

## 7. Invariantes e testes

A entrega deve garantir:

- 20 novos IDs únicos;
- quatro milestones por Ativo, nos limiares 3, 6, 10 e 15;
- todo ID com texto completo em `pt-BR` e `en`;
- cronologia cobrindo os 88 documentos exatamente uma vez;
- relações apontando apenas para IDs existentes;
- desbloqueio um abate antes permanecendo fechado;
- cruzamento múltiplo liberando todos os intermediários;
- abates de um arquétipo não atravessando outro arco;
- settlement idempotente por `runId`;
- documentos novos nascendo não lidos;
- índice `Ver docs` contendo todos os documentos já abertos do Ativo.

---

## 8. Fora de escopo

- novas mecânicas de combate;
- mudança de balanceamento dos Ativos;
- falas ou cutscenes;
- voice acting;
- confirmação de que o Veio guarda almas;
- transformar todo inimigo em identidade humana recuperável;
- exibir progresso de farming.

Detalhes sonoros ou visuais podem ser adicionados futuramente, mas a história
precisa funcionar somente pelos documentos e pelo comportamento que já existe.
