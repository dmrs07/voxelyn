// AS INSTRUCOES DO FRIO, so nas primeiras vezes.
//
// Duas frases: "o frio esta se acumulando" na primeira dose parcial e
// "motores e chassi congelados — segure disparo para aquecer" no primeiro
// congelamento. Cada uma aparece um numero pequeno de vezes e depois cala:
// quem ja aprendeu que o gatilho e o motor nao precisa ler de novo no meio
// da luta. A contagem vive no localStorage, como as outras dicas do jogo;
// armazenamento bloqueado responde "ja mostrou o bastante" nos dois lados —
// a dica nunca vira ruido permanente por causa de uma janela privada.
export const FROST_HINT_SHOWS = 3;

const KEYS = {
  partial: 'voxelyn.hint.freeze.partial',
  frostbite: 'voxelyn.hint.freeze.frostbite',
} as const;

export type FrostHint = keyof typeof KEYS;

const readCount = (key: string): number => {
  try {
    const raw = localStorage.getItem(key);
    const n = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : FROST_HINT_SHOWS;
  } catch {
    return FROST_HINT_SHOWS;
  }
};

/**
 * Deve mostrar a dica agora? Devolve `true` e CONTA a exibicao; depois de
 * `FROST_HINT_SHOWS` vezes, `false` para sempre.
 */
export const takeFrostHint = (hint: FrostHint): boolean => {
  const key = KEYS[hint];
  const shown = readCount(key);
  if (shown >= FROST_HINT_SHOWS) return false;
  try {
    localStorage.setItem(key, String(shown + 1));
  } catch {
    return false;
  }
  return true;
};

/** So para testes e para o painel de debug da arena. */
export const resetFrostHints = (): void => {
  try {
    for (const key of Object.values(KEYS)) localStorage.removeItem(key);
  } catch {
    /* sem armazenamento, nada a apagar */
  }
};
