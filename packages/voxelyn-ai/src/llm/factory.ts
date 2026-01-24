/**
 * @voxelyn/ai - LLM Client Factory
 *
 * Factory function for creating LLM clients with a unified configuration.
 */

import type { LLMClient, LLMClientConfig, QuickConfig, LLMProvider, ModelId } from './types';
import {
  GeminiClient,
  OpenAIClient,
  AnthropicClient,
  CopilotLLMClient,
  OllamaClient,
  GroqClient,
} from './providers';

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create an LLM client from a full configuration object.
 *
 * @example
 * ```ts
 * const client = createLLMClient({
 *   provider: 'openai',
 *   model: 'gpt-4o',
 *   config: { apiKey: process.env.OPENAI_API_KEY! },
 *   debug: true,
 * });
 * ```
 */
export function createLLMClient<P extends LLMProvider>(
  config: LLMClientConfig<P>
): LLMClient {
  const baseConfig = {
    maxRetries: config.maxRetries,
    timeoutMs: config.timeoutMs,
    debug: config.debug,
  };

  switch (config.provider) {
    case 'gemini': {
      const geminiConfig = config.config as { apiKey: string };
      return new GeminiClient({
        ...baseConfig,
        apiKey: geminiConfig.apiKey,
        model: config.model as ModelId['gemini'],
      });
    }

    case 'openai': {
      const openaiConfig = config.config as {
        apiKey: string;
        organization?: string;
        baseURL?: string;
      };
      return new OpenAIClient({
        ...baseConfig,
        apiKey: openaiConfig.apiKey,
        organization: openaiConfig.organization,
        baseURL: openaiConfig.baseURL,
        model: config.model as ModelId['openai'],
      });
    }

    case 'anthropic': {
      const anthropicConfig = config.config as { apiKey: string };
      return new AnthropicClient({
        ...baseConfig,
        apiKey: anthropicConfig.apiKey,
        model: config.model as ModelId['anthropic'],
      });
    }

    case 'copilot': {
      const copilotConfig = config.config as { token: string };
      return new CopilotLLMClient({
        ...baseConfig,
        token: copilotConfig.token,
        model: config.model as ModelId['copilot'],
      });
    }

    case 'ollama': {
      const ollamaConfig = config.config as { baseURL?: string };
      return new OllamaClient({
        ...baseConfig,
        baseURL: ollamaConfig.baseURL,
        model: config.model as ModelId['ollama'],
      });
    }

    case 'groq': {
      const groqConfig = config.config as { apiKey: string };
      return new GroqClient({
        ...baseConfig,
        apiKey: groqConfig.apiKey,
        model: config.model as ModelId['groq'],
      });
    }

    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

/**
 * Create an LLM client from a quick configuration.
 * Simpler API for common use cases.
 *
 * @example
 * ```ts
 * // Gemini
 * const gemini = createClient({ provider: 'gemini', apiKey: 'xxx' });
 *
 * // OpenAI
 * const openai = createClient({ provider: 'openai', apiKey: 'xxx', model: 'gpt-4o' });
 *
 * // Local Ollama
 * const ollama = createClient({ provider: 'ollama', model: 'llama3.2' });
 *
 * // GitHub Copilot
 * const copilot = createClient({ provider: 'copilot', token: process.env.GITHUB_TOKEN });
 * ```
 */
export function createClient(config: QuickConfig): LLMClient {
  switch (config.provider) {
    case 'gemini':
      return new GeminiClient({
        apiKey: config.apiKey,
        model: config.model,
      });

    case 'openai':
      return new OpenAIClient({
        apiKey: config.apiKey,
        model: config.model,
      });

    case 'anthropic':
      return new AnthropicClient({
        apiKey: config.apiKey,
        model: config.model,
      });

    case 'copilot':
      return new CopilotLLMClient({
        token: config.token,
        model: config.model,
      });

    case 'ollama':
      return new OllamaClient({
        baseURL: config.baseURL,
        model: config.model,
      });

    case 'groq':
      return new GroqClient({
        apiKey: config.apiKey,
        model: config.model,
      });

    default:
      throw new Error(`Unknown LLM provider: ${(config as QuickConfig).provider}`);
  }
}

// ============================================================================
// PROVIDER DETECTION
// ============================================================================

/**
 * Get available providers based on environment variables.
 * Returns providers that have their required API keys set.
 */
export function getAvailableProviders(): LLMProvider[] {
  const available: LLMProvider[] = [];

  // Check for globalThis.process (Node.js environment)
  const env = getEnv();

  if (env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY) {
    available.push('gemini');
  }
  if (env.OPENAI_API_KEY) {
    available.push('openai');
  }
  if (env.ANTHROPIC_API_KEY) {
    available.push('anthropic');
  }
  if (env.GITHUB_TOKEN || env.COPILOT_TOKEN) {
    available.push('copilot');
  }
  if (env.GROQ_API_KEY) {
    available.push('groq');
  }

  // Ollama is always potentially available (local)
  available.push('ollama');

  return available;
}

/**
 * Get environment variables safely (works in Node.js and browser)
 */
function getEnv(): Record<string, string | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (g.process?.env) {
    return g.process.env as Record<string, string | undefined>;
  }
  return {};
}

/**
 * Auto-detect and create the best available client.
 * Checks environment variables for API keys.
 *
 * Priority: Gemini > OpenAI > Anthropic > Groq > Ollama
 */
export function createAutoClient(options?: {
  preferredProvider?: LLMProvider;
  debug?: boolean;
}): LLMClient | null {
  const env = getEnv();
  const debug = options?.debug;

  // Check preferred provider first
  if (options?.preferredProvider) {
    const client = tryCreateFromEnv(options.preferredProvider, env, debug);
    if (client) return client;
  }

  // Try providers in priority order
  const providers: LLMProvider[] = ['gemini', 'openai', 'anthropic', 'groq', 'ollama'];

  for (const provider of providers) {
    const client = tryCreateFromEnv(provider, env, debug);
    if (client) return client;
  }

  return null;
}

function tryCreateFromEnv(
  provider: LLMProvider,
  env: Record<string, string | undefined>,
  debug?: boolean
): LLMClient | null {
  try {
    switch (provider) {
      case 'gemini': {
        const apiKey = env.GEMINI_API_KEY ?? env.GOOGLE_AI_API_KEY;
        if (apiKey) {
          return new GeminiClient({ apiKey, debug });
        }
        break;
      }

      case 'openai': {
        const apiKey = env.OPENAI_API_KEY;
        if (apiKey) {
          return new OpenAIClient({ apiKey, debug });
        }
        break;
      }

      case 'anthropic': {
        const apiKey = env.ANTHROPIC_API_KEY;
        if (apiKey) {
          return new AnthropicClient({ apiKey, debug });
        }
        break;
      }

      case 'copilot': {
        const token = env.GITHUB_TOKEN ?? env.COPILOT_TOKEN;
        if (token) {
          return new CopilotLLMClient({ token, debug });
        }
        break;
      }

      case 'groq': {
        const apiKey = env.GROQ_API_KEY;
        if (apiKey) {
          return new GroqClient({ apiKey, debug });
        }
        break;
      }

      case 'ollama':
        // Ollama doesn't need an API key
        return new OllamaClient({ debug });
    }
  } catch {
    // Provider not available
  }

  return null;
}
