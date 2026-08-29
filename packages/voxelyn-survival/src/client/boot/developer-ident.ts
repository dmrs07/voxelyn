// A IDENTIDADE DO DESENVOLVEDOR — o slot, e o que ele deliberadamente NAO e.
//
// A primeira tela da abertura pertence a quem FEZ o jogo. Isso e diferente de
// tudo o que o resto do pacote diz, e a distincao precisa ficar escrita aqui
// porque e facil de errar:
//
//   AURIX DYNAMICS e a companhia FICTICIA do jogo. Ela emprega o Prospector,
//   assina a Ordem de Despacho, publica o contrato semanal e carimba a key
//   art. E ficcao — parte do mundo, como o Veio e os Nucleos. `aurix.ts` e a
//   marca DELA.
//
//   A identidade do desenvolvedor e a pessoa real que faz o jogo. Ela nao
//   aparece em lugar nenhum do repositorio ainda, e por isso este arquivo
//   existe: para receber essa marca sem que ninguem precise procurar onde
//   mexer, e para que, ate la, o jogo nao finja ter um estudio que nao tem.
//
// COMO PREENCHER, quando a marca existir:
//
//   1. ponha o arquivo em `public/ident/` (SVG de preferencia — escala sem
//      borrar do celular ao 4K; PNG com fundo transparente tambem serve);
//   2. escreva `name` e `markUrl` abaixo;
//   3. acrescente o arquivo a lista `OPTIONAL` de `public/sw.js`, junto da key
//      art e da trilha — e o que faz a abertura funcionar offline no PWA;
//   4. se o arquivo for o unico assunto da tela, `name` pode ficar vazio: a
//      tipografia some e sobra so a marca.
//
// O passo a passo completo, com tamanhos e tempos, esta em
// `public/ident/README.md`.
//
// Nada mais precisa mudar. A tela, o tempo e a ordem das fases continuam os
// mesmos.
//
// ENQUANTO ELA NAO EXISTE, o comportamento e explicito e nao um acidente: sem
// nome e sem asset, a fase de identidade dura ZERO e a abertura comeca direto
// na tela de carregamento (ver `bootTiming`). Melhor pular uma tela do que
// segurar o jogador dois segundos diante de um espaco vazio — ou, pior, diante
// da marca de uma empresa que so existe dentro do jogo.

/** Caminho do asset, relativo a base do app (vite `base: './'`). */
export type DeveloperIdent = {
  /**
   * O nome que aparece sob a marca. Vazio = sem tipografia.
   *
   * NAO invente um nome aqui. Um estudio que nao existe na tela de abertura e
   * pior do que nenhuma tela de abertura.
   */
  name: string;
  /**
   * O arquivo da marca em `public/`. Vazio = sem imagem.
   *
   * Carregado como tarefa NAO critica do preload: se o arquivo faltar ou nao
   * decodificar, a tela cai na tipografia e a abertura segue — nenhum caminho
   * do boot depende deste asset.
   */
  markUrl: string;
  /** Texto alternativo da marca, para leitor de tela. */
  markAlt?: string;
};

/**
 * A identidade em vigor.
 *
 * `name` esta vazio de proposito: a marca fala sozinha, e a tela fica com o
 * desenho no centro do preto e nada mais. Preencher o nome e escrever a string
 * aqui — a tipografia aparece sob a marca sem nenhuma outra mudanca.
 *
 * O arquivo e produzido por `pnpm ident:prepare` a partir da arte versionada
 * em `docs/art/ident/`: o script recorta o fundo branco por inundacao, apara a
 * moldura vazia e reduz para 512 px em WebP (~32 KB). Ver
 * `scripts/prepare-developer-ident.mjs`.
 */
export const DEVELOPER_IDENT: DeveloperIdent = {
  name: '',
  markUrl: 'ident/developer-mark.webp',
};

/**
 * Ha identidade para apresentar?
 *
 * `false` faz a fase de identidade durar zero — a abertura comeca na tela de
 * carregamento, sem tela preta vazia e sem marca emprestada.
 */
export const hasDeveloperIdent = (ident: DeveloperIdent = DEVELOPER_IDENT): boolean =>
  ident.name.trim().length > 0 || ident.markUrl.trim().length > 0;
