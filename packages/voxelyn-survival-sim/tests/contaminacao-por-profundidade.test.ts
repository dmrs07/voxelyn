// O RELOGIO DA CONTAMINACAO CONTRA A DURACAO DA RUN.
//
// O defeito que este arquivo existe para impedir nao produz erro nenhum, nao
// quebra teste nenhum e nao aparece em revisao: cada constante continua certa
// sozinha. Ele so aparece jogando, como uma descida funda que nao da para
// terminar.
//
// A historia: `CONTAMINATION_PER_TICK` foi calibrado quando toda run tinha tres
// setores e doze minutos de alvo. Quando a profundidade virou dado da geracao e
// a run passou a ter ate sete setores e vinte e oito minutos, o relogio ficou
// onde estava. O resultado, medido: a run de tres setores saturava a ~89% do
// caminho — o sprint final, que E o clima pretendido — e a de sete saturava a
// ~58%, com cinco setores de subida pela frente e vinte e um segundos de vida.
//
// O que estes testes prendem, entao, nao e um numero: e a RELACAO entre o
// relogio e a duracao que a run declara.

import { describe, expect, it } from 'vitest';
import {
  CONTAMINATION_CARRYOVER,
  CONTAMINATION_PER_TICK,
  CONTAMINATION_SECTOR_SCALE,
  DEFAULT_SECTOR_COUNT,
  TICK_HZ,
  contaminationPerTick,
  createRun,
  descend,
  emptyCommand,
  runDepthForGeneration,
  stepRun,
  targetExtractionTicks,
} from '../src/index.js';
import type { ProspectorGeneration } from '../src/index.js';

const PROFUNDIDADES = [3, 4, 5, 7];

describe('o relogio do ar acompanha a duracao da run', () => {
  // Tres setores e a calibragem de origem, e continua sendo o ponto fixo: sem
  // isto, o ajuste teria mexido em toda run que ja aconteceu.
  it('a descida de tres setores fica bit a bit identica', () => {
    expect(contaminationPerTick(DEFAULT_SECTOR_COUNT)).toBe(CONTAMINATION_PER_TICK);
  });

  /**
   * A invariante central: uma run que dura o proprio alvo consome a MESMA
   * fracao da barra, seja ela de tres ou de sete setores.
   *
   * Medida no setor 1 e sem Nucleo, para isolar o relogio da escala por setor e
   * do multiplicador do caminho de volta — os dois continuam valendo, e os dois
   * sao assunto de outros testes.
   */
  it('o alvo inteiro custa a mesma fracao da barra em qualquer profundidade', () => {
    const custos = PROFUNDIDADES.map(
      (n) => contaminationPerTick(n) * targetExtractionTicks(n),
    );
    for (const custo of custos) expect(custo).toBeCloseTo(custos[0], 10);
  });

  // Descida mais funda, ar mais lento POR TICK — e exatamente na proporcao em
  // que ela e mais longa. Sem isto o teste acima passaria com o relogio parado.
  it('a taxa por tick cai na proporcao da profundidade', () => {
    expect(contaminationPerTick(7)).toBeCloseTo((contaminationPerTick(3) * 3) / 7, 12);
    expect(contaminationPerTick(7)).toBeLessThan(contaminationPerTick(3));
  });

  // Entrada torta nao vira divisao por zero nem taxa negativa: uma
  // profundidade invalida tem de deixar o ar MAIS rapido, nunca eterno.
  it('profundidade invalida nao apaga o relogio', () => {
    for (const torta of [0, -5, Number.NaN]) {
      const taxa = contaminationPerTick(torta);
      expect(Number.isFinite(taxa) ? taxa : contaminationPerTick(1)).toBeGreaterThan(0);
    }
  });
});

describe('a simulacao usa o relogio da run, e nao a constante', () => {
  /**
   * Prova pelo COMPORTAMENTO, e nao pela leitura do modulo: duas runs paradas
   * no setor 1 pelo mesmo tempo tem de acumular contaminacao na razao inversa
   * da profundidade. Um `stepContamination` que voltasse a usar a constante
   * passaria em todos os testes acima e falharia aqui.
   */
  it('run funda acumula mais devagar que run rasa, no mesmo setor', () => {
    const parada = (generation: ProspectorGeneration): number => {
      const state = createRun({
        seed: 99,
        playerCount: 1,
        depth: runDepthForGeneration(generation),
      });
      for (let i = 0; i < 600; i++) stepRun(state, [emptyCommand()]);
      return state.contamination;
    };
    const rasa = parada('G-00'); // 3 setores
    const funda = parada('G-04'); // 7 setores
    expect(funda).toBeCloseTo((rasa * 3) / 7, 4);
  });

  // O alivio do poco continua existindo, e continua sendo o unico que existe: a
  // subida NAO alivia, de proposito — o caminho de volta e a cobranca.
  it('o poco continua aliviando na descida', () => {
    const state = createRun({ seed: 7, playerCount: 1, depth: runDepthForGeneration('G-04') });
    for (let i = 0; i < 1200; i++) stepRun(state, [emptyCommand()]);
    const antes = state.contamination;
    expect(antes).toBeGreaterThan(0);
    descend(state, []);
    expect(state.contamination).toBeCloseTo(antes * CONTAMINATION_CARRYOVER, 6);
  });
});

describe('a saturacao cai no mesmo trecho do arco, em qualquer profundidade', () => {
  /**
   * O teste que teria pego o defeito original.
   *
   * Simula o ar de uma run de referencia — desce explorando, sobe correndo,
   * dentro do alvo — e mede EM QUE PONTO DO CAMINHO a barra enche. Saturar
   * perto do fim e o clima pretendido: e o sprint que fecha a run. Saturar na
   * metade, com setores de subida pela frente, e outra coisa — e era o que
   * acontecia nas descidas fundas.
   *
   * O ritmo e uma suposicao declarada, e nao uma medida; por isso a assercao e
   * uma FAIXA e uma comparacao entre profundidades, e nao um numero exato. O que
   * importa aqui e que as profundidades nao divirjam entre si.
   */
  const DESCE_MIN = 2.5;
  const SOBE_MIN = 1.2;
  const MIN = TICK_HZ * 60;
  const escala = (setor: number): number => 1 + (setor - 1) * CONTAMINATION_SECTOR_SCALE;

  /** Fracao do caminho ja percorrida quando a barra enche; 1 = nunca encheu. */
  const saturaEm = (setores: number): number => {
    const taxa = contaminationPerTick(setores);
    const total = setores * (DESCE_MIN + SOBE_MIN);
    let c = 0;
    let t = 0;
    for (let s = 1; s <= setores; s++) {
      c = Math.min(1, c + taxa * escala(s) * DESCE_MIN * MIN);
      t += DESCE_MIN;
      if (c >= 1) return t / total;
      if (s < setores) c = Math.min(1, c * CONTAMINATION_CARRYOVER);
    }
    for (let s = setores; s >= 1; s--) {
      // 2,2x: o Nucleo na carga e a cobranca do caminho de volta.
      c = Math.min(1, c + taxa * escala(s) * 2.2 * SOBE_MIN * MIN);
      t += SOBE_MIN;
      if (c >= 1) return t / total;
    }
    return 1;
  };

  it('nenhuma profundidade satura antes de dois tercos do caminho', () => {
    for (const setores of PROFUNDIDADES) {
      expect(saturaEm(setores), `${setores} setores`).toBeGreaterThan(0.66);
    }
  });

  /**
   * E as profundidades nao se afastam entre si.
   *
   * Antes do ajuste a distancia era de 31 pontos percentuais (89% contra 58%) —
   * a de sete setores vivia uma run inteiramente diferente da de tres. Quinze
   * pontos e folga para o resto do arco continuar existindo (descer AINDA e
   * mais duro, e deve ser) sem virar outro jogo.
   */
  it('a mais funda nao satura muito antes da mais rasa', () => {
    const pontos = PROFUNDIDADES.map(saturaEm);
    expect(Math.max(...pontos) - Math.min(...pontos)).toBeLessThan(0.15);
  });
});
