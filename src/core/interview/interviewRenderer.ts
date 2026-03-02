import chalk from "chalk";
import type { InterviewQuestion } from "../types/index.js";

const CATEGORY_ICONS: Record<string, string> = {
  "Ontology": "🧠",
  "Domain Rules": "🛡",
  "Domain": "📐",
  "Boundaries": "🔒",
  "Decisions": "⚖️",
  "Invariants": "🛡",
  "Cognitive Risks": "⚠️",
  "General": "💡"
};

const PRIORITY_COLORS: Record<string, (text: string) => string> = {
  "critical": chalk.red,
  "important": chalk.yellow,
  "nice-to-have": chalk.gray
};

export class InterviewRenderer {
  renderHeader(totalQuestions: number): void {
    console.log();
    console.log(chalk.cyan.bold("╔══════════════════════════════════════════════════════════════╗"));
    console.log(chalk.cyan.bold("║") + chalk.white.bold("  ForgeMind — Architectural Interview                        ") + chalk.cyan.bold("║"));
    console.log(chalk.cyan.bold("╠══════════════════════════════════════════════════════════════╣"));
    console.log(chalk.cyan.bold("║") + chalk.gray(`  ${totalQuestions} questions prepared based on codebase analysis         `) + chalk.cyan.bold("║"));
    console.log(chalk.cyan.bold("║") + chalk.gray("  Commands: /skip (skip question) | /done (end interview)     ") + chalk.cyan.bold("║"));
    console.log(chalk.cyan.bold("╚══════════════════════════════════════════════════════════════╝"));
    console.log();
  }

  renderQuestion(question: InterviewQuestion, current: number, total: number): void {
    const icon = CATEGORY_ICONS[question.category] ?? "💡";
    const priorityColor = PRIORITY_COLORS[question.priority] ?? chalk.white;
    const progressBar = this.buildProgressBar(current, total);

    console.log();
    console.log(chalk.dim("─".repeat(62)));
    console.log(
      `${progressBar}  ${icon} ${chalk.bold(question.category)} ${priorityColor(`[${question.priority}]`)}`
    );
    console.log();
    console.log(chalk.white.bold(`  ${question.question}`));

    if (question.context) {
      console.log();
      console.log(chalk.dim(`  Context: ${question.context}`));
    }

    if (Array.isArray(question.options) && question.options.length > 0) {
      console.log();
      for (let i = 0; i < question.options.length; i++) {
        console.log(chalk.gray(`  ${i + 1}) ${question.options[i]}`));
      }
      console.log(chalk.gray("  0) Other (describe your own answer)"));
      console.log(chalk.dim("  Type the option number or write your own answer."));
    }
  }

  renderSkip(): void {
    console.log(chalk.gray("  ↷ Skipped"));
  }

  renderEarlyExit(questionsAnswered: number): void {
    console.log();
    console.log(chalk.yellow(`  Interview ended early. ${questionsAnswered} question(s) processed.`));
  }

  renderComplete(answersCount: number): void {
    console.log();
    console.log(chalk.dim("─".repeat(62)));
    console.log();
    console.log(chalk.green.bold("  ✓ Interview complete!"));
    console.log(chalk.gray(`  ${answersCount} answer(s) captured and will be used for document generation.`));
    console.log();
  }

  private buildProgressBar(current: number, total: number): string {
    const filled = Math.round((current / total) * 10);
    const empty = 10 - filled;
    const bar = chalk.cyan("█".repeat(filled)) + chalk.dim("░".repeat(empty));
    return `${bar} ${chalk.dim(`${current}/${total}`)}`;
  }
}
