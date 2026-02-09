import readline from 'node:readline';

export const promptText = async (question: string, defaultValue?: string): Promise<string> => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt = defaultValue ? `${question}` : question;
  const answer = await new Promise<string>((resolve) => rl.question(prompt, resolve));
  rl.close();
  const trimmed = answer.trim();
  if (!trimmed && defaultValue !== undefined) return defaultValue;
  return trimmed;
};

export const confirm = async (question: string, defaultValue = false): Promise<boolean> => {
  const hint = defaultValue ? 'Y/n' : 'y/N';
  const answer = await promptText(`${question} (${hint}) `);
  if (!answer) return defaultValue;
  const normalized = answer.toLowerCase();
  return normalized === 'y' || normalized === 'yes';
};

export const promptSelect = async (
  question: string,
  options: string[],
  defaultValue?: string
): Promise<string> => {
  const list = options.join('/');
  const answer = await promptText(`${question} (${list}): `, defaultValue);
  if (options.includes(answer)) return answer;
  const index = Number.parseInt(answer, 10);
  if (Number.isFinite(index) && index >= 1 && index <= options.length) {
    return options[index - 1] as string;
  }
  if (defaultValue && options.includes(defaultValue)) return defaultValue;
  throw new Error(`Invalid choice: ${answer}`);
};
