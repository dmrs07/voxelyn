import { installDeathEchoPresentation } from './death-echo-presentation';

// Imports estáticos executam dependências antes do corpo deste módulo. `main.ts`
// precisa ser dinâmico para que o decorador esteja instalado ANTES de construir
// `SurvivalRenderer`; não é lazy loading de gameplay, é ordem de inicialização.
installDeathEchoPresentation();
void import('./main');
