import type { LLMClient, Message, ToolCall, ToolResult } from "@promptroute/providers";
import type { RouteDecision, RouterModel } from "@promptroute/router";
import { route } from "@promptroute/router";
import type { ToolRegistry } from "./tools";

export interface SessionOptions {
  id: string;
  router: RouterModel;
  client: LLMClient;
  tools: ToolRegistry;
  systemPrompt?: string;
  maxSteps?: number;
}

export type SessionEvent =
  | { type: "route"; decision: RouteDecision }
  | { type: "delta"; text: string }
  | { type: "tool_call"; call: ToolCall }
  | { type: "tool_result"; result: ToolResult }
  | { type: "done"; messages: Message[] }
  | { type: "error"; error: Error };

export class Session {
  readonly id: string;
  private messages: Message[] = [];
  private cancelled = false;

  constructor(private opts: SessionOptions) {
    this.id = opts.id;
    if (opts.systemPrompt) {
      this.messages.push({ role: "system", content: opts.systemPrompt });
    }
  }

  cancel() {
    this.cancelled = true;
  }

  getMessages(): readonly Message[] {
    return this.messages;
  }

  async *run(prompt: string): AsyncGenerator<SessionEvent> {
    this.messages.push({ role: "user", content: prompt });

    const decision = route(this.opts.router, { prompt });
    yield { type: "route", decision };

    const max = this.opts.maxSteps ?? 12;
    for (let step = 0; step < max; step++) {
      if (this.cancelled) return;

      const stream = this.opts.client.stream({
        provider: decision.provider,
        model: decision.model,
        messages: this.messages,
        tools: this.opts.tools.descriptors()
      });

      let assistantText = "";
      const toolCalls: ToolCall[] = [];

      for await (const chunk of stream) {
        if (this.cancelled) return;
        if (chunk.kind === "text") {
          assistantText += chunk.delta;
          yield { type: "delta", text: chunk.delta };
        } else if (chunk.kind === "tool_call") {
          toolCalls.push(chunk.call);
          yield { type: "tool_call", call: chunk.call };
        }
      }

      this.messages.push({
        role: "assistant",
        content: assistantText,
        toolCalls: toolCalls.length ? toolCalls : undefined
      });

      if (toolCalls.length === 0) {
        yield { type: "done", messages: [...this.messages] };
        return;
      }

      for (const call of toolCalls) {
        const result = await this.opts.tools.invoke(call);
        this.messages.push({ role: "tool", content: result.output, toolCallId: call.id });
        yield { type: "tool_result", result };
      }
    }

    yield {
      type: "error",
      error: new Error(`max steps (${max}) exceeded`)
    };
  }
}
