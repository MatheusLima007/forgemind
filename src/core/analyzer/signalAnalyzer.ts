import { basename, relative } from "node:path";
import { walkFiles, readTextFile, fileExists } from "../../utils/fileSystem.js";
import type { ArchitecturalSignal, ScanResult } from "../types/index.js";

interface NamingPattern {
  regex: RegExp;
  type: string;
  description: string;
}

const NAMING_PATTERNS: NamingPattern[] = [
  { regex: /repository\b/i, type: "repository-abstraction", description: "Repository naming suggests data access abstraction boundaries" },
  { regex: /usecase|use-case|application-service/i, type: "application-orchestration", description: "Use-case oriented naming suggests explicit application flow orchestration" },
  { regex: /service\b/i, type: "service-layer", description: "Service naming suggests behavior encapsulation beyond transport concerns" },
  { regex: /policy|rule|specification/i, type: "rule-encoding", description: "Policy/rule/specification naming suggests explicit domain rule codification" },
  { regex: /aggregate|valueobject|value-object|entity/i, type: "domain-modeling", description: "DDD-style naming suggests rich domain modeling" },
  { regex: /event|subscriber|listener|handler/i, type: "event-orientation", description: "Event-oriented naming suggests asynchronous or decoupled interaction" },
  { regex: /command|query/i, type: "cqrs-tendency", description: "Command/query naming suggests intent-query separation" },
  { regex: /adapter|port|gateway/i, type: "boundary-adapters", description: "Ports/adapters naming suggests boundary-driven architecture" },
  { regex: /guard|interceptor|middleware|filter/i, type: "cross-cutting-controls", description: "Cross-cutting control naming suggests centralized policy enforcement" },
  { regex: /strategy|factory|builder/i, type: "explicit-variation-points", description: "Creational/strategy naming suggests intentional variation points" },
];

const GENERIC_CONFIG_FILES = [
  "docker-compose.yml",
  "docker-compose.yaml",
  "Dockerfile",
  ".github/workflows",
  ".gitlab-ci.yml",
  "turbo.json",
  "nx.json",
  ".env.example",
  "README.md"
];

export class SignalAnalyzer {
  async analyze(scan: ScanResult, ignoreDirs: string[]): Promise<ArchitecturalSignal[]> {
    const files = await walkFiles(scan.rootPath, ignoreDirs);
    const relativePaths = files.map((f) => relative(scan.rootPath, f));

    const signals: ArchitecturalSignal[] = [];
    signals.push(...this.analyzeNamingPatterns(relativePaths));
    signals.push(...this.analyzeConceptualFolderHints(relativePaths));
    signals.push(...await this.analyzeConfigSignals(scan.rootPath, scan.configFilesFound));
    signals.push(...this.detectBoundedContextHints(relativePaths));
    signals.push(...await this.analyzeCrossContextReferences(files, scan.rootPath));
    signals.push(...this.analyzeTestOrganization(relativePaths));

    return signals;
  }

  private analyzeNamingPatterns(relativePaths: string[]): ArchitecturalSignal[] {
    const patternMatches = new Map<string, string[]>();

    for (const filePath of relativePaths) {
      const fileName = basename(filePath).replace(/\.[^/.]+$/, "");
      for (const pattern of NAMING_PATTERNS) {
        if (pattern.regex.test(fileName)) {
          const existing = patternMatches.get(pattern.type) ?? [];
          existing.push(filePath);
          patternMatches.set(pattern.type, existing);
        }
      }
    }

    const signals: ArchitecturalSignal[] = [];
    for (const [type, evidence] of patternMatches) {
      if (evidence.length < 2) continue;
      const rule = NAMING_PATTERNS.find((p) => p.type === type);
      if (!rule) continue;

      signals.push({
        type,
        source: "naming-analysis",
        confidence: Math.min(0.9, 0.35 + evidence.length * 0.08),
        evidence: evidence.slice(0, 12),
        description: `${rule.description} (${evidence.length} matches)`
      });
    }

    return signals;
  }

  private analyzeConceptualFolderHints(relativePaths: string[]): ArchitecturalSignal[] {
    const allSegments = new Set<string>();
    for (const path of relativePaths) {
      for (const segment of path.split("/")) {
        allSegments.add(segment.toLowerCase());
      }
    }

    const signals: ArchitecturalSignal[] = [];
    const checks: Array<{ keys: string[]; type: string; description: string; min: number }> = [
      { keys: ["domain", "application", "infrastructure", "adapters"], type: "layered-intent", description: "Folder semantics suggest explicit separation of concerns", min: 2 },
      { keys: ["modules", "features", "contexts", "domains"], type: "context-modularization", description: "Folder semantics suggest domain/context modularization", min: 1 },
      { keys: ["policies", "rules", "guards", "validators"], type: "policy-explicitness", description: "Rule/policy vocabulary suggests explicit constraint management", min: 1 },
      { keys: ["events", "handlers", "subscribers", "consumers"], type: "async-communication-hints", description: "Event vocabulary suggests asynchronous coordination", min: 1 },
      { keys: ["shared", "common", "kernel"], type: "shared-kernel-risk", description: "Shared/common vocabulary suggests potential hidden coupling risk", min: 1 },
    ];

    for (const check of checks) {
      const matches = check.keys.filter((k) => allSegments.has(k));
      if (matches.length >= check.min) {
        signals.push({
          type: check.type,
          source: "semantic-folder-analysis",
          confidence: Math.min(0.82, 0.35 + matches.length * 0.14),
          evidence: matches,
          description: check.description
        });
      }
    }

    return signals;
  }

  private async analyzeConfigSignals(rootPath: string, detectedConfigFiles: string[]): Promise<ArchitecturalSignal[]> {
    const signals: ArchitecturalSignal[] = [];

    for (const configFile of detectedConfigFiles) {
      signals.push({
        type: "config-context",
        source: "config-analysis",
        confidence: 0.8,
        evidence: [configFile],
        description: `Configuration artifact detected (${configFile}) — contributes to runtime assumptions`
      });
    }

    for (const file of GENERIC_CONFIG_FILES) {
      if (await fileExists(`${rootPath}/${file}`)) {
        signals.push({
          type: "operational-context",
          source: "config-analysis",
          confidence: 0.75,
          evidence: [file],
          description: `Operational automation/config signal detected via ${file}`
        });
      }
    }

    return signals;
  }

  private detectBoundedContextHints(relativePaths: string[]): ArchitecturalSignal[] {
    const firstLevelCounts = new Map<string, number>();

    for (const path of relativePaths) {
      const [first] = path.split("/");
      if (!first) continue;
      firstLevelCounts.set(first, (firstLevelCounts.get(first) ?? 0) + 1);
    }

    const candidates = [...firstLevelCounts.entries()]
      .filter(([name, count]) => count >= 4 && !/^\.|^(src|lib|app|tests?)$/i.test(name))
      .map(([name]) => name);

    if (candidates.length < 2) {
      return [];
    }

    return [{
      type: "bounded-context-candidates",
      source: "context-surface-analysis",
      confidence: Math.min(0.8, 0.45 + candidates.length * 0.05),
      evidence: candidates.slice(0, 12),
      description: "Multiple substantial first-level domains suggest conceptual boundary candidates"
    }];
  }

  private async analyzeCrossContextReferences(files: string[], rootPath: string): Promise<ArchitecturalSignal[]> {
    const sourceFiles = files.filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs|py|go|java|kt|rb|php|rs|swift|dart|cs)$/i.test(f)).slice(0, 180);
    const contextImports = new Map<string, Set<string>>();

    for (const filePath of sourceFiles) {
      try {
        const content = await readTextFile(filePath);
        const relPath = relative(rootPath, filePath);
        const sourceContext = relPath.split("/")[0];
        if (!sourceContext) continue;

        const regex = /(?:from\s+['"]|require\(\s*['"]|import\s+['"])(\.{1,2}\/[^'"]+)['"]/g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
          const raw = match[1];
          const segments = raw.split("/").filter(Boolean);
          const target = segments.find((segment) => !segment.startsWith("."));
          if (!target || target === sourceContext) continue;

          const targets = contextImports.get(sourceContext) ?? new Set<string>();
          targets.add(target);
          contextImports.set(sourceContext, targets);
        }
      } catch {
        // ignore unreadable file
      }
    }

    const bidirectional: string[] = [];
    for (const [from, targets] of contextImports) {
      for (const to of targets) {
        if (contextImports.get(to)?.has(from)) {
          bidirectional.push(`${from} ↔ ${to}`);
        }
      }
    }

    if (bidirectional.length === 0) {
      return [];
    }

    const unique = [...new Set(bidirectional)];
    return [{
      type: "cross-boundary-coupling-risk",
      source: "reference-analysis",
      confidence: 0.72,
      evidence: unique.slice(0, 10),
      description: "Bidirectional cross-context references suggest potential conceptual coupling risk"
    }];
  }

  private analyzeTestOrganization(relativePaths: string[]): ArchitecturalSignal[] {
    const testFiles = relativePaths.filter((f) =>
      /(\.test\.|\.spec\.|_test\.)/i.test(f) || /(^|\/)(__tests__|tests?|specs?)(\/|$)/i.test(f)
    );

    if (testFiles.length === 0) {
      return [{
        type: "validation-signal-gap",
        source: "test-analysis",
        confidence: 0.86,
        evidence: [],
        description: "No explicit test surface detected — higher risk of hidden invariant drift"
      }];
    }

    return [{
      type: "verification-surface-present",
      source: "test-analysis",
      confidence: 0.65,
      evidence: testFiles.slice(0, 8),
      description: "Test artifacts indicate at least partial invariant verification practice"
    }];
  }
}
