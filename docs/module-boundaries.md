# Module Boundaries

This document defines the conceptual boundaries, responsibilities, and interaction rules between different modules within the project. It aims to clarify the system's architecture, prevent common pitfalls, and guide future development.

## Conceptual Contexts

This section outlines the high-level conceptual modules, their primary purpose, and inherent risks.

### 1. Core Module
*   **Responsibility:** Encapsulates the 'AI Context Engineering' process (scanning, analyzing, hypothesizing, interviewing, consolidating, generating) in distinct, interchangeable components.
*   **Responsibilities:**
    *   Orchestrating the AI Context Engineering pipeline.
    *   Managing the SemanticContext.
    *   Interacting with LLMs via the LLMProvider interface.
*   **Risks:**
    *   Components becoming too tightly coupled, violating modularity.
    *   Bypassing the LLMProvider interface, leading to direct LLM implementation dependencies.

### 2. LLM Module
*   **Responsibility:** Provides a pluggable abstraction layer for Large Language Models, strictly separating core business logic from specific LLM provider implementations.
*   **Risks:**
    *   Subtle semantic differences in how different LLMProviders interpret code context.
    *   Inconsistent error handling across different LLM implementations.
    *   Performance bottlenecks due to external API latency.

### 3. `src/utils` Module
*   **Responsibility:** A collection of highly cohesive, low-dependency, generic helper functions consumable by any other module without introducing circular dependencies or domain-specific logic.
*   **Risks:**
    *   Accidental introduction of domain-specific logic, violating its generic nature.
    *   Becoming a dumping ground for unrelated functions, reducing cohesion.

### 4. `src/core/types` Module
*   **Responsibility:** Serves as the central contract definition for the entire application, ensuring type consistency and clear data structures across all other modules.
*   **Risks:**
    *   Fragmentation of type definitions if other modules define core types independently.
    *   Outdated or incorrect type definitions leading to runtime errors.

## Responsibility Boundaries

This section details the specific responsibilities and constraints for each conceptual module.

### Core Module Responsibilities
*   **Claim:** The `llm` module is designed as a pluggable abstraction layer for Large Language Models, strictly separating the core business logic from specific LLM provider implementations. The `core` module interacts with LLMs solely through the `LLMProvider` interface, enforcing the Dependency Inversion Principle. [CLAIM:hyp-2]
    *   **Confidence:** confirmed
    *   **Agent Implication:** Agents must interact with LLMs exclusively via the `LLMProvider` interface, avoiding direct coupling to specific LLM implementations. This ensures maintainability and allows for easy switching of LLM backends.

### `src/utils` Module Responsibilities
*   **Claim:** The `src/utils` module is intended to be a collection of highly cohesive, low-dependency, generic helper functions that can be consumed by any other module without introducing circular dependencies or domain-specific logic. [CLAIM:hyp-8]
    *   **Confidence:** confirmed
    *   **Agent Implication:** Agents should treat the `src/utils` module as a shared library for generic, non-domain-specific functionalities. New utilities should be added here if they meet the criteria of high cohesion and low dependency, and other modules should import from `utils` rather than duplicating common logic.

### `src/core/types` Module Responsibilities
*   **Claim:** The `src/core/types` module serves as the central contract definition for the entire application, ensuring type consistency and clear data structures across all other modules. No other module should define core domain types independently. [CLAIM:hyp-14]
    *   **Confidence:** confirmed
    *   **Agent Implication:** Agents must define all core domain types within `src/core/types/index.ts`. When introducing new data structures or modifying existing ones, ensure they are declared or updated in this central location to maintain type consistency and prevent fragmentation of type definitions.

## Allowed Relations

This section describes the permissible conceptual interactions between modules.

*   **Relation:** `core module` interacts via `LLMProvider` interface with `llm module`.
    *   **Claim:** The `core` module interacts with LLMs solely through the `LLMProvider` interface, enforcing the Dependency Inversion Principle. [CLAIM:hyp-2]
    *   **Evidence:** (See `hyp-2` evidence)
    *   **Confidence:** confirmed
    *   **Agent Implication:** Agents developing within the `core` module are permitted to import and use the `LLMProvider` interface and its factory, but not concrete LLM implementations.
*   **Relation:** `Any module` consumes generic helper functions from `src/utils` module.
    *   **Claim:** The `src/utils` module is intended to be a collection of highly cohesive, low-dependency, generic helper functions that can be consumed by any other module. [CLAIM:hyp-8]
    *   **Evidence:** (See `hyp-8` evidence)
    *   **Confidence:** confirmed
    *   **Agent Implication:** Any module is allowed to import and utilize functions from `src/utils` for generic, non-domain-specific tasks.
*   **Relation:** `Any module` imports type definitions from `src/core/types` module.
    *   **Claim:** The `src/core/types` module serves as the central contract definition for the entire application, ensuring type consistency and clear data structures across all other modules. [CLAIM:hyp-14]
    *   **Evidence:** (See `hyp-14` evidence)
    *   **Confidence:** confirmed
    *   **Agent Implication:** All modules are encouraged to import necessary core domain types from `src/core/types` to ensure type consistency.

## Prohibited Relations

This section describes conceptual interactions that are explicitly forbidden to maintain architectural integrity.

*   **Relation:** `core module` to `Specific LLM implementation`.
    *   **Reason:** Violates Dependency Inversion Principle; must interact via LLMProvider interface only.
    *   **Claim:** Agents must interact with LLMs exclusively via the `LLMProvider` interface, avoiding direct coupling to specific LLM implementations. [CLAIM:hyp-2]
    *   **Evidence:** (See `hyp-2` evidence)
    *   **Confidence:** confirmed
    *   **Agent Implication:** Agents must never directly import or instantiate specific LLM provider classes from the `core` module or any module that depends on `core` logic.
*   **Relation:** `src/utils` module to `Any other module`.
    *   **Reason:** Must not introduce circular dependencies.
    *   **Claim:** The `src/utils` module is intended to be a collection of highly cohesive, low-dependency, generic helper functions that can be consumed by any other module without introducing circular dependencies or domain-specific logic. [CLAIM:hyp-8]
    *   **Evidence:** (See `hyp-8` evidence)
    *   **Confidence:** confirmed
    *   **Agent Implication:** The `src/utils` module must not import any code from other domain-specific modules to prevent circular dependencies and maintain its generic nature.
*   **Relation:** `Any module (other than src/core/types)` to `Core domain types`.
    *   **Reason:** Must not define core domain types independently; all core types must be in `src/core/types`.
    *   **Claim:** No other module should define core domain types independently. [CLAIM:hyp-14]
    *   **Evidence:** (See `hyp-14` evidence)
    *   **Confidence:** confirmed
    *   **Agent Implication:** Agents must not define new core domain types outside of `src/core/types/index.ts`. Existing types should be modified only in this central location.

## Dangerous Interactions

These are scenarios where modules might interact in ways that lead to significant problems, even if not explicitly prohibited by direct import rules.

*   **Interaction:** Subtle semantic differences in how various LLMProviders interpret code context, leading to inconsistent or incorrect analysis results.
    *   **Agent Implication:** Developers should be aware that switching LLM providers, while technically seamless, might introduce behavioral changes. Thorough testing across providers is crucial for critical paths.
*   **Interaction:** Uncontrolled LLM token usage leading to unexpected costs or performance degradation.
    *   **Agent Implication:** All interactions with LLMs should consider token limits and cost implications. Mechanisms for token counting, cost estimation, and rate limiting should be utilized where available.
*   **Interaction:** Failure to adhere to file/directory ignore policies, resulting in analysis of irrelevant or sensitive data.
    *   **Agent Implication:** Agents must rigorously implement and respect file exclusion patterns (e.g., `.gitignore`, `.llmignore`) to prevent unintended data exposure or processing overhead.

## Boundary Violation Signals

This section lists observable indicators that a module boundary might be violated or at risk.

*   **Signal:** Direct imports of specific LLM provider implementations within the `core` module or any module that orchestrates core logic.
    *   **Indicates:** Violation of the `LLMProvider` interface abstraction. [CLAIM:hyp-2]
*   **Signal:** Introduction of domain-specific logic (e.g., business rules, specific AI context engineering steps) within the `src/utils` module.
    *   **Indicates:** Erosion of the `src/utils` module's generic, low-dependency nature. [CLAIM:hyp-8]
*   **Signal:** Definition of new core domain types in files outside of the designated central types module.
    *   **Indicates:** Fragmentation of type definitions and potential for inconsistency. [CLAIM:hyp-14]
*   **Signal:** Circular dependencies involving the `src/utils` module.
    *   **Indicates:** `src/utils` is no longer a low-dependency utility library, potentially introducing tight coupling. [CLAIM:hyp-8]
*   **Signal:** Inconsistent behavior or output when switching between different LLM providers without code changes.
    *   **Indicates:** Potential for subtle semantic differences in LLM interpretation, requiring further investigation or abstraction refinement.
*   **Signal:** Unexpectedly high LLM API costs or slow response times.
    *   **Indicates:** Potential for uncontrolled token usage or inefficient LLM interaction patterns.
*   **Signal:** Analysis results containing data from ignored files or directories.
    *   **Indicates:** Failure in file/directory ignore policy enforcement.
