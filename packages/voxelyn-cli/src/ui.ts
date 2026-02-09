import process from 'node:process';
import { isCliError } from './errors.js';

export type LoggerOptions = {
  verbose?: boolean;
  quiet?: boolean;
  noColor?: boolean;
};

export type SpinnerHandle = {
  stop: (message?: string) => void;
  fail: (message?: string) => void;
};

export type Logger = {
  info: (message: string) => void;
  success: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug: (message: string) => void;
  spinner: (message: string) => SpinnerHandle;
  formatError: (err: unknown) => string;
};

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

const colorize = (enabled: boolean, color: string, text: string): string =>
  enabled ? `${color}${text}${colors.reset}` : text;

export const createLogger = (options: LoggerOptions): Logger => {
  const quiet = Boolean(options.quiet);
  const verbose = Boolean(options.verbose) && !quiet;
  const colorEnabled = !options.noColor && process.stdout.isTTY && !process.env.NO_COLOR;

  const write = (message: string): void => {
    if (quiet) return;
    process.stdout.write(`${message}\n`);
  };

  const writeErr = (message: string): void => {
    process.stderr.write(`${message}\n`);
  };

  const info = (message: string): void => write(message);
  const success = (message: string): void =>
    write(colorize(colorEnabled, colors.green, message));
  const warn = (message: string): void => {
    if (quiet) return;
    writeErr(colorize(colorEnabled, colors.yellow, message));
  };
  const error = (message: string): void =>
    writeErr(colorize(colorEnabled, colors.red, message));
  const debug = (message: string): void => {
    if (!verbose) return;
    write(colorize(colorEnabled, colors.gray, message));
  };

  const spinner = (message: string): SpinnerHandle => {
    if (quiet || !process.stdout.isTTY) {
      return {
        stop: () => undefined,
        fail: () => undefined
      };
    }

    const frames = ['-', '\\', '|', '/'];
    let index = 0;
    let active = true;

    const tick = () => {
      if (!active) return;
      const frame = frames[index % frames.length] ?? '-';
      index += 1;
      process.stdout.write(`\r${frame} ${message}`);
    };

    tick();
    const timer = setInterval(tick, 80);

    const end = (prefix: string, finalMessage?: string) => {
      active = false;
      clearInterval(timer);
      process.stdout.write('\r');
      const line = finalMessage ? `${prefix} ${finalMessage}` : `${prefix} ${message}`;
      write(line);
    };

    return {
      stop: (finalMessage?: string) => end(colorize(colorEnabled, colors.green, '[done]'), finalMessage),
      fail: (finalMessage?: string) => end(colorize(colorEnabled, colors.red, '[fail]'), finalMessage)
    };
  };

  const formatError = (err: unknown): string => {
    if (isCliError(err)) {
      return `[${err.code}] ${err.message}`;
    }
    const message = err instanceof Error ? err.message : String(err);
    return `[ERR_UNKNOWN] ${message}`;
  };

  return {
    info,
    success,
    warn,
    error,
    debug,
    spinner,
    formatError
  };
};
