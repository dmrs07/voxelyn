import { readPackageJson, readVoxelynConfig, writePackageJson } from './config.js';
import { importFromProject } from './project-import.js';
import type { CliOptions } from './types.js';
import type { Logger } from './ui.js';
import { resolvePackageManager, runAdd, runRemove, runScript, runInstall } from './pm.js';

export type PluginCommand = (
  options: CliOptions,
  positionals: string[],
  logger: Logger
) => Promise<void> | void;

export type PluginRegistry = Map<string, PluginCommand>;

export type PluginContext = {
  registerCommand: (name: string, handler: PluginCommand) => void;
  logger: Logger;
  fs: {
    readPackageJson: typeof readPackageJson;
    writePackageJson: typeof writePackageJson;
  };
  pm: {
    resolvePackageManager: typeof resolvePackageManager;
    runScript: typeof runScript;
    runInstall: typeof runInstall;
    runAdd: typeof runAdd;
    runRemove: typeof runRemove;
  };
};

export const loadPlugins = async (cwd: string, logger: Logger): Promise<PluginRegistry> => {
  const registry: PluginRegistry = new Map();
  let config;
  try {
    config = await readVoxelynConfig(cwd);
  } catch {
    return registry;
  }

  const plugins = config.plugins ?? [];
  if (plugins.length === 0) return registry;

  const registerCommand = (name: string, handler: PluginCommand): void => {
    if (registry.has(name)) {
      logger.warn(`[plugin] command already registered: ${name}`);
      return;
    }
    registry.set(name, handler);
  };

  const ctx: PluginContext = {
    registerCommand,
    logger,
    fs: { readPackageJson, writePackageJson },
    pm: { resolvePackageManager, runScript, runInstall, runAdd, runRemove }
  };

  for (const pluginName of plugins) {
    const mod = await importFromProject(pluginName, cwd);
    if (!mod) {
      logger.warn(`[plugin] failed to load ${pluginName}`);
      continue;
    }
    const register =
      typeof mod.register === 'function'
        ? (mod.register as (ctx: PluginContext) => Promise<void> | void)
        : typeof (mod.default as { register?: unknown })?.register === 'function'
          ? ((mod.default as { register: (ctx: PluginContext) => Promise<void> | void }).register)
          : null;

    if (!register) {
      logger.warn(`[plugin] ${pluginName} has no register() export`);
      continue;
    }

    try {
      await register(ctx);
      logger.debug(`[plugin] loaded ${pluginName}`);
    } catch (err) {
      logger.warn(`[plugin] error loading ${pluginName}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return registry;
};
