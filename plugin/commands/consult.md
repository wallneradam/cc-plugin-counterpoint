---
description: Think through an uncertain problem together with Codex
argument-hint: '[question or problem to explore]'
allowed-tools: mcp__counterpoint__*, Read, Glob, Grep
---

Invoke the counterpoint skill in **consult** mode — use this when you are unsure about an approach and want to think it through collaboratively with Codex via the `mcp__counterpoint__consult` tool.

If $ARGUMENTS is provided, use it as the question to explore.

If $ARGUMENTS is empty, gather the current problem or uncertainty from the conversation context, then run the consult protocol from the counterpoint skill.

Do NOT delegate to `codex-rescue` or any other Codex agent — those bypass the persistent thread and lose the multi-round collaborative context.
