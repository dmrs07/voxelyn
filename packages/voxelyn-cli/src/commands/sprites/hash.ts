import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
    .join(',')}}`;
};

export const sha256Bytes = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

export const sha256File = (filePath: string): string => sha256Bytes(readFileSync(filePath));

export const sha256CanonicalJson = (value: unknown): string =>
  sha256Bytes(new TextEncoder().encode(canonicalize(value)));
