---
description: Review and stress-test a concrete plan or proposal with Codex (critique mode)
argument-hint: '[plan or proposal to review]'
allowed-tools: Bash(node:*), Read, Glob, Grep
---

Invoke the counterpoint skill to run a structured actor-critic debate.

If $ARGUMENTS is provided, use it as the proposal to debate.

If $ARGUMENTS is empty, gather the current plan or proposal from the conversation context, then run the debate protocol from the counterpoint skill.
