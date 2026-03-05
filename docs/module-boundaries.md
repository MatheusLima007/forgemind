# Module Boundaries

This document defines the conceptual boundaries between different modules within the project. It focuses on responsibilities, allowed interactions, and potential pitfalls, rather than technical import paths or file structures. The goal is to ensure a clear separation of concerns, promote maintainability, and prevent architectural degradation.

## Conceptual Contexts

### Core Module
-   **Responsibility**: Encapsulates the pipeline stages of the AI Context Engineering process.
-   **Responsibilities**:\n    -   Orchestrating scanning, analyzing, hypothesizing, interviewing, consolidating, and generating knowledge.
    -   Managing the SemanticContext as the central source of truth.
    -   Interacting with LLMs exclusively via the LLMProvider interface.
-   **Risks**:
    -   Introducing tight coupling between pipeline stages, hindering modularity.
    -   Bypassing the LLMProvider interface for direct LLM interaction.
    -   Inconsistently updating or managing the SemanticContext.

### LLM Abstraction Layer
-   **Responsibility**: Provides a pluggable abstraction layer for Large Language Models.
-   **Responsibilities**:
    -   Defining the LLMProvider interface for consistent LLM interaction.
    -   Handling LLM-specific error translation and retry logic.
-   **Risks**:
    -   Leaking LLM-specific implementation details into the Core Module.
    -   Inconsistent error handling or semantic interpretation across different LLM providers.
    -   Failure to abstract subtle semantic differences in how LLMs interpret code context.

### Utilities Module
-   **Responsibility**: Houses generic, highly cohesive, low-dependency helper functions.
-   **Risks**:
    -   Introducing domain-specific logic, leading to tight coupling with other modules.
    -   Creating circular dependencies.
    -   Becoming a dumping ground for unrelated functions, reducing cohesion.

### Core Types Module
-   **Responsibility**: Serves as the central contract definition for the entire application's data structures.
-   **Responsibilities**:
    -   Defining all core domain types.
    -   Ensuring type consistency across all modules.
    -   Providing clear data structure contracts for inter-module communication.
-   **Risks**:
    -   Other modules defining core domain types independently, leading to type fragmentation and inconsistency.
    -   Outdated or incomplete type definitions causing runtime errors or misinterpretations.

### CLI Module
-   **Responsibility**: Exposes all primary interactions and workflows as command-line commands.
-   **Responsibilities**:
    -   Orchestrating high-level application workflows based on user commands.
    -   Providing user feedback via the centralized logging mechanism.
-   **Risks**:
    -   Introducing business logic directly into the CLI, violating separation of concerns.
    -   Poorly defined command interfaces leading to user confusion or incorrect usage.
    -   Failure to integrate with the centralized logging system for consistent output.

## Responsibility Boundaries

-   **Core Module**: Primarily responsible for the business logic and orchestration of the AI Context Engineering pipeline.
-   **LLM Abstraction Layer**: Solely responsible for abstracting interactions with various Large Language Models.
-   **Utilities Module**: Exclusively responsible for providing generic, reusable, non-domain-specific helper functions.
-   **Core Types Module**: The single source of truth for all core domain type definitions.
-   **CLI Module**: Responsible for user interaction via the command line and initiating core workflows.

## Allowed Relations

-   **From**: Core Module
    -   **To**: LLM Abstraction Layer
    -   **Type**: uses interface
-   **From**: Any Module
    -   **To**: Utilities Module
    -   **Type**: consumes helpers
-   **From**: Any Module
    -   **To**: Core Types Module
    -   **Type**: imports types
-   **From**: CLI Module
    -   **To**: Core Module
    -   **Type**: invokes workflows

## Prohibited Relations

-   **From**: Core Module
    -   **To**: Specific LLM Provider Implementation
    -   **Reason**: Violates Dependency Inversion Principle and LLM abstraction.
-   **From**: Any Module (except the Core Types Module)
    -   **To**: Core Domain Type Definition
    -   **Reason**: Violates centralized type definition invariant, leading to inconsistency.
-   **From**: Utilities Module
    -   **To**: Domain-Specific Logic
    -   **Reason**: Violates utility module's purpose of being generic and low-dependency.

## Dangerous Interactions

-   Direct access to specific LLM implementations from the Core Module, bypassing the LLM abstraction interface.
-   Modifying the SemanticContext without proper versioning or consistency checks, leading to data corruption or loss of historical context.
-   Introducing domain-specific logic or circular dependencies within the Utilities Module, compromising its reusability and modularity.
-   Defining core domain types outside of the Core Types Module, leading to fragmented and inconsistent type definitions across the codebase.
-   Ignoring the maxTokensBudget constraint during LLM prompt construction, potentially leading to excessive costs or truncated responses.
-   Failure to distinguish between recoverable and non-recoverable LLM errors, resulting in inappropriate retry logic or missed opportunities for graceful degradation.

## Boundary Violation Signals

-   **Claim**: The LLM Abstraction Layer is designed as a pluggable abstraction layer for Large Language Models, strictly separating the core business logic from specific LLM provider implementations. The Core Module interacts with LLMs solely through the LLMProvider interface, enforcing the Dependency Inversion Principle. [CLAIM:hyp-2]
    -   **Confidence**: confirmed
    -   **Agent Implication**: Agents must interact with LLMs exclusively via the LLMProvider interface, avoiding direct coupling to specific LLM implementations. This ensures maintainability and allows for easy switching of LLM backends.

-   **Claim**: The Utilities Module is intended to be a collection of highly cohesive, low-dependency, generic helper functions that can be consumed by any other module without introducing circular dependencies or domain-specific logic. [CLAIM:hyp-8]
    -   **Confidence**: confirmed
    -   **Agent Implication**: Agents should treat the Utilities Module as a shared library for generic, non-domain-specific functionalities. New utilities should be added here if they meet the criteria of high cohesion and low dependency, and other modules should import from the Utilities Module rather than duplicating common logic.

-   **Claim**: The Core Types Module serves as the central contract definition for the entire application, ensuring type consistency and clear data structures across all other modules. No other module should define core domain types independently. [CLAIM:hyp-14]
    -   **Confidence**: confirmed
    -   **Agent Implication**: Agents must define all core domain types within the Core Types Module. When introducing new data structures or modifying existing ones, ensure they are declared or updated in this central location to maintain type consistency and prevent fragmentation of type definitions.
