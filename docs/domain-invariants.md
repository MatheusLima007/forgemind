# Domain Invariants

This document crystalizes the core domain rules and states that agents operating within this project must understand and adhere to. Violation of these invariants can lead to system instability, incorrect behavior, or data corruption.

## Critical Invariants

These invariants represent fundamental rules that, if violated, would severely compromise the system's core functionality, data integrity, or primary interaction model.

-   **Claim**: The system must maintain a comprehensive, evolving 'Semantic Context' as a single source of truth for its understanding of a codebase. All derived knowledge (signals, hypotheses, interview data, consolidated knowledge) must be consistently aggregated and versioned within this context. [CLAIM:hyp-4]
    -   **Confidence**: confirmed
    -   **Agent Implication**: Agents must always refer to and update the `SemanticContext` as the authoritative source for codebase understanding. Any new insights or modifications to existing knowledge should be integrated into this central structure to maintain consistency and versioning.

-   **Claim**: The project aims for a highly modular, pipeline-driven architecture, where each stage of the 'AI Context Engineering' process (scanning, analyzing, hypothesizing, interviewing, consolidating, generating) is encapsulated in distinct, interchangeable components within the `core` module. [CLAIM:hyp-1]
    -   **Confidence**: confirmed
    -   **Agent Implication**: Agents must ensure changes align with the modular, pipeline-driven design.

-   **Claim**: The project is designed as a CLI-first application, where all primary interactions and workflows are exposed through command-line commands, rather than a GUI or API server. [CLAIM:hyp-11]
    -   **Confidence**: confirmed
    -   **Agent Implication**: Agents should assume a CLI-driven interaction model. New features or workflows should be exposed as command-line commands, rather than designing for a GUI or API endpoint.

-   **Claim**: Architectural compliance is currently ensured through explicit agent-first documentation and human review processes. The system improves alignment and reduces ambiguity for AI agents, but enforcement is handled by developer discipline and future CI-based validation strategies. [CLAIM:Architectural Compliance Enforcement]
    -   **Evidence**: Synthesized from project architecture (`hyp-1`, `hyp-11`) and explicit design goals.
    -   **Confidence**: confirmed
    -   **Agent Implication**: Agents must adhere to the established architectural patterns (e.g., modularity, pipeline stages, CLI-first interaction) as described in documentation. When proposing changes, consider their impact on architectural integrity and ensure they align with the system's design principles.

## Important Invariants

These invariants are crucial for the system's performance, maintainability, user experience, and secondary functionality. Violations might not immediately crash the system but can lead to degraded performance, incorrect results, or increased technical debt.

-   **Claim**: The system has a strict policy for ignoring specific directories and file patterns during repository scanning to prevent analysis of irrelevant, temporary, or sensitive files, thereby optimizing performance and focusing on relevant codebase context. [CLAIM:hyp-10]
    -   **Confidence**: confirmed
    -   **Agent Implication**: Agents performing file system operations or repository scanning must adhere to the defined ignore policies. When adding new file types or directories, evaluate if they should be added to the ignore list to maintain scan efficiency and relevance.

-   **Claim**: The system implicitly acknowledges that its generated hypotheses are not infallible and requires a mechanism for validation and refinement, likely through human interaction or further automated analysis. [CLAIM:hyp-7]
    -   **Confidence**: confirmed
    -   **Agent Implication**: Agents generating or consuming hypotheses should be aware of their provisional nature. When developing new features related to hypothesis generation or refinement, ensure integration with the existing interview and validation mechanisms to facilitate human feedback and status updates.

-   **Claim**: The project is designed to be highly configurable, allowing users to customize LLM providers, models, and operational parameters, with a clear hierarchy for configuration resolution (e.g., environment variables overriding config files). [CLAIM:hyp-5]
    -   **Confidence**: inferred
    -   **Agent Implication**: Agents should prioritize using the established configuration mechanisms for LLM and operational parameters. When modifying configuration logic, adhere to the existing resolution hierarchy to avoid unexpected behavior.

-   **Claim**: The system must accurately identify and categorize different programming languages and frameworks within a repository to provide context-aware analysis, and it explicitly supports a predefined set of these. [CLAIM:hyp-13]
    -   **Confidence**: inferred
    -   **Agent Implication**: Agents performing codebase analysis or generating context must rely on the defined types for classification. When extending support for new languages or frameworks, these types must be updated, and detection logic must be implemented accordingly.

## Open Validation Points

These points represent areas where explicit validation or stricter enforcement might be beneficial, or where current understanding is inferred and could benefit from confirmation.

-   **LLM Token Usage Adherence**: LLM token usage must adhere to the defined token budget to control costs and performance. (Constraint)
-   **External LLM Request Timeout**: External LLM requests must respect a fixed timeout (e.g., 120 seconds) to prevent indefinite hangs. (Constraint)
-   **Configuration Resolution Hierarchy**: The precise hierarchy for configuration resolution (e.g., environment variables overriding config files) is inferred and should be explicitly documented and tested. (Inferred from `hyp-5`)
-   **Language and Framework Detection Logic**: The mechanisms for accurately identifying and categorizing languages and frameworks are critical and should be robustly validated. (Inferred from `hyp-13`)
