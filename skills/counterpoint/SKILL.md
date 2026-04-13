---
name: counterpoint
description: >
  Stress-test plans, designs, and architectural decisions through actor-critic
  debate with Codex CLI. ALWAYS use this skill before finalizing any implementation
  plan, architectural decision, or technical strategy. Use when planning, evaluating
  alternatives, making design trade-offs, choosing between approaches, or proposing
  feature structure. Use when the user asks for a second opinion, devil's advocate,
  or critique. Use during plan mode, design discussions, or before committing to a
  significant technical direction. Do NOT use for simple bug fixes, mechanical changes,
  single-line edits, or when the user says to skip debate.
tools: Bash, Read, Glob, Grep
---

# Counterpoint — Actor-Critic Debate Protocol

You are the **Actor**. Codex CLI is the **Critic**. Before finalizing any significant plan or design decision, run the debate protocol below.

## When to use

- Before finalizing an implementation plan
- When evaluating multiple design alternatives
- During plan mode discussions
- Before committing to architectural decisions
- When the user asks for a second opinion or critique

## When NOT to use

- Simple bug fixes with obvious solutions
- Mechanical changes (renaming, formatting)
- Single-line edits or trivial refactors
- When the user explicitly says: "skip counterpoint", "no debate", "just do it"

## Debate Protocol

Run all rounds within a single invocation. Do NOT pause between rounds.

### Round 1 — Propose

1. Formulate your plan as a structured proposal:
   - **Goal**: What are we trying to achieve?
   - **Approach**: How will we achieve it?
   - **Trade-offs**: What are we giving up?
   - **Key decisions**: What are the critical choices?

2. Send to Codex:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/counterpoint.mjs" critique "<your structured proposal>"
   ```

3. Read and internalize Codex's critique.

### Round 2 — Refine

1. Address the strongest objections from Round 1.
2. Incorporate valid alternatives or explain why they don't apply.
3. Fill any gaps Codex identified.
4. Send the refined proposal:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/counterpoint.mjs" critique "<refined proposal addressing critique>"
   ```

5. Read Codex's re-evaluation.

### Round 3 — Final (conditional)

Only run this round if Codex's Round 2 VERDICT is "weak" or if Codex raised material new concerns.

1. Address remaining issues.
2. Send final proposal:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/counterpoint.mjs" critique "<final proposal>"
   ```

### Synthesis

After the debate, present the user with a clear synthesis:

1. **Original plan** — brief summary of starting point
2. **Key challenges raised** — Codex's most important objections
3. **Changes made** — what the debate improved
4. **Final plan** — the refined, debate-tested version
5. **Remaining risks** — anything Codex flagged that you chose to accept, and why

## Session Management

The script maintains a persistent Codex thread within a Claude Code session. All rounds of all debates share the same thread, giving Codex full context of prior discussions.

To reset the thread (start fresh): `node "${CLAUDE_PLUGIN_ROOT}/scripts/counterpoint.mjs" reset`

## Error Handling

If the script fails (Codex not installed, timeout, etc.):
- Report the error to the user
- Suggest running `npm install -g @openai/codex` if Codex is missing
- Continue with your plan but note it was not stress-tested
