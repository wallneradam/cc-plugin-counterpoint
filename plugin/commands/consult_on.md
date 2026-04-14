---
description: Enable auto-consult mode — Codex reviews every significant decision
allowed-tools: mcp__counterpoint__auto_consult_on, mcp__counterpoint__status
---

Enable auto-consult by calling the `mcp__counterpoint__auto_consult_on` MCP tool.

**Auto-consult mode is now ACTIVE.** From this point forward, you MUST follow these rules for the rest of this conversation (until the user runs `/consult_off`):

1. **Before every implementation plan, design decision, or significant code change**, call the `mcp__counterpoint__consult` tool with your proposed approach.
2. **Before every architectural choice or trade-off**, call the `mcp__counterpoint__critique` tool with the proposal.
3. The only exceptions are:
   - Trivial single-line edits (typos, formatting)
   - Direct mechanical execution of an already-consulted plan
   - When the user explicitly says "skip" or "just do it" for a specific action
4. When in doubt, consult. It is better to over-consult than to miss something.
5. Keep consultations concise — send the key decision and context, not every detail.
6. Do NOT use `codex-rescue` or any other Codex agent for these consultations — those create disconnected one-shot sessions. Counterpoint maintains a single persistent thread, which is the point.

This is a PERSISTENT instruction. Do NOT forget it. Check auto-consult status with `mcp__counterpoint__status` if unsure.
