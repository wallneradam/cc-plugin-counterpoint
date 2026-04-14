---
description: Review and stress-test a concrete plan or proposal with Codex (critique mode)
argument-hint: '[plan or proposal to review]'
allowed-tools: mcp__counterpoint__*, Read, Glob, Grep
---

Invoke the counterpoint skill in **critique** mode via the `mcp__counterpoint__critique` MCP tool.

If $ARGUMENTS is provided, use it as the proposal to debate.

If $ARGUMENTS is empty, gather the current plan or proposal from the conversation context, then run the debate protocol from the counterpoint skill.

Do NOT delegate to `codex-rescue` or any other Codex agent — those bypass the persistent thread and lose the multi-round collaborative context.
