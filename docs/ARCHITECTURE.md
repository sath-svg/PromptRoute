# PromptRoute Architecture

## Routing layer

`.pk1` = on-device logistic-regression model that maps prompt features → provider/model class.

### Binary format

```
offset  size  field
0       4     magic "PK1\0"
4       2     u16 version (LE)
6       2     u16 feature_count (F)
8       2     u16 class_count (C)
10      C*4   f32[C] bias        (LE)
10+C*4  F*C*4 f32[F*C] weights   (row-major: feature i, class j at i*C+j)
```

Decision: `argmax(bias + features @ weights)`. Class index → provider+model lookup table shipped in same manifest.

### Feature vector

Computed in `packages/router/src/features.ts`. Cheap, deterministic, no tokenization model required:

- prompt length buckets (log10)
- code-fence presence / language hints
- LSP context size (# diagnostics, # open files)
- file extension one-hot (top 32 langs)
- task-keyword bag (refactor, explain, debug, write, review, plan, edit)
- session history depth
- has-image flag
- selection-text length

Total F ≈ 96. Small enough to run < 1ms per prompt.

### Update flow

1. App boot → `loader.ts` reads bundled `router.pk1` via Tauri resource API.
2. Background task → fetch `https://api.pmtpk.com/models/manifest.json`, compare `version`.
3. If newer + `sha256` matches download → write to `%APPDATA%/promptroute/models/router.pk1`.
4. Next boot → loader prefers app-data copy over bundled, falls back on hash mismatch.

Bundled copy is the floor. Network failure never blocks routing.

## Agent layer

`packages/agent/`:

- `Session` — message log, tool calls, cancellation token, share id.
- `ToolRegistry` — read/write/edit/grep/bash/lsp_query/route_decide.
- `LspClient` — spawns language servers per workspace, exposes diagnostics + hover + definitions to the model.

Multi-session: each `Session` runs in its own async task. Shared `WorkspaceIndex` so file watches aren't duplicated.

Share links: session log serialized to Convex (reuse PromptPack backend), URL = `https://promptroute.app/s/<id>`.

## Providers

`packages/providers/` exposes one `LLMClient` interface. Adapters per vendor. OAuth flows in `auth/` — GitHub device code for Copilot, OpenAI session token for ChatGPT Plus (browser-assisted).

## Tauri shell

`apps/desktop/`:

- React UI for session list, chat, diff viewer.
- Rust side: spawn LSPs, file watchers, OAuth callback server, model loader IPC.
