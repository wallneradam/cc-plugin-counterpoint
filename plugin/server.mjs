#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  runSession,
  readThreadId,
  clearThreadId,
  isAutoConsult,
  setAutoConsult,
  VALID_EFFORTS,
} from "./lib/codex-session.mjs";

const effortSchema = z
  .enum([...VALID_EFFORTS])
  .describe("Codex reasoning effort. Default is Codex's own default.")
  .optional();

const COUNTERPOINT_NATURE = `
Counterpoint is an iterative, peer-to-peer collaborative review loop with Codex CLI — NOT a one-shot delegated rescue. Each round continues the same persistent Codex thread, so Codex remembers prior rounds and the conversation builds up. Use this when you want Codex as a thinking partner over multiple exchanges. Do NOT use the codex-rescue agent or any other Codex hand-off mechanism for counterpoint work — those create fresh, disconnected sessions every time.

The user does NOT see the raw response from these tools — MCP results are visible to the assistant only. After every call, summarize Codex's response in chat for the user, and only reference points that appear in your summary.`.trim();

const server = new McpServer(
  { name: "counterpoint", version: "2.1.0" },
  { capabilities: { tools: {} } }
);

server.registerTool(
  "critique",
  {
    title: "Critique a proposal with Codex",
    description: `Stress-test a concrete plan or proposal through collaborative review with Codex. Codex responds with STRENGTHS / CONCERNS / ALTERNATIVES / GAPS / VERDICT. In follow-up rounds, send only the delta (what changed) — Codex remembers the prior rounds.\n\n${COUNTERPOINT_NATURE}`,
    inputSchema: {
      proposal: z
        .string()
        .min(1)
        .describe("The plan, design, or proposal to critique. On round 2+, send only the delta."),
      effort: effortSchema,
    },
  },
  async ({ proposal, effort }) => {
    const { response } = await runSession("critique", proposal, effort);
    return {
      content: [
        { type: "text", text: response },
      ],
    };
  }
);

server.registerTool(
  "consult",
  {
    title: "Consult Codex on an uncertain problem",
    description: `Think through an open problem together with Codex. Codex responds with UNDERSTANDING / OPTIONS / RECOMMENDATION / OPEN QUESTIONS. In follow-up rounds, send only what's new — Codex remembers prior context.\n\n${COUNTERPOINT_NATURE}`,
    inputSchema: {
      question: z
        .string()
        .min(1)
        .describe("The question, uncertainty, or context to think through together."),
      effort: effortSchema,
    },
  },
  async ({ question, effort }) => {
    const { response } = await runSession("consult", question, effort);
    return {
      content: [
        { type: "text", text: response },
      ],
    };
  }
);

server.registerTool(
  "status",
  {
    title: "Counterpoint thread status",
    description: "Report the active Codex thread ID and whether auto-consult mode is on.",
    inputSchema: {},
  },
  async () => {
    const threadId = readThreadId();
    const autoConsult = isAutoConsult();
    const lines = [
      threadId ? `Active thread: ${threadId}` : "No active counterpoint thread.",
      `Auto-consult: ${autoConsult ? "ON" : "off"}`,
    ];
    return {
      content: [{ type: "text", text: lines.join("\n") }],
      structuredContent: { threadId, autoConsult },
    };
  }
);

server.registerTool(
  "consult_on",
  {
    title: "Enable auto-consult mode",
    description: "Turn on auto-consult mode for this session. From this point Claude is expected to consult Codex (via `critique` or `consult`) on every significant decision until `consult_off` is called. This is a user-toggled persistent flag — it does NOT trigger any consultations on its own; it instructs the assistant to consult.",
    inputSchema: {},
  },
  async () => {
    setAutoConsult(true);
    return {
      content: [{ type: "text", text: "Auto-consult mode: ON" }],
      structuredContent: { autoConsult: true },
    };
  }
);

server.registerTool(
  "consult_off",
  {
    title: "Disable auto-consult mode",
    description: "Turn off auto-consult mode for this session. Counterpoint reverts to fully manual — only invoked when the user explicitly asks.",
    inputSchema: {},
  },
  async () => {
    setAutoConsult(false);
    return {
      content: [{ type: "text", text: "Auto-consult mode: off" }],
      structuredContent: { autoConsult: false },
    };
  }
);

server.registerTool(
  "reset",
  {
    title: "Reset the counterpoint thread",
    description: "Clear the persistent Codex thread so the next critique/consult starts fresh. Use only when the current thread is stale or wrong project context.",
    inputSchema: {},
  },
  async () => {
    clearThreadId();
    return {
      content: [{ type: "text", text: "Counterpoint thread cleared." }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
