// O CICLO DO FERRO — as massas que o campo do Magnetarca carrega.
//
// A promessa que a lore dele fazia e a mecanica nao cumpria: o campo move
// material ferroso, e o estrato inteiro e minerio e sucata, mas a unica coisa
// que o campo movia era o Prospector. Depois de aprender a distancia, o
// encontro parava de pedir decisao.
//
// O ciclo do ferro e a leitura do campo aplicada a MATERIA, e por isso ele nao
// inventa sistema nenhum — e a mesma regra, com outro corpo:
//
//   ATRAINDO   ele RECOLHE as massas cravadas na arena;
//   REPELINDO  ele as ARREMESSA de volta para fora.
//
// Entre um e outro a massa fica cravada onde parou, e cravada ela e ALVO. Uma
// massa fraturada nao aguenta o recolhimento: ela se despedaca contra os aneis,
// cobra do proprio chefe e desregula o campo. A decisao que isso cria e a razao
// de o arquivo existir — continuar acertando o chefe, ou gastar tres tiros numa
// massa para transformar o proximo recolhimento numa janela.
//
// Duas regras que valem para tudo aqui:
//
// - NADA DISTO E SOLIDO. Uma massa cravada nao escreve celula, nao fecha rota e
//   nao tampa objetivo. A camara gerada continua atravessavel em qualquer
//   combinacao de massas, sem precisar de prova — que e a unica coisa que um
//   objeto novo no chao de um mapa gerado nao pode quebrar.
// - A ROTA CONGELA NO TELEGRAFO. O destino nasce marcado no chao e nao
//   persegue, como as cargas da Salva de Demolicao do Diamandis: sair da linha
//   e a resposta inteira do golpe, e ela so existe porque a linha fica onde
//   nasceu.

import {
  MAGNETARCH_CRUSH_RANGE,
  MAGNETARCH_EXPOSED_TICKS,
  MAGNETARCH_SHARDS,
  MAGNETARCH_SHARD_DAMAGE,
  MAGNETARCH_SHARD_FAN,
  MAGNETARCH_SHARD_HIT_TICKS,
  MAGNETARCH_SHARD_HP,
  MAGNETARCH_SHARD_RADIUS,
  MAGNETARCH_SHARD_RETURN_DAMAGE,
  MAGNETARCH_SHARD_SPEED,
  MAGNETARCH_SHARD_THROW,
  MAGNETARCH_SHARD_WINDUP_TICKS,
  MAGNETARCH_TETHER_RANGE,
  SOLID_NONE,
  TICK_HZ,
} from './constants.js';
import {
  SHARD_FLIGHT,
  SHARD_HELD,
  SHARD_LODGED,
  SHARD_WINDUP,
  type Entity,
  type MagnetShard,
  type SemanticEvent,
  type SurvivalState,
  type Vec2,
} from './types.js';
import { damageEntity } from './entities.js';

/** A celula esta aberta e dentro do mapa? A unica pergunta que o chao responde. */
const walkable = (state: SurvivalState, x: number, y: number): boolean => {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 1 || cy < 1 || cx >= state.config.width - 1 || cy >= state.config.height - 1) {
    return false;
  }
  return state.solid[cy * state.config.width + cx] === SOLID_NONE;
};

/**
 * A SUCATA QUE A CAMARA JA TINHA.
 *
 * As massas nao sao invocadas: o Ferrifero e feito delas, e o campo so reclama
 * o que estava no chao. Por isso elas nascem no primeiro tick do encontro, e
 * nao num golpe — o jogador entra numa sala que ja tem ferro solto, e o
 * primeiro recolhimento e a apresentacao da regra.
 *
 * Nascem NA FAIXA, espalhadas por angulo fixo. Na faixa porque e onde o jogador
 * vai estar (e onde ele pode atirar nelas sem pagar borda), e por angulo fixo
 * porque a posicao delas nao pode consumir a RNG da run: worldgen e sorteio de
 * chefe sao funcoes puras da seed, e um encontro que deslocasse a sequencia
 * faria a mesma seed gerar setores diferentes conforme o jogador tivesse ou nao
 * chegado ate aqui.
 */
export const claimMagnetShards = (state: SurvivalState, boss: Entity): void => {
  const shards: MagnetShard[] = [];
  const mid = (MAGNETARCH_CRUSH_RANGE + MAGNETARCH_TETHER_RANGE) / 2;
  for (let i = 0; i < MAGNETARCH_SHARDS && shards.length < MAGNETARCH_SHARDS; i++) {
    const angle = (i / MAGNETARCH_SHARDS) * Math.PI * 2;
    // Tenta do meio da faixa para fora e para dentro: numa camara apertada o
    // anel do meio pode cair na parede, e uma massa que nao nasce e uma massa a
    // menos no ciclo inteiro.
    for (const radius of [mid, mid - 1.5, mid + 1.5, MAGNETARCH_CRUSH_RANGE + 0.6]) {
      const x = boss.x + Math.cos(angle) * radius;
      const y = boss.y + Math.sin(angle) * radius;
      if (!walkable(state, x, y)) continue;
      shards.push({
        x,
        y,
        tx: x,
        ty: y,
        at: state.tick,
        state: SHARD_LODGED,
        cracked: 0,
        hp: MAGNETARCH_SHARD_HP,
        hitAt: -1,
      });
      break;
    }
  }
  state.bossRuntime.magnetShards = shards;
};

/**
 * A polaridade virou: todas as massas cravadas ganham rota.
 *
 * ATRAINDO a rota e o corpo do chefe — o recolhimento. REPELINDO e um ponto
 * atras da posicao que o alvo ocupava AGORA, aberto em leque: tres corredores
 * legiveis em vez de tres pedras na mesma linha.
 *
 * As massas em voo nao sao reroteadas. Uma massa que trocasse de destino no
 * meio do caminho apagaria a promessa da marca no chao, que e a coisa toda.
 */
export const routeMagnetShards = (
  state: SurvivalState,
  boss: Entity,
  target: Vec2 | null,
  attracting: boolean,
): void => {
  const shards = state.bossRuntime.magnetShards;
  let fanned = 0;
  for (const shard of shards) {
    // Atraindo, so o que esta LA FORA e recolhido; repelindo, sai tudo o que
    // ele tem na mao — o que estava cravado e o que ele reincorporou.
    if (shard.state !== SHARD_LODGED && !(shard.state === SHARD_HELD && !attracting)) continue;
    shard.at = state.tick;
    shard.state = SHARD_WINDUP;
    shard.hitAt = -1;
    if (attracting) {
      shard.tx = boss.x;
      shard.ty = boss.y;
      continue;
    }
    // O ARREMESSO mira ONDE O ALVO ESTA, e passa direto: o destino fica na
    // borda do campo, atras dele. Uma rota que terminasse nos pes do jogador
    // premiaria ficar parado — a massa pararia antes de chegar.
    const aimX = (target?.x ?? boss.x + 1) - shard.x;
    const aimY = (target?.y ?? boss.y) - shard.y;
    const len = Math.hypot(aimX, aimY) || 1;
    const spread = (fanned - (MAGNETARCH_SHARDS - 1) / 2) * MAGNETARCH_SHARD_FAN;
    fanned++;
    const cos = Math.cos(spread);
    const sin = Math.sin(spread);
    const dx = ((aimX / len) * cos - (aimY / len) * sin) * MAGNETARCH_SHARD_THROW;
    const dy = ((aimX / len) * sin + (aimY / len) * cos) * MAGNETARCH_SHARD_THROW;
    let tx = shard.x + dx;
    let ty = shard.y + dy;
    // O TETO NO ANEL EXTERNO. Sem ele o ferro pousava na borda do campo, e
    // sabotar exigia sair da faixa e pagar o arco de retorno para chegar la — o
    // contrario do que o encontro pede. O destino e projetado de volta para o
    // anel, mantendo o rumo: a rota continua sendo a mesma reta, so mais curta.
    const outX = tx - boss.x;
    const outY = ty - boss.y;
    const out = Math.hypot(outX, outY);
    if (out > MAGNETARCH_TETHER_RANGE) {
      tx = boss.x + (outX / out) * MAGNETARCH_TETHER_RANGE;
      ty = boss.y + (outY / out) * MAGNETARCH_TETHER_RANGE;
    }
    shard.tx = tx;
    shard.ty = ty;
  }
};

/**
 * Um tick das massas: telegrafo, voo, atropelo, pouso e estilhaco.
 *
 * Roda mesmo com o campo CALADO (folga ou descompasso). O que a folga suspende
 * e o deslocamento dos corpos pelo campo; uma massa ja em voo tem inercia, e
 * congelar ferro no ar seria a unica coisa desta luta que nao se explica
 * sozinha. O que a folga faz e nao dar rota nova — quem chama `routeMagnetShards`
 * e a virada de polaridade, e ela acontece quando a folga FECHA.
 *
 * ATORDOAR O CHEFE PARA O FERRO, e isso e consequencia e nao excecao: o laco de
 * inimigos pula o corpo enquanto ele esta atordoado, e a massa so anda dentro do
 * passo dele. Quem eletrifica a parede do Ferrifero — a resposta natural do
 * estrato — congela o corredor junto com o dono dele. Nao ha codigo para isso
 * aqui; ha uma nota, porque a primeira pessoa a notar vai achar que e defeito.
 */
export const stepMagnetShards = (
  state: SurvivalState,
  boss: Entity,
  events: SemanticEvent[],
): void => {
  const rt = state.bossRuntime;
  const step = MAGNETARCH_SHARD_SPEED / TICK_HZ;
  const survivors: MagnetShard[] = [];

  for (const shard of rt.magnetShards) {
    if (shard.state === SHARD_WINDUP) {
      if (state.tick - shard.at >= MAGNETARCH_SHARD_WINDUP_TICKS) {
        shard.state = SHARD_FLIGHT;
        shard.at = state.tick;
        events.push({
          t: 'boss_attack',
          archetype: 'magnetarch',
          ability: 'shard',
          x: shard.x,
          y: shard.y,
        });
      }
      survivors.push(shard);
      continue;
    }
    if (shard.state !== SHARD_FLIGHT) {
      survivors.push(shard);
      continue;
    }

    const dx = shard.tx - shard.x;
    const dy = shard.ty - shard.y;
    const left = Math.hypot(dx, dy);
    const nx = shard.x + (dx / (left || 1)) * Math.min(step, left);
    const ny = shard.y + (dy / (left || 1)) * Math.min(step, left);

    // A PAREDE PARA A MASSA, e ela crava ali. Nao ha atravessar rocha: o campo
    // move ferro, nao o desmaterializa — e uma massa que aparecesse do outro
    // lado de um muro seria dano sem sinal.
    if (!walkable(state, nx, ny)) {
      shard.state = SHARD_LODGED;
      shard.at = state.tick;
      survivors.push(shard);
      continue;
    }
    shard.x = nx;
    shard.y = ny;

    // O ATROPELO. Uma cobranca por massa a cada `MAGNETARCH_SHARD_HIT_TICKS`,
    // e nao uma por tick: a massa atravessa o corpo em poucos quadros, e sem o
    // intervalo o mesmo pedaco de ferro cobraria tres vezes o mesmo passo.
    if (shard.hitAt < 0 || state.tick - shard.hitAt >= MAGNETARCH_SHARD_HIT_TICKS) {
      for (const victim of state.players) {
        if (!victim.alive || !state.playerExtras[victim.slot ?? 0].joined) continue;
        if (Math.hypot(victim.x - shard.x, victim.y - shard.y) > MAGNETARCH_SHARD_RADIUS + 0.34) {
          continue;
        }
        shard.hitAt = state.tick;
        damageEntity(state, victim, MAGNETARCH_SHARD_DAMAGE, events, {
          kind: 'enemy_contact',
          archetype: 'magnetarch',
          elite: boss.elite,
        });
        events.push({ t: 'pulse', x: shard.x, y: shard.y, radius: MAGNETARCH_SHARD_RADIUS });
        break;
      }
    }

    if (Math.hypot(shard.tx - shard.x, shard.ty - shard.y) > 0.05) {
      survivors.push(shard);
      continue;
    }

    // CHEGOU. No arremesso isso e simplesmente cravar no destino marcado.
    const homing = Math.hypot(boss.x - shard.tx, boss.y - shard.ty) < 0.01;
    if (!homing) {
      shard.state = SHARD_LODGED;
      shard.at = state.tick;
      survivors.push(shard);
      continue;
    }

    // NO RECOLHIMENTO, a massa integra e REINCORPORADA: ela some dentro do
    // corpo e sai de novo no proximo arremesso. Enquanto esta ali ela nao e
    // alvo — e essa e a licao do encontro: a hora de sabotar e enquanto a massa
    // esta LA FORA.
    if (shard.cracked === 0) {
      shard.state = SHARD_HELD;
      shard.at = state.tick;
      shard.x = boss.x;
      shard.y = boss.y;
      shard.tx = boss.x;
      shard.ty = boss.y;
      survivors.push(shard);
      continue;
    }

    // A MASSA FRATURADA NAO SOBREVIVE AO RETORNO. Ela se despedaca contra os
    // aneis: cobra do chefe, desregula o campo e ACABA — o material e finito, e
    // e isso que impede o contra-jogo de virar farm numa luta curta.
    damageEntity(state, boss, MAGNETARCH_SHARD_RETURN_DAMAGE, events, { kind: 'player_shot' });
    rt.magnetExposedUntil = state.tick + MAGNETARCH_EXPOSED_TICKS;
    events.push({ t: 'pulse', x: boss.x, y: boss.y, radius: MAGNETARCH_CRUSH_RANGE });
    events.push({
      t: 'boss_state',
      archetype: 'magnetarch',
      state: 'shatter',
      x: boss.x,
      y: boss.y,
    });
  }

  rt.magnetShards = survivors;
};

/**
 * O tiro que passa por uma massa cravada.
 *
 * Chamado do sub-passo do projetil, ao lado de `hitSutures`, e pelo mesmo
 * motivo dele: a massa nao e entidade nem celula, entao nenhuma das duas
 * colisoes do laco a encontraria sozinha.
 *
 * So CRAVADA. Uma massa em voo atravessa o tiro — ela ja e o golpe, e permitir
 * abate-la no ar transformaria o contra-jogo ("prepare a proxima") em reflexo
 * ("derrube esta"), que e o oposto do que o encontro pede.
 *
 * Devolve `true` quando a massa consumiu o tiro. O tiro morre nela: ferro com
 * um palmo de espessura nao deixa bolt passar, e um tiro que atravessasse
 * apagaria a escolha (voce nao estaria gastando nada para fraturar).
 */
export const hitMagnetShards = (
  state: SurvivalState,
  from: Vec2,
  to: Vec2,
  damage: number,
  events: SemanticEvent[],
): boolean => {
  for (const shard of state.bossRuntime.magnetShards) {
    if (shard.state !== SHARD_LODGED) continue;
    if (segmentDistance(from, to, shard) > MAGNETARCH_SHARD_RADIUS) continue;
    if (shard.cracked === 1) {
      // Ja fraturada: o tiro ainda para nela (ela continua sendo um palmo de
      // ferro), mas nao ha nada a mais para quebrar. Fraturar duas vezes nao
      // dobra o retorno — o premio e o estilhaco, e ele e um so.
      return true;
    }
    shard.hp -= damage;
    if (shard.hp > 0) {
      events.push({ t: 'pulse', x: shard.x, y: shard.y, radius: 0.5 });
      return true;
    }
    shard.cracked = 1;
    shard.hp = 0;
    // A LIMALHA ESCAPANDO e o unico sinal de que aquela massa mudou de estado.
    // Sem ele, o jogador que investiu tres tiros nao teria como saber se
    // investiu o bastante — e a decisao seguinte (parar ou continuar) e feita
    // exatamente aqui.
    events.push({
      t: 'boss_state',
      archetype: 'magnetarch',
      state: 'crack',
      x: shard.x,
      y: shard.y,
    });
    return true;
  }
  return false;
};

/** Distancia do ponto ao segmento — a mesma conta do corte de fio. */
const segmentDistance = (a: Vec2, b: Vec2, p: Vec2): number => {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len = vx * vx + vy * vy;
  const t = len > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len)) : 0;
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
};
