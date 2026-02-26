# ForgeMind AI Toolkit

**AI-Ready Repository Governance for Agent-First Engineering.**

ForgeMind is a CLI toolkit that ensures your repository is structured for intelligent agent collaboration.

It validates and generates Agent-First documentation, prompt packs, and AI governance contracts — without becoming a lint tool or static analyzer.

## Why ForgeMind Exists

Modern development increasingly relies on AI agents.

However:

- Repositories are not structured for AI
- Prompts are inconsistent
- Documentation drifts
- Agents generate misaligned code
- Engineering rules live only in developers’ heads

ForgeMind introduces the **AI-Ready Repository Contract (ARRC)**.

It ensures your repository is:

- Deterministic
- Explicit
- Governable
- Drift-aware
- AI-operable

## Core Concept

ForgeMind does **NOT** validate code quality like ESLint or Sonar.

It validates the AI contract layer of your repository.

It ensures:

- Agent-first documentation exists
- Prompts are aligned with architecture
- Policies are declared
- AI contract metadata is present
- Drift between code and documentation is detected

## Installation

Install dependencies locally:

```bash
npm install
```

Build the CLI:

```bash
npm run build
```

Run directly in development:

```bash
npm run dev -- scan
```

Run scan with optional LLM enrichment:

```bash
npm run dev -- scan --llm openai
```

## Commands

### Initialize AI-Ready Structure

```bash
forgemind init
```

Creates the required AI-Ready structure:

```text
docs/
  agent-first.md
  architecture.md

prompts/
  review.md
  feature.md
  refactor.md
  troubleshooting.md

policies/
  checklist.json

ai/
  contract.json
  fingerprint.json
```

### Scan Repository

```bash
forgemind scan
```

Optional enrichment mode:

```bash
forgemind scan --llm openai
forgemind scan --llm openai-compatible
forgemind scan --llm none
```

Strict mode (fail-fast, no fallback):

```bash
forgemind scan --llm openai --llm-strict
```

Supported provider values:

- `none` (default)
- `openai`
- `openai-compatible`
- `anthropic` (stub)
- `azure` (stub)
- `local` (stub)

Detects:

- Language (JS, TS, PHP, etc.)
- Framework (Nest, Laravel, React, etc.)
- Folder structure
- Dependency files
- Architectural signals

Generates or updates:

- Agent-first documentation
- Prompt packs
- AI contract metadata
- Fingerprint hash

### Validate Contract (CI Mode)

```bash
forgemind validate
```

Fails if:

- Required docs are missing
- Prompts are missing
- AI contract is outdated
- Fingerprint drift is detected

Exit codes:

- `0` → OK
- `1` → Policy violation
- `2` → Documentation drift
- `3` → Contract missing or invalid

Designed to work in:

- GitHub Actions
- GitLab CI
- Jenkins
- Azure DevOps
- Any CI/CD pipeline

## AI-Ready Repository Contract (ARRC)

ForgeMind enforces the AI-Ready Repository Contract.

Level 1 Compliance requires:

- Explicit architecture documentation
- Prompt governance structure
- Machine-readable AI contract file
- Drift detection mechanism
- Versioned policy definitions

This ensures deterministic collaboration between humans and AI agents.

## Config

ForgeMind reads `forgemind.config.json` from the repository root.

Current config supports:
- `outputPaths`
- `ignoreDirs`
- `ignoreFilePatterns` (fingerprint-level file pattern exclusions)
- `compliance.level` (L1)
- `templateOverrides` (deterministic file-based overrides)
- `llm` (optional enrichment settings)

Example:

```json
{
  "llm": {
    "enabled": true,
    "provider": "openai-compatible",
    "baseUrl": "http://localhost:11434/v1",
    "model": "local-model",
    "temperature": 0.2
  }
}
```

API key resolution order:

1. `llm.apiKey` (from config)
2. Provider-specific key env:
   - `OPENAI_API_KEY` (`openai`, `openai-compatible`)
   - `ANTHROPIC_API_KEY` (`anthropic`)
   - `AZURE_OPENAI_API_KEY` (`azure`)
3. `FORGEMIND_LLM_API_KEY` (generic fallback)

Base URL resolution order:

1. `llm.baseUrl` (from config)
2. `FORGEMIND_LLM_BASE_URL`

Security notes:

- Never commit API keys in repository files.
- Prefer env vars in CI.
- ForgeMind never logs API key values.

If no key is present, scan degrades gracefully to deterministic template output.

Validation hardening:

- `contract.json` is validated against internal ARRC schema
- `fingerprint.json` is validated against internal schema
- `policies/checklist.json` is validated against internal schema
- `policies/checklist.json` must include all required governance IDs with coherent path/status
- `arrcVersion` compatibility is enforced (`1.0.0`)
- `contract.json` fingerprint metadata must match `fingerprint.json`
- `contract.json` embedded fingerprint `generatedAt` must match `fingerprint.json`
- `contract.generatedAt` must be greater than or equal to `fingerprint.generatedAt`
- `contract.json` scanSummary languages and frameworks must match the current repository scan
- `contract.json` scanSummary dependency files must match the current repository scan
- fingerprint ignores dotfiles and temporary files by default (`.*`, `*.tmp`, `*.temp`, `*.swp`, `*.swo`, `*.bak`, `*~`)
- `templateOverrides` keys are strictly validated against supported keys

Supported `templateOverrides` keys:

- `docs.agentFirst`
- `docs.architecture`
- `prompts.review`
- `prompts.feature`
- `prompts.refactor`
- `prompts.troubleshooting`
- `policies.checklist`
- `ai.contract`

Template placeholders:

- `{{scan.languages}}`
- `{{scan.frameworks}}`
- `{{scan.signals}}`
- `{{scan.structure.topLevel}}`
- `{{scan.dependencies.files}}`
- `{{compliance.level}}`
- `{{rootPath}}`

Current contract includes:

- `arrcVersion` (protocol version)
- `version` (artifact version)
- `complianceLevel`
- `scanSummary`
- `fingerprint`

## Project Roadmap

### Phase 1 — Core Governance Engine (MVP)

- [x] CLI (`init`, `scan`, `validate`)
- [x] Repository scanner (heuristic-based)
- [x] Template-based documentation generator
- [x] Prompt pack generator
- [x] AI contract metadata file
- [x] Fingerprint hash generation
- [x] Internal ARRC schema validation
- [x] Validation mode with exit codes
- [x] Config file support (`forgemind.config.json`)
- [x] Real-world dogfooding artifacts committed (`ai/`, `docs/`, `prompts/`, `policies/`)

No LLM integration.

Deterministic and reliable.

### Phase 2 — Optional LLM Enrichment Layer

Add pluggable LLM support:

- [x] Provider interface
- [x] Repo Facts JSON
- [x] Architecture/document enrichment mode
- [x] Context-aware prompt enrichment mode
- [x] Structured/schema-validated AI responses

Supported providers (planned):

- [x] OpenAI
- [ ] Azure OpenAI
- [ ] Anthropic
- [ ] Local models

LLM integration remains optional.

### Phase 2 Safety Model

- LLM integration is strictly optional and disabled by default.
- `validate` remains 100% deterministic and performs no network calls.
- LLM output is enrichment-only and non-authoritative.
- Core contract integrity (`ai/contract.json`, `ai/fingerprint.json`) remains deterministic.
- If provider setup fails or request fails, scan continues with template-based output (unless `--llm-strict` is used).
- Fingerprint hashing ignores LLM blocks in docs, preserving deterministic drift checks.
- LLM output must pass the internal structured response schema before merge.

### Local LLM Setup (OpenAI-Compatible)

Use any OpenAI-compatible endpoint (e.g. local gateway):

```json
{
  "llm": {
    "enabled": true,
    "provider": "openai-compatible",
    "baseUrl": "http://localhost:11434/v1",
    "model": "your-local-model",
    "temperature": 0.2
  }
}
```

Then run:

```bash
forgemind scan --llm openai-compatible
```

Optional fail-fast mode:

```bash
forgemind scan --llm openai-compatible --llm-strict
```

### Determinism Guarantee

- Deterministic scan/contract/fingerprint pipeline remains authoritative.
- `validate` does not call providers and remains network-free.
- LLM enrichment block replacement is idempotent across multiple runs.
- JSON governance artifacts are serialized with stable key ordering.
- Path normalization and hashing remain cross-platform stable.

### npm Release Readiness Checklist

- [x] Build output isolated in `dist/`
- [x] CLI entrypoint configured in `package.json`
- [x] Typed public exports configured (`exports`, `types`)
- [x] Prepublish checks (`release:check`, `prepublishOnly`)
- [x] Changelog structure added (`CHANGELOG.md`)
- [x] Semver version field maintained in `package.json`

### Phase 3 — Advanced Governance

- [ ] Plugin system (Nest, Laravel, React Native, etc.)
- [ ] Official GitHub Action wrapper
- [ ] Prompt pack versioning
- [ ] Compliance levels (L1, L2, L3)
- [ ] PR auto-comment reports
- [ ] AI-Readiness badge
- [ ] Enterprise governance mode

## Architecture Overview

ForgeMind is built with:

- Node.js
- TypeScript
- Modular architecture
- Clean separation of concerns

Core modules:

- Repository Scanner
- Documentation Generator
- Prompt Generator
- Policy Engine
- Contract Manager
- CLI Interface

Future-ready for LLM integration.

## Not a Linter

ForgeMind does not:

- Analyze code smells
- Measure complexity
- Replace ESLint
- Replace SonarQube
- Perform security scanning

It validates the AI governance layer only.

## Vision

ForgeMind defines the foundation for AI-native repositories.

Instead of adapting AI to messy codebases, we adapt repositories to intelligent systems.

## License

MIT
