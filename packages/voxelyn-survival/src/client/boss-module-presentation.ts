// Os quatro estados de um modulo do Diamandis, do lado de quem desenha.
//
// A simulacao manda um evento so — `boss_module` com `state` — porque no wire os
// quatro estados tem o mesmo formato e inflar o protocolo com quatro tipos
// identicos seria pagar bytes por nada. O preco disso e que a DISTINCAO tem de
// existir aqui: sem ela o cliente ou ignora o evento (era o caso) ou desenha os
// quatro iguais, e o jogador ve o mesmo clarao quando ganha uma peca e quando a
// perde de vez.
//
// A economia dos Coveiros so e uma decisao se o jogador conseguir acompanhar o
// placar, e o placar e este:
//
//   exposed   soltou da carcaça. E uma OFERTA — a peça esta pendurada no
//             chassi, balancando, e um Coveiro ja pode engatar. Ouro.
//   detached  um Coveiro engatou e esta LEVANDO. Ainda da tempo: matar o
//             carregador devolve a sucata. Ambar, urgente.
//   dropped   o carregador caiu e a peça caiu com ele — e vira lasca de
//             minerio ali mesmo. Verde, porque a leitura e "voce ganhou isto
//             de volta", nao "apareceu algo novo".
//   lost      saiu do mapa. Nao ha o que fazer, e o aviso e uma nota de
//             prejuizo: vermelho.
//
// O CORPO e quem mostra onde a peca esta em cada estado (diamandis-body.ts):
// presa ou solta no chassi, pendurada no eletroima do Coveiro, caida no chao.
// Por isso nao ha mais uma marca de chao separada — a versao anterior punha
// uma cruz no ponto do evento, e no `exposed` esse ponto e onde o chefe ESTAVA,
// nao onde a peça esta.
//
// Vive fora do renderer porque e uma TABELA, e uma tabela pode ser conferida
// sem um canvas por perto — inclusive a garantia de que os quatro estados sao
// visualmente distintos entre si, que e a coisa que este arquivo existe para
// prometer.
import type { MessageKey } from './i18n';

// NOTA: o `module` deste evento e um indice de PEÇA do chefe (broca, torre,
// lente) e nao um `ModuleId` de equipamento do jogador. Os dois sao numeros
// pequenos e se parecem no wire; passar um pelo outro daria um toast com o nome
// errado sem nenhum erro de tipo, entao a tabela de nomes daqui e propria.

export type BossModuleState = 'exposed' | 'detached' | 'dropped' | 'lost';

export type BossModulePresentation = {
  /** Cor do aviso, do clarao e da marca. Distinta em cada estado. */
  color: string;
  /** Chave do toast; recebe `{module}` com o nome da peça. */
  toastKey: MessageKey;
  /** Quanto tempo o aviso fica na tela. Perder dura mais que ganhar. */
  toastMs: number;
  /** Alcance do clarao, em tiles. */
  flashRadius: number;
  flashPower: number;
  flashMs: number;
};

const TABLE: Record<BossModuleState, BossModulePresentation> = {
  exposed: {
    color: '#ffd166',
    toastKey: 'toast.bossModule.exposed',
    toastMs: 2400,
    flashRadius: 4,
    flashPower: 0.8,
    flashMs: 320,
  },
  detached: {
    color: '#ffa63f',
    toastKey: 'toast.bossModule.detached',
    toastMs: 2600,
    flashRadius: 5,
    flashPower: 0.95,
    flashMs: 280,
  },
  dropped: {
    color: '#59f2c2',
    toastKey: 'toast.bossModule.dropped',
    toastMs: 2200,
    flashRadius: 3.5,
    flashPower: 0.7,
    flashMs: 300,
  },
  lost: {
    color: '#d93b4c',
    toastKey: 'toast.bossModule.lost',
    toastMs: 3200,
    flashRadius: 2.5,
    flashPower: 0.5,
    flashMs: 420,
  },
};

export const bossModulePresentation = (state: BossModuleState): BossModulePresentation =>
  TABLE[state];

/**
 * Nome da peça pelo indice que viaja no evento.
 *
 * Os indices sao BOSS_MODULE_DRILL/TOWER/SCANNER da simulacao. Um indice fora
 * da faixa nao pode derrubar o quadro nem sair como "undefined" no toast: cai
 * na chave generica, que continua sendo uma frase valida.
 */
export const BOSS_MODULE_NAME_KEYS: readonly MessageKey[] = [
  'bossModule.drill',
  'bossModule.tower',
  'bossModule.scanner',
];

export const bossModuleNameKey = (module: number): MessageKey =>
  BOSS_MODULE_NAME_KEYS[module] ?? 'bossModule.unknown';
