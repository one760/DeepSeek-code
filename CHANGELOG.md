# Changelog

## 0.1.0 - 2026-04-03

Initial packaged release of DeepSeek Code CLI.

### Added

- System prompt handling for workspace-aware conversations
- Context management and truncation flow
- Native tool calling and reasoner fallback path
- Retry support for transient request failures
- Token usage and estimated cost tracking
- Extended local tools for file, search, edit, shell, and git flows
- MCP integration stubs for future expansion
- Session persistence, resume flow, and permission controls

### Changed

- Reworked terminal UI into controller hook, reducer, and component-based architecture
- Refreshed UI to a panel-based Claude Code style layout with role colors and structured overlays

### Verification

- `npm run build`
- `npm test`
- `npm run dev` startup smoke test
