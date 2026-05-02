import type { CompletionRequest, ProviderAdapter, StreamChunk } from "../types";

/**
 * "server" provider — calls the PromptPack-hosted proxy at api.pmtpk.com,
 * which forwards to Groq (server-side key, never exposed to the client).
 *
 * This is the default route for free-tier users and for any time the
 * router classifies a prompt as "fast". Tier-gated by the backend via the
 * Clerk JWT in the Authorization header.
 */
export interface ServerConfig {
  baseUrl?: string;
  authToken?: () => string | undefined;
}

export function serverAdapter(cfg: ServerConfig = {}): ProviderAdapter {
  const base = cfg.baseUrl ?? "https://api.pmtpk.com";
  return {
    name: "server",
    async models() {
      // Server-side selection — surface a stable label so the UI can show it.
      return ["pmtpk-default"];
    },
    stream(req) {
      return streamServer(base, cfg.authToken?.(), req);
    }
  };
}

async function* streamServer(
  base: string,
  token: string | undefined,
  req: CompletionRequest
): AsyncGenerator<StreamChunk> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${base}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: req.model,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content }))
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`server ${res.status}: ${body || res.statusText}`);
  }

  // Backend returns a single JSON blob: { content: string }.
  const data = (await res.json()) as { content?: string };
  const text = data.content ?? "";
  if (text) yield { kind: "text", delta: text };
  yield { kind: "done" };
}
