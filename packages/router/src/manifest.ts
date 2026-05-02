export interface ModelManifest {
  version: number;
  url: string;
  sha256: string;
  classMapUrl: string;
  classMapSha256: string;
  releasedAt: string;
}

export const DEFAULT_MANIFEST_URL = "https://api.pmtpk.com/models/manifest.json";

export async function fetchManifest(
  url: string = DEFAULT_MANIFEST_URL,
  fetchImpl: typeof fetch = fetch
): Promise<ModelManifest> {
  const res = await fetchImpl(url, { method: "GET" });
  if (!res.ok) throw new Error(`manifest fetch ${res.status}`);
  return (await res.json()) as ModelManifest;
}

export async function verifyAndDownload(
  manifest: ModelManifest,
  fetchImpl: typeof fetch = fetch
): Promise<{ model: ArrayBuffer; classMap: string }> {
  const [modelRes, mapRes] = await Promise.all([
    fetchImpl(manifest.url),
    fetchImpl(manifest.classMapUrl)
  ]);
  if (!modelRes.ok) throw new Error(`model fetch ${modelRes.status}`);
  if (!mapRes.ok) throw new Error(`class map fetch ${mapRes.status}`);

  const model = await modelRes.arrayBuffer();
  const classMap = await mapRes.text();

  if (!(await sha256Matches(model, manifest.sha256))) {
    throw new Error("model sha256 mismatch");
  }
  const classBytes = new TextEncoder().encode(classMap);
  if (!(await sha256Matches(classBytes.buffer, manifest.classMapSha256))) {
    throw new Error("class map sha256 mismatch");
  }
  return { model, classMap };
}

async function sha256Matches(buf: ArrayBuffer, expected: string): Promise<boolean> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.toLowerCase() === expected.toLowerCase();
}
