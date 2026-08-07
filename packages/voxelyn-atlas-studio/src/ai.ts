// IA projetando poses: chama a Claude API direto do PWA (chave do usuario,
// guardada so no aparelho) e pede um JSON compacto de poses POR PARTE — que o
// motor deterministico de src/pose.ts aplica nos voxels. A IA decide o
// MOVIMENTO; o motor garante a precisao.
import Anthropic from '@anthropic-ai/sdk';
import type { AnimationSpec, Part } from './pose';
import { MAX_DEG, MAX_MOVE, partsSummary } from './pose';
import type { VisionImage } from './vision';
import type { VoxelModel } from './voxel';

const KEY_STORAGE = 'voxelyn-atlas-studio-anthropic-key';
const MODEL_STORAGE = 'voxelyn-atlas-studio-anthropic-model';

export const getApiKey = (): string => localStorage.getItem(KEY_STORAGE) ?? '';
export const setApiKey = (key: string): void => {
  if (key) localStorage.setItem(KEY_STORAGE, key);
  else localStorage.removeItem(KEY_STORAGE);
};

/** Modelos oferecidos no seletor, do mais capaz ao mais barato. */
export const AI_MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 — melhor qualidade (padrao)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 — rapido e mais barato' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — o mais barato' },
] as const;

export const DEFAULT_MODEL = AI_MODELS[0].id;

export const getModel = (): string => {
  const stored = localStorage.getItem(MODEL_STORAGE);
  return AI_MODELS.some((m) => m.id === stored) ? stored! : DEFAULT_MODEL;
};
export const setModel = (model: string): void => {
  localStorage.setItem(MODEL_STORAGE, model);
};

/** Schema do spec de animacao — a API valida a resposta contra ele. */
const SPEC_SCHEMA = {
  type: 'object',
  properties: {
    frames: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          poses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                part: { type: 'string' },
                move: {
                  type: 'array',
                  items: { type: 'integer' },
                },
                rotate: {
                  type: 'object',
                  properties: {
                    axis: { type: 'string', enum: ['x', 'y', 'z'] },
                    deg: { type: 'integer' },
                  },
                  required: ['axis', 'deg'],
                  additionalProperties: false,
                },
              },
              required: ['part'],
              additionalProperties: false,
            },
          },
        },
        required: ['poses'],
        additionalProperties: false,
      },
    },
  },
  required: ['frames'],
  additionalProperties: false,
} as const;

const SYSTEM = `Voce e um animador de sprites voxel isometricos de um jogo de acao. Voce projeta POSES por keyframe para um modelo voxel segmentado em partes nomeadas.

Voce recebe imagens da pose neutra e um MAPA DE PARTES colorido, com legenda dizendo qual cor e qual parte. Use as imagens para entender a anatomia — para que lado cada membro aponta, onde ele encosta no corpo, o que e frente — e use os numeros do resumo para dimensionar o movimento.

Convencoes do espaco (fixas):
- FRENTE do personagem = -y (avancar e dy negativo). Tras = +y.
- Cima = +z. O chao esta em z=0 e nada pode afundar nele.
- +x e a direita anatomica do modelo.

O modelo tem um ESQUELETO em arvore: "corpo" e a raiz, a raiz de cada membro se prende nele, e os ossos seguintes ("perna-1.canela", "perna-1.pe") se penduram no anterior. O resumo diz o pai de cada osso.

Vale a regra da cinematica direta: girar um osso LEVA OS FILHOS JUNTO. Entao:
- girar a raiz de um membro ("perna-1") balanca o membro inteiro a partir do quadril/ombro;
- girar o osso seguinte ("perna-1.canela") dobra o joelho/cotovelo, sem mexer na coxa;
- mover ou girar "corpo" carrega o bicho inteiro — use para bob, inclinacao e recuo, e NAO repita o mesmo deslocamento nos membros.

Voce descreve cada frame como uma lista de poses por osso:
- move [dx, dy, dz]: desloca em voxels (inteiros, ate ${MAX_MOVE} por eixo).
- rotate {axis, deg}: gira em torno do PIVO do osso, que e a junta com o pai (graus inteiros, ate ${MAX_DEG}). Para pernas, axis "x" com deg negativo balanca para FRENTE, positivo para tras.
- Ossos nao citados ficam na pose neutra. Todas as poses sao RELATIVAS a pose base (frame nao acumula sobre frame).

Principios de animacao que voce aplica:
- Ciclos (idle, walk) fecham: o ultimo frame conduz de volta ao primeiro; pernas alternam em fases opostas; o corpo tem bob sutil (dz 0-1) no ritmo dos passos.
- Uma perna so le como perna quando a junta trabalha: a coxa vai para frente e a canela dobra atras dela no meio do passo, e estende de novo ao tocar o chao. Perna que so pendula rigida do quadril parece muleta.
- Num bicho de muitas patas, agrupe em fases opostas (as pares avancam enquanto as impares apoiam) em vez de tratar cada pata como um caso solto.
- Antecipacao e follow-through em ataques: recuo curto, pico de extensao, retorno.
- Silhueta legivel: movimentos pequenos e intencionais (1-3 voxels, 10-30 graus) leem melhor que deslocamentos grandes.
- Recuo de dano inclina o corpo para tras (+y) e volta; morte NAO e sua responsabilidade (o jogo tem desmoronamento proprio).

Responda apenas com o JSON pedido.`;

export type PoseRequest = {
  model: VoxelModel;
  parts: Part[];
  animation: string;
  frames: number;
  fps: number;
  loop: boolean;
  /** descricao do personagem e do movimento desejado, nas palavras do autor */
  description: string;
  /** pose neutra renderizada + mapa de partes colorido (ver src/vision.ts) */
  images?: VisionImage[];
};

/**
 * Pede a Claude o spec de poses. Lanca Error com mensagem legivel em falha.
 * O resultado ja vem validado pelo schema; os limites finos (clamp de move e
 * graus) sao aplicados pelo motor ao aplicar.
 */
export const designPoses = async (req: PoseRequest): Promise<AnimationSpec> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Configure sua chave da API Anthropic primeiro');

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  // as imagens vem primeiro: o modelo le a anatomia e so depois as medidas
  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of req.images ?? []) {
    content.push({ type: 'text', text: img.label });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: img.base64 },
    });
  }
  content.push({
    type: 'text',
    text: [
      partsSummary(req.parts, req.model),
      '',
      `Animacao a projetar: "${req.animation}" com EXATAMENTE ${req.frames} frames a ${req.fps} fps (${req.loop ? 'em loop' : 'sem loop'}).`,
      `Descricao do autor: ${req.description || '(sem descricao — use o nome da animacao e a anatomia das partes)'}`,
      '',
      `Projete as poses dos ${req.frames} frames.`,
    ].join('\n'),
  });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: getModel(),
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SPEC_SCHEMA } },
      messages: [{ role: 'user', content }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error('Chave da API invalida — confira em Configurar IA');
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new Error('Limite de requisicoes atingido — tente de novo em instantes');
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new Error('Sem conexao com a API — verifique a internet');
    }
    throw new Error(`Falha na API: ${(err as Error).message}`);
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('A API recusou o pedido — reformule a descricao');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Resposta truncada — tente uma animacao com menos frames');
  }
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('Resposta sem conteudo');
  const spec = JSON.parse(text.text) as AnimationSpec;
  if (!Array.isArray(spec.frames) || spec.frames.length === 0) {
    throw new Error('A IA nao devolveu frames — tente de novo');
  }
  return spec;
};
