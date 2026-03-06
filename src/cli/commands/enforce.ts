// ─────────────────────────────────────────────────────────────
// ForgeMind — Phase 1 / CLI command: forgemind enforce
// Runs all deterministic enforcement checks and reports violations.
// No LLM calls — offline, CI-safe.
// ─────────────────────────────────────────────────────────────

import { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "../../core/config/configLoader.js";
import { Logger } from "../../utils/logger.js";
import { EnforcementViolationsError } from "../../core/errors/pipelineErrors.js";
import { EXIT_CODES } from "../exitCodes.js";
import {
  InvariantCompiler,
  BoundaryEnforcer,
  ConsistencyChecker,
  buildEnforcementReport,
  saveEnforcementReport,
  formatEnforcementSummary,
} from "../../core/enforcement/index.js";
import { SemanticContextStore } from "../../core/orchestrator/semanticContextStore.js";

export function registerEnforceCommand(program: Command): void {
  program
    .command("enforce")
    .description(
      "Run deterministic enforcement checks on consolidated knowledge. " +
        "Detects invariant violations, prohibited boundary crossings, and consistency issues."
    )
    .option(
      "--fail-on-consistency",
      "Also return non-zero exit code when consistency issues are detected (default: only violations fail)",
      false
    )
    .option(
      "--context <path>",
      "Path to the semantic context file or context directory (default: <root>/ai/context/)"
    )
    .action(async (_, command: Command) => {
      const options = command.optsWithGlobals<{
        root: string;
        config?: string;
        json: boolean;
        verbose: boolean;
        failOnConsistency: boolean;
        context?: string;
      }>();

      const rootPath = resolve(options.root);
      const logger = new Logger({ json: options.json, verbose: options.verbose });

      try {
        // 1. Load project config (needed for intermediatePath)
        const config = await loadConfig(rootPath, options.config);
        const intermediateDir = resolve(rootPath, config.intermediatePath);
        const contextStore = new SemanticContextStore();
        const contextBasePath = options.context ? resolve(options.context) : intermediateDir;
        const violationsPath = resolve(intermediateDir, "violations.json");

        // 2. Load consolidated knowledge from partitioned context
        const semanticContext = await contextStore.load(contextBasePath);
        if (!semanticContext) {
          const msg =
            `Cannot read semantic context at '${contextBasePath}'. ` +
            "Run 'forgemind forge' (or 'forgemind generate') first to generate the semantic context.";
          if (options.json) {
            logger.outputJson({ command: "enforce", rootPath, error: msg });
          } else {
            logger.error(msg);
          }
          process.exitCode = EXIT_CODES.GENERAL_ERROR;
          return;
        }

        const knowledge = semanticContext.consolidatedKnowledge;

        // 3. Run enforcement checks
        logger.info("Running invariant compiler...");
        const compiler = new InvariantCompiler();
        const invariantViolations = await compiler.compile(knowledge.domainInvariants, rootPath);

        const unenforced = compiler.unenforceableRules(knowledge.domainInvariants);
        if (unenforced.length > 0 && options.verbose) {
          logger.debug(
            `${unenforced.length} confirmed invariant(s) have no enforcement spec and were skipped: ${unenforced.slice(0, 3).join(", ")}${unenforced.length > 3 ? "…" : ""}`
          );
        }

        logger.info("Running boundary enforcer...");
        const enforcer = new BoundaryEnforcer();
        const boundaryViolations = await enforcer.enforce(knowledge.conceptualBoundaries, rootPath);

        logger.info("Running consistency checker...");
        const checker = new ConsistencyChecker();
        const consistencyIssues = checker.check(knowledge);

        // 4. Build and persist report
        const allViolations = [...invariantViolations, ...boundaryViolations];
        const report = buildEnforcementReport(rootPath, allViolations, consistencyIssues);
        await saveEnforcementReport(violationsPath, report);

        // 5. Output
        if (options.json) {
          logger.outputJson({
            command: "enforce",
            rootPath,
            passed: report.passed,
            totalViolations: report.totalViolations,
            criticalViolations: report.criticalViolations,
            importantViolations: report.importantViolations,
            consistencyIssues: report.consistencyIssues,
            reportPath: violationsPath,
          });
        } else {
          logger.info(formatEnforcementSummary(report));
          logger.info(`Report written to: ${config.intermediatePath}/violations.json`);
        }

        // 6. Exit codes
        const shouldFail =
          report.totalViolations > 0 ||
          (options.failOnConsistency && report.consistencyIssues > 0);

        if (shouldFail) {
          throw new EnforcementViolationsError(
            report.totalViolations,
            report.criticalViolations,
            violationsPath
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (options.json) {
          logger.outputJson({ command: "enforce", rootPath, error: message });
        } else {
          logger.error(message);
        }

        if (error instanceof EnforcementViolationsError) {
          process.exitCode = EXIT_CODES.ENFORCEMENT_VIOLATIONS;
        } else {
          process.exitCode = EXIT_CODES.GENERAL_ERROR;
        }
      }
    });
}
