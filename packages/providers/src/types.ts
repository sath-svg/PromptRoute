export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolDescriptor {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
}

export interface ToolResult {
  id: string;
  output: string;
  error: boolean;
}

export interface CompletionRequest {
  provider: string;
  model: string;
  messages: Message[];
  tools?: ToolDescriptor[];
  temperature?: number;
  maxTokens?: number;
}

export type StreamChunk =
  | { kind: "text"; delta: string }
  | { kind: "tool_call"; call: ToolCall }
  | { kind: "done"; usage?: { input: number; output: number } };

export interface ProviderAdapter {
  name: string;
  models: () => Promise<string[]>;
  stream(req: CompletionRequest): AsyncIterable<StreamChunk>;
}

export interface LLMClient {
  stream(req: CompletionRequest): AsyncIterable<StreamChunk>;
  listModels(provider: string): Promise<string[]>;
  providers(): string[];
}
