import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Cliente de upload do Cloudinary — assinado, sem SDK.
 *
 * O SDK oficial arrasta uma arvore de dependencias para fazer o que cabe em
 * `createHash` mais `fetch`: a assinatura e um SHA-1 dos parametros ordenados
 * com o segredo concatenado no fim, e o upload e um POST de formulario. O
 * resto do pipeline do devlog tambem nao tem dependencia de runtime, e nao vai
 * ganhar uma por causa disto.
 *
 * As credenciais NUNCA aparecem em arquivo versionado. Elas vem do ambiente, o
 * segredo so e usado para calcular a assinatura, e o que fica gravado no
 * plan.json e a URL publica que sai do upload.
 */

const API = 'https://api.cloudinary.com/v1_1';

/** Pasta raiz no Cloudinary. Manter estavel: ela vira parte da URL publica. */
export const ROOT_FOLDER = 'voxelyn/devlog';

export class CloudinaryError extends Error {}

/**
 * Le as credenciais do ambiente.
 *
 * `CLOUDINARY_URL` (cloudinary://key:secret@cloud) e o formato que o proprio
 * painel do Cloudinary entrega para colar, entao ele e aceito inteiro em vez
 * de obrigar a quebrar em tres variaveis a mao.
 */
export const credentialsFromEnv = (env = process.env) => {
  if (env.CLOUDINARY_URL) {
    const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(env.CLOUDINARY_URL.trim());
    if (!m)
      throw new CloudinaryError('CLOUDINARY_URL fora do formato cloudinary://key:secret@cloud');
    return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
  }
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
};

/**
 * Assinatura da requisicao.
 *
 * SHA-1 dos parametros em ordem alfabetica, no formato `k=v&k=v`, com o
 * segredo colado no fim. `file`, `api_key` e `resource_type` ficam de fora —
 * e a regra do Cloudinary, e incluir qualquer um deles produz uma assinatura
 * que o servidor recusa sem dizer qual campo sobrou.
 */
export const signParams = (params, apiSecret) => {
  const canonical = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1')
    .update(canonical + apiSecret)
    .digest('hex');
};

/** PDF sobe como `raw` para voltar byte a byte; imagem sobe como `image`. */
export const resourceTypeFor = (file) => (file.toLowerCase().endsWith('.pdf') ? 'raw' : 'image');

const mimeFor = (file) => {
  if (file.toLowerCase().endsWith('.pdf')) return 'application/pdf';
  if (file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg'))
    return 'image/jpeg';
  return 'image/png';
};

/**
 * Sobe um arquivo e devolve a URL segura.
 *
 * `overwrite` mais `invalidate` porque o `public_id` e deterministico: recapturar
 * a entrada 032 tem de trocar a imagem NAQUELA url, e nao criar uma segunda. Um
 * devlog cujo link muda a cada reexecucao nao serve para nada.
 */
export const uploadFile = async (localPath, publicId, credentials, { timeoutMs = 60_000 } = {}) => {
  const { cloudName, apiKey, apiSecret } = credentials;
  const resourceType = resourceTypeFor(localPath);
  const timestamp = Math.floor(Date.now() / 1000);

  const signed = {
    invalidate: 'true',
    overwrite: 'true',
    public_id: publicId,
    timestamp,
  };

  const form = new URLSearchParams({
    ...signed,
    api_key: apiKey,
    signature: signParams(signed, apiSecret),
    file: `data:${mimeFor(localPath)};base64,${readFileSync(localPath).toString('base64')}`,
  });

  const response = await fetch(`${API}/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  if (!response.ok) {
    let detail = text.slice(0, 300);
    try {
      detail = JSON.parse(text).error?.message ?? detail;
    } catch {
      /* corpo nao-JSON: o texto cru ja e a melhor pista */
    }
    throw new CloudinaryError(`upload de ${publicId} falhou (${response.status}): ${detail}`);
  }

  const body = JSON.parse(text);
  if (!body.secure_url) throw new CloudinaryError(`upload de ${publicId} sem secure_url`);
  return { url: body.secure_url, bytes: body.bytes, publicId: body.public_id };
};

/**
 * `public_id` a partir do caminho relativo dentro de docs/devlog.
 *
 * Deterministico, para a URL ser estavel entre reexecucoes: `media/001-noita.png`
 * vira `voxelyn/devlog/media/001-noita`.
 *
 * A extensao so cai fora em `image`, onde o Cloudinary anexa a dele. Em `raw`
 * ele usa o id LITERALMENTE, e tirar o `.pdf` produziria uma URL sem extensao
 * — que o navegador baixa como arquivo sem nome de tipo.
 */
export const publicIdFor = (relativePath) =>
  resourceTypeFor(relativePath) === 'raw'
    ? `${ROOT_FOLDER}/${relativePath}`
    : `${ROOT_FOLDER}/${relativePath.replace(/\.[^./]+$/, '')}`;
