import type { CompletionRequest, ProviderAdapter, StreamChunk } from "../types";

export interface OllamaConfig {
  baseUrl?: string;
}

export function ollamaAdapter(cfg: OllamaConfig = {}): ProviderAdapter {
  const base = cfg.baseUrl ?? "http://localhost:11434";
  return {
    name: "ollama",
    async models() {
      const res = await fetch(`${base}/api/tags`);
      if (!res.ok) throw new Error(`ollama tags ${res.status}`);
      const data = (await res.json()) as { models: Array<{ name: string }> };
      return data.models.map((m) => m.name);
    },
    stream(req) {
      return streamOllama(base, req);
    }
  };
}

async function* streamOllama(
  base: string,
  req: CompletionRequest
): AsyncGenerator<StreamChunk> {
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: req.model,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true
    })
  });
  if (!res.ok || !res.body) throw new Error(`ollama stream ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() ?? "";
    for (const line of parts) {
      if (!line.trim()) continue;
      const json = JSON.parse(line) as {
        message?: { content?: string };
        done?: boolean;
      };
      if (json.message?.content) {
        yield { kind: "text", delta: json.message.content };
      }
      if (json.done) {
        yield { kind: "done" };
        return;
      }
    }
  }
}
