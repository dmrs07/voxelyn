// A GEOMETRIA do painel de status, medida sem Canvas.
//
// A regressao que este arquivo existe para impedir apareceu numa captura de
// tela: "NÚCLEOS 0/2" desenhado por cima de "O SELO DO SETOR RESISTE — ..." e a
// diretiva vazando a borda direita do painel. Nenhum teste media o painel,
// porque a geometria era aritmetica solta dentro do render. Agora ela e uma
// funcao, e a funcao promete: nenhuma secao invade a seguinte, e a diretiva
// mais longa dos dois idiomas cabe na largura mais estreita que o painel tem.

import { describe, expect, it } from 'vitest';
import { createRun, runDepthForGeneration } from '@voxelyn/survival-sim';
import {
  HP_GHOST_HOLD_MS,
  HUD_OBJECTIVE_MAX_LINES,
  hpGhostStep,
  hudDense,
  hudObjectiveMaxWidth,
  hudPanelLayout,
  hudPanelWidth,
  hudScale,
  wrapHudText,
} from '../client/hud-layout';
import { setLocale, t } from '../client/i18n';
import { RouteMemory, drawSurveyHud, surveyHudHeight } from '../client/survey-overlay';

const SAFE = { top: 0, right: 0, bottom: 0, left: 0 };

/** Avanco de um caractere da fonte da diretiva (11px monoespacada, negrito). */
const OBJECTIVE_CHAR_PX = 6.7;
const measure = (text: string): number => text.length * OBJECTIVE_CHAR_PX;

const OBJECTIVE_KEYS = [
  'hud.objective.descend',
  'hud.objective.ascend',
  'hud.objective.extract',
  'hud.objective.findCore',
  'hud.objective.breakSeal',
] as const;

describe('a diretiva cabe no painel', () => {
  it.each(['pt-BR', 'en'] as const)(
    'em %s, cada diretiva quebra em linhas que cabem na largura mais estreita',
    (locale) => {
      setLocale(locale);
      const maxWidth = hudObjectiveMaxWidth(320);
      for (const key of OBJECTIVE_KEYS) {
        const lines = wrapHudText(t(key), maxWidth, measure);
        expect(lines.length, key).toBeLessThanOrEqual(HUD_OBJECTIVE_MAX_LINES);
        for (const line of lines)
          expect(measure(line), `${key}: ${line}`).toBeLessThanOrEqual(maxWidth);
        expect(lines.join(' ')).toBe(t(key));
      }
    },
  );

  it('a diretiva do selo precisa de mais de uma linha no painel compacto', () => {
    setLocale('en');
    const lines = wrapHudText(t('hud.objective.breakSeal'), hudObjectiveMaxWidth(320), measure);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('uma palavra maior que a linha nao e engolida', () => {
    expect(wrapHudText('ABCDEFGHIJ KL', 30, measure)).toEqual(['ABCDEFGHIJ', 'KL']);
    expect(wrapHudText('', 30, measure)).toEqual(['']);
  });
});

describe('escala do painel em tela pequena', () => {
  it('encolhe num celular em pe e num celular deitado, e nao no desktop', () => {
    expect(hudScale(390, 844)).toBeLessThan(1);
    expect(hudScale(844, 390)).toBeLessThan(1);
    expect(hudScale(1280, 720)).toBe(1);
    expect(hudScale(768, 1024)).toBe(1);
  });

  it('nunca desce a ponto de a diretiva virar textura (9 px CSS)', () => {
    expect(hudScale(320, 568) * 11).toBeGreaterThanOrEqual(9);
  });

  it('num celular em pe o painel escalado fica em metade da largura', () => {
    const vw = 390;
    const hs = hudScale(vw, 844);
    expect(hudPanelWidth(vw / hs) * hs).toBeLessThanOrEqual(vw * 0.5);
  });
});

describe('largura do painel', () => {
  it('fica presa entre o compacto e o confortavel', () => {
    expect(hudPanelWidth(320)).toBe(230);
    expect(hudPanelWidth(1920)).toBe(300);
    expect(hudPanelWidth(800)).toBe(272);
  });
});

describe('as secoes do painel nunca se invadem', () => {
  const cases = [
    { dense: false, moduleCount: 0, surveyHeight: 0, objectiveLines: 1 },
    { dense: false, moduleCount: 3, surveyHeight: 0, objectiveLines: 1 },
    { dense: false, moduleCount: 0, surveyHeight: 21, objectiveLines: 2 },
    { dense: false, moduleCount: 7, surveyHeight: 21, objectiveLines: 3 },
    { dense: true, moduleCount: 0, surveyHeight: 0, objectiveLines: 1 },
    { dense: true, moduleCount: 3, surveyHeight: 0, objectiveLines: 1 },
    { dense: true, moduleCount: 0, surveyHeight: 21, objectiveLines: 2 },
    { dense: true, moduleCount: 7, surveyHeight: 21, objectiveLines: 3 },
  ];

  it.each(cases)('%o', (input) => {
    const l = hudPanelLayout({ viewportWidth: 390, safe: { ...SAFE, top: 20, left: 8 }, ...input });
    // Vitais: barra, calor e rotacao empilhados sem tocar.
    expect(l.hpBar.y + l.hpBar.h).toBeLessThanOrEqual(l.heatRail.y);
    expect(l.heatRail.y + l.heatRail.h).toBeLessThanOrEqual(l.spinRail.y);
    expect(l.spinRail.y + l.spinRail.h).toBeLessThan(l.dividerA);
    expect(l.freezeRail).toBeNull();
    // Com o medidor de congelamento visivel, ele cabe entre a rotacao e o
    // divisor sem tocar em nenhum dos dois — e tudo abaixo desce junto.
    const f = hudPanelLayout({
      viewportWidth: 390,
      safe: { ...SAFE, top: 20, left: 8 },
      ...input,
      freezeMeter: true,
    });
    expect(f.freezeRail).not.toBeNull();
    expect(f.freezeRail!.y).toBeGreaterThanOrEqual(f.spinRail.y + f.spinRail.h);
    expect(f.freezeRail!.y + f.freezeRail!.h).toBeLessThan(f.dividerA);
    expect(f.dividerA - l.dividerA).toBe(f.height - l.height);
    expect(f.height).toBeGreaterThan(l.height);
    // Recursos abaixo do primeiro divisor, com folga para o glifo de 15px.
    expect(l.resources.glyphY - 8).toBeGreaterThan(l.dividerA);
    // Modulos: o card e o badge inteiro (nada orbita fora dele), entre a
    // linha de recursos e o segundo divisor, com um pixel de ar nos dois lados.
    if (input.moduleCount > 0) {
      expect(l.modules).not.toBeNull();
      expect(l.modules!.y - 2).toBeGreaterThan(l.resources.baseline);
      expect(l.modules!.y + l.modules!.size + 2).toBeLessThan(l.dividerB);
    } else {
      expect(l.modules).toBeNull();
      expect(l.resources.baseline).toBeLessThan(l.dividerB);
    }
    // Setor (10px) e bioma (9px): baselines com espaco para a altura da fonte.
    expect(l.sectorBaseline - 8).toBeGreaterThan(l.dividerB);
    expect(l.biomeBaseline - l.sectorBaseline).toBeGreaterThanOrEqual(11);
    // Levantamento comeca abaixo do bioma e a diretiva abaixo do levantamento.
    expect(l.surveyTop).toBeGreaterThan(l.biomeBaseline);
    expect(l.objective.firstBaseline - 9).toBeGreaterThanOrEqual(l.surveyTop + input.surveyHeight);
    // A ultima linha da diretiva fica dentro do painel.
    const lastBaseline =
      l.objective.firstBaseline + (l.objective.lines - 1) * l.objective.lineHeight;
    expect(lastBaseline + 3).toBeLessThanOrEqual(l.y + l.height);
    // Diretiva dentro da largura interna.
    expect(l.objective.x + l.objective.maxWidth).toBeLessThanOrEqual(l.innerRight + 1e-6);
    // O painel respeita a area segura.
    expect(l.x).toBeGreaterThanOrEqual(8);
    expect(l.y).toBeGreaterThanOrEqual(20);
  });

  it('cresce com o conteudo, e so com ele', () => {
    const base = hudPanelLayout({
      viewportWidth: 800,
      safe: SAFE,
      moduleCount: 0,
      surveyHeight: 0,
      objectiveLines: 1,
    });
    const withModules = hudPanelLayout({
      viewportWidth: 800,
      safe: SAFE,
      moduleCount: 2,
      surveyHeight: 0,
      objectiveLines: 1,
    });
    const withSurvey = hudPanelLayout({
      viewportWidth: 800,
      safe: SAFE,
      moduleCount: 0,
      surveyHeight: 18,
      objectiveLines: 1,
    });
    const twoLines = hudPanelLayout({
      viewportWidth: 800,
      safe: SAFE,
      moduleCount: 0,
      surveyHeight: 0,
      objectiveLines: 2,
    });
    expect(withModules.height).toBeGreaterThan(base.height);
    expect(withSurvey.height - base.height).toBe(18);
    expect(twoLines.height - base.height).toBe(twoLines.objective.lineHeight);
    // Nunca mais alto que a versao antiga com modulos (157px) mais uma linha.
    expect(base.height).toBeLessThanOrEqual(130);
  });

  it('o ritmo denso e mais baixo em toda combinacao, sem perder secao', () => {
    for (const moduleCount of [0, 2, 7]) {
      for (const objectiveLines of [1, 2, 3]) {
        const roomy = hudPanelLayout({
          viewportWidth: 464,
          safe: SAFE,
          moduleCount,
          surveyHeight: 0,
          objectiveLines,
        });
        const dense = hudPanelLayout({
          viewportWidth: 464,
          safe: SAFE,
          dense: true,
          moduleCount,
          surveyHeight: 0,
          objectiveLines,
        });
        expect(dense.height).toBeLessThan(roomy.height * 0.92);
        expect(dense.modules === null).toBe(roomy.modules === null);
      }
    }
  });

  it('a tela pequena e densa; o desktop nao', () => {
    expect(hudDense(390, 844)).toBe(true);
    expect(hudDense(1280, 720)).toBe(false);
  });

  it('Nucleos e setor dividem a mesma linha', () => {
    const l = hudPanelLayout({
      viewportWidth: 800,
      safe: SAFE,
      moduleCount: 0,
      surveyHeight: 0,
      objectiveLines: 1,
    });
    // O contador de Nucleos e desenhado alinhado a direita em `sectorBaseline`;
    // a diretiva vem ao menos uma linha inteira abaixo do bioma.
    expect(l.objective.firstBaseline - l.biomeBaseline).toBeGreaterThanOrEqual(19);
  });
});

describe('o rastro da barra de HP', () => {
  it('segura o valor antigo, depois desce, e para exatamente no atual', () => {
    expect(hpGhostStep(1, 0.6, 0, 16)).toBe(1);
    expect(hpGhostStep(1, 0.6, HP_GHOST_HOLD_MS - 1, 16)).toBe(1);
    const moving = hpGhostStep(1, 0.6, HP_GHOST_HOLD_MS, 16);
    expect(moving).toBeLessThan(1);
    expect(moving).toBeGreaterThan(0.6);
    let ghost = 1;
    for (let i = 0; i < 400; i++) ghost = hpGhostStep(ghost, 0.6, HP_GHOST_HOLD_MS + i * 16, 16);
    expect(ghost).toBe(0.6);
  });

  it('cura nunca deixa rastro', () => {
    expect(hpGhostStep(0.4, 0.9, 0, 16)).toBe(0.9);
  });
});

describe('a altura dos instrumentos de levantamento e a que o desenho usa', () => {
  const stubCtx = {
    fillStyle: '',
    globalAlpha: 1,
    fillRect: () => undefined,
  } as unknown as CanvasRenderingContext2D;

  it('sem instrumentos, zero', () => {
    const state = createRun({ seed: 3, sector: 1, depth: runDepthForGeneration('G-01') });
    const nav = {
      ...state.config.tuning.navigation,
      routeMemory: false,
      contaminationForecast: false,
    };
    expect(surveyHudHeight(state, nav, new RouteMemory())).toBe(0);
  });

  it('com mapa e previsao, a promessa bate com o cursor devolvido por drawSurveyHud', () => {
    const state = createRun({ seed: 3, sector: 1, depth: runDepthForGeneration('G-01') });
    const nav = {
      ...state.config.tuning.navigation,
      routeMemory: true,
      contaminationForecast: true,
    };
    const route = new RouteMemory();
    route.observe(state);
    const height = surveyHudHeight(state, nav, route);
    expect(height).toBeGreaterThan(0);
    const y = 100;
    expect(drawSurveyHud(stubCtx, state, nav, route, 12, y, 0)).toBe(y + height);
  });
});
