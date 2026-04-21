#!/usr/bin/env node

const additionalContext = [
  "Counterpoint skill is available in this session.",
  "",
  "When to invoke (do NOT wait for the user to ask):",
  "- Before finalizing an implementation plan",
  "- When facing a non-trivial design trade-off",
  "- Before committing to an architectural decision",
  "- Before a significant refactor or a decision with meaningful consequences",
  "- When evaluating multiple design alternatives",
  "→ call `mcp__counterpoint__critique` (for concrete proposals) or `mcp__counterpoint__consult` (for open problems).",
  "",
  "Skip for: trivial single-line edits, mechanical renames, obvious bug fixes, or when the user says \"just do it.\"",
  "",
  "When Codex responds, two non-negotiable rules:",
  "1. Codex's output is a set of hypotheses to validate in your context — not a verdict to apply. It has no access to the codebase; you do. Reject points that are generic, theoretical, or based on a misread of the proposal.",
  "2. The user's original ask defines the scope. If Codex reframes the work into workstreams (A/B/C), phases, sprints, or research plans the user didn't ask for, strip that framing out before synthesizing. Extract the technical substance; discard the scaffolding.",
].join("\n");

const output = {
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext,
  },
};

process.stdout.write(JSON.stringify(output));
