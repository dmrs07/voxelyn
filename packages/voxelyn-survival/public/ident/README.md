# Identidade do desenvolvedor

Este diretório recebe a marca que abre o jogo — a primeira tela da sequência de
abertura, antes de qualquer coisa do Voxelyn Survival aparecer.

**Ela é do desenvolvedor, não da Aurix Dynamics.** A Aurix é a companhia
_fictícia_ de dentro do jogo: emprega o Prospector, assina a Ordem de Despacho,
publica o contrato semanal e carimba a key art. O emblema dela vive em
`src/assets/aurix-mark.svg` e pertence ao mundo do jogo — usá-lo na abertura
diria ao jogador que a Aurix fez o Voxelyn Survival.

## Como instalar a marca

1. Ponha o arquivo aqui. **SVG de preferência** — a abertura escala de um
   celular de 320 px a um monitor 4K, e um vetor atravessa isso sem borrar. PNG
   com fundo transparente também serve; mande no dobro do tamanho de exibição
   (a marca é desenhada com até 132 px de altura, então 264 px de lado bastam).
2. Preencha `src/client/boot/developer-ident.ts`:

   ```ts
   export const DEVELOPER_IDENT: DeveloperIdent = {
     name: 'NOME QUE APARECE SOB A MARCA',
     markUrl: 'ident/nome-do-arquivo.svg',
   };
   ```

   `name` vazio deixa só a marca; `markUrl` vazio deixa só a tipografia. Os dois
   vazios (o estado de hoje) fazem a fase de identidade durar **zero** — a
   abertura começa direto na tela de carregamento, sem tela preta à toa.

3. Acrescente o arquivo à lista `OPTIONAL` de `public/sw.js`, junto da key art e
   da trilha. É o que faz a abertura funcionar offline no PWA. Opcional, e não
   obrigatório: uma marca ausente nunca pode custar o install.

## O que a tela faz com ela

Fundo preto, marca centralizada, nome abaixo em Chakra Petch. Nada de HUD, nada
de menu, nada de barra de carregamento — o preload está rodando por trás desde
o primeiro milissegundo, mas essa tela não fala dele.

A marca é esperada pelo preload como qualquer outro recurso (tarefa
`ident-mark`, **não crítica**): se o arquivo faltar ou não decodificar, a tela
cai na tipografia sozinha e a abertura segue. Nenhum caminho do boot depende
dela.

Tempos em `src/client/boot/boot-flow.ts` (`BOOT_TIMING_FULL`): entra em 380 ms,
fica 1100 ms, sai em 380 ms. O total cabe abaixo de dois segundos de propósito —
quem abre o jogo pela décima vez no dia não pode ser cobrado por isso.
