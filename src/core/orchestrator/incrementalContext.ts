import { extname, relative, resolve } from "node:path";
import { readTextFile, walkFiles } from "../../utils/fileSystem.js";
import { hashContent, hashJson } from "../../utils/hashing.js";
import { normalizeToPosixPath } from "../../utils/path.js";
import type { ForgemindConfig } from "../types/index.js";
import type { DocumentType } from "../generators/documents/documentGenerator.js";

const TEXT_RELEVANT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".yaml", ".yml", ".toml", ".ini", ".env",
  ".py", ".go", ".java", ".kt", ".rb", ".php", ".rs", ".swift", ".dart", ".cs", ".c", ".cpp", ".h", ".hpp",
  ".md", ".txt", ".sh", ".sql", ".xml", ".proto"
]);

type ImpactArea = "ontology" | "invariants" | "boundaries" | "decisions" | "manual" | "unknown";

export interface IncrementalState {
  version: string;
  generatedAt: string;
  trackedFiles: Record<string, string>;
  trackedFilesHash: string;
  cachedSamplesHash?: string;
}

export interface IncrementalChangeSet {
  changedFiles: string[];
  removedFiles: string[];
  unchanged: boolean;
}

export interface IncrementalPlan {
  docsToRegenerate: DocumentType[];
  areas: ImpactArea[];
  requiresFullRegeneration: boolean;
  docsOnlyChange: boolean;
}

function isInsidePath(path: string, rootPath: string, childPath: string): boolean {
  const normalizedRoot = normalizeToPosixPath(resolve(rootPath));
  const normalizedChild = normalizeToPosixPath(resolve(childPath));
  return normalizedChild.startsWith(`${normalizedRoot}/`) || normalizedChild === normalizedRoot;
}

function isIntermediateOrOutputFile(relativePath: string, config: ForgemindConfig): boolean {
  const normalized = normalizeToPosixPath(relativePath);
  return normalized.startsWith(`${normalizeToPosixPath(config.intermediatePath)}/`) ||
    normalized.startsWith(`${normalizeToPosixPath(config.outputPath)}/`);
}

function classifyImpact(path: string): ImpactArea {
  const normalized = normalizeToPosixPath(path).toLowerCase();

  if (normalized.startsWith("docs/") || normalized.startsWith("docs-non-oficial/")) {
    return "manual";
  }

  if (/(boundary|boundaries|adapter|gateway|module|import-graph|context)/.test(normalized)) {
    return "boundaries";
  }

  if (/(invariant|rule|policy|validator|schema|guard|domain)/.test(normalized)) {
    return "invariants";
  }

  if (/(decision|adr|architecture|config|package\.json|docker|workflow|pipeline|ci)/.test(normalized)) {
    return "decisions";
  }

  const extension = extname(normalized);
  if ([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".java", ".kt", ".rb", ".php"].includes(extension)) {
    return "unknown";
  }

  return "ontology";
}

export async function buildTrackedFileHashes(rootPath: string, config: ForgemindConfig): Promise<Record<string, string>> {
  const files = await walkFiles(rootPath, config.ignoreDirs);
  const trackedEntries: Array<[string, string]> = [];

  for (const absolutePath of files) {
    if (!isInsidePath(absolutePath, rootPath, absolutePath)) {
      continue;
    }

    const relativePath = normalizeToPosixPath(relative(rootPath, absolutePath));
    if (isIntermediateOrOutputFile(relativePath, config)) {
      continue;
    }

    const extension = extname(relativePath).toLowerCase();
    if (!TEXT_RELEVANT_EXTENSIONS.has(extension) && extension !== "") {
      continue;
    }

    try {
      const content = await readTextFile(absolutePath);
      trackedEntries.push([relativePath, hashContent(content)]);
    } catch {
      // ignore read errors for volatile/permission files
    }
  }

  trackedEntries.sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(trackedEntries);
}

export function buildTrackedFilesHash(trackedFiles: Record<string, string>): string {
  return hashJson(trackedFiles);
}

export function diffTrackedFiles(
  previous: Record<string, string> | undefined,
  current: Record<string, string>
): IncrementalChangeSet {
  if (!previous) {
    return {
      changedFiles: Object.keys(current).sort((left, right) => left.localeCompare(right)),
      removedFiles: [],
      unchanged: false
    };
  }

  const changedFiles: string[] = [];
  const removedFiles: string[] = [];

  for (const [path, hash] of Object.entries(current)) {
    if (!previous[path] || previous[path] !== hash) {
      changedFiles.push(path);
    }
  }

  for (const path of Object.keys(previous)) {
    if (!current[path]) {
      removedFiles.push(path);
    }
  }

  changedFiles.sort((left, right) => left.localeCompare(right));
  removedFiles.sort((left, right) => left.localeCompare(right));

  return {
    changedFiles,
    removedFiles,
    unchanged: changedFiles.length === 0 && removedFiles.length === 0
  };
}

export function planPartialRegeneration(changeSet: IncrementalChangeSet): IncrementalPlan {
  const allChanges = [...changeSet.changedFiles, ...changeSet.removedFiles];
  if (allChanges.length === 0) {
    return {
      docsToRegenerate: [],
      areas: [],
      requiresFullRegeneration: false,
      docsOnlyChange: false
    };
  }

  const areas = new Set<ImpactArea>();
  for (const filePath of allChanges) {
    areas.add(classifyImpact(filePath));
  }

  const docsOnlyChange = allChanges.every((path) => {
    const normalized = normalizeToPosixPath(path);
    return normalized.startsWith("docs/") || normalized.startsWith("docs-non-oficial/");
  });

  if (areas.has("unknown")) {
    return {
      docsToRegenerate: [
        "system-ontology",
        "domain-invariants",
        "module-boundaries",
        "decision-log",
        "agent-operating-manual"
      ],
      areas: [...areas].sort((left, right) => left.localeCompare(right)),
      requiresFullRegeneration: true,
      docsOnlyChange
    };
  }

  const docs = new Set<DocumentType>();
  if (areas.has("ontology")) {
    docs.add("system-ontology");
    docs.add("agent-operating-manual");
  }
  if (areas.has("invariants")) {
    docs.add("domain-invariants");
    docs.add("agent-operating-manual");
  }
  if (areas.has("boundaries")) {
    docs.add("module-boundaries");
    docs.add("agent-operating-manual");
  }
  if (areas.has("decisions")) {
    docs.add("decision-log");
    docs.add("agent-operating-manual");
  }
  if (areas.has("manual") && docs.size === 0) {
    docs.add("agent-operating-manual");
  }

  return {
    docsToRegenerate: [...docs].sort((left, right) => left.localeCompare(right)),
    areas: [...areas].sort((left, right) => left.localeCompare(right)),
    requiresFullRegeneration: false,
    docsOnlyChange
  };
}
