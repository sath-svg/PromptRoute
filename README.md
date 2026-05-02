# PromptRoute

> The desktop coding agent that picks your model for you — offline, on-device, every prompt.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Status: alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#status)
[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB.svg)](https://tauri.app)

OpenCode-style coding agent (LSP, multi-session, share-links, 75+ LLM providers) with one extra trick: a bundled `.pk1` logistic-regression model picks the best LLM for each prompt **without round-tripping to a server**. Works offline. Updates over the air when online.

---

## Features

- **Offline router** — `.pk1` model bundled with the app. Routes in <1ms with no network.
- **75+ providers** — OpenAI, Anthropic, GitHub Copilot, OpenRouter, local Ollama, more.
- **Bring your subscription** — log in with GitHub for Copilot, OpenAI for ChatGPT Plus/Pro.
- **LSP-aware** — auto-loads language servers per file type, feeds diagnostics into the model context.
- **Multi-session** — run multiple agents in parallel on the same workspace.
- **Share links** — publish a session URL for review or debugging.
- **OTA model updates** — fetch newer routers from `api.pmtpk.com/models/manifest.json`, sha256-verified, falls back to bundled copy on hash mismatch or offline.

## Quick start

```sh
git clone https://github.com/sath-svg/PromptRoute.git
cd PromptRoute
pnpm install
pnpm --filter desktop tauri dev
```

Requirements: Node 20+, pnpm 9+, Rust stable, Tauri 2 prerequisites for your OS — see https://tauri.app/start/prerequisites/.

## Layout

```
apps/desktop/        Tauri shell (Rust + React)
packages/router/     .pk1 loader + feature extractor + manifest fetcher
packages/agent/      Session loop, tool registry, LSP client, share publisher
packages/providers/  Unified streaming client (openai, anthropic, copilot,
                     openrouter, ollama, …)
tools/build-pk1.mjs  Regenerates the placeholder router.pk1 + classes.json
```

## Router model

Binary `.pk1` format — magic `PK1\0`, little-endian floats, row-major weight matrix. Decision = `argmax(softmax(bias + features @ weights))`. Feature vector is deterministic, no tokenizer required, and computed identically in both Rust ([`apps/desktop/src-tauri/src/router.rs`](apps/desktop/src-tauri/src/router.rs)) and TypeScript ([`packages/router/src/features.ts`](packages/router/src/features.ts)).

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full format spec, feature list, and update flow.

### Update flow

1. App boot → `router.rs` reads bundled `router.pk1` from `resources/models/`.
2. Background → fetch `manifest.json`, compare versions.
3. Newer + sha256 matches → write to `%APPDATA%/promptroute/models/`. Loaded next boot.
4. No network or hash mismatch → bundled copy keeps working forever.

## Status

Alpha scaffold. Routing core + provider adapters wired; tool handlers (read/edit/bash) and OAuth flows are stubs awaiting wiring to Tauri plugins. The bundled `router.pk1` is a hand-written placeholder, not a trained model.

Roadmap:
- [ ] Wire `read`/`edit`/`bash` tools to Tauri fs + shell plugins
- [ ] GitHub device-code OAuth → Copilot token exchange
- [ ] OpenAI session-token bridge for ChatGPT Plus/Pro
- [ ] Train real `.pk1` from public benchmark traces
- [ ] CDN endpoint for `manifest.json` + `router.pk1` updates
- [ ] Diff viewer + session sidebar UI
- [ ] Convex-backed share links

## Contributing

PRs welcome. Open an issue first for anything beyond a typo or doc fix. Apache-2.0 — see [LICENSE](LICENSE).

## Acknowledgements

Architecture inspired by [OpenCode](https://opencode.ai). Routing approach and `.pk1` format are original to PromptRoute.
