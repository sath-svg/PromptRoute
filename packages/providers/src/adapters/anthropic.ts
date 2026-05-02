import type { CompletionRequest, ProviderAdapter, StreamChunk } from "../types";

export interface AnthropicConfig {
  apiKey: string;
  baseUrl?: string;
}

const KNOWN_MODELS = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001"
];

export function anthropicAdapter(cfg: AnthropicConfig): ProviderAdapter {
  const base = cfg.baseUrl ?? "https://api.anthropic.com/v1";
  return {
    name: "anthropic",
    async models() {
      return KNOWN_MODELS;
    },
    stream(req: CompletionRequest) {
      return streamAnthropic(base, cfg.apiKey, req);
    }
  };
}

async function* streamAnthropic(
  base: string,
  apiKey: string,
  req: CompletionRequest
): AsyncGenerator<StreamChunk> {
  const sys = req.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const conv = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "tool" ? "user" : m.role,
      content: m.content
    }));

  const res = await fetch(`${base}/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: req.model,
      system: sys || undefined,
      messages: conv,
      stream: true,
      max_tokens: req.maxTokens ?? 4096
    })
  });
  if (!res.ok || !res.body) throw new Error(`anthropic stream ${res.status}`);
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
      if (!payload) continue;
      const json = JSON.parse(payload) as {
        type: string;
        delta?: { text?: string };
      };
      if (json.type === "content_block_delta" && json.delta?.text) {
        yield { kind: "text", delta: json.delta.text };
      }
      if (json.type === "message_stop") {
        yield { kind: "done" };
        return;
      }
    }
  }
}
