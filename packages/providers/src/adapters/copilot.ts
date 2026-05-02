import type { CompletionRequest, ProviderAdapter, StreamChunk } from "../types";

/**
 * GitHub Copilot adapter — uses the user's Copilot subscription via
 * the device-code OAuth flow. Token is exchanged for a short-lived
 * "copilot-internal" token used by the chat endpoint.
 */
export interface CopilotConfig {
  oauthToken: string; // GitHub OAuth token from device-code flow
  getCopilotToken: (oauth: string) => Promise<string>;
}

const COPILOT_CHAT = "https://api.githubcopilot.com/chat/completions";

const KNOWN_MODELS = ["gpt-4o", "claude-3.5-sonnet", "o1-preview"];

export function copilotAdapter(cfg: CopilotConfig): ProviderAdapter {
  return {
    name: "copilot",
    async models() {
      return KNOWN_MODELS;
    },
    stream(req: CompletionRequest) {
      return streamCopilot(cfg, req);
    }
  };
}

async function* streamCopilot(
  cfg: CopilotConfig,
  req: CompletionRequest
): AsyncGenerator<StreamChunk> {
  const token = await cfg.getCopilotToken(cfg.oauthToken);
  const res = await fetch(COPILOT_CHAT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "editor-version": "PromptRoute/0.0.1"
    },
    body: JSON.stringify({
      model: req.model,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true
    })
  });
  if (!res.ok || !res.body) throw new Error(`copilot stream ${res.status}`);
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
