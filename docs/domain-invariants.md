# domain-invariants.md

This document crystalizes the fundamental domain rules that agents interacting with this codebase must not violate. These invariants define the core principles, states, and behaviors of the system.

## Critical Invariants

- Claim: The project aims for a highly modular, pipeline-driven architecture, where each stage of the 'AI Context Engineering' process (scanning, analyzing, hypothesizing, interviewing, consolidating, generating) is encapsulated in distinct, interchangeable components within the `core` module. [CLAIM:hyp-1]
- Agent Implication: Agents should understand the pipeline stages and component responsibilities within `core` to correctly identify where specific logic resides or needs modification, ensuring changes align with the modular design.

- Claim: The `SemanticContext` must be maintained as the comprehensive, evolving, and authoritative source of truth for the system's understanding of a codebase. All derived knowledge must be consistently aggregated and versioned within it. [CLAIM:hyp-4]
- Agent Implication: Agents must always refer to and update the `SemanticContext` as the authoritative source for codebase understanding. Any new insights or modifications to existing knowledge should be integrated into this central structure to maintain consistency and versioning.

- Claim: The project is designed as a CLI-first application, where all primary interactions and workflows are exposed through command-line commands, rather than a GUI or API server. [CLAIM:hyp-11]
- Agent Implication: Agents should assume a CLI-driven interaction model. New features or workflows should be exposed as command-line commands via `src/cli/index.js` and the `commander` library, rather than designing for a GUI or API endpoint.

- Claim: All interactions with Large Language Models must occur exclusively through the `LLMProvider` interface, enforcing a strict separation between core logic and specific LLM implementations. [CLAIM:inv-llm-abstraction]
- Agent Implication: Agents must ensure all LLM interactions are routed through the `LLMProvider` interface, and avoid direct coupling to specific LLM implementations.

- Claim: All core domain types and data structures for the application must be defined exclusively within the `src/core/types/index.ts` module to ensure type consistency and prevent fragmentation. [CLAIM:inv-core-types]
- Agent Implication: Agents creating or modifying core domain types must define them in `src/core/types/index.ts` and import them elsewhere, rather than duplicating or defining them locally.

## Important Invariants

- Claim: The project is designed to be highly configurable, allowing users to customize LLM providers, models, and operational parameters, with a clear hierarchy for configuration resolution (e.g., environment variables overriding config files). [CLAIM:hyp-5]
- Agent Implication: Agents should prioritize using the established configuration mechanisms (config files, environment variables) for LLM and operational parameters. When modifying configuration logic, adhere to the existing resolution hierarchy to avoid unexpected behavior.

- Claim: The system implicitly acknowledges that its generated hypotheses are not infallible and requires a mechanism for validation and refinement, likely through human interaction or further automated analysis. [CLAIM:hyp-7]
- Agent Implication: Agents generating or consuming hypotheses should be aware of their provisional nature. When developing new features related to hypothesis generation or refinement, ensure integration with the existing interview and validation mechanisms to facilitate human feedback and status updates.

- Claim: The system has a strict policy for ignoring specific directories and file patterns during repository scanning to prevent analysis of irrelevant, temporary, or sensitive files, thereby optimizing performance and focusing on relevant codebase context. [CLAIM:hyp-10]
- Agent Implication: Agents performing file system operations or repository scanning must adhere to the defined `ignoreDirs` and `ignoreFilePatterns` from `defaultConfig`. When adding new file types or directories, evaluate if they should be added to the ignore list to maintain scan efficiency and relevance.

- Claim: The system must accurately identify and categorize different programming languages and frameworks within a repository to provide context-aware analysis, and it explicitly supports a predefined set of these. [CLAIM:hyp-13]
- Agent Implication: Agents performing codebase analysis or generating context must rely on the `SupportedLanguage` and `SupportedFramework` types for classification. When extending support for new languages or frameworks, these types must be updated, and detection logic must be implemented accordingly.

- Claim: All LLM interactions must respect the configured `maxTokensBudget` to control costs and performance, treating it as a critical operational constraint. [CLAIM:inv-llm-budget]
- Agent Implication: Agents must implement and verify mechanisms to enforce `maxTokensBudget` for all LLM calls, and consider its implications for prompt engineering.

## Valid States

- SemanticContext is consistent, versioned, and reflects all derived knowledge. [CLAIM:hyp-4]
- LLM interactions are routed through the `LLMProvider` interface. [CLAIM:inv-llm-abstraction]
- Hypotheses are generated and linked to validation and refinement mechanisms. [CLAIM:hyp-7]
- Configuration parameters are resolved according to a defined hierarchy. [CLAIM:hyp-5]
- Repository scans exclude ignored directories and file patterns. [CLAIM:hyp-10]
- Core domain types are consistently defined in `src/core/types/index.ts`. [CLAIM:inv-core-types]
- All primary interactions are exposed via the CLI. [CLAIM:hyp-11]

## Invalid States (must never exist)

- Direct coupling to specific LLM implementations, bypassing the `LLMProvider` interface. [CLAIM:inv-llm-abstraction]
- Inconsistent or fragmented definitions of core domain types across multiple modules. [CLAIM:inv-core-types]
- LLM token usage exceeding `maxTokensBudget` without explicit handling. [CLAIM:inv-llm-budget]
- Repository scans including irrelevant or sensitive files due to ignored policy violations. [CLAIM:hyp-10]
- Hypotheses treated as infallible truths without a validation mechanism. [CLAIM:hyp-7]
- Core system logic bypassing the modular, pipeline-driven architecture. [CLAIM:hyp-1]
- New primary workflows introduced without CLI exposure. [CLAIM:hyp-11]

## Open Validation Points

The following points represent areas where the system's behavior or design principles are inferred or require explicit validation and enforcement mechanisms:

- **Configuration Resolution Hierarchy:** The exact hierarchy for configuration resolution (e.g., environment variables overriding config files) needs explicit documentation and robust testing to ensure predictable behavior. [CLAIM:hyp-5]
- **LLM Token Budget Enforcement:** Mechanisms to strictly enforce `maxTokensBudget` during LLM interactions need to be validated to ensure cost and performance constraints are always met. This includes handling scenarios where prompts might naturally exceed the budget. [CLAIM:inv-llm-budget]
- **Supported Languages and Frameworks Detection:** The accuracy and completeness of the system's ability to identify and categorize `SupportedLanguage` and `SupportedFramework` types require ongoing validation as new technologies emerge or existing ones evolve. [CLAIM:hyp-13]
- **`src/utils` Module Cohesion:** The `src/utils` module must remain a collection of highly cohesive, low-dependency, generic helper functions. This principle requires continuous review during development to prevent the introduction of domain-specific or high-dependency logic.
