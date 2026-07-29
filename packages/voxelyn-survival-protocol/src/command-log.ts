// Codificacao do log de comandos de uma run.
//
// Existe por causa do leaderboard. A regra que o desenho inteiro serve e uma
// so: O CLIENTE NUNCA SUBMETE UM RESULTADO. Ele submete a seed e o que
// PRESSIONOU; o servidor re-simula e descobre sozinho o que aconteceu. Forjar
// uma pontuacao passa a exigir forjar uma sequencia de comandos que realmente
// produza aquele resultado — o que e a mesma coisa que jogar bem.
//
// Isso so funciona porque a simulacao e deterministica por seed + comandos, o
// que o repositorio ja garantia e testava. O leaderboard nao adiciona
// confianca nenhuma ao cliente; ele apenas colhe o que a sim ja sabia provar.
//
// ---------------------------------------------------------------------------
// A DECISAO CRITICA: quantizar na CAPTURA, nao no envio.
// ---------------------------------------------------------------------------
// `aim` e um vetor de float vindo do mouse ou do joystick. Codificar em int8 na
// hora de enviar produziria um log que, re-simulado, diverge do que o jogador
// viveu: um tiro que passou raspando no original erra no replay, e a run
// honesta e recusada como fraude. Por isso `quantizeCommand` e aplicado ao
// comando ANTES de ele entrar em `stepRun` no cliente. O jogador joga com o
// mesmo comando que o servidor vai reproduzir, e o replay e exato por
// construcao em vez de por sorte.
//
// A perda de precisao e irrelevante para o jogo: 1/127 de um vetor unitario e
// muito menor que a largura de um pixel na mira.

import type { PlayerCommand } from '@voxelyn/survival-sim';

/** Bytes por comando no formato nao comprimido. */
export const COMMAND_BYTES = 5;

const FLAG_FIRE = 1 << 0;
const FLAG_ABILITY = 1 << 1;
const FLAG_DODGE = 1 << 2;
const FLAG_INTERACT = 1 << 3;
const FLAG_PURGE = 1 << 4;
/** Dois bits para `choose`: 0 = null, 1 = opcao 0, 2 = opcao 1. */
const CHOOSE_SHIFT = 5;

const q = (v: number): number => {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-127, Math.min(127, Math.round(v * 127)));
};
const dq = (v: number): number => v / 127;

/**
 * Devolve o comando como ele sera gravado e reproduzido.
 *
 * O cliente DEVE passar o resultado disto para a propria simulacao. Ver o
 * cabecalho do arquivo: e o que torna o replay exato.
 */
export const quantizeCommand = (cmd: PlayerCommand): PlayerCommand => ({
  move: { x: dq(q(cmd.move.x)), y: dq(q(cmd.move.y)) },
  aim: { x: dq(q(cmd.aim.x)), y: dq(q(cmd.aim.y)) },
  fire: cmd.fire,
  ability: cmd.ability,
  dodge: cmd.dodge,
  interact: cmd.interact,
  purge: cmd.purge,
  choose: cmd.choose,
});

const packFlags = (cmd: PlayerCommand): number => {
  let flags = 0;
  if (cmd.fire) flags |= FLAG_FIRE;
  if (cmd.ability) flags |= FLAG_ABILITY;
  if (cmd.dodge) flags |= FLAG_DODGE;
  if (cmd.interact) flags |= FLAG_INTERACT;
  if (cmd.purge) flags |= FLAG_PURGE;
  if (cmd.choose !== null) flags |= (cmd.choose + 1) << CHOOSE_SHIFT;
  return flags;
};

const unpackFlags = (
  flags: number,
): Pick<PlayerCommand, 'fire' | 'ability' | 'dodge' | 'interact' | 'purge' | 'choose'> => {
  const choose = (flags >> CHOOSE_SHIFT) & 0b11;
  return {
    fire: (flags & FLAG_FIRE) !== 0,
    ability: (flags & FLAG_ABILITY) !== 0,
    dodge: (flags & FLAG_DODGE) !== 0,
    interact: (flags & FLAG_INTERACT) !== 0,
    purge: (flags & FLAG_PURGE) !== 0,
    choose: choose === 0 ? null : ((choose - 1) as 0 | 1),
  };
};

const sameCommand = (a: Uint8Array, ao: number, b: Uint8Array, bo: number): boolean => {
  for (let i = 0; i < COMMAND_BYTES; i++) if (a[ao + i] !== b[bo + i]) return false;
  return true;
};

/**
 * Teto de repeticoes de um mesmo bloco RLE.
 *
 * 65535 cabe em dois bytes e cobre 54 minutos a 20 Hz num unico bloco — mais
 * que qualquer run possivel. O corte existe so para que o contador nunca
 * transborde em silencio.
 */
const MAX_RUN_LENGTH = 0xffff;

/**
 * Compacta o log com RLE.
 *
 * Vale muito a pena aqui e nao seria obvio sem medir: gente segura a mesma
 * direcao por segundos a fio, e cada segundo parado sao 20 comandos identicos.
 * Uma run de 12 minutos sai de ~72 KB crus para poucos KB — a diferenca entre
 * um envio que passa em rede movel e um que o jogador cancela.
 */
export const encodeCommandLog = (commands: readonly PlayerCommand[]): Uint8Array => {
  const raw = new Uint8Array(commands.length * COMMAND_BYTES);
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const o = i * COMMAND_BYTES;
    raw[o] = q(cmd.move.x) & 0xff;
    raw[o + 1] = q(cmd.move.y) & 0xff;
    raw[o + 2] = q(cmd.aim.x) & 0xff;
    raw[o + 3] = q(cmd.aim.y) & 0xff;
    raw[o + 4] = packFlags(cmd);
  }

  const out: number[] = [];
  let i = 0;
  while (i < commands.length) {
    let run = 1;
    while (
      run < MAX_RUN_LENGTH &&
      i + run < commands.length &&
      sameCommand(raw, i * COMMAND_BYTES, raw, (i + run) * COMMAND_BYTES)
    ) {
      run++;
    }
    out.push(run & 0xff, (run >> 8) & 0xff);
    for (let b = 0; b < COMMAND_BYTES; b++) out.push(raw[i * COMMAND_BYTES + b]);
    i += run;
  }
  return Uint8Array.from(out);
};

/** Quantos comandos um log codificado representa, sem decodificar tudo. */
export const commandLogLength = (data: Uint8Array): number => {
  let total = 0;
  for (let p = 0; p + 2 + COMMAND_BYTES <= data.length; p += 2 + COMMAND_BYTES) {
    total += data[p] | (data[p + 1] << 8);
  }
  return total;
};

/**
 * Decodifica. Entrada NAO CONFIAVEL: vem de um cliente qualquer pela rede.
 *
 * Devolve null em vez de lancar para que o servidor trate log malformado como
 * submissao invalida, e nao como erro de servidor — um cliente hostil nao pode
 * derrubar o processo mandando bytes tortos.
 */
export const decodeCommandLog = (data: Uint8Array, maxCommands: number): PlayerCommand[] | null => {
  if (data.length % (2 + COMMAND_BYTES) !== 0) return null;
  const out: PlayerCommand[] = [];
  for (let p = 0; p < data.length; p += 2 + COMMAND_BYTES) {
    const run = data[p] | (data[p + 1] << 8);
    if (run === 0) return null; // bloco vazio: log malformado
    if (out.length + run > maxCommands) return null;
    const mx = (data[p + 2] << 24) >> 24; // int8
    const my = (data[p + 3] << 24) >> 24;
    const ax = (data[p + 4] << 24) >> 24;
    const ay = (data[p + 5] << 24) >> 24;
    const flags = data[p + 6];
    for (let k = 0; k < run; k++) {
      out.push({
        move: { x: dq(mx), y: dq(my) },
        aim: { x: dq(ax), y: dq(ay) },
        ...unpackFlags(flags),
      });
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// Transporte
// ---------------------------------------------------------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Base64 sem depender de Buffer nem de btoa.
 *
 * Escrito a mao porque este modulo roda nos DOIS lados: `btoa` nao existe em
 * Node e `Buffer` nao existe no browser. Uma implementacao por ambiente
 * significaria duas chances de errar o padding, num caminho onde um byte
 * trocado transforma uma run honesta em fraude aparente.
 */
export const toBase64 = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : B64[b2 & 63];
  }
  return out;
};

export const fromBase64 = (text: string): Uint8Array | null => {
  const clean = text.replace(/=+$/, '');
  if (/[^A-Za-z0-9+/]/.test(clean)) return null;
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64.indexOf(clean[i]);
    const c1 = B64.indexOf(clean[i + 1] ?? 'A');
    const c2 = B64.indexOf(clean[i + 2] ?? 'A');
    const c3 = B64.indexOf(clean[i + 3] ?? 'A');
    if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) return null;
    if (o < out.length) out[o++] = (c0 << 2) | (c1 >> 4);
    if (o < out.length) out[o++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (o < out.length) out[o++] = ((c2 & 3) << 6) | c3;
  }
  return out;
};

/**
 * O que o cliente envia ao pedir verificacao de uma run solo.
 *
 * Note o que NAO esta aqui: tempo, estrelas, abates, causa de morte. Nada de
 * resultado. O servidor deriva tudo re-simulando — nao ha campo para mentir.
 */
export type SoloRunSubmission = {
  seed: number;
  /** Log RLE em base64. */
  log: string;
  /** Nome exibido no ranking. Saneado pelo servidor. */
  name: string;
};
