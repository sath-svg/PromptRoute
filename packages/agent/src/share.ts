import type { Message } from "@promptroute/providers";

export interface SharePayload {
  sessionId: string;
  createdAt: string;
  provider: string;
  model: string;
  messages: Message[];
}

export interface ShareLink {
  id: string;
  url: string;
}

export async function publishShare(
  payload: SharePayload,
  endpoint = "https://api.pmtpk.com/share",
  fetchImpl: typeof fetch = fetch
): Promise<ShareLink> {
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`share publish ${res.status}`);
  return (await res.json()) as ShareLink;
}
