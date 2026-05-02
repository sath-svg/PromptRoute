import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Chat } from "./components/Chat";
import { AuthBar } from "./components/AuthBar";
import { useAuthStore } from "./stores/authStore";

export function App() {
  const [routerVersion, setRouterVersion] = useState("loading…");
  const initAuthListener = useAuthStore((s) => s.initAuthListener);

  useEffect(() => {
    invoke<string>("router_version")
      .then(setRouterVersion)
      .catch((e) => setRouterVersion(`error: ${e}`));
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    initAuthListener().then((u) => (unlisten = u));
    return () => unlisten?.();
  }, [initAuthListener]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <h1>PromptRoute</h1>
          <span className="app-tagline">offline router · {routerVersion}</span>
        </div>
        <AuthBar />
      </header>
      <main className="app-main">
        <Chat />
      </main>
    </div>
  );
}
