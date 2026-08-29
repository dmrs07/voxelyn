// O que a abertura espera, e o que ela deixa para depois.
//
// Esta e a lista concreta de tarefas do preload — o unico arquivo do boot que
// conhece os subsistemas do jogo. `boot-flow` e `boot-tasks` continuam
// genericos de proposito: adicionar uma tarefa nova aqui nao encosta na
// maquina de estados nem na tela.
//
// A LINHA ENTRE ESPERAR E DEIXAR PARA DEPOIS
//
// O criterio nao e "o que o jogo usa" — e "o que precisa estar pronto para o
// menu aparecer E para uma descida comecar bem". Os atlas somam 8,4 MB e todos
// eles ja eram pedidos no primeiro quadro, muito antes desta feature; o que
// muda agora e so QUEM E ESPERADO:
//
//   ESPERADO (~4,4 MB) — fontes, os seis corpos que qualquer run encontra
//   (`REQUIRED_ATLAS_IDS`), o terreno e o chao, os props. Com isto pronto, a
//   primeira descida nasce desenhada.
//
//   DEIXADO PARA DEPOIS (~4,1 MB) — o bestiario restante: dez chefes dos quais
//   uma run encontra no maximo um, mais os corpos de estratos profundos e os
//   FX. Eles continuam sendo baixados em paralelo, exatamente como antes, e a
//   reserva de silhueta cobre a janela em que ainda nao chegaram. Segurar o
//   menu por um chefe que talvez nunca apareca seria latencia sem contrapartida
//   — a mesma decisao que o carregamento sob demanda dos mapas de faces ja
//   tinha tomado neste banco.
//
// Nenhuma tarefa daqui inicia um download. Todas ESPERAM objetos que o
// `SurvivalRenderer` ja criou no construtor e que o jogo vai usar depois; e o
// que garante que entrar no jogo nao rebaixe nada nem repita um byte.

import type { SurvivalRenderer } from '../render';
import { REQUIRED_ATLAS_IDS } from '../sprites';
import { BOOT_TASK_TIMEOUT_MS, withBootTimeout, type BootTask } from './boot-tasks';

/**
 * As tres faces auto-hospedadas do sistema de design, no formato que
 * `FontFaceSet.load` cobra (`<peso> <tamanho> <familia>`).
 *
 * Esperar por elas resolve um defeito que so a sequencia de abertura tornou
 * visivel: `font-display: swap` desenha o menu na fonte de reserva e o
 * RESUBSTITUI quando a Chakra Petch chega. Antes isso acontecia no meio de uma
 * tela que ja estava mudando; agora o menu entra sob o preto do handoff, e ele
 * precisa entrar ja na tipografia certa.
 */
const FONT_FACES = ['600 16px "Chakra Petch"', '700 16px "Chakra Petch"', '400 16px "VT323"'];

/**
 * Espera as fontes do sistema de design.
 *
 * `document.fonts` nao existe em todo lugar (e nao existe no ambiente `node`
 * dos testes): sem ele a tarefa resolve na hora e o `swap` do CSS volta a ser
 * o comportamento, que e o de antes desta feature.
 */
const loadFonts = async (): Promise<void> => {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts) return;
  await Promise.all(FONT_FACES.map((face) => fonts.load(face)));
  // `ready` cobre o que `load` nao cobre: a fila interna do navegador acabou de
  // ser alimentada e o layout ainda pode nao ter sido reavaliado.
  await fonts.ready;
};

/**
 * Espera uma imagem que a propria tela de abertura ja pediu.
 *
 * `decode()` e o ponto certo, e nao `onload`: uma imagem carregada mas ainda
 * nao decodificada trava o primeiro quadro em que aparece — exatamente o
 * quadro do handoff, que e o que esta feature existe para deixar liso.
 */
export const decodeImage = async (image: HTMLImageElement): Promise<void> => {
  if (image.decode) {
    await image.decode();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    if (image.complete && image.naturalWidth > 0) return resolve();
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => reject(new Error('imagem nao carregou')), { once: true });
  });
};

export type BootPlanDeps = {
  renderer: SurvivalRenderer;
  /**
   * A imagem de fundo da abertura, quando a tela conseguiu cria-la. Ausente
   * (arquivo nao versionado, navegador sem WebP) a tarefa simplesmente nao
   * entra na lista — a tela fica com o leito escuro do design system e nada
   * quebra, do mesmo jeito que o menu fica em silencio sem a trilha.
   */
  keyart?: HTMLImageElement | null;
  /**
   * A marca do desenvolvedor, quando ha uma cadastrada em `developer-ident.ts`.
   *
   * Entra no preload por um motivo de tempo, nao de peso: a identidade e a
   * PRIMEIRA tela, e uma marca que chega no meio do fade de entrada aparece
   * como um solavanco. Esperar por ela junto do resto garante que, quando ela
   * existir, ela apareca inteira desde o primeiro quadro.
   */
  identMark?: HTMLImageElement | null;
};

/**
 * Monta a lista de tarefas desta abertura.
 *
 * Os PESOS sao os megabytes de cada grupo, arredondados. Nao ha nada de
 * arbitrario neles: a barra tem de andar na proporcao do que falta chegar, e
 * numa rede lenta o terreno (2,9 MB) e mesmo tres vezes o que os seis corpos
 * (1,1 MB) sao. Com pesos iguais, a barra chegaria a 80% em um segundo e
 * ficaria parada no resto — a mesma mentira de um cronometro, so que invertida.
 */
export const buildBootPlan = ({ renderer, keyart, identMark }: BootPlanDeps): BootTask[] => {
  const timed = <T>(promise: Promise<T>, label: string): Promise<T> =>
    withBootTimeout(promise, BOOT_TASK_TIMEOUT_MS, label);

  const tasks: BootTask[] = [
    {
      id: 'fonts',
      weight: 0.5,
      critical: false,
      run: () => timed(loadFonts(), 'fonts'),
    },
    {
      // O UNICO critico da abertura. Sem estes seis o jogo abre, mas abre como
      // um esboco de si mesmo — e dizer isso com uma tela e um botao e melhor
      // do que entregar em silencio um mundo de silhuetas. Ver
      // `REQUIRED_ATLAS_IDS`, que é a mesma lista que o build ja cobra do
      // precache em `scripts/check-precache.mjs`.
      id: 'atlas-core',
      weight: 2,
      critical: true,
      run: async () => {
        // Sem efeito na primeira passada (nada falhou ainda); na nova tentativa
        // depois de uma falha critica, e ele que re-emite os pedidos. E o que
        // torna o botao "tentar de novo" uma tentativa de verdade.
        renderer.sprites.retryFailed();
        const failed = await timed(renderer.sprites.whenSettled(REQUIRED_ATLAS_IDS), 'atlas-core');
        if (failed.length > 0) throw new Error(`atlas essenciais ausentes: ${failed.join(', ')}`);
      },
    },
    {
      id: 'atlas-terrain',
      weight: 5,
      critical: false,
      run: async () => {
        renderer.terrain.retryFailed();
        renderer.surfaces.retryFailed();
        const [terrain, surfaces] = await timed(
          Promise.all([renderer.terrain.whenSettled(), renderer.surfaces.whenSettled()]),
          'atlas-terrain',
        );
        // Falha NAO critica: o jogo desenha blocos e chao chapados, que e o que
        // ele ja fazia quando o atlas demorava. Mas a promessa rejeita mesmo
        // assim, para o laudo do boot registrar a degradacao em vez de mentir
        // que esta tudo pronto.
        if (!terrain || !surfaces) throw new Error('atlas de terreno/chao indisponivel');
      },
    },
    {
      id: 'atlas-props',
      weight: 1,
      critical: false,
      run: async () => {
        renderer.props.retryFailed();
        if (!(await timed(renderer.props.whenSettled(), 'atlas-props'))) {
          throw new Error('atlas de props indisponivel');
        }
      },
    },
  ];

  if (identMark) {
    tasks.push({
      id: 'ident-mark',
      weight: 0.25,
      critical: false,
      run: () => timed(decodeImage(identMark), 'ident-mark'),
    });
  }

  if (keyart) {
    tasks.push({
      id: 'keyart',
      weight: 0.5,
      critical: false,
      run: () => timed(decodeImage(keyart), 'keyart'),
    });
  }

  return tasks;
};
