# agent-operating-manual.md

## Quick Cognitive Safety Rules

1.  **LLM Abstraction is Sacred**: All interactions with Large Language Models *must* go through the LLM provider interface. Never directly import or use specific LLM implementations. [CLAIM:hyp-2]
2.  **SemanticContext is Truth**: The semantic context is the single, authoritative source for codebase understanding. All knowledge, updates, and derived insights *must* be consistently aggregated and versioned within it. [CLAIM:hyp-4]
3.  **Types Live in Core Types**: All core domain types and data structures *must* be defined exclusively in the designated core types file. Avoid defining them elsewhere to prevent fragmentation and inconsistency. [CLAIM:hyp-14]
4.  **Respect the Budget**: Always adhere to the token budget when constructing LLM prompts or processing responses to manage costs and performance. [CLAIM:hyp-6]
5.  **Utilities are Generic**: The utilities module is for highly cohesive, low-dependency, *generic* helper functions. Do not introduce domain-specific logic there. [CLAIM:hyp-8]
6.  **Validate Hypotheses**: Generated hypotheses are provisional. Always integrate with the interview and validation mechanisms for human feedback and refinement. [CLAIM:hyp-7]

---

## Likely Agent Errors

-   **Claim**: Misinterpreting subtle semantic differences in how various LLM providers interpret code context, leading to inconsistent or incorrect analysis. [CLAIM:risk-LE-1]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: Agents should be aware that even with the abstraction layer, different underlying LLMs might interpret prompts or code snippets with subtle variations. This can lead to inconsistent analysis results if not accounted for, potentially requiring provider-specific prompt tuning or validation.

-   **Claim**: Violating the token budget constraint, resulting in unexpected costs, truncated LLM responses, or incomplete context for agents. [CLAIM:risk-LE-2]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: Agents must rigorously track and manage token usage when preparing prompts or processing LLM outputs. Exceeding the budget can lead to financial penalties, incomplete information, or errors in downstream processing.

-   **Claim**: Incorrectly classifying LLM API errors as recoverable when they are permanent, leading to infinite retry loops or resource exhaustion. [CLAIM:risk-LE-3]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: When handling LLM provider errors, agents must carefully evaluate the `recoverable` flag. Misinterpreting this flag can lead to inefficient or erroneous retry strategies, consuming resources without resolving the underlying issue.

-   **Claim**: Introducing domain-specific logic into the utilities module, compromising its generic nature and creating hidden dependencies. [CLAIM:risk-LE-4]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: Agents must strictly adhere to the principle that the utilities module is for generic, reusable functions. Adding domain-specific logic here creates hidden coupling, makes the utility less reusable, and complicates future refactoring.

-   **Claim**: Forgetting to update the designated core types file when new data structures are introduced or modified, leading to type inconsistencies and potential runtime errors. [CLAIM:risk-LE-5]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: Any change or addition to core data structures used across the application *must* be reflected in the designated core types file. Failure to do so will result in fragmented type definitions, making the codebase harder to understand, maintain, and prone to type-related bugs.

-   **Claim**: Failing to adhere to the configured ignore directories and file patterns during manual file system operations, leading to analysis of irrelevant or sensitive data. [CLAIM:risk-LE-6]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: When performing file system scans or operations, agents must always consult and apply the configured ignore directories and file patterns. Ignoring these can lead to processing unnecessary files, performance degradation, or accidental exposure of sensitive information.

---

## Deceptive Patterns

-   **Claim**: Assuming consistency in LLM behavior or output across different LLM provider implementations, despite the explicit warning about semantic differences. [CLAIM:risk-DP-1]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: Agents should not assume that switching LLM providers will yield identical results. While the interface is consistent, the underlying models have different training data and biases. Always validate outputs when changing providers or models.

-   **Claim**: Implicitly relying on specific LLM provider characteristics (e.g., prompt formatting, error codes) that are not part of the LLM provider interface contract. [CLAIM:risk-DP-2]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: Agents must only depend on the contract defined by the LLM provider interface. Relying on undocumented or provider-specific behaviors creates fragile code that will break if the underlying provider changes or a new provider is introduced.

-   **Claim**: Treating generated hypotheses as confirmed facts without engaging the validation and refinement mechanisms, leading to propagation of unverified knowledge. [CLAIM:risk-DP-3]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: Hypotheses are provisional. Agents must integrate with the interview and validation workflow to ensure human review and refinement. Bypassing this step leads to the system operating on potentially incorrect or unverified assumptions.

-   **Claim**: Over-generalizing utility functions in the utilities module to include domain-specific logic, making them appear generic but creating hidden coupling. [CLAIM:risk-DP-4]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: A function in the utilities module might *look* generic, but if it implicitly relies on or manipulates domain-specific data structures or concepts from the core module, it's a deceptive pattern. This creates hidden coupling and undermines modularity.

-   **Claim**: Believing that the semantic context is always perfectly up-to-date without explicit mechanisms for versioning, aggregation, and conflict resolution. [CLAIM:risk-DP-5]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: The semantic context is an evolving entity. Agents should not assume it's always perfectly current or consistent, especially in concurrent operations or after partial updates. Mechanisms for versioning and conflict resolution (if any) must be understood and utilized.

---

## Implicit Couplings

-   **Claim**: Accidental coupling of core module logic to specific LLM implementations by inferring behavior not explicitly defined in the LLM provider interface. [CLAIM:risk-IC-1]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: The core module must *only* interact with LLMs via the LLM provider interface. Any code in core that assumes specific prompt formats, error codes, or response structures of a particular LLM creates an implicit coupling, violating the Dependency Inversion Principle.

-   **Claim**: Modules implicitly relying on the side effects or specific ordering of operations within the pipeline-driven architecture, rather than explicit data flow. [CLAIM:risk-IC-2]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: The pipeline stages (scanning, analyzing, hypothesizing, etc.) are designed to be modular. Agents should ensure that each stage explicitly passes necessary data to the next, rather than relying on implicit state changes or a fixed execution order that isn't enforced by the data flow.

-   **Claim**: Hidden dependencies on specific configuration values or environment variables that are not clearly documented or enforced through the configuration hierarchy. [CLAIM:risk-IC-3]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: Agents must always refer to the established configuration resolution hierarchy. Introducing new configuration parameters without documenting their precedence or implicitly relying on undocumented environment variables creates hidden dependencies that are hard to trace and manage.

-   **Claim**: Components implicitly assuming the presence or state of other components, bypassing explicit interfaces or contracts. [CLAIM:risk-IC-4]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: Each module and component has defined responsibilities and interfaces. Agents should avoid making assumptions about the internal state or existence of other components without explicit interaction through their defined contracts.

-   **Claim**: Reliance on specific file system structures or naming conventions that are not explicitly part of the configured ignore patterns. [CLAIM:risk-IC-5]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: While the system ignores certain files, agents should not implicitly assume specific file system layouts beyond what is explicitly configured. This can lead to brittle code that breaks if repository structures change.

---

## Invisible Side Effects

-   **Claim**: Changes to ignore patterns silently altering the scope of repository scans, leading to missed context or inclusion of unwanted files. [CLAIM:risk-ISE-1]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: Modifying ignore lists has a broad, often non-obvious impact on what the system perceives as the codebase. Agents must carefully evaluate these changes, as they can silently exclude critical files or include irrelevant ones, affecting analysis quality and performance.

-   **Claim**: Modifications to the token budget having cascading effects on LLM response completeness and overall system cost without immediate visibility. [CLAIM:risk-ISE-2]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: Adjusting the token budget can drastically change LLM behavior. A lower budget might truncate responses, leading to incomplete information, while a higher budget can significantly increase costs. These effects might not be immediately apparent without thorough testing across various scenarios.

-   **Claim**: Updates to the designated core types file inadvertently breaking type compatibility in distant modules that rely on those definitions. [CLAIM:risk-ISE-3]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: Because the core types file is the central contract, even minor changes can have widespread, silent ripple effects across the entire codebase. Agents must perform comprehensive type checking and potentially integration tests after any modification to these core types.

-   **Claim**: Performance degradation due to inefficient LLM prompt construction or excessive API calls, even within the token budget. [CLAIM:risk-ISE-4]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: While the token budget controls cost, it doesn't guarantee performance. Inefficient prompt engineering (e.g., redundant information, poorly structured queries) or making too many sequential API calls can lead to slow execution times, which might not be immediately obvious without profiling.

-   **Claim**: Subtle changes in LLM provider behavior (e.g., new model versions) leading to different semantic interpretations of code context, which are hard to detect. [CLAIM:risk-ISE-5]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: LLM models are continuously updated. A new version from a provider might subtly change how it interprets certain code patterns or responds to prompts. These changes can lead to different analysis results that are difficult to attribute or debug without a robust validation suite.

---

## Operational Assumptions

-   **Claim**: External LLM services are generally available, performant, and respond within the 120-second timeout limit. [CLAIM:risk-OA-1]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: The system assumes a reasonable level of reliability and responsiveness from external LLM providers. Prolonged outages, degraded performance, or frequent timeouts will severely impact the system's ability to function.

-   **Claim**: Human reviewers consistently and accurately apply the agent-first documentation checklist during code review to ensure architectural compliance. [CLAIM:risk-OA-2]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: In the absence of full automated enforcement, the system relies on human vigilance to maintain architectural integrity. Any lapse in human review can lead to the introduction of non-compliant code and technical debt.

-   **Claim**: The semantic context can be reliably updated and versioned without significant concurrency issues or data loss. [CLAIM:risk-OA-3]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: The integrity of the semantic context is paramount. The system assumes that updates to this central source of truth are atomic and that any versioning or conflict resolution mechanisms are robust.

-   **Claim**: The chosen token budget is appropriate for the majority of LLM tasks and does not unduly restrict context or output quality. [CLAIM:risk-OA-4]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: The token budget is a critical parameter balancing cost and quality. The system assumes this budget is sufficient for its analytical tasks. If the complexity of codebases or analysis requirements increases, this assumption may no longer hold, leading to degraded results.

-   **Claim**: The system's ability to identify and categorize programming languages and frameworks is sufficiently accurate for its analysis needs. [CLAIM:risk-OA-5]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: The quality of context-aware analysis heavily depends on accurate language and framework detection. If the detection logic fails or is incomplete for certain projects, the subsequent analysis will be flawed.

-   **Claim**: The underlying file system operations are reliable and performant for typical repository sizes. [CLAIM:risk-OA-6]
    -   **Evidence**: Project's cognitive risk assessment
    -   **Confidence**: inferred
    -   **Agent Implication**: The system relies on efficient and error-free file system access for scanning and processing codebases. For very large repositories or unreliable storage, this assumption might break down, leading to performance bottlenecks or data access errors.

---

## Safe Change Workflow

This workflow guides agents through making modifications while mitigating cognitive risks and adhering to the system's architectural principles.

### Phase 1: Understand the Change & Intent

1.  **Clarify Core Purpose**: Re-evaluate the change against the system's core purpose: "Extracting and validating architectural decisions and domain invariants from code." Ensure the change aligns.
2.  **Consult Mental Model**: Understand how the proposed change fits into the "Agent-first documentation" mental model. Will it enhance or detract from structured, explicit knowledge for AI agents?
3.  **Identify Central Concepts**: Determine which central concepts are directly or indirectly affected.
4.  **Review Principles**: Check the proposed change against the system's guiding principles.

### Phase 2: Identify Affected Components & Boundaries

1.  **Map to Conceptual Boundaries**: Pinpoint which conceptual contexts are involved.
2.  **Check Allowed/Prohibited Relations**: Verify that the proposed interactions between modules adhere to allowed and prohibited relations.
3.  **Scan for Dangerous Interactions**: Actively look for any dangerous interactions that the change might introduce or exacerbate.

### Phase 3: Check Critical Invariants

1.  **LLM Provider Abstraction**: If the change involves LLMs, confirm that all interactions *exclusively* use the LLM provider interface. [CLAIM:hyp-2]
2.  **Semantic Context as Single Source of Truth**: If the change involves codebase understanding or knowledge, ensure it consistently aggregates and versions data within the semantic context. [CLAIM:hyp-4]
3.  **Centralized Core Type Definitions**: If new data structures are introduced or existing ones modified, ensure they are defined *only* in the designated core types file. [CLAIM:hyp-14]

### Phase 4: Anticipate Cognitive Risks

1.  **Review Likely Agent Errors**: Consider if the change introduces new ways for agents to make errors (e.g., violating token budget, misclassifying LLM errors, introducing domain logic to utilities).
2.  **Examine Deceptive Patterns**: Evaluate if the change creates new deceptive patterns or makes existing ones harder to detect (e.g., assuming LLM consistency, treating hypotheses as facts).
3.  **Uncover Implicit Couplings**: Identify any new implicit dependencies or hidden assumptions the change might create between modules or components.
4.  **Foresee Invisible Side Effects**: Think through potential non-obvious consequences (e.g., changes to ignore patterns affecting scan scope, token budget changes impacting cost/quality, type definition changes breaking distant modules).
5.  **Validate Operational Assumptions**: Does the change challenge any existing operational assumptions? (e.g., LLM availability, human review effectiveness, semantic context reliability).

### Phase 5: Implementation & Self-Correction

1.  **Adhere to Agent Impacts**: For each relevant claim from the initial analysis, ensure the `agentImpact` is respected.
    *   **Pipeline Stages**: Understand pipeline stages and component responsibilities. [CLAIM:hyp-1]
    *   **LLM Interaction**: Use the LLM provider interface exclusively. [CLAIM:hyp-2]
    *   **Error Handling**: Leverage `recoverable` flag in LLM provider errors. [CLAIM:hyp-3]
    *   **SemanticContext**: Always refer to and update the semantic context. [CLAIM:hyp-4]
    *   **Configuration**: Prioritize established configuration mechanisms. [CLAIM:hyp-5]
    *   **Token Budget**: Respect the token budget. [CLAIM:hyp-6]
    *   **Hypothesis Validation**: Integrate with interview/validation for provisional hypotheses. [CLAIM:hyp-7]
    *   **Utilities**: Use the utilities module for generic, non-domain-specific functions. [CLAIM:hyp-8]
    *   **Logging**: Utilize the logger for all application logging. [CLAIM:hyp-9]
    *   **File System Ignores**: Adhere to configured ignore directories and file patterns. [CLAIM:hyp-10]
    *   **CLI-First**: Assume CLI-driven interaction model. [CLAIM:hyp-11]
    *   **Modern TS/JS**: Adhere to modern practices. [CLAIM:hyp-12]
    *   **Language/Framework Types**: Use supported language/framework types for classification. [CLAIM:hyp-13]
    *   **Core Types**: Define all core domain types in the designated core types file. [CLAIM:hyp-14]
    *   **Timeouts**: Respect established timeouts for external requests. [CLAIM:hyp-15]
2.  **Use Centralized Logging**: Ensure all relevant operational information is logged using the logger, considering both human-readable and machine-parseable formats. [CLAIM:hyp-9]

### Phase 6: Documentation & Review

1.  **Update Agent-First Documentation**: Modify or add to the `agent-operating-manual.md` to reflect any new insights, risks, or changes in operational assumptions introduced by the modification.
2.  **Prepare for Human Review**: Clearly articulate the change, its impact, and how it adheres to the system's principles and invariants for human reviewers. Highlight any new cognitive risks identified.
3.  **Seek Feedback**: Engage human reviewers to ensure architectural compliance and catch any conceptual mistakes or hidden risks that the agent might have missed.
