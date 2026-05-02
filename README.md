# PromptRoute

Desktop coding agent with offline prompt routing.

OpenCode-style agent (LSP, multi-session, share-links, multi-provider) plus an on-device logistic-regression router (`.pk1` model) that picks the best LLM for each prompt without round-tripping to a server.

## Features

- **Offline router** — `.pk1` model bundled with the app. Works with no network.
- **75+ providers** — OpenAI, Anthropic, GitHub Copilot, OpenRouter, local Ollama, etc.
- **LSP-aware** — auto-loads language servers per file type, feeds diagnostics to the model.
- **Multi-session** — run several agents in parallel on the same project.
- **Share links** — share a session URL for review or debugging.
- **OAuth** — log in with GitHub (Copilot) or OpenAI (ChatGPT Plus/Pro).

## Layout

```
apps/desktop/        Tauri shell (Rust + React)
packages/router/     .pk1 loader + feature extraction + routing
packages/agent/      Session, tool loop, LSP client
packages/providers/  Unified client for 75+ LLM providers
```

## Develop

```sh
pnpm install
pnpm --filter desktop tauri dev
```

## Router model

Bundled at `apps/desktop/src-tauri/resources/models/router.pk1`. Hot-swapped from `api.pmtpk.com/models/manifest.json` when newer version is available; bundled copy is the offline floor.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
