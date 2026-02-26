import chalk from "chalk";

export interface LoggerOptions {
  json: boolean;
  verbose: boolean;
}

export class Logger {
  constructor(private readonly options: LoggerOptions) {}

  info(message: string): void {
    if (!this.options.json) {
      console.log(chalk.blue("ℹ"), message);
    }
  }

  success(message: string): void {
    if (!this.options.json) {
      console.log(chalk.green("✓"), message);
    }
  }

  warn(message: string): void {
    if (!this.options.json) {
      console.warn(chalk.yellow("⚠"), message);
    }
  }

  error(message: string): void {
    if (!this.options.json) {
      console.error(chalk.red("✗"), message);
    }
  }

  debug(message: string): void {
    if (this.options.verbose && !this.options.json) {
      console.log(chalk.gray("•"), message);
    }
  }

  outputJson(payload: unknown): void {
    console.log(JSON.stringify(payload, null, 2));
  }
}
