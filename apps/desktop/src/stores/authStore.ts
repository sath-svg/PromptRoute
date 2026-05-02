import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { fetchUserTier } from "../lib/api";
import type { Tier } from "../lib/constants";
import { useSettingsStore } from "./settingsStore";

export interface AuthSession {
  user_id: string;
  email: string | null;
  name: string | null;
  image_url: string | null;
  tier: Tier;
  session_token: string;
  expires_at: number;
}

interface AuthCallbackData {
  token: string;
  name: string | null;
  email: string | null;
  image_url: string | null;
  user_id: string | null;
}

interface AuthState {
  session: AuthSession | null;
  isLoading: boolean;
  error: string | null;
  openSignIn: () => Promise<void>;
  handleAuthCallback: (data: AuthCallbackData) => Promise<void>;
  logout: () => Promise<void>;
  refreshTier: () => Promise<void>;
  clearError: () => void;
  initAuthListener: () => Promise<() => void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      isLoading: false,
      error: null,

      openSignIn: async () => {
        set({ error: null, isLoading: true });
        try {
          await invoke("open_auth_window");
        } catch (e) {
          set({ error: e instanceof Error ? e.message : String(e), isLoading: false });
        }
      },

      handleAuthCallback: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const userId = data.user_id ?? "";
          const previous = get().session;
          if (previous?.user_id && previous.user_id !== userId) {
            useSettingsStore.setState({ serverChatCount: 0 });
          }

          const rawTier = userId ? await fetchUserTier(userId) : "free";
          const tier = (rawTier as Tier) ?? "free";
          useSettingsStore.getState().setBillingTier(tier);

          const session: AuthSession = {
            user_id: userId,
            email: data.email,
            name: data.name,
            image_url: data.image_url,
            tier,
            session_token: data.token,
            expires_at: Math.floor(Date.now() / 1000) + 3600
          };

          try {
            const verified = await invoke<AuthSession>("verify_auth_token", { token: data.token });
            session.user_id = verified.user_id || session.user_id;
            session.expires_at = verified.expires_at;
          } catch {
            // verification failed — keep callback data
          }

          set({ session, isLoading: false });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : String(e), isLoading: false });
        }
      },

      logout: async () => {
        try {
          await invoke("logout");
        } catch {
          // ignore
        }
        set({ session: null, error: null });
        useSettingsStore.getState().setBillingTier("free");
      },

      refreshTier: async () => {
        const { session } = get();
        if (!session?.user_id) return;
        const rawTier = await fetchUserTier(session.user_id);
        const tier = (rawTier as Tier) ?? "free";
        if (tier !== session.tier) {
          set({ session: { ...session, tier } });
        }
        useSettingsStore.getState().setBillingTier(tier);
      },

      clearError: () => set({ error: null }),

      initAuthListener: async () => {
        const unlisten = await listen<AuthCallbackData>("auth-callback", (e) => {
          get().handleAuthCallback(e.payload);
        });
        return unlisten;
      }
    }),
    {
      name: "promptroute-auth",
      partialize: (s) => ({ session: s.session })
    }
  )
);
