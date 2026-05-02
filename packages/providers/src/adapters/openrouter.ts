import type { CompletionRequest, ProviderAdapter, StreamChunk } from "../types";

export interface OpenRouterConfig {
  apiKey: string;
  appUrl?: string;
  appName?: string;
}

/**
 * OpenRouter — single API key, 75+ underlying providers.
 * Use this as the default fallback for any model the router picks
 * that isn't covered by a dedicated adapter.
 */
export function openrouterAdapter(cfg: OpenRouterConfig): ProviderAdapter {
  const base = "https://openrouter.ai/api/v1";
  return {
    name: "openrouter",
    async models() {
      const res = await fetch(`${base}/models`);
      if (!res.ok) throw new Error(`openrouter models ${res.status}`);
      const data = (await res.json()) as { data: Array<{ id: string }> };
      return data.data.map((m) => m.id);
    },
    stream(req) {
      return streamOpenRouter(base, cfg, req);
    }
  };
}

async function* streamOpenRouter(
  base: string,
  cfg: OpenRouterConfig,
  req: CompletionRequest
): AsyncGenerator<StreamChunk> {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.apiKey}`,
      "content-type": "application/json",
      ...(cfg.appUrl ? { "http-referer": cfg.appUrl } : {}),
      ...(cfg.appName ? { "x-title": cfg.appName } : {})
    },
    body: JSON.stringify({
      model: req.model,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      temperature: req.temperature,
      max_tokens: req.maxTokens
    })
  });
  if (!res.ok || !res.body) throw new Error(`openrouter stream ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") {
        yield { kind: "done" };
        return;
      }
      const json = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) yield { kind: "text", delta };
    }
  }
}
