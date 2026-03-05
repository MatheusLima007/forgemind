# System Ontology

## Core Purpose

-   **Claim**: The core purpose of this system is to extract and validate architectural decisions and domain invariants from code.
-   **Evidence**: `systemOntology.corePurpose`
-   **Confidence**: confirmed
-   **Agent Implication**: Agents should focus their analysis and generation tasks on identifying and formalizing architectural patterns, design choices, and fundamental business rules embedded within the codebase.

## Mental Model

-   **Claim**: The system operates on a mental model of "Agent-first documentation," where explicit, structured documentation is generated for AI agents. This documentation captures architectural intent, domain invariants, module boundaries, critical workflows, and cognitive risks, serving as a stable reference for human review and future automated validation.
-   **Evidence**: `systemOntology.mentalModel`
-   **Confidence**: confirmed
-   **Agent Implication**: Agents must prioritize the generation and consumption of information that is structured, explicit, and directly usable by other AI agents. When creating or modifying documentation, ensure it aligns with this "agent-first" paradigm, focusing on clarity, precision, and machine-readability.

## Central Concepts

-   **Claim**: The system revolves around several central concepts that define its operational domain and internal state management.
-   **Evidence**: `systemOntology.centralConcepts`
-   **Confidence**: confirmed
-   **Agent Implication**: Agents should be familiar with these concepts and their interrelationships to effectively navigate, analyze, and contribute to the system's functionality.

    1.  **Architectural Decisions**: Explicit choices made during the design of the system or identified within the target codebase.
    2.  **Domain Invariants**: Fundamental rules or conditions that must always be true within a specific domain.
    3.  **Agent-First Documentation**: Information structured and optimized for consumption and generation by AI agents.
    4.  **Semantic Context**: A comprehensive, evolving, and versioned single source of truth representing the system's understanding of a codebase [CLAIM:hyp-4].
    5.  **Hypotheses (Provisional Knowledge)**: Automatically generated insights about the codebase that are subject to validation and refinement [CLAIM:hyp-7].
    6.  **LLM Abstraction Layer**: A design pattern separating core logic from specific Large Language Model provider implementations.
    7.  **Pipeline-Driven Architecture**: A modular design where the AI Context Engineering process is broken down into distinct, interchangeable stages [CLAIM:hyp-1].
    8.  **Configuration Hierarchy**: A structured approach to managing system parameters, allowing customization with clear precedence rules [CLAIM:hyp-5].
    9.  **Token Usage Management**: Explicit strategies and constraints for controlling LLM token consumption to manage costs and performance.
    10. **Error Handling Resilience**: Mechanisms to gracefully manage and recover from various types of errors, especially those from external API interactions.

## System Orientation

-   **Claim**: The system operates primarily as a command-line interface (CLI) application, processing commands to perform its functions [CLAIM:hyp-11]. Internally, it manages and evolves a 'Semantic Context' which acts as a central state representing its understanding of a codebase [CLAIM:hyp-4]. Its core process is pipeline-driven, breaking down complex analysis into modular stages [CLAIM:hyp-1].
-   **Evidence**: `systemOntology.systemOrientation`, `systemOntology.centralConcepts`, `claims.hyp-1`, `claims.hyp-4`, `claims.hyp-11`
-   **Confidence**: confirmed
-   **Agent Implication**: Agents should assume a CLI-driven interaction model for external operations and understand that internal processes are orchestrated through a pipeline that continuously updates the `SemanticContext`. New features should be exposed via CLI commands and integrate with the existing pipeline stages.

## Foundational Principles

-   **Claim**: The system adheres to a set of foundational principles guiding its design, development, and operation.
-   **Evidence**: `systemOntology.principles`
-   **Confidence**: confirmed
-   **Agent Implication**: Agents must ensure that any modifications, extensions, or new features align with these principles. Deviations should be explicitly justified and documented.

    1.  **Modularity**: Encapsulate distinct stages of the AI Context Engineering process into interchangeable components [CLAIM:hyp-1].
    2.  **Dependency Inversion**: Strictly separate core business logic from specific LLM provider implementations via an abstraction layer.
    3.  **Robust Error Handling**: Differentiate between recoverable and non-recoverable errors, especially for external API calls, to enable resilience.
    4.  **Single Source of Truth**: Maintain a comprehensive, evolving 'Semantic Context' as the authoritative understanding of a codebase [CLAIM:hyp-4].
    5.  **Configurability**: Allow customization of operational parameters and external integrations (e.g., LLM providers) through a clear configuration hierarchy [CLAIM:hyp-5].
    6.  **Cost and Performance Management**: Explicitly manage resource consumption, such as LLM token usage and request timeouts.
    7.  **Validation and Refinement**: Acknowledge the provisional nature of generated hypotheses and integrate mechanisms for human validation and refinement [CLAIM:hyp-7].
    8.  **Centralized Type Definitions**: Ensure type consistency and clear data structures across all modules by centralizing core domain types.
    9.  **Agent-First Documentation**: Prioritize documentation explicitly structured for AI agents to improve alignment and reduce ambiguity.
    10. **Human Review Enforcement**: Rely on human review processes, guided by agent-first documentation, for architectural compliance in the absence of automated enforcement.

## What This System Is NOT

-   **Claim**: This system is explicitly designed *not* to be certain things, which helps define its scope and intended functionality.
-   **Evidence**: `claims.hyp-1`, `claims.hyp-4`, `claims.hyp-5`, `claims.hyp-7`, `claims.hyp-10`, `claims.hyp-11`, `systemOntology.centralConcepts`, `systemOntology.principles`
-   **Confidence**: inferred
-   **Agent Implication**: Agents should avoid designing or implementing features that contradict these negations, as they fall outside the system's intended scope or violate its core design principles.

    1.  **Not a Graphical User Interface (GUI) or API Server**: It is fundamentally a CLI-first application [CLAIM:hyp-11].
    2.  **Not a "Black Box"**: Its understanding of the codebase is explicitly captured and versioned in a `SemanticContext` [CLAIM:hyp-4], and its generated insights (hypotheses) are provisional and require validation [CLAIM:hyp-7].
    3.  **Not Inflexible or Unconfigurable**: It is designed for high configurability, allowing customization of LLM providers, models, and operational parameters through a clear hierarchy [CLAIM:hyp-5].
    4.  **Not an Exhaustive Code Scanner**: It has a strict policy for ignoring irrelevant directories and file patterns to optimize performance and focus on relevant context [CLAIM:hyp-10].
    5.  **Not Tightly Coupled to a Single LLM Provider**: It employs an LLM Abstraction Layer, allowing for interchangeability of providers.
    6.  **Not Indifferent to Costs or Performance**: It explicitly manages LLM token usage and sets timeouts for external requests to control operational costs and ensure responsiveness.
    7.  **Not a System That Assumes Infallible AI Output**: It acknowledges that generated hypotheses are provisional and requires mechanisms for human validation and refinement [CLAIM:hyp-7].
    8.  **Not a Monolithic Application**: It is built with a highly modular, pipeline-driven architecture where stages are encapsulated in distinct, interchangeable components [CLAIM:hyp-1].
