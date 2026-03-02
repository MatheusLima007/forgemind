# Agent Operating Manual: Cognitive Safety for AI Agents

This manual serves as a cognitive safety guide for AI agents operating within this project. Its purpose is to prevent conceptual mistakes by explicitly detailing hidden risks, architectural invariants, and operational assumptions. Adherence to these guidelines is paramount for maintaining system integrity, performance, and conceptual consistency.

## Quick Cognitive Safety Rules

1.  **Semantic Context is Sacred:** Always refer to and update the `SemanticContext` as the single, authoritative source of codebase understanding. [CLAIM:hyp-4]
2.  **Abstract LLM Interactions:** Interact with Large Language Models exclusively through the `LLMProvider` interface. Never directly couple to specific LLM implementations. [CLAIM:hyp-2]
3.  **Respect Token Budgets:** Strictly adhere to `maxTokensBudget` to manage costs and prevent performance issues in all LLM interactions. [CLAIM:hyp-6]
4.  **Validate Hypotheses:** Treat all generated hypotheses as provisional. Integrate with human validation and refinement mechanisms. [CLAIM:hyp-7]
5.  **Centralize Types:** Define all core domain types exclusively within `src/core/types/index.ts` to ensure consistency. [CLAIM:hyp-14]
6.  **Adhere to Configuration:** Utilize established configuration mechanisms and respect the resolution hierarchy for all operational parameters. [CLAIM:hyp-5]
7.  **Modern Practices Only:** Embrace modern JavaScript/TypeScript features and avoid introducing legacy patterns or unnecessary third-party libraries. [CLAIM:hyp-12]
8.  **Log Deliberately:** Use the `Logger` for all logging, considering whether output needs to be machine-parseable or human-readable. [CLAIM:hyp-9]
9.  **Filter Scans:** Always respect `ignoreDirs` and `ignoreFilePatterns` during repository scanning to maintain efficiency and relevance. [CLAIM:hyp-10]
10. **Utilize Utilities Wisely:** Leverage `src/utils` for generic, non-domain-specific functions, but avoid introducing domain logic there. [CLAIM:hyp-8]

## Likely Agent Errors

These are common pitfalls or misinterpretations that agents might encounter, leading to incorrect behavior or system degradation.

-   **Claim:** Misinterpreting subtle semantic differences in how various LLMProviders interpret code context, leading to inaccurate or biased analysis.
    -   **Evidence:** [CLAIM:hyp-2]
    -   **Confidence:** confirmed
    -   **Agent Implication:** Agents must be aware that while the `LLMProvider` interface abstracts *how* to interact, the underlying LLM implementations might have subtle differences in their interpretation of prompts or context. Rigorous testing and validation across providers are necessary, especially when critical analysis depends on nuanced understanding.

-   **Claim:** Violating the 'maxTokensBudget' when constructing LLM prompts, resulting in increased costs or truncated responses.
    -   **Evidence:** The project explicitly manages LLM token usage to control costs and performance, treating `maxTokensBudget` as a critical operational constraint. [CLAIM:hyp-6]
    -   **Confidence:** inferred
    -   **Agent Implication:** Agents must respect the `maxTokensBudget` when constructing LLM prompts or processing responses. Any new LLM interactions or modifications to existing ones should consider and adhere to this budget to manage costs and prevent performance issues.

-   **Claim:** Failing to adhere to the defined 'ignoreDirs' and 'ignoreFilePatterns' during repository scanning, leading to analysis of irrelevant or sensitive files.
    -   **Evidence:** The system has a strict policy for ignoring specific directories and file patterns during repository scanning to prevent analysis of irrelevant, temporary, or sensitive files, thereby optimizing performance and focusing on relevant codebase context. [CLAIM:hyp-10]
    -   **Confidence:** confirmed
    -   **Agent Implication:** Agents performing file system operations or repository scanning must adhere to the defined `ignoreDirs` and `ignoreFilePatterns`. When adding new file types or directories, evaluate if they should be added to the ignore list to maintain scan efficiency and relevance.

-   **Claim:** Introducing older JavaScript/TypeScript patterns or unnecessary third-party libraries, deviating from the modern language practices principle.
    -   **Evidence:** The project embraces modern JavaScript/TypeScript features, including ES modules, `async/await` for asynchronous operations, and the `fetch` API, indicating a preference for contemporary language and platform capabilities over older alternatives or third-party libraries for basic functionalities. [CLAIM:hyp-12]
    -   **Confidence:** confirmed
    -   **Agent Implication:** Agents should adhere to modern JavaScript/TypeScript practices. Avoid introducing older patterns or unnecessary third-party libraries for functionalities natively supported by modern platforms.

-   **Claim:** Assuming generated hypotheses are infallible without proper validation and refinement mechanisms.
    -   **Evidence:** The system implicitly acknowledges that its generated hypotheses are not infallible and requires a mechanism for validation and refinement, likely through human interaction or further automated analysis. [CLAIM:hyp-7]
    -   **Confidence:** confirmed
    -   **Agent Implication:** Agents generating or consuming hypotheses should be aware of their provisional nature. When developing new features related to hypothesis generation or refinement, ensure integration with the existing interview and validation mechanisms to facilitate human feedback and status updates.

-   **Claim:** Inconsistent type definitions across modules if 'src/core/types' is not strictly used as the central contract.
    -   **Evidence:** The `src/core/types` module serves as the central contract definition for the entire application, ensuring type consistency and clear data structures across all other modules. No other module should define core domain types independently. [CLAIM:hyp-14]
    -   **Confidence:** confirmed
    -   **Agent Implication:** Agents must define all core domain types within `src/core/types/index.ts`. When introducing new data structures or modifying existing ones, ensure they are declared or updated in this central location to maintain type consistency and prevent fragmentation of type definitions.

## Deceptive Patterns (looks obvious but is wrong)

These are situations that might appear straightforward or correct on the surface but hide underlying complexities or lead to incorrect outcomes.

-   **Claim:** Subtle semantic differences in how LLMProviders interpret code context, which might not be immediately obvious but can significantly alter analysis outcomes.
    -   **Evidence:** [CLAIM:hyp-2]
    -   **Confidence:** confirmed
    -   **Agent Implication:** Agents must not assume functional equivalence across different `LLMProvider` implementations, even if the interface is identical. Differences in model training, prompt interpretation, or underlying knowledge can lead to divergent results. Always validate critical LLM-driven analysis across providers if multi-provider support is active.

-   **Claim:** Implicit assumptions about LLM behavior or API stability that are not explicitly documented or tested.
    -   **Evidence:** The project prioritizes robust error handling and resilience for external LLM API calls, specifically distinguishing between recoverable and non-recoverable errors to enable retry mechanisms or graceful degradation. [CLAIM:hyp-3] The project uses a fixed timeout for external LLM requests (120 seconds), indicating a pragmatic decision to prevent indefinite hangs and manage resource consumption when interacting with potentially slow or unresponsive third-party services. [CLAIM:hyp-15]
    -   **Confidence:** confirmed
    -   **Agent Implication:** Agents should never assume LLM API calls will always succeed, respond quickly, or behave deterministically. Always account for network issues, rate limits, API changes, and non-deterministic outputs. Leverage `LLMProviderError`'s `recoverable` flag and respect timeouts.

-   **Claim:** Over-reliance on automated hypothesis generation without human validation, leading to propagation of incorrect knowledge.
    -   **Evidence:** The system implicitly acknowledges that its generated hypotheses are not infallible and requires a mechanism for validation and refinement, likely through human interaction or further automated analysis. [CLAIM:hyp-7]
    -   **Confidence:** confirmed
    -   **Agent Implication:** Agents must integrate hypothesis generation with the established interview and validation mechanisms. The output of automated hypothesis generation should be considered a starting point, not a definitive truth, until validated.

## Implicit Couplings

These are dependencies or relationships between modules or components that are not explicitly declared or immediately obvious, posing a risk to modularity and maintainability.

-   **Claim:** Potential for modules to bypass the 'LLMProvider' interface and directly couple to specific LLM implementations, violating the Dependency Inversion Principle.
    -   **Evidence:** [CLAIM:hyp-2]
    -   **Confidence:** confirmed
    -   **Agent Implication:** Agents must interact with LLMs exclusively via the `LLMProvider` interface, avoiding direct coupling to specific LLM implementations. This ensures maintainability and allows for easy switching of LLM backends.

-   **Claim:** Unintended dependencies on specific file system structures or external tools not explicitly declared.
    -   **Evidence:** The `src/utils` module is intended to be a collection of highly cohesive, low-dependency, generic helper functions that can be consumed by any other module without introducing circular dependencies or domain-specific logic. [CLAIM:hyp-8] The system has a strict policy for ignoring specific directories and file patterns during repository scanning to prevent analysis of irrelevant, temporary, or sensitive files, thereby optimizing performance and focusing on relevant codebase context. [CLAIM:hyp-10]
    -   **Confidence:** confirmed
    -   **Agent Implication:** When performing file system operations, agents should use the `src/utils/fileSystem.ts` module. Avoid hardcoding paths or assuming the presence of specific external tools. Any new external tool dependency must be explicitly declared and configured.

-   **Claim:** Implicit reliance on specific environment variable configurations without clear fallback mechanisms.
    -   **Evidence:** The project is designed to be highly configurable, allowing users to customize LLM providers, models, and operational parameters, with a clear hierarchy for configuration resolution (e.g., environment variables overriding config files). [CLAIM:hyp-5]
    -   **Confidence:** inferred
    -   **Agent Implication:** Agents should prioritize using the established configuration mechanisms (config files, environment variables) for LLM and operational parameters. When modifying configuration logic, adhere to the existing resolution hierarchy to avoid unexpected behavior. Always ensure robust fallback mechanisms for critical configurations.

## Invisible Side Effects

These are consequences of changes that are not immediately apparent or easily traceable, often manifesting as subtle bugs, performance degradations, or unexpected behavior in seemingly unrelated parts of the system.

-   **Claim:** Uncontrolled LLM token usage leading to unexpected cost overruns or performance degradation that is not immediately visible.
    -   **Evidence:** The project explicitly manages LLM token usage to control costs and performance, treating `maxTokensBudget` as a critical operational constraint. [CLAIM:hyp-6]
    -   **Confidence:** inferred
    -   **Agent Implication:** Any new or modified LLM interaction must include explicit token counting and adherence to `maxTokensBudget`. Failure to do so can silently increase operational costs and degrade performance without immediate error signals. Implement monitoring for token usage.

-   **Claim:** Changes in 'src/utils' functions having widespread, unforeseen impacts across the codebase due to its generic nature.
    -   **Evidence:** The `src/utils` module is intended to be a collection of highly cohesive, low-dependency, generic helper functions that can be consumed by any other module without introducing circular dependencies or domain-specific logic. [CLAIM:hyp-8]
    -   **Confidence:** confirmed
    -   **Agent Implication:** When modifying functions within `src/utils`, agents must perform a comprehensive impact analysis across the entire codebase. Due to its generic and widely consumed nature, even minor changes can have cascading, non-obvious effects. Prioritize backward compatibility and thorough testing.

-   **Claim:** Updates to 'src/core/types' causing silent type mismatches in consuming modules if not rigorously checked by the TypeScript compiler or tests.
    -   **Evidence:** The `src/core/types` module serves as the central contract definition for the entire application, ensuring type consistency and clear data structures across all other modules. No other module should define core domain types independently. [CLAIM:hyp-14]
    -   **Confidence:** confirmed
    -   **Agent Implication:** Any modification to types in `src/core/types` requires a full type-check of the entire project. While TypeScript helps, subtle changes in type definitions can lead to logical errors or unexpected runtime behavior in consuming modules if not thoroughly validated.

-   **Claim:** Long-running or hanging LLM requests consuming system resources without clear indication of failure.
    -   **Evidence:** The project uses a fixed timeout for external LLM requests (120 seconds), indicating a pragmatic decision to prevent indefinite hangs and manage resource consumption when interacting with potentially slow or unresponsive third-party services. [CLAIM:hyp-15]
    -   **Confidence:** inferred
    -   **Agent Implication:** Agents developing or modifying LLM integration logic must respect the established 120-second timeout for external requests. When interacting with new external services, consider implementing similar timeout mechanisms to ensure resilience and prevent resource exhaustion. Ensure proper error handling for timeouts.

## Operational Assumptions

These are fundamental beliefs about the system's environment, user behavior, or external dependencies that, if violated, could lead to system failure or unexpected behavior.

-   **Claim:** Human review processes will consistently enforce architectural compliance based on agent-first documentation.
    -   **Evidence:** Architectural compliance is currently ensured through explicit agent-first documentation and human review processes. The system improves alignment and reduces ambiguity for AI agents, but enforcement is handled by developer discipline and future CI-based validation strategies. [CRITICAL INVARIANT:Architectural Compliance Enforcement]
    -   **Confidence:** confirmed
    -   **Agent Implication:** Agents should generate code and documentation that is clear, explicit, and directly references the architectural principles and claims outlined in this manual. This facilitates human review and compliance. Do not assume automated enforcement is currently in place for all architectural rules.

-   **Claim:** LLM API calls will eventually respond within the fixed timeout (120 seconds) or fail recoverably.
    -   **Evidence:** The project uses a fixed timeout for external LLM requests (120 seconds), indicating a pragmatic decision to prevent indefinite hangs and manage resource consumption when interacting with potentially slow or unresponsive third-party services. [CLAIM:hyp-15] The project prioritizes robust error handling and resilience for external LLM API calls, specifically distinguishing between recoverable and non-recoverable errors to enable retry mechanisms or graceful degradation. [CLAIM:hyp-3]
    -   **Confidence:** confirmed
    -   **Agent Implication:** Agents must design LLM interaction logic to handle both successful responses within the timeout and `LLMProviderError` instances, specifically checking the `recoverable` flag. Do not assume indefinite waits or unhandled errors.

-   **Claim:** The 'SemanticContext' is always the single source of truth and is kept consistent by all system components.
    -   **Evidence:** [CLAIM:hyp-4] [CRITICAL INVARIANT:Semantic Context as Single Source of Truth]
    -   **Confidence:** confirmed
    -   **Agent Implication:** Agents must always refer to and update the `SemanticContext` as the authoritative source for codebase understanding. Any new insights or modifications to existing knowledge should be integrated into this central structure to maintain consistency and versioning. Deviations will lead to fragmented or incorrect system understanding.

-   **Claim:** The predefined set of 'SupportedLanguage' and 'SupportedFramework' types is sufficient for current and near-future analysis needs.
    -   **Evidence:** The system must accurately identify and categorize different programming languages and frameworks within a repository to provide context-aware analysis, and it explicitly supports a predefined set of these. [CLAIM:hyp-13]
    -   **Confidence:** inferred
    -   **Agent Implication:** Agents performing codebase analysis or generating context must rely on the `SupportedLanguage` and `SupportedFramework` types for classification. When extending support for new languages or frameworks, these types must be updated, and detection logic must be implemented accordingly.

-   **Claim:** The CLI-first interaction model is adequate for all primary user workflows.
    -   **Evidence:** The project is designed as a CLI-first application, where all primary interactions and workflows are exposed through command-line commands, rather than a GUI or API server. [CLAIM:hyp-11]
    -   **Confidence:** confirmed
    -   **Agent Implication:** Agents should assume a CLI-driven interaction model. New features or workflows should be exposed as command-line commands, rather than designing for a GUI or API endpoint.

## Safe Change Workflow

This workflow outlines the steps for AI agents to propose and implement changes safely, minimizing the risk of introducing conceptual errors or violating architectural invariants.

1.  **Understand the Goal & Context:**
    *   Clearly define the problem or feature to be addressed.
    *   Consult the `SemanticContext` [CLAIM:hyp-4] for existing codebase understanding relevant to the change.
    *   Identify which pipeline stages within `core` [CLAIM:hyp-1] are affected.

2.  **Identify Affected Claims & Invariants:**
    *   Review this manual for relevant `Quick Cognitive Safety Rules`, `Likely Agent Errors`, `Deceptive Patterns`, `Implicit Couplings`, `Invisible Side Effects`, and `Operational Assumptions`.
    *   Specifically identify any `claims` [CLAIM:hyp-1 to hyp-15] that might be impacted or violated by the proposed change.
    *   Check `criticalInvariants` (e.g., "Semantic Context as Single Source of Truth", "Architectural Compliance Enforcement") for potential breaches.

3.  **Propose Design & Justification:**
    *   **Modular Design:** Ensure the proposed change aligns with the highly modular, pipeline-driven architecture. [CLAIM:hyp-1]
    *   **LLM Interaction:** If LLMs are involved, ensure interaction is exclusively via `LLMProvider` [CLAIM:hyp-2], respects `maxTokensBudget` [CLAIM:hyp-6], and handles `LLMProviderError` [CLAIM:hyp-3] appropriately.
    *   **Type Definitions:** If new data structures are needed, define them in `src/core/types/index.ts` [CLAIM:hyp-14].
    *   **Configuration:** Leverage existing configuration mechanisms and hierarchy. [CLAIM:hyp-5]
    *   **Utilities:** Utilize `src/utils` for generic functions, but avoid introducing domain-specific logic. [CLAIM:hyp-8]
    *   **Modern Practices:** Adhere to modern JavaScript/TypeScript practices. [CLAIM:hyp-12]
    *   **Logging:** Use the `Logger` appropriately. [CLAIM:hyp-9]
    *   **CLI-First:** If a new user interaction is required, expose it via the CLI. [CLAIM:hyp-11]
    *   **Boundary Adherence:** Explicitly state how the change respects `conceptualBoundaries` (allowed/prohibited relations, context responsibilities).

4.  **Pre-computation & Impact Analysis:**
    *   **Token Usage:** Estimate token usage for any new LLM interactions. [CLAIM:hyp-6]
    *   **File System Impact:** Verify adherence to `ignoreDirs` and `ignoreFilePatterns` for any file system operations. [CLAIM:hyp-10]
    *   **Dependency Analysis:** Analyze potential `implicitCoupling` and `invisibleSideEffects`, especially for changes in `src/utils` or `src/core/types`.
    *   **Error Handling:** Detail how robust error handling and resilience are maintained. [CLAIM:hyp-3], [CLAIM:hyp-15]

5.  **Implementation & Testing:**
    *   Implement the change following the proposed design.
    *   Write comprehensive tests, including unit, integration, and end-to-end tests, to validate functionality and guard against regressions.
    *   Specifically test scenarios related to identified `Likely Agent Errors` and `Deceptive Patterns`.
    *   Verify that `criticalInvariants` are preserved.

6.  **Documentation & Review:**
    *   Update relevant sections of this `agent-operating-manual.md` if new claims, risks, or assumptions are identified.
    *   Clearly document the change, its rationale, and any new `agentImpact` or `cognitiveRisks` introduced.
    *   Submit the change for human review, explicitly highlighting how the workflow steps were followed and how potential risks were mitigated. The human reviewer will use this documentation as a structured checklist for architectural compliance. [CRITICAL INVARIANT:Architectural Compliance Enforcement]

7.  **Monitor & Iterate:**
    *   After deployment, monitor the system for any `invisibleSideEffects` or unexpected behavior.
    *   Gather feedback and iterate on the change and its documentation as needed.
