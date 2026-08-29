/**
 * Variante de superficie de um bloco a partir da posicao no mundo.
 *
 * Porta exata de `variantAt` em `packages/voxelyn-survival-content/src/terrain.ts`,
 * que e o que o cliente usa para escolher qual das tres variantes de cada tipo de
 * bloco cai em cada tile. Esta em `.mjs` porque a cadeia de ferramentas de
 * `tools/` roda em Node cru, sem passar pelo compilador de TypeScript do pacote.
 *
 * A porta e literal, e tem de continuar sendo: se as duas divergirem, a splash
 * mostraria uma pedra malhada diferente da que o jogador ve na mesma celula da
 * mesma seed — que e exatamente o tipo de divergencia silenciosa que a auditoria
 * de autenticidade nao consegue pegar olhando a imagem.
 */
export const variantAt = (x, y, variants) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % variants;
};
