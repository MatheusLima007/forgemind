# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

### Added
- Phase 2 optional LLM enrichment foundation.
- Provider abstraction and OpenAI implementation.

### Changed
- Deterministic hashing hardened for enrichment blocks.

### Security
- LLM failures gracefully fallback to deterministic output (unless strict mode is enabled).
