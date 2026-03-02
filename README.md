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
    "maxTokensBudget": 120000
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

Files: `signals.json`, `samples.json`, `hypotheses.json`, `interview.json`, `context.json`

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
