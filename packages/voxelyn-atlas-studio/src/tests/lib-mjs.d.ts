// Tipos minimos do modulo .mjs do pipeline de conteudo, importado pelos testes
// de paridade de paleta. So o que os testes consomem.
declare module '*tools/lib.mjs' {
  export const COLORS: Record<string, number[]>;
  export const HEX: Record<string, string>;
  export const ALLOWED_HEX: Set<string>;
}
