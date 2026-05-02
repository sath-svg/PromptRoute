/**
 * LSP client scaffold. Each workspace gets one LspClient; per file extension
 * it spawns the matching language server (typescript-language-server, gopls,
 * rust-analyzer, pyright, …) and exposes diagnostics + hover + definition
 * to the agent.
 *
 * Implementation note: in the desktop app this calls into Rust via Tauri
 * commands (`lsp_start`, `lsp_diagnose`) since spawning child processes from
 * the renderer is restricted.
 */

export interface LspDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "info" | "hint";
  message: string;
  source?: string;
}

export interface LspHover {
  file: string;
  line: number;
  column: number;
  text: string;
}

export interface LspClient {
  start(workspaceRoot: string): Promise<void>;
  diagnostics(file: string): Promise<LspDiagnostic[]>;
  hover(file: string, line: number, column: number): Promise<LspHover | null>;
  shutdown(): Promise<void>;
}

const EXT_TO_SERVER: Record<string, string> = {
  ts: "typescript-language-server",
  tsx: "typescript-language-server",
  js: "typescript-language-server",
  jsx: "typescript-language-server",
  py: "pyright-langserver",
  go: "gopls",
  rs: "rust-analyzer",
  java: "jdtls",
  rb: "solargraph",
  php: "intelephense",
  cs: "omnisharp",
  swift: "sourcekit-lsp",
  kt: "kotlin-language-server"
};

export function serverForExt(ext: string): string | undefined {
  return EXT_TO_SERVER[ext.toLowerCase()];
}
