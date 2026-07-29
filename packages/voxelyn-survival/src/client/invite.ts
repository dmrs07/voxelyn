// O link de convite.
//
// Separado de main.ts porque e a unica parte do convite que tem regra: o que
// entra e o que NAO entra no link. O resto (folha de compartilhamento, area de
// transferencia) e wiring de browser e nao da para testar sem um.

/**
 * Monta o link que leva direto para a sala.
 *
 * Remove o estado de sessao de quem convidou. Isso nao e higiene, e correcao:
 * `?dev=1` abriria as ferramentas de desenvolvimento na maquina do amigo, e
 * `?seed=` fixaria a descida dele numa seed que ele nao escolheu — os dois
 * silenciosamente, porque um link nao se explica.
 */
export const inviteUrlFrom = (href: string, code: string): string => {
  const url = new URL(href);
  url.searchParams.set('room', code);
  for (const key of ['dev', 'seed', 'solo', 'online']) url.searchParams.delete(key);
  return url.toString();
};
