export class CliError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const isCliError = (err: unknown): err is CliError =>
  typeof err === 'object' && err !== null && 'code' in err;
