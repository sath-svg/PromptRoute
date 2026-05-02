import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { PMTPK_API, chatLimitFor } from "../lib/constants";
import { useSettingsStore } from "./settingsStore";
import { useAuthStore } from "./authStore";

export interface RouteDecision {
  provider: string;
  model: string;
  confidence: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  decision?: RouteDecision;
  createdAt: number;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
}

const PROVIDER_BASE: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  ollama: "http://localhost:11434/v1"
};

function makeId() {
  return Math.random().toString(36).slice(2);
}

async function callServer(
  token: string | undefined,
  model: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${PMTPK_API}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`server ${res.status}: ${body || res.statusText}`);
  }
  const data = (await res.json()) as { content?: string };
  return data.content ?? "";
}

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({ model, max_tokens: 4096, messages })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `anthropic ${res.status}`);
  }
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return data.content?.[0]?.text ?? "";
}

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ model, max_tokens: 4096, messages })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `${baseUrl} ${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

async function dispatch(
  decision: RouteDecision,
  apiKeys: Partial<Record<string, string>>,
  token: string | undefined,
  history: { role: string; content: string }[]
): Promise<string> {
  const { provider, model } = decision;
  if (provider === "server") return callServer(token, model, history);
  if (provider === "anthropic") {
    const key = apiKeys.anthropic;
    if (!key) throw new Error("Anthropic API key not configured");
    return callAnthropic(key, model, history);
  }
  const base = PROVIDER_BASE[provider];
  if (!base) throw new Error(`unknown provider ${provider}`);
  const key = provider === "ollama" ? "ollama" : apiKeys[provider];
  if (!key) throw new Error(`${provider} API key not configured`);
  return callOpenAICompatible(base, key, model, history);
}

function pickProvider(
  decision: RouteDecision,
  apiKeys: Partial<Record<string, string>>
): RouteDecision {
  // If router picked a provider the user can't reach, fall back to "server".
  // Server route is always available (free tier gets 3 calls).
  if (decision.provider === "server") return decision;
  if (decision.provider === "anthropic" && apiKeys.anthropic) return decision;
  if (decision.provider === "openai" && apiKeys.openai) return decision;
  if (decision.provider === "groq" && apiKeys.groq) return decision;
  if (decision.provider === "openrouter" && apiKeys.openrouter) return decision;
  if (decision.provider === "ollama") return decision;
  return { provider: "server", model: "pmtpk-default", confidence: decision.confidence };
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,

  sendMessage: async (text) => {
    if (!text.trim()) return;

    const { apiKeys, billingTier, serverChatCount, incrementServerChatCount } =
      useSettingsStore.getState();
    const token = useAuthStore.getState().session?.session_token;

    let decision: RouteDecision;
    try {
      decision = await invoke<RouteDecision>("route_prompt", { prompt: text });
    } catch (e) {
      set({ error: `routing failed: ${(e as Error).message ?? e}` });
      return;
    }
    decision = pickProvider(decision, apiKeys);

    if (decision.provider === "server") {
      const limit = chatLimitFor(billingTier);
      if (serverChatCount >= limit) {
        set({ error: "__CHAT_LIMIT_REACHED__" });
        return;
      }
    }

    const userMsg: ChatMessage = {
      id: makeId(),
      role: "user",
      content: text,
      createdAt: Date.now()
    };
    set((s) => ({ messages: [...s.messages, userMsg], isLoading: true, error: null }));

    const history = get().messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const content = await dispatch(decision, apiKeys, token, history);
      if (decision.provider === "server") incrementServerChatCount();
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: makeId(),
            role: "assistant",
            content,
            decision,
            createdAt: Date.now()
          }
        ],
        isLoading: false
      }));
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : String(e),
        isLoading: false
      });
    }
  },

  clearMessages: () => set({ messages: [], error: null }),
  clearError: () => set({ error: null })
}));
