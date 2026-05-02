import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type RouteDecision = {
  provider: string;
  model: string;
  confidence: number;
};

export function App() {
  const [prompt, setPrompt] = useState("");
  const [decision, setDecision] = useState<RouteDecision | null>(null);
  const [routerVersion, setRouterVersion] = useState<string>("loading…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    invoke<string>("router_version")
      .then(setRouterVersion)
      .catch((e) => setRouterVersion(`error: ${e}`));
  }, []);

  async function route() {
    setBusy(true);
    try {
      const d = await invoke<RouteDecision>("route_prompt", { prompt });
      setDecision(d);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>PromptRoute</h1>
        <span className="version">router {routerVersion}</span>
      </header>
      <main>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type a prompt — router picks the best model offline."
        />
        <button onClick={route} disabled={!prompt || busy}>
          {busy ? "routing…" : "Route"}
        </button>
        {decision && (
          <pre className="decision">
            {decision.provider} / {decision.model}
            {"  "}
            ({(decision.confidence * 100).toFixed(1)}%)
          </pre>
        )}
      </main>
    </div>
  );
}
