---
description: Enable auto-consult mode — consult Codex on every significant decision
allowed-tools: mcp__counterpoint__consult_on, mcp__counterpoint__status, mcp__counterpoint__consult, mcp__counterpoint__critique
---

Enable auto-consult by calling the `mcp__counterpoint__consult_on` MCP tool.

**Auto-consult mode is now ACTIVE.** From this point forward, until the user runs `/consult_off`, the following rules apply for the rest of this conversation:

1. **Before every implementation plan, design decision, or significant code change**, call `mcp__counterpoint__consult` with your proposed approach.
2. **Before every architectural choice or non-trivial trade-off**, call `mcp__counterpoint__critique` with the concrete proposal.
3. Exceptions (no consultation needed):
   - Trivial single-line edits (typos, formatting, mechanical renames)
   - Direct execution of an already-consulted plan
   - When the user explicitly says "skip" or "just do it" for a specific action
4. When in doubt, consult. It is better to over-consult than to miss something.
5. Keep each consultation focused — send the key decision and minimal context, not every detail. Multi-round is the point; build up over rounds, don't front-load.
6. **All other counterpoint rules still apply**: summarize Codex's response in chat after every round (the user does not see raw MCP output), defend your position against generic/theoretical points, strip out unrequested workstream/phase framing, and pursue multi-round dialogue when there is real disagreement. See the `counterpoint` skill for the full protocol.
7. Do NOT delegate to `codex-rescue` or any other Codex agent — those bypass the persistent thread.

This is a PERSISTENT instruction for this session. Check the current state at any time with `mcp__counterpoint__status`.
