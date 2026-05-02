import type { CompletionRequest, ProviderAdapter, StreamChunk } from "../types";

export interface OpenAIConfig {
  apiKey: string;
  baseUrl?: string;
}

export function openaiAdapter(cfg: OpenAIConfig): ProviderAdapter {
  const base = cfg.baseUrl ?? "https://api.openai.com/v1";
  return {
    name: "openai",
    async models() {
      const res = await fetch(`${base}/models`, {
        headers: { authorization: `Bearer ${cfg.apiKey}` }
      });
      if (!res.ok) throw new Error(`openai models ${res.status}`);
      const data = (await res.json()) as { data: Array<{ id: string }> };
      return data.data.map((m) => m.id);
    },
    stream(req: CompletionRequest) {
      return streamOpenAI(base, cfg.apiKey, req);
    }
  };
}

async function* streamOpenAI(
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
      messages: req.messages.map(toOpenAIMessage),
      tools: req.tools?.map((t) => ({ type: "function", function: t })),
      stream: true,
      temperature: req.temperature,
      max_tokens: req.maxTokens
    })
  });
  if (!res.ok || !res.body) throw new Error(`openai stream ${res.status}`);
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
        choices?: Array<{ delta?: { content?: string; tool_calls?: unknown[] } }>;
      };
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) yield { kind: "text", delta };
    }
  }
}

function toOpenAIMessage(m: { role: string; content: string; toolCallId?: string }) {
  if (m.role === "tool") {
    return { role: "tool", content: m.content, tool_call_id: m.toolCallId };
  }
  return { role: m.role, content: m.content };
}
