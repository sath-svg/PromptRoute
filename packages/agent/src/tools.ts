import type { ToolCall, ToolResult, ToolDescriptor } from "@promptroute/providers";

export type ToolHandler = (args: unknown, ctx: ToolContext) => Promise<string>;

export interface ToolContext {
  cwd: string;
  signal?: AbortSignal;
}

export interface RegisteredTool {
  descriptor: ToolDescriptor;
  handler: ToolHandler;
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();
  constructor(private ctx: ToolContext) {}

  register(tool: RegisteredTool): this {
    this.tools.set(tool.descriptor.name, tool);
    return this;
  }

  descriptors(): ToolDescriptor[] {
    return [...this.tools.values()].map((t) => t.descriptor);
  }

  async invoke(call: ToolCall): Promise<ToolResult> {
    const t = this.tools.get(call.name);
    if (!t) {
      return { id: call.id, output: `error: unknown tool ${call.name}`, error: true };
    }
    try {
      const output = await t.handler(call.args, this.ctx);
      return { id: call.id, output, error: false };
    } catch (e) {
      return { id: call.id, output: String((e as Error).message ?? e), error: true };
    }
  }
}

export const READ_TOOL: RegisteredTool = {
  descriptor: {
    name: "read",
    description: "Read a file from the workspace.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"]
    }
  },
  handler: async (_args, _ctx) => {
    throw new Error("read tool: wire to platform fs (Tauri or node)");
  }
};

export const EDIT_TOOL: RegisteredTool = {
  descriptor: {
    name: "edit",
    description: "Apply a search/replace edit to a file.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        find: { type: "string" },
        replace: { type: "string" }
      },
      required: ["path", "find", "replace"]
    }
  },
  handler: async (_args, _ctx) => {
    throw new Error("edit tool: wire to platform fs (Tauri or node)");
  }
};

export const BASH_TOOL: RegisteredTool = {
  descriptor: {
    name: "bash",
    description: "Run a shell command.",
    parameters: {
      type: "object",
      properties: { cmd: { type: "string" } },
      required: ["cmd"]
    }
  },
  handler: async (_args, _ctx) => {
    throw new Error("bash tool: wire to platform shell (Tauri shell plugin)");
  }
};
