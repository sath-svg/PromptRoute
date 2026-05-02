import type { CompletionRequest, LLMClient, ProviderAdapter, StreamChunk } from "./types";

export class Registry implements LLMClient {
  private adapters = new Map<string, ProviderAdapter>();

  register(adapter: ProviderAdapter): this {
    this.adapters.set(adapter.name, adapter);
    return this;
  }

  providers(): string[] {
    return [...this.adapters.keys()];
  }

  async listModels(provider: string): Promise<string[]> {
    const a = this.adapters.get(provider);
    if (!a) throw new Error(`unknown provider ${provider}`);
    return a.models();
  }

  stream(req: CompletionRequest): AsyncIterable<StreamChunk> {
    const a = this.adapters.get(req.provider);
    if (!a) throw new Error(`unknown provider ${req.provider}`);
    return a.stream(req);
  }
}
