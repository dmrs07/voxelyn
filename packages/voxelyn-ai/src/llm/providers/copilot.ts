/**
 * @voxelyn/ai - GitHub Copilot Provider
 *
 * LLM client implementation using GitHub Copilot SDK.
 *
 * The Copilot SDK is session-based and manages its own CLI process.
 * This provider creates sessions on-demand for each generation request.
 *
 * NOTE: Requires @github/copilot-sdk to be installed separately.
 * Install with: npm install @github/copilot-sdk
 *
 * @see https://github.com/github/copilot-sdk
 */

import { BaseLLMClient, type BaseClientConfig } from '../base-client';
import type { LLMProvider, ModelId } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export type CopilotConfig = {
  /**
   * GitHub token with Copilot access.
   * If not provided, the SDK will use the default GitHub authentication.
   */
  token?: string;
  /**
   * Model to use for generation.
   * Default: gpt-4o
   */
  model?: ModelId['copilot'];
  /**
   * Path to Copilot CLI executable.
   * Default: "copilot" (searches PATH)
   */
  cliPath?: string;
} & Partial<BaseClientConfig>;

// Dynamic types for the Copilot SDK (loaded at runtime)
type CopilotClientInstance = {
  start(): Promise<void>;
  stop(): Promise<unknown[]>;
  createSession(config: { model?: string }): Promise<CopilotSessionInstance>;
  getState(): string;
};

type CopilotSessionInstance = {
  sendAndWait(opts: { prompt: string }): Promise<{ data: { content: string } } | null>;
  destroy(): Promise<void>;
};

type CopilotSDK = {
  CopilotClient: new (options?: Record<string, unknown>) => CopilotClientInstance;
};

// ============================================================================
// COPILOT CLIENT
// ============================================================================

/**
 * GitHub Copilot LLM client implementation.
 *
 * Uses the @github/copilot-sdk to communicate with the Copilot CLI.
 * Sessions are created on-demand and cleaned up after each request.
 */
export class CopilotLLMClient extends BaseLLMClient {
  readonly provider: LLMProvider = 'copilot';
  readonly model: string;

  private token?: string;
  private cliPath?: string;
  private client: CopilotClientInstance | null = null;
  private SDK: CopilotSDK | null = null;

  constructor(config: CopilotConfig) {
    super(config);

    this.model = config.model ?? 'gpt-4o';
    this.token = config.token;
    this.cliPath = config.cliPath;
  }

  /**
   * Lazily load the Copilot SDK.
   * This allows the provider to be included without requiring the SDK to be installed.
   */
  private async getSDK(): Promise<CopilotSDK> {
    if (this.SDK) {
      return this.SDK;
    }

    try {
      // Lazily import the Copilot SDK so it's only required when this provider is used
      const sdkModule = await import('@github/copilot-sdk');
      this.SDK = sdkModule as unknown as CopilotSDK;
      return this.SDK;
    } catch {
      throw new Error(
        'GitHub Copilot SDK not installed. Install with: npm install @github/copilot-sdk'
      );
    }
  }

  /**
   * Get or create the Copilot client.
   */
  private async getClient(): Promise<CopilotClientInstance> {
    if (this.client && this.client.getState() === 'connected') {
      return this.client;
    }

    const SDK = await this.getSDK();

    const options: Record<string, unknown> = {
      autoStart: true,
      autoRestart: true,
      logLevel: this.config.debug ? 'debug' : 'error',
    };

    if (this.cliPath) {
      options.cliPath = this.cliPath;
    }

    if (this.token) {
      // Get current env from globalThis
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentEnv = (globalThis as any).process?.env ?? {};
      options.env = {
        ...currentEnv,
        GITHUB_TOKEN: this.token,
      };
    }

    this.client = new SDK.CopilotClient(options);
    await this.client.start();

    return this.client;
  }

  protected async generateContent(
    systemPrompt: string,
    userPrompt: string,
    _options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    const client = await this.getClient();

    // Create a session for this request
    const session = await client.createSession({
      model: this.model,
    });

    try {
      // Combine system and user prompts
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

      // Send and wait for response
      const response = await session.sendAndWait({ prompt: fullPrompt });

      if (!response?.data?.content) {
        throw new Error('Empty response from Copilot');
      }

      return response.data.content;
    } finally {
      // Clean up the session
      await session.destroy();
    }
  }

  /**
   * Test the Copilot connection.
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.getClient();
      return client.getState() === 'connected';
    } catch (e) {
      if (this.config.debug) {
        console.error('[voxelyn-ai:copilot] Connection test failed:', e);
      }
      return false;
    }
  }

  /**
   * Stop the Copilot client.
   * Call this when done to clean up resources.
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.stop();
      this.client = null;
    }
  }
}

/**
 * Create a GitHub Copilot client.
 */
export function createCopilotClient(config: CopilotConfig): CopilotLLMClient {
  return new CopilotLLMClient(config);
}
