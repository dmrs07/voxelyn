import { HASH_METER, HASH_POS } from './constants.js';
import type { HackState } from './types.js';

/**
 * FNV-1a, o mesmo formato dos irmaos (Survival, Iliada). O valor de um hash de
 * determinismo esta em ser o MESMO em toda a casa: e o que permite comparar
 * divergencia entre dois processos com as ferramentas que ja existem.
 */
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

class Fnv1a {
  private h = FNV_OFFSET;

  u32(v: number): void {
    let x = v >>> 0;
    for (let i = 0; i < 4; i++) {
      this.h ^= x & 0xff;
      this.h = Math.imul(this.h, FNV_PRIME) >>> 0;
      x >>>= 8;
    }
  }

  /** Ponto fixo explicito: float direto no hash e divergencia garantida. */
  fixed(v: number, scale: number): void {
    this.u32(Math.round(v * scale) | 0);
  }

  str(s: string): void {
    this.u32(s.length);
    for (let i = 0; i < s.length; i++) this.u32(s.charCodeAt(i));
  }

  digest(): string {
    return (this.h >>> 0).toString(16).padStart(8, '0');
  }
}

export const hashState = (state: HackState): string => {
  const h = new Fnv1a();
  h.u32(state.tick);
  h.u32(state.rngState);
  h.str(state.phase);
  h.u32(state.treats);
  h.u32(state.buildBroken ? 1 : 0);
  h.fixed(state.buildProgress, 1);
  h.str(state.held ?? '-');
  h.str(state.fight?.a ?? '-');
  h.str(state.fight?.b ?? '-');
  h.u32(state.cableOut ? 1 : 0);
  h.fixed(state.cableProgress, 1);
  for (const c of state.cats) {
    h.str(c.id);
    // A FICHA MECANICA do contratado e ENTRADA do replay: dois elencos com
    // os mesmos ids e fichas diferentes divergem JA no tick zero — sem
    // isto, a ferramenta de divergencia so acusava muito depois (achado de
    // revisao do Slice D).
    h.str(c.specialty);
    h.str(c.personality);
    h.str(c.quirk);
    h.str(c.tier);
    for (const tr of c.traits) h.str(tr);
    h.str(c.hiddenTrait);
    h.fixed(c.breedMod.nap, HASH_METER);
    h.fixed(c.breedMod.stress, HASH_METER);
    h.fixed(c.breedMod.hunger, HASH_METER);
    h.fixed(c.breedMod.social, HASH_METER);
    h.fixed(c.x, HASH_POS);
    h.fixed(c.y, HASH_POS);
    // Em walk/zoomies o alvo determina as proximas posicoes: sem ele, dois
    // estados divergentes davam o mesmo hash.
    h.fixed(c.targetX, HASH_POS);
    h.fixed(c.targetY, HASH_POS);
    h.fixed(c.energy, HASH_METER);
    h.fixed(c.hunger, HASH_METER);
    h.fixed(c.stress, HASH_METER);
    // Moral manda na velocidade; a memoria do carinho manda no proximo
    // carinho. Ambos determinam o futuro — ambos entram.
    h.fixed(c.moral, HASH_METER);
    h.u32(c.petStreak);
    h.u32(c.petLastTick + 1);
    // A revelacao do trait oculto muda eventos futuros: entra.
    h.u32(c.revealed ? 1 : 0);
    h.fixed(c.speedBoost, HASH_METER);
    // O aprendizado do junior manda na velocidade dele; o contador de ships
    // decide crescimento e estrela. Ambos determinam o futuro — entram.
    h.fixed(c.learned, HASH_METER);
    h.u32(c.shipped);
    h.str(c.mode);
    h.str(c.slot ?? '-');
    h.u32(c.modeUntil);
  }
  for (const t of state.tasks) {
    h.fixed(t.progress, 1);
    // A decisao muda custos e tags: dois estados com escolhas diferentes NAO
    // podem colidir.
    h.u32(t.cost);
    h.str(t.chosen ?? '-');
    h.u32((t.done ? 1 : 0) | (t.cut ? 2 : 0) | (t.awaitingShip ? 4 : 0));
  }
  h.u32(state.debt + 8);
  h.u32(state.innovation + 8);
  h.u32(state.uxCare);
  h.u32(state.stability);
  h.u32(state.sponsorRisk ? 1 : 0);
  for (const g of state.gear) h.str(g);
  h.u32(state.catnipLeft);
  h.u32(state.laserLeft);
  h.fixed(state.hype, HASH_METER);
  h.u32(state.prizeBonus);
  h.u32(state.petSessions);
  // O contrato de sponsor muda custos de bug, risco de crash e o palco; a
  // categoria especial muda o premio; os pares anunciados mudam eventos.
  h.str(state.sponsor?.id ?? '-');
  h.str(state.specialCategory);
  for (const v of state.vibesSeen) h.str(v);
  for (const s of state.social) {
    h.str(s.kind);
    h.u32(s.at);
    h.u32(s.until);
    h.u32((s.resolved ? 1 : 0) | (s.taken === 'a' ? 2 : s.taken === 'b' ? 4 : 0));
  }
  if (state.pitch) {
    h.u32(state.pitch.ticksLeft);
    h.fixed(state.pitch.gauge, HASH_METER);
    h.str(state.pitch.lastAbility ?? '-');
    h.u32(state.pitch.crisisAt + 1);
    h.u32(state.pitch.crisisUntil);
    h.u32(state.pitch.crisisResolved ? 1 : 0);
    // Os cooldowns do TIME DESTA RUN, na ordem do elenco — iterar os ids
    // classicos deixava todo time gerado fora do hash (achado de revisao).
    for (const c of state.cats) h.u32(state.pitch.readyAt[c.id] ?? 0);
  }
  for (const b of state.bugs) {
    h.u32(b.id);
    h.str(b.track);
    h.fixed(b.progress, 1);
    h.u32(b.fixed ? 1 : 0);
  }
  h.u32(state.hairball.fired);
  h.u32(state.hairball.active ? 1 : 0);
  h.fixed(state.hairball.progress, 1);
  h.u32(state.events.length);
  return h.digest();
};
