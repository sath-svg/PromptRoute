import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Tier } from "../lib/constants";

export type ProviderKey =
  | "openai"
  | "anthropic"
  | "groq"
  | "openrouter"
  | "copilot"
  | "ollama";

interface SettingsState {
  apiKeys: Partial<Record<ProviderKey, string>>;
  billingTier: Tier;
  serverChatCount: number;
  setApiKey: (provider: ProviderKey, key: string) => void;
  removeApiKey: (provider: ProviderKey) => void;
  setBillingTier: (tier: Tier) => void;
  incrementServerChatCount: () => void;
  resetServerChatCount: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKeys: {},
      billingTier: "free",
      serverChatCount: 0,

      setApiKey: (provider, key) =>
        set((s) => ({ apiKeys: { ...s.apiKeys, [provider]: key } })),

      removeApiKey: (provider) =>
        set((s) => {
          const next = { ...s.apiKeys };
          delete next[provider];
          return { apiKeys: next };
        }),

      setBillingTier: (billingTier) => set({ billingTier }),

      incrementServerChatCount: () =>
        set((s) => ({ serverChatCount: s.serverChatCount + 1 })),

      resetServerChatCount: () => set({ serverChatCount: 0 })
    }),
    { name: "promptroute-settings" }
  )
);
