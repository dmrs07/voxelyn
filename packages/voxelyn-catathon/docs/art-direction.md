# Catathon — direcao de arte dos gatos

Os sprites sao PROCEDURAIS (desenhados pixel a pixel em `client/render.ts`),
mas as regras de um bom sprite sheet valem igual. Este documento e o portao
de qualidade: toda pose nova passa por ele antes de entrar.

## A regra central

> Um gato precisa ler como GATO na silhueta, e uma acao precisa ler na pose
> — nunca em pixels soltos que "significam" a acao.

A splash oficial e a referencia de identidade (raca, expressao, pose
intencional, contato fisico com o objeto). Os primeiros sprites simples sao
a referencia de charme iconico. Os frames que viraram "retangulo + dois
pixels de mao" sao referencia de BUG, nunca de arte.

## Anatomia (toda pose, todo frame)

- A silhueta preserva pelo menos quatro de: orelhas, focinho/bochecha,
  peito, anca, antebraco, perna, rabo, curva do dorso.
- Pata pertence a um braco: colunas continuas do ombro ao contato. Nenhum
  pixel flutuante representa membro.
- Roupa VESTE o corpo: a camisa segue o volume do peito e para na anca; a
  gravata pende do colarinho; oculos alinham com os dois olhos. Se o
  figurino transforma o torso em caixa, a pose esta errada — refazer.
- Padrao de pelagem acompanha o volume (listras cruzam o dorso em arco),
  nunca vira ruido de superficie.
- Contato estavel com chao/mesa/cadeira em todo frame.

## Acao = pontos de contato + olhar

- Teclar: sentado DE COSTAS para a camera, virado para a mesa; as duas
  patas pousadas na beira do teclado; cabeca entre os antebracos encarando
  o monitor (`drawTypingCat`).
- Consertar no rack, comer, dormir, brigar, carinho: cada um tem ancora
  fisica explicita (alcance visivel ao objeto, focinho na tigela, apoio do
  peito, contato dos golpes).
- O olhar sustenta a acao: focinho e ombros giram para a ferramenta. Um
  gato nunca tecla olhando para fora da mesa.

## Animacao (nunca "icone piscando")

- Corpo conectado: pata → antebraco → ombro leve → massa plantada.
- Movimento secundario: flick de orelha, ponta do rabo, piscada.
- Ritmo IRREGULAR para trabalho: rajada, pausa de leitura, um toque
  deliberado. Alternancia mecanica perfeita parece robo.
- Dois pixels oscilando NAO sao uma animacao.

## Espaco individual (sistema, nao z-index)

- Postos sociais tem VAGAS deterministicas (`VENUE_OFFSETS`,
  `DECIDE_SPOTS`) com separacao minima — silhuetas de vagas ocupadas nunca
  se intersectam.
- Mesa e territorio de UM gato (drop desaloja); posto social nunca desaloja.
- O PM aborda pelo lado LIVRE da mesa (`PM_PEP_SIDE`, lado do centro) e a
  entrega exige proximidade real (`PM_PEP_RADIUS`) — presenca ao lado, nunca
  sobreposicao.
- Toque: `catAt` resolve o gato MAIS PROXIMO — vagas distintas garantem
  alvos distintos.

## Regras de pixel

- Posicao inteira sempre (`Math.round` nas ancoras); nada de subpixel.
- Aglomerados deliberados; pixel isolado so para olho, bigode ou brilho.
- Paleta por gato limitada (body/mark/belly + derivados via
  `adjustBrightness`).
- Conferir toda pose em 1x no view do jogo (mobile), nao so ampliada.

## Portoes de rejeicao

Rejeitar qualquer pose/frame se:

- a acao nao se identifica sem texto de UI;
- alguma pata esta desconectada do corpo;
- o gato opera um objeto olhando para o lado oposto;
- o figurino destroi a silhueta felina;
- dois gatos se fundem visualmente num posto;
- o volume do corpo muda sem intencao entre frames;
- o movimento e so pixel isolado piscando;
- a versao ampliada parece boa mas a escala nativa nao.
