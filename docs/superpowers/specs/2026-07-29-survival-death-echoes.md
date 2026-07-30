# Voxelyn Survival — Ecos do Veio

## Objetivo

Popular descidas procedurais com restos de Prospectores mortos em runs anteriores sem transformar o mapa em layout fixo e sem quebrar o contrato autoritativo de `seed + comandos`.

O sistema preserva a **posição narrativa** da morte, não apenas a coordenada. Em runs comuns, a carcaça é reprojetada para uma célula que cumpre função topológica semelhante. Em contratos de seed compartilhada, uma etapa futura poderá usar a coordenada real.

## Invariantes

1. O worldgen nunca abre, fecha ou desloca terreno para acomodar um eco.
2. Um eco nunca bloqueia movimento, ocupa spawn ou substitui objetivo, terminal, cofre ou chefe.
3. Conteúdo visual não entra em `SurvivalState`, hash, protocolo ou replay.
4. Qualquer versão futura que conceda recurso ou altere inimigos deve existir em manifesto imutável escolhido antes do tick zero.
5. A ausência de storage ou rede nunca impede iniciar ou jogar uma run.
6. Nenhum texto livre ou identidade pessoal de jogador entra no sistema.
7. A morte deve ensinar: a caixa-preta mostra causa autoritativa, nunca uma inferência do cliente.

## Etapa 1 — restos locais, somente visuais

### Registro

Ao terminar uma run **solo** em morte, o cliente salva uma cápsula separada de `voxelyn.records`:

- identidade estável da run;
- seed e setor;
- célula original e direção final;
- progresso topológico quantizado entre entrada e objetivo;
- abertura local;
- superfície sob o corpo;
- proximidade de minério;
- causa autoritativa da morte;
- tick terminal.

O histórico é limitado e tolera storage ausente ou corrompido.

O co-op fica fora desta etapa por uma razão de verdade narrativa, não de conveniência: o `RunSummary` atual registra a causa que encerrou a **sala**, mas não associa causa, posição e direção por slot. Usar a posição do jogador local com a causa do último parceiro a cair fabricaria um acontecimento que não ocorreu. A etapa comunitária deve persistir esses campos juntos no servidor.

### Projeção

Depois de o setor estar completamente criado, o cliente procura células abertas e alcançáveis. São excluídas áreas próximas de:

- entrada;
- poço/núcleo;
- Guardião ou Bispo;
- inimigos;
- terminais e cofres.

As candidatas recebem uma pontuação por:

- diferença de progresso;
- diferença de abertura;
- compatibilidade de superfície;
- proximidade de minério;
- desempate determinístico por seed, eco e índice da célula.

Nenhuma candidata aceitável significa nenhum eco.

### Apresentação

- no máximo uma carcaça local por setor;
- Prospector na pose final de morte, com tint enferrujado;
- caixa-preta emissiva curta e legível;
- ao se aproximar, mostrar a causa da morte;
- nenhuma colisão, loot, alerta ou alteração da simulação.

## Etapa 2 — pool comunitário

Somente ecos provenientes de simulação autoritativa podem entrar no pool:

- co-op: o servidor já simulou a run e pode associar causa e corpo corretos;
- solo: apenas depois de re-simular o command log.

O servidor armazena cápsulas sem PII e entrega uma amostra limitada. O cliente continua reprojetando-as localmente enquanto forem visuais.

## Etapa 3 — contrato de seed compartilhada

Uma seed diária ou semanal produz os mesmos três setores para todos. Nesse modo, ecos podem usar a coordenada real quando ela continuar válida.

No modo ranqueado, permanecem informativos. Muitas mortes próximas são agregadas para evitar um cemitério de entidades.

## Etapa 4 — recuperação com gameplay

Só entra depois de existir `RunManifest` imutável:

```ts
type RunManifest = {
  version: 1;
  seed: number;
  echoManifestId: string;
  echoes: Array<{
    echoId: string;
    sector: number;
    cell: number;
    moduleId: ModuleId | null;
    contaminationCost: number;
  }>;
};
```

A verificação passa a usar `seed + comandos + echoManifestId`. O pool comunitário nunca é consultado novamente durante replay.

## Entrega deste PR

Este PR deve fechar a Etapa 1 antes de avançar:

1. cápsula, storage e deduplicação puros, com testes;
2. projeção topológica determinística, com testes de reservas e fallback;
3. render da carcaça e leitura por proximidade;
4. captura local solo, sem protocolo novo;
5. build, suítes Survival, offline check e revisão Codex limpa.

As Etapas 2–4 ficam explicitamente fora do diff enquanto a experiência visual local não estiver provada.
