# ForgeMind Roadmap — Agent‑First → Agent‑Native (2026)

## Status de Execução (atualizado em 2026-03-05)

- **Fase 0 concluída** e validada com suíte ativa verde (`test`, `build`, `lint`).
- **Fase 2 concluída** no código com cobertura de testes e artefatos ativos (`ai/semantic-drift.json`, `ai/semantic-drift-baseline.json`, `ai/contradictions.json`).
- Foi aplicada migração de testes legados para o contexto arquitetural atual, preservando intenção comportamental.
- O roadmap abaixo permanece como guia de evolução; **Fase 1** e **Fase 3** continuam pendentes.

### Snapshot da Fase 0

- ✅ **Token Budget Enforcer** implementado e integrado ao orquestrador LLM (controle por estágio + erro explícito por exaustão).
- ✅ **Hypothesis Quality Gate** implementado (`needs-review`, bloqueio de consolidação por razão pendente configurável).
- ✅ **Knowledge Versioning + Diff** implementado (`consolidatedKnowledgeHash` + `ai/knowledge-diff.json` com resumo de mudanças).
- ✅ **Interview UX com persistência incremental** implementado (`[E]dit / [S]kip / Enter`, gravação determinística de `answers.json`).
- ✅ **Mapeamento de exit codes** para orçamento e bloqueio de quality gate implementado no CLI.

### Próximo foco recomendado

- Iniciar **Fase 1 — Executable Contracts**, priorizando `InvariantCompiler` + `BoundaryEnforcer` para enforcement determinístico.

### Snapshot da Fase 2

- ✅ **Provider Capability Matrix** implementada (`supportsJsonMode`, `maxOutputTokens`, `varianceLevel`, `supportsTools`) com adaptação automática de requests.
- ✅ **Semantic Drift Detector** implementado com calibração barata, score determinístico ponderado por categoria e baseline por `provider:model`.
- ✅ **Confirmação humana para drift** implementada: em `forge` exige entrevista quando necessário; em `generate` exige `--accept-drift`.
- ✅ **Contradiction Engine** implementado com detecção entre respostas↔hipóteses, boundaries↔invariants e decisions↔manual, com downgrade para `needs-review` + perguntas de follow-up.

This roadmap turns ForgeMind from a **high‑value agent‑first documentation engine** into an **agent‑native governance platform** (contracts + enforcement + drift resilience), while keeping the CLI experience strong.

---

## Guiding Principles

- **Value first:** documentation must change agent behavior (if docs are removed, agents perform worse).
- **Evidence‑first:** every strong claim must link to evidence (paths/symbols/lines) or be marked **UNKNOWN** and converted into an interview question.
- **Human‑in‑the‑loop where it matters:** interview is the mechanism to confirm intent and eliminate ambiguity.
- **Deterministic core, optional intelligence:** enforcement can be deterministic; LLM is used for synthesis, not authority.
- **Provider variance is a first‑class risk:** switching models must not silently change “truth”.

---

# Phase 0 — Stabilization & Cognitive Safety (P0–P1)  
**Goal:** prevent low‑quality knowledge from becoming “truth”, control cost, and add traceability.  
**Target outcome:** predictable runs, better quality of hypotheses, and versioned knowledge changes.

### Deliverables
1. **Token Budget Enforcer (runtime)**
   - Enforce `maxTokensBudget` across *all* LLM calls.
   - Abort with clear error when exhausted.
   - Emit per‑stage token usage + totals.

2. **Hypothesis Quality Gate**
   - Gate hypotheses before consolidation.
   - Default rules:
     - If `confidence < minConfidence` → `needs-review`
     - If `needs-review ratio > maxPendingRatio` → force interview (no skip)
   - Make thresholds configurable.

3. **Knowledge Versioning + Diff**
   - Persist previous `consolidatedKnowledgeHash`.
   - Generate `ai/knowledge-diff.json` on each run.
   - CLI prints summary: added/removed/changed invariants/boundaries/decisions.

4. **Interview UX upgrades (baseline for later)**
   - Persist incremental answers.
   - Don’t overwrite answers silently.

### Success criteria
- Runs stop on budget exhaustion (no hidden overspend).
- Consolidation does not accept low confidence without review.
- Knowledge changes are visible and reviewable between runs.

---

## AgentIA Prompt — Phase 0
```text
You are a Staff Engineer implementing Phase 0 for ForgeMind.

Mission:
Stabilize the system by enforcing token budgets, gating low-quality hypotheses, and adding knowledge versioning/diffing.

Constraints:
- Keep CLI-first.
- No breaking changes to existing commands unless strictly necessary.
- All new artifacts must be stored under ai/ and be deterministic where possible.

Tasks:
1) Implement TokenBudgetEnforcer:
   - Track estimated and actual token usage.
   - Integrate into llm orchestrator so every provider call consults the budget.
   - Abort with a clear error and exit code when budget is exhausted.
   - Print per-stage token usage in logs.

2) Implement HypothesisQualityGate:
   - Add thresholds: minConfidence, maxPendingRatio.
   - Classify hypotheses into accepted / needs-review / rejected.
   - Prevent consolidation when pending ratio is too high unless interview is completed.

3) Implement Knowledge Versioning + Diff:
   - Create a knowledge hash for consolidatedKnowledge.
   - Save previous hash, compute current hash, generate ai/knowledge-diff.json.
   - Diff should list added/removed/modified items for:
     - invariants
     - boundaries (allowed/prohibited)
     - decisions
     - cognitive risks (manual)
   - Update CLI to print a concise summary.

4) Improve Interview persistence:
   - If answers exist, show:
     - Current answer
     - [E]dit / [S]kip / Enter continue
   - Ensure changes update ai/answers.json deterministically.

Testing:
- Add tests covering:
  - budget exhaustion stops execution
  - hypotheses gating blocks consolidation
  - knowledge diff correctly detects added/removed items
  - interview edit/skip works

Deliverables:
- PR with code + tests + updated README section for Phase 0 behaviors.
```

---

# Phase 1 — Executable Contracts (Enforcement Layer) (P1–P2)  
**Goal:** convert “docs as guidance” into “docs as enforceable contracts”.  
**Target outcome:** violations become detectable automatically (without needing LLM), enabling CI later.

### Deliverables
1. **Invariant Compiler (confirmed rules → executable checks)**
   - Compile `DomainInvariantKnowledge.rules[status=confirmed]` into checks.
   - Start with pragmatic checks:
     - import path rules
     - naming rules
     - presence/absence rules
     - config rules
   - Output violations as structured report: `ai/violations.json`.

2. **Boundary Enforcer**
   - Enforce `module-boundaries` prohibited relations using:
     - import graph analysis (TS/JS first)
     - fallback string/path rules for other languages (configurable)
   - Provide clear remediation messages.

3. **Cross-document consistency checks**
   - Detect contradictions across generated docs (e.g., boundary allows vs prohibits).
   - Fail generation if contradictions exist, and convert into interview questions.

### Success criteria
- Running `forgemind validate` (or `forgemind enforce`) detects violations deterministically.
- Developers get clear, actionable violation messages.
- Contracts survive repo changes via diff + violations.

---

## AgentIA Prompt — Phase 1
```text
You are a Principal Engineer implementing Phase 1 for ForgeMind: Executable Contracts.

Mission:
Make architecture and domain rules enforceable automatically (deterministic checks), turning agent-first knowledge into executable constraints.

Constraints:
- No network calls required for enforcement.
- Prefer deterministic analysis; do not rely on LLM to “decide” violations.
- Focus initially on TS/JS import graph enforcement; design must allow extensions.

Tasks:
1) Implement InvariantCompiler:
   - Compile confirmed invariants into executable checks.
   - Start with a "rule templates" approach:
     - forbiddenImport(pattern)
     - requiredFileExists(path)
     - requiredSymbolExists(symbol in file)
     - namingConvention(regex)
   - Add an internal DSL-like structure for invariants to map into templates.
   - Output structured violation results to ai/violations.json.

2) Implement BoundaryEnforcer:
   - Build import graph for TS/JS (ts-morph or TypeScript compiler API).
   - Enforce prohibitedRelations:
     - Map file paths → contexts
     - Detect imports crossing prohibited boundaries
   - Provide violation with {fromContext,toContext,file,line,reason,fixHint}.

3) Add Cross-Document Consistency Check:
   - Validate that boundaries/decisions/invariants do not contradict.
   - When contradiction exists:
     - mark as UNKNOWN
     - generate an interview question to resolve it
     - do not silently pick one

4) CLI:
   - Add a new command `forgemind enforce` OR extend `validate` with `--enforce`:
     - Runs all checks
     - Returns non-zero exit code on violations
     - Prints concise report + path to ai/violations.json

Testing:
- Add fixtures with prohibited imports to ensure violations are detected.
- Add invariant rule tests for each rule template.

Deliverables:
- Code + tests + README docs for enforcement mode and rule templates.
```

---

# Phase 2 — Provider Variance & Semantic Integrity (P1–P2)  
**Goal:** stop silent semantic drift when models/providers change.  
**Target outcome:** predictable knowledge regardless of provider, or explicit warning when unstable.

### Deliverables
1. **Provider Capability Matrix**
   - Store capability metadata per provider/model:
     - json reliability
     - max output tokens
     - tool/function calling
     - determinism / variance level
   - Prompts adapt based on capability.

2. **Semantic Drift Detector**
   - Run controlled “calibration prompts” (small, cheap).
   - Compare key structured outputs (hypotheses/knowledge) across runs/providers.
   - Flag drift above a threshold and require human confirmation.

3. **Contradiction Engine**
   - Detect:
     - internal contradictions within consolidated knowledge
     - contradictions between interview answers and inferred claims
   - Convert to questions; never silently override confirmed info.

### Success criteria
- Switching provider triggers a drift check.
- Drift results are visible and actionable.
- Knowledge stays stable or is flagged as unstable.

---

## AgentIA Prompt — Phase 2
```text
You are a Staff Engineer implementing Phase 2 for ForgeMind: Provider Variance & Semantic Integrity.

Mission:
Protect ForgeMind from silent behavior changes when switching LLM providers/models by introducing calibration, capability awareness, and semantic drift detection.

Constraints:
- Keep runtime cost low: calibration must be cheap and bounded.
- Drift detection should be deterministic in how it compares outputs.
- Never override confirmed interview answers automatically.

Tasks:
1) Provider Capability Matrix:
   - Create providerCapabilities registry with fields:
     supportsJsonMode, maxOutputTokens, varianceLevel, supportsTools
   - Adjust prompts based on these capabilities (e.g., stricter JSON if supported).

2) Semantic Drift Detector:
   - Implement a small calibration suite:
     - generate a minimal hypotheses set from the same signals/samples
     - compare structured outputs vs last known stable baseline
   - Store results in ai/semantic-drift.json:
     {provider, model, previousProvider, diffSummary, driftScore, actionRequired}
   - If driftScore > threshold:
     - require interview confirmation or explicit --accept-drift flag

3) Contradiction Engine:
   - Detect contradictions between:
     - interview answers (confirmed) and inferred hypotheses
     - boundaries and invariants
     - decisions and operating manual rules
   - Output ai/contradictions.json and generate interview questions.

Testing:
- Mock providers returning different outputs → drift flagged.
- Confirmed answer contradicting hypothesis → hypothesis downgraded + question generated.

Deliverables:
- Code + tests + README guidance for provider changes and drift handling.
```

---

# Phase 3 — Scalability & Incremental Context (P2–P3)  
**Goal:** handle big repos without exploding cost/tokens.  
**Target outcome:** incremental runs, partitioned context, and selective regeneration.

### Deliverables
1. **Partitioned SemanticContext**
   - Move from monolithic `ai/context.json` to:
     - ai/context/signals.json
     - ai/context/hypotheses.json
     - ai/context/knowledge.json
     - ai/context/interviews/*.json
   - Deterministic file ordering and stable schemas.

2. **Incremental Scan + Partial Regeneration**
   - Detect changed files and scope impact:
     - if only docs changed → no need for full scan
     - if certain modules changed → regen affected sections only
   - Cache sampling results and reuse.

3. **Relevance Ranking**
   - Prioritize evidence and concepts by impact and usage frequency.
   - Prevent “hypothesis explosion” with top‑K selection rules.

### Success criteria
- Big repos run without OOM/token explosion.
- Regeneration is faster after small changes.
- Context remains useful and not bloated.

---

## AgentIA Prompt — Phase 3
```text
You are a Principal Engineer implementing Phase 3 for ForgeMind: Scalability & Incremental Context.

Mission:
Make ForgeMind efficient on large repos by partitioning context, enabling incremental scans, and regenerating only what changed.

Constraints:
- Maintain correctness: never skip required regeneration when code meaningfully changes.
- Keep artifacts deterministic (stable ordering, stable formatting).
- Avoid adding heavy dependencies unnecessarily.

Tasks:
1) Partition SemanticContext:
   - Replace monolithic ai/context.json with ai/context/* artifacts.
   - Provide a loader that reconstructs SemanticContext from parts.

2) Incremental scan:
   - Track file hashes for sampled/code-relevant files.
   - Determine affected areas (e.g., invariants vs boundaries vs decisions).
   - Regenerate only affected docs/sections while keeping others unchanged.

3) Cache & reuse:
   - Cache samples.json and reuse when unchanged.
   - Cache evidence-map entries with stable IDs.

4) Relevance ranking:
   - Implement ranking for domain candidates and hypotheses.
   - Enforce top-K selection per category to limit noise and tokens.

Testing:
- Verify that small change triggers partial regen, not full.
- Verify determinism: two runs with same inputs produce same outputs.

Deliverables:
- Code + tests + README for incremental mode and partitioned context.
```

---

## Recommended Sequencing (high confidence)

1) **Phase 0** (quality + cost + traceability)  
2) **Phase 1** (executable constraints)  
3) **Phase 2** (provider variance & semantic integrity)  
4) **Phase 3** (scalability & incremental context)

---

## Notes on Interview UX (carry across all phases)

- Default suggestion + enter-to-accept
- `--auto-accept-suggestions`
- Incremental edit/skip
- Limit questions (entropy stop condition)
- Generate only high-impact questions (unknown + contradictions + criticals)

