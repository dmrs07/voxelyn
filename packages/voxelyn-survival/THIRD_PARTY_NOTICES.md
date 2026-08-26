# Third-party notices — voxelyn-survival

Ativos de terceiros embutidos neste pacote (auto-hospedados; nada é baixado
em runtime). Os textos integrais das licenças vivem em [`licenses/`](./licenses/).

## Fontes

| Fonte                                             | Uso                                                 | Autores                                                                                        | Licença                                       |
| ------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Chakra Petch** (600, 700 — subset latin, woff2) | Voz de autoridade da UI (títulos, chips, navegação) | The Chakra Petch Project Authors — Cadson Demak (<https://github.com/m4rc1e/Chakra-Petch.git>) | [SIL OFL 1.1](./licenses/OFL-ChakraPetch.txt) |
| **VT323** (400 — subset latin, woff2)             | Carimbos de ação primária e displays de fósforo     | The VT323 Project Authors — Peter Hull (<peter.hull@oikoi.com>)                                | [SIL OFL 1.1](./licenses/OFL-VT323.txt)       |

Arquivos: `src/assets/fonts/chakra-petch-600.woff2`,
`src/assets/fonts/chakra-petch-700.woff2`, `src/assets/fonts/vt323-400.woff2`.
Subsets gerados a partir dos woff2 distribuídos pelo Google Fonts, sem
modificação dos glifos. A OFL permite embutir e redistribuir junto do
software; as fontes não são vendidas isoladamente.

## Ícones

| Conjunto                                             | Uso                                        | Autores                                      | Licença                                 |
| ---------------------------------------------------- | ------------------------------------------ | -------------------------------------------- | --------------------------------------- |
| **Phosphor Icons** (regular — 24 paths selecionados) | Ícones dos protocolos da Matriz Geracional | Phosphor Icons (<https://phosphoricons.com>) | [MIT](./licenses/MIT-PhosphorIcons.txt) |

Arquivo: `src/client/matrix-icons.ts` — os `path` SVG são copiados de
`@phosphor-icons/core` (peso regular, viewBox 256) e embutidos como
constantes; nenhuma outra parte da biblioteca é distribuída.

## Música

| Obra                                                | Uso                                          | Autor                            | Termos                                 |
| --------------------------------------------------- | -------------------------------------------- | -------------------------------- | -------------------------------------- |
| **Trilha composta do Voxelyn Survival** (FLAC, loop) | Trilha sonora da run, em todos os estratos | Clevo (@clevoclevoclevo)         | Composta para o jogo; usada com permissão do autor |

Arquivo: `public/audio/voxelyn-survival-theme.flac` — o master do compositor
empacotado sem perda por `scripts/prepare-soundtrack.mjs` (nenhuma alteração
no áudio além do container). O crédito também aparece no jogo, em
Opções → Trilha.
