import { CONVEX_URL } from "./constants";

export async function fetchUserTier(clerkId: string): Promise<string> {
  try {
    const res = await fetch(`${CONVEX_URL}/api/extension/billing-status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clerkId })
    });
    if (res.ok) {
      const data = (await res.json()) as { tier?: string };
      if (data.tier) return data.tier;
    }
  } catch {
    // network error → fall through to free
  }
  return "free";
}
