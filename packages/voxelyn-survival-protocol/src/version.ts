// Versoes de compatibilidade transmitidas em todo handshake e snapshot.
// Regras:
// - PROTOCOL_VERSION muda quando o formato das mensagens muda (quebra de wire).
// - SIMULATION_VERSION muda quando a logica autoritativa muda de forma que altera
//   hashes deterministicos (cliente e servidor precisam concordar para prever/interpolar).
// - CONTENT_VERSION muda quando itens/criaturas/materiais mudam (pool de conteudo).
// 11: eventos `message` passam a viajar como CHAVE de catalogo (`key`) e nao
// como frase pronta (`text`). E quebra de wire nos dois sentidos: um cliente
// novo contra servidor antigo leria `key` ausente e mostraria o aviso em
// branco, e um cliente antigo contra servidor novo procuraria `text`. Sem o
// bump, o handshake aceitaria os dois pares e o defeito apareceria como um
// aviso vazio no meio do co-op, em vez de uma recusa explicita na conexao.
export const PROTOCOL_VERSION = 11;
// 14: sistema de biomas — estratos/ocupacoes/linhagens mudam a geracao semeada
// dos setores 2+ e a populacao de inimigos; agua/brasa/gelo mudam reacoes de
// celula; cinco arquetipos de assinatura entram na simulacao e no hash de
// kills. Dois peers em versoes diferentes gerariam MUNDOS diferentes da mesma
// seed — a recusa tem de acontecer no handshake, nao como divergencia de hash
// no minuto tres. (O protocolo em si nao muda: o envelope das mensagens e o
// mesmo, e os campos novos de `sector_entered` viajam dentro de um evento cujo
// par de versoes de sim ja garante que ambos os lados conhecem.)
// 15: a Lampreia vira bando (tres por setor de Aquifero), as vagas de
// assinatura derivam do orcamento real do setor, e os estratos ganham
// ESTRUTURAS DE SALAO no worldgen (rotunda, pulmoes, canions, bacias,
// sumidouros, lagos) — a geracao semeada dos setores 2+ muda de novo.
export const SIMULATION_VERSION = 15;
// 11: rocha por estrato no atlas de terreno — seis peles novas da parede
// comum, com fragil/minerio/cristal continuando universais.
export const CONTENT_VERSION = 11;

export type VersionTriple = {
  protocolVersion: number;
  simulationVersion: number;
  contentVersion: number;
};

export const CURRENT_VERSIONS: VersionTriple = {
  protocolVersion: PROTOCOL_VERSION,
  simulationVersion: SIMULATION_VERSION,
  contentVersion: CONTENT_VERSION,
};

export type VersionCheck =
  | { ok: true }
  | { ok: false; reason: string; field: keyof VersionTriple };

/** O protocol precisa casar exatamente; sim/content sao avaliados pelo chamador. */
export const checkProtocolVersion = (incoming: Partial<VersionTriple>): VersionCheck => {
  if (incoming.protocolVersion !== PROTOCOL_VERSION) {
    return {
      ok: false,
      field: 'protocolVersion',
      reason: `protocolVersion ${incoming.protocolVersion ?? 'ausente'} != ${PROTOCOL_VERSION}`,
    };
  }
  if (incoming.simulationVersion !== SIMULATION_VERSION) {
    return {
      ok: false,
      field: 'simulationVersion',
      reason: `simulationVersion ${incoming.simulationVersion ?? 'ausente'} != ${SIMULATION_VERSION}`,
    };
  }
  if (incoming.contentVersion !== CONTENT_VERSION) {
    return {
      ok: false,
      field: 'contentVersion',
      reason: `contentVersion ${incoming.contentVersion ?? 'ausente'} != ${CONTENT_VERSION}`,
    };
  }
  return { ok: true };
};
