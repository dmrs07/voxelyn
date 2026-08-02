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
// 16: INERCIA DO GELO — sobre SURF_ICE o movimento do jogador carrega
// embalo (ICE_GLIDE): o rumo novo entra aos poucos e soltar o direcional
// desliza. Fora do gelo o passo e byte a byte o historico, mas dois peers
// em versoes diferentes divergiriam na primeira pisada da Cripta. E a
// SILICA ganha FRATURA POR CAMADA (quebrar fragil enfraquece os vizinhos
// frageis da mesma faixa horizontal) + SEAMS de minerio no worldgen — a
// geracao e a fisica dos setores sedimentares mudam juntas nesta versao.
// Ainda em 16 (mesma leva, nunca lancada separada): o ESTRATO FERRIFERO —
// a linhagem industrial re-trilhada (basalto -> ferrifero -> ferrifero),
// seams + nos de minerio, minerCap alto e conducao por parede
// (FERRIC_VEIN_SCALE) — e o pedestal do poco por estrato no worldgen. E a
// ARMADILHA DE CARRINHO: tramos SURF_RAIL/SURF_RAIL_V no worldgen da
// operacao (Aurix/ferrifero), gatilho por pisada com telegrafo
// (cart_warning) e o carrinho como projetil hostil (kind 'cart') que
// atropela jogador E bicho sem morrer no impacto. E a EXTRACAO DE
// RETORNO: com o Nucleo o poco sela, a entrada de setor profundo vira
// portal de SUBIDA (ascend — mundo regenerado da mesma seed, fauna
// repovoada, contaminacao sem alivio) e a vitoria so fecha na plataforma
// do setor 1.
// 17: FAUNA AFINADA POR BIOMA e a memoria de chefe abatido.
// - Chefe morto NAO repovoa: a extracao de retorno regenera o setor na
//   subida, e o repovoamento carimbava o Bispo de volta na camara — a
//   conquista mais cara da run desmanchando sozinha. `bossesDown` (mascara
//   por setor) entra no estado e no hash autoritativo.
// - Bandos de assinatura: cada estrato passa a receber VARIOS exemplares do
//   proprio bicho (SIGNATURE_PACK), ocupando vagas comuns — a densidade nao
//   muda, muda quem a preenche. A populacao semeada de todo setor 2+ muda.
// - BOMBARDEIRO DE ENXOFRE: onde nao ha micelio (Fenda e Fornalha) o Spore
//   Bomber some da mistura e entra o de enxofre, que estoura em GAS — e gas,
//   ao contrario de esporo, pega fogo.
// - COVEIRO: assinatura do Ferrifero. Eletroima com telegrafo longo ARRASTA
//   o jogador (passo a passo, respeitando colisao) e a prensa vem em
//   seguida. Primeiro corpo do bestiario que tira do jogador a posicao.
export const SIMULATION_VERSION = 17;
// 11: rocha por estrato no atlas de terreno — seis peles novas da parede
// comum, com fragil/minerio/cristal continuando universais.
// 12: a pele de rocha do Estrato Ferrifero entra no atlas de terreno
// (terrain-blocks v4, kind rockFerric no fim da lista).
// 13: props decorativos VOLUMETRICOS viram modelos voxel no atlas
// world-props (v3, kinds decor:<kind>:<variante>) — fumarolas, monolitos e
// a broca deixam o desenho de runtime (que vira fallback).
// 14: crostas dos TRILHOS da operacao (surface-tiles v6: rail e rail-v) —
// o chao da armadilha de carrinho.
// 15: PORTAIS por bioma no atlas world-props (v4): dez chaves animadas
// portal:<estrato|ocupacao> — todas com a mesma gramatica (boca escura +
// cruz de luzes-guia convergentes) — e o poco SELADO (portal:sealed) da
// extracao de retorno. O `descent` generico vira fallback.
export const CONTENT_VERSION = 15;

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
