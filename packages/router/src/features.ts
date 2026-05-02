import type { FeatureContext } from "./types";

const KEYWORDS = ["refactor", "explain", "debug", "review", "plan", "edit", "write", "test"];

const TOP_EXT = [
  "ts", "tsx", "js", "jsx", "py", "go", "rs", "java", "kt", "swift",
  "c", "cpp", "h", "cs", "rb", "php", "lua", "sh", "sql", "html",
  "css", "scss", "vue", "svelte", "json", "yaml", "toml", "md", "tex",
  "r", "ex", "ml"
];

/**
 * Deterministic feature vector for the .pk1 logistic regressor.
 * MUST stay byte-identical to the Rust implementation in
 * apps/desktop/src-tauri/src/router.rs::extract_features.
 */
export function extractFeatures(ctx: FeatureContext, n: number): Float32Array {
  const v = new Float32Array(n);
  if (n === 0) return v;

  const prompt = ctx.prompt ?? "";
  const lower = prompt.toLowerCase();
  const len = [...prompt].length;

  // 0: log10 length
  v[0] = Math.log10(len + 1);

  // 1: code fence
  if (n > 1) v[1] = prompt.includes("```") ? 1 : 0;

  // 2: keyword hits
  if (n > 2) {
    let hits = 0;
    for (const k of KEYWORDS) if (lower.includes(k)) hits++;
    v[2] = hits;
  }

  // 3: selection length bucket
  if (n > 3) v[3] = Math.log10((ctx.selectionLength ?? 0) + 1);

  // 4: diagnostic count bucket
  if (n > 4) v[4] = Math.log10((ctx.diagnosticCount ?? 0) + 1);

  // 5: open file count bucket
  if (n > 5) v[5] = Math.log10((ctx.openFileCount ?? 0) + 1);

  // 6: history depth bucket
  if (n > 6) v[6] = Math.log10((ctx.historyDepth ?? 0) + 1);

  // 7: has image flag
  if (n > 7) v[7] = ctx.hasImage ? 1 : 0;

  // 8..8+TOP_EXT.length: file extension one-hot
  if (ctx.fileExt) {
    const idx = TOP_EXT.indexOf(ctx.fileExt.toLowerCase());
    if (idx >= 0 && 8 + idx < n) v[8 + idx] = 1;
  }

  return v;
}
