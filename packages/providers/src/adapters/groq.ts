import type { CompletionRequest, ProviderAdapter, StreamChunk } from "../types";

/**
 * Direct Groq adapter — only used when the user has supplied their own
 * Groq API key in Settings. The default free-tier flow uses the `server`
 * adapter instead, which proxies through api.pmtpk.com so the Groq key
 * stays on the backend and out of this open-source repo.
 */
export interface GroqConfig {
  apiKey: string;
  baseUrl?: string;
}

const KNOWN_MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "mixtral-8x7b-32768"
];

export function groqAdapter(cfg: GroqConfig): ProviderAdapter {
  const base = cfg.baseUrl ?? "https://api.groq.com/openai/v1";
  return {
    name: "groq",
    async models() {
      return KNOWN_MODELS;
    },
    stream(req) {
      return streamGroq(base, cfg.apiKey, req);
    }
  };
}

async function* streamGroq(
  base: string,
  apiKey: string,
  req: CompletionRequest
): AsyncGenerator<StreamChunk> {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: req.model,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      temperature: req.temperature,
      max_tokens: req.maxTokens
    })
  });
  if (!res.ok || !res.body) throw new Error(`groq stream ${res.status}`);
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
