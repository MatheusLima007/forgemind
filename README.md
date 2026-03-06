# ForgeMind

**AI Context Engineering Engine — generates agent-first documentation via LLM-powered codebase analysis.**

ForgeMind scans your repository, detects architectural signals, generates hypotheses about your design decisions, conducts an interactive developer interview, and produces high-quality documentation optimized for AI agents — not humans reading wikis.

## What It Produces

Five agent-first documents in `docs/`:

| Document | Purpose |
|---|---|
| `system-ontology.md` | Why this system exists and which mental model governs it |
| `domain-invariants.md` | Business rules that must never be violated |
| `module-boundaries.md` | What can and cannot cross module boundaries |
| `decision-log.md` | Decisions with context, constraints, and trade-offs |
| `agent-operating-manual.md` | Concrete rules for AI agents working in this codebase |

## How It Works

```
Scan → Detect Signals → Sample Code → Generate Hypotheses → Interview Developer → Consolidate → Generate Docs
```

1. **Scan** — Detects languages, frameworks, dependencies, file structure
2. **Signal Analysis** — Identifies architectural patterns (hexagonal, CQRS, DDD, clean arch, etc.)
3. **Code Sampling** — Selects strategic code snippets within token budget
4. **Hypothesis Generation** — LLM generates hypotheses about architectural intent
5. **Developer Interview** — Interactive CLI session to confirm/refute/expand hypotheses
6. **Semantic Consolidation** — Merges all knowledge sources into structured knowledge
7. **Document Generation** — LLM produces each document with anti-redundancy filtering

## Quick Start

```bash
# Install
npm install -g forgemind

# Initialize config
forgemind init

# Set your API key
export ANTHROPIC_API_KEY=sk-...

# Run the full pipeline
forgemind forge

# Or skip the interview
forgemind forge --skip-interview

# Run only the interview
forgemind interview

# Generate docs from existing intermediate data
forgemind generate

# Force full regeneration (ignore incremental cache)
forgemind forge --full-regen
```

## Configuration

`forgemind.config.json`:

```json
{
  "outputPath": "docs",
  "intermediatePath": "ai",
  "ignoreDirs": [".git", "node_modules", "dist"],
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "temperature": 0.3,
    "maxTokensBudget": 120000,
    "semanticDriftThreshold": 0.35
  },
  "qualityGate": {
    "minConfidence": 0.65,
    "maxPendingRatio": 0.45
  },
  "interview": {
    "maxQuestions": 8,
    "adaptiveFollowUp": true,
    "language": "en"
  }
}
```

## Supported Stacks

- **TypeScript / JavaScript** — NestJS, NextJS, React
- **PHP** — Laravel
- **Python** — Django, Flask, FastAPI
- **Go** — Gin, Echo
- **Rust, Java/Kotlin, Ruby** — Spring, Rails (detection)

## LLM Providers

| Provider | Env Variable | Model Default |
|---|---|---|
| Anthropic (default) | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o` |
| Gemini | `GEMINI_API_KEY` | `gemini-2.0-flash` |
| OpenAI-compatible | `OPENAI_API_KEY` + `OPENAI_BASE_URL` | — |

```bash
# Use a different provider
forgemind forge --llm openai
forgemind forge --llm gemini

# Accept provider/model semantic drift explicitly
forgemind forge --llm gemini --accept-drift
```

## CLI Commands

| Command | Description |
|---|---|
| `forgemind init` | Initialize config and directory structure |
| `forgemind forge` | Run the full context engineering pipeline |
| `forgemind interview` | Run only the interactive interview |
| `forgemind generate` | Generate docs from existing intermediate data |

### Global Options

```
-r, --root <path>    Repository root path (default: cwd)
-c, --config <path>  Config file path
--json               Output in JSON format
-v, --verbose        Enable verbose output
```

## Intermediate Data

ForgeMind persists intermediate results in `ai/` (configurable) so you can:

- Re-run document generation without re-scanning
- Resume an interrupted interview
- Inspect the signals, hypotheses, and consolidated knowledge

Files: `signals.json`, `samples.json`, `hypotheses.json`, `evidence-map.json`, `interview.json`, `answers.json`, `knowledge-diff.json`, `semantic-drift.json`, `semantic-drift-baseline.json`, `contradictions.json`, `incremental-state.json`, and partitioned context under `context/` (`metadata.json`, `signals.json`, `hypotheses.json`, `knowledge.json`, `interviews/*.json`)

## Phase 0 Runtime Behaviors

- **Token budget enforcement**: every LLM call consults `llm.maxTokensBudget`; when exhausted, execution aborts with a clear error and non-zero exit code.
- **Hypothesis quality gate**: hypotheses below `qualityGate.minConfidence` become `needs-review`; if `needs-review / total > qualityGate.maxPendingRatio`, consolidation is blocked until interview answers exist.
- **Knowledge versioning & diff**: each run persists `consolidatedKnowledgeHash` in `ai/context.json` and generates `ai/knowledge-diff.json` with added/removed/modified items for invariants, boundaries, decisions, and cognitive risks.
- **Interview persistence upgrades**: when answers exist, interview shows current answer with `[E]dit / [S]kip / Enter continue`; `ai/answers.json` is updated incrementally and deterministically.

## Phase 2 Runtime Behaviors

- **Provider capability matrix**: providers are mapped by `supportsJsonMode`, `maxOutputTokens`, `supportsTools`, and `varianceLevel`; request shaping adapts accordingly.
- **Semantic drift detection**: when provider/model changes, ForgeMind runs a bounded calibration and writes `ai/semantic-drift.json`; if `driftScore > llm.semanticDriftThreshold`, execution requires interview confirmation (`forgemind forge`) or explicit `--accept-drift`.
- **Stable baseline registry**: accepted calibrations are persisted in `ai/semantic-drift-baseline.json` per `provider:model`, with an active baseline pointer to compare future switches deterministically.
- **Contradiction engine**: contradictions are detected across interview answers vs hypotheses, boundaries vs invariants, and decisions vs operating manual, persisted in `ai/contradictions.json` with generated follow-up questions.

## Phase 3 Runtime Behaviors

- **Partitioned semantic context**: ForgeMind persists semantic context in `ai/context/*` (instead of a monolithic `ai/context.json`) and reconstructs it through an internal loader used by pipeline and enforcement.
- **Incremental scan by file hash**: tracked textual/code-relevant files are hashed and stored in `ai/incremental-state.json`; unchanged runs reuse cached intermediates deterministically.
- **Selective regeneration**: changed files are mapped to impacted areas (invariants, boundaries, decisions, ontology/manual) and only affected documents are regenerated when classification is safe; unknown-impact code changes fall back to full regeneration for correctness.
- **Cache & reuse**: `samples.json` and other intermediate artifacts are reused when tracked changes are absent (or docs-only), reducing unnecessary LLM calls.
- **Stable evidence IDs + relevance top-K**: evidence entries receive deterministic stable IDs, and domain candidates/hypotheses are ranked with per-category top-K limits to reduce token noise.
- **`--full-regen` safety switch**: `forge` and `generate` accept `--full-regen` to bypass incremental reuse and force a full deterministic regeneration (useful in CI/debug scenarios).

## Architecture

```
src/
  cli/                    # Commander.js CLI
  core/
    analyzer/             # SignalAnalyzer + CodeSampler
    config/               # Config loader + defaults
    consolidator/         # SemanticConsolidator
    generators/documents/ # DocumentGenerator + RedundancyFilter
    intelligence/         # HypothesisEngine + prompts
    interview/            # InterviewEngine + Renderer
    orchestrator/         # ContextPipeline (main)
    scanner/              # RepositoryScanner + detectors
    types/                # All type definitions
  llm/                    # Provider interface + implementations
  utils/                  # FileSystem, hashing, logger, paths
```

## Requirements

- Node.js >= 20
- An LLM API key (Anthropic recommended)

## License

MIT
