// @vitest-environment happy-dom
//
// O painel de assinatura tem DUAS responsabilidades criticas, e nenhuma das duas
// e visual:
//
//   1. o `done` SEMPRE e chamado. Quem chama esta segurando o envio da run ao
//      ranking — um callback pendurado nao deixa o campo vazio, deixa a run
//      fora do livro;
//   2. ele e chamado SINCRONAMENTE. No co-op o bloco que fecha o painel e o
//      mesmo que fecha o socket, algumas linhas abaixo; um callback adiado para
//      o microtask seguinte enviaria o nome por um socket ja fechado.
//
// Quase todo teste aqui e sobre uma dessas duas.
import { afterEach, describe, expect, it } from 'vitest';
import { RunNamePrompt } from './run-name-prompt';
import { setLocale } from './i18n';

let prompt: RunNamePrompt | undefined;
afterEach(() => {
  prompt = undefined;
  document.body.replaceChildren();
});

/** O que o painel devolveu, ou `PENDENTE` enquanto ele nao devolveu nada. */
const PENDENTE = Symbol('pendente');
type Recebido = string | null | typeof PENDENTE;

const abrir = (kind: 'solo' | 'team' = 'solo', prefill = 'dmrs07') => {
  setLocale('pt-BR');
  prompt = new RunNamePrompt();
  document.body.append(prompt.element);
  const caixa: { valor: Recebido } = { valor: PENDENTE };
  prompt.open(kind, prefill, (choice) => (caixa.valor = choice));
  const field = prompt.element.querySelector('input') as HTMLInputElement;
  // `Array.from`, e nao espalhamento: o `lib` deste tsconfig nao tem
  // `dom.iterable`, entao um NodeList espalhado passa no vitest (esbuild nao
  // checa tipo) e so quebra no `tsc` do build de deploy.
  const [skip, confirm] = Array.from(prompt.element.querySelectorAll('button'));
  return { panel: prompt, caixa, field, skip, confirm };
};

describe('assinatura do relatorio', () => {
  it('nasce preenchido com o nome salvo', () => {
    const { field, panel } = abrir();
    expect(field.value).toBe('dmrs07');
    expect(panel.element.hidden).toBe(false);
  });

  it('assinar devolve o que foi digitado NA HORA, e fecha', () => {
    const { caixa, field, confirm, panel } = abrir();
    field.value = '  Barriguda  ';
    confirm.click();
    // Sem `await`: o valor ja esta la quando o clique retorna. E o ponto — ver
    // o cabecalho deste arquivo.
    // Aparado: o nome vai para o livro e para o campo de Opcoes, e espaco nas
    // pontas apareceria nos dois.
    expect(caixa.valor).toBe('Barriguda');
    expect(panel.element.hidden).toBe(true);
    expect(panel.waiting).toBe(false);
  });

  it('pular devolve NULO — que e "nao mexi no nome salvo"', () => {
    const { caixa, field, skip } = abrir();
    // Mesmo com o campo mexido: pular e desistir do que foi digitado, e quem
    // chama volta a usar o nome que ja tinha.
    field.value = 'ignorado';
    skip.click();
    expect(caixa.valor).toBeNull();
  });

  it('campo VAZIO devolve string vazia, e nao nulo: subir anonimo e uma escolha', () => {
    const { caixa, field, confirm } = abrir();
    field.value = '';
    confirm.click();
    // A diferenca importa para quem chama: '' manda ESTA run sem nome, `null`
    // manda com o nome salvo. Colapsar os dois apagaria uma das duas intencoes.
    expect(caixa.valor).toBe('');
  });

  it('Enter assina, e nao vaza para o jogo', () => {
    const { caixa, field, panel } = abrir();
    field.value = 'no teclado';
    let vazou = false;
    window.addEventListener('keydown', () => (vazou = true));
    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    expect(caixa.valor).toBe('no teclado');
    // Enter e Espaco sao acoes na tela de fim (descer de novo). Um nome com
    // espaco no meio nao pode reiniciar a run por baixo do painel.
    expect(vazou).toBe(false);
    expect(panel.element.hidden).toBe(true);
  });

  it('sair da tela fecha com o que estava escrito — o caso que salva a run', () => {
    const { caixa, field, panel } = abrir();
    field.value = 'digitei e sai';
    // `settle` e o que os dois lacos chamam quando o jogador aperta "descer de
    // novo" ou "terminal" sem tocar no painel. Sem ele o envio ficaria esperando
    // para sempre e a run nunca chegaria ao ranking.
    panel.settle();
    expect(caixa.valor).toBe('digitei e sai');
  });

  it('settle entrega ANTES da proxima linha — o co-op fecha o socket ali', () => {
    const { caixa, field, panel } = abrir('team', 'dmrs07');
    field.value = 'Os Barrigudos';
    // Isto imita o laco do co-op: `settle()` e, logo abaixo, o fechamento do
    // socket. Enquanto o painel devolvia uma promessa, o nome so chegava no
    // microtask seguinte — com o socket ja fechado e o `NetClient` descartando
    // em silencio. O envio TEM de caber entre estas duas linhas.
    panel.settle();
    const socketAindaAberto = caixa.valor !== PENDENTE;
    expect(socketAindaAberto).toBe(true);
    expect(caixa.valor).toBe('Os Barrigudos');
  });

  it('quem ignora o painel e sai envia o nome salvo, como antes de ele existir', () => {
    const { caixa, panel } = abrir('solo', 'dmrs07');
    panel.settle();
    expect(caixa.valor).toBe('dmrs07');
  });

  it('settle sem nada aberto nao faz nada', () => {
    setLocale('pt-BR');
    const panel = new RunNamePrompt();
    expect(() => panel.settle()).not.toThrow();
    expect(panel.waiting).toBe(false);
  });

  it('nao chama `done` duas vezes: um envio por run', () => {
    const { caixa, confirm, panel } = abrir();
    let vezes = 0;
    panel.open('solo', 'dmrs07', () => vezes++);
    confirm.click();
    panel.settle(); // ja resolvido: nao pode contar de novo
    expect(vezes).toBe(1);
    // E a abertura anterior foi encerrada pela nova, sem ficar pendurada.
    expect(caixa.valor).not.toBe(PENDENTE);
  });

  it('abrir de novo encerra a abertura anterior em vez de vaza-la', () => {
    const { caixa, field, panel } = abrir();
    field.value = 'da run passada';
    // Reinicio rapido: a run seguinte termina antes de alguem ter respondido a
    // anterior. O callback velho nao pode ficar pendurado — ele e quem segura o
    // envio da run velha.
    let segunda: Recebido = PENDENTE;
    panel.open('solo', 'dmrs07', (choice) => (segunda = choice));
    expect(caixa.valor).toBe('da run passada');
    expect(panel.waiting).toBe(true);
    panel.settle();
    expect(segunda).toBe('dmrs07');
  });

  it('o rotulo do co-op fala de EQUIPE, e o do solo nao', () => {
    const solo = abrir('solo').panel.element.textContent ?? '';
    document.body.replaceChildren();
    const team = abrir('team').panel.element.textContent ?? '';
    expect(solo).toContain('RELATÓRIO');
    expect(team).toContain('EQUIPE');
    expect(team).not.toBe(solo);
  });

  it('nao rouba o toque do canvas atras dele', () => {
    const { panel } = abrir();
    let vazou = false;
    window.addEventListener('pointerdown', () => (vazou = true));
    panel.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    // O canvas da tela de fim le pointerdown para saber qual botao um toque
    // acertou. Tocar no campo para digitar nao pode contar como toque nele.
    expect(vazou).toBe(false);
  });

  it('ancora acima dos botoes, e so escreve estilo quando o numero muda', () => {
    const { panel } = abrir();
    const botao = { x: 0, y: 500, w: 100, h: 40 };
    panel.anchorAbove(botao);
    const primeiro = panel.element.style.bottom;
    expect(primeiro).toBe(`${window.innerHeight - 500 + 12}px`);

    // Marcador com valor VALIDO: o CSSOM descarta o que nao e comprimento, e um
    // marcador descartado testaria o navegador em vez do painel.
    panel.element.style.bottom = '999px';
    panel.anchorAbove(botao); // mesmo retangulo: nao deve reescrever
    expect(panel.element.style.bottom).toBe('999px');

    panel.anchorAbove({ ...botao, y: 400 });
    expect(panel.element.style.bottom).toBe(`${window.innerHeight - 400 + 12}px`);
  });

  it('sem moldura dos botoes, encosta no rodape em vez de sumir', () => {
    const { panel } = abrir();
    panel.anchorAbove(null);
    expect(panel.element.style.bottom).toBe('8px');
  });
});
