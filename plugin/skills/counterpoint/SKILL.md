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

# Counterpoint — Collaborative Review with Codex

You and Codex are **colleagues working toward the same goal**. Codex is an experienced teammate who helps you produce better plans — through constructive critique and collaborative thinking.

Two modes are available:

| Mode        | Purpose                                      | When to use                                         |
|-------------|----------------------------------------------|-----------------------------------------------------|
| `critique`  | Review a concrete proposal                   | You have a plan and want it stress-tested            |
| `consult`   | Think through a problem together              | You are unsure about the approach, need to explore   |

## When to use

- Before finalizing an implementation plan → `critique`
- When evaluating multiple design alternatives → `consult`
- During plan mode discussions → `critique` or `consult`
- Before committing to architectural decisions → `critique`
- When unsure about the best approach → `consult`
- When the user asks for a second opinion → `critique`

## When NOT to use

- Simple bug fixes with obvious solutions
- Mechanical changes (renaming, formatting)
- Single-line edits or trivial refactors
- When the user explicitly says: "skip counterpoint", "no debate", "just do it"

## Reasoning Effort

Control how deeply Codex thinks with `--effort`. Choose based on decision weight:

| Effort     | When to use                                                    |
|------------|----------------------------------------------------------------|
| `medium`   | Default. Most design decisions, API choices, data modeling     |
| `high`     | Architecture-level decisions, security-critical design, complex trade-offs |
| `xhigh`    | Foundational decisions that are very hard to reverse later     |
| `low`      | Quick sanity checks, minor design details                     |

Pass it as: `node "${CLAUDE_PLUGIN_ROOT}/scripts/counterpoint.mjs" critique --effort medium "<proposal>"`

If unsure, use `medium`. Only escalate to `high`/`xhigh` when the decision has long-term or wide-reaching consequences.

## Critique Protocol

Use when you have a concrete proposal to review. Run all rounds within a single invocation. Do NOT pause between rounds.

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

3. Read Codex's feedback — note both the strengths it confirmed and the concerns it raised.

### Round 2 — Refine

Codex remembers Round 1. Do NOT resend the full proposal — only send what changed.

1. Address the concerns from Round 1.
2. Incorporate valid alternatives or explain why they don't apply.
3. Fill any gaps Codex identified.
4. Send **only the delta** — what you changed and why:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/counterpoint.mjs" critique "Changes based on your feedback: [list concrete changes]. Kept [X] because [reason]. Open question: [if any]."
   ```

5. Read Codex's re-evaluation.

### Round 3 — Final (conditional)

Only run this round if Codex's Round 2 VERDICT is "weak" or if Codex raised material new concerns.

1. Address remaining issues.
2. Again, send only the delta:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/counterpoint.mjs" critique "Final adjustments: [changes]. Accepting [risk X] because [reason]."
   ```

### Synthesis

After the review, present the user with a clear synthesis:

1. **Original plan** — brief summary of starting point
2. **What Codex confirmed** — strengths and validated decisions
3. **Key concerns raised** — important issues Codex identified
4. **Changes made** — what the review improved
5. **Final plan** — the refined, review-tested version
6. **Accepted risks** — anything Codex flagged that you chose to keep, and why

## Consult Protocol

Use when you are unsure about the approach and want to think it through with Codex. Run 2-3 rounds.

### Round 1 — Ask

1. Describe the problem and your uncertainty:
   - **Context**: What are we building, what constraints exist?
   - **Uncertainty**: What specifically are you unsure about?
   - **Options you see**: What approaches have you considered so far?

2. Send to Codex:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/counterpoint.mjs" consult "<your question and context>"
   ```

3. Read Codex's analysis of options and recommendation.

### Round 2 — Narrow down

1. React to Codex's suggestions — which options resonate, which don't fit.
2. Ask follow-up questions on the most promising direction.
3. Send only what's new:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/counterpoint.mjs" consult "Leaning toward [X] because [reason]. But still unsure about [specific aspect]. What do you think about [follow-up]?"
   ```

### Round 3 — Confirm (optional)

If you've reached a decision, optionally validate it:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/counterpoint.mjs" consult "Decided on [approach]. Quick sanity check: anything I'm missing?"
```

### Synthesis

Present the user with:

1. **Problem** — what you were unsure about
2. **Options explored** — what you and Codex considered
3. **Decision** — what you settled on and why
4. **Key insight from Codex** — what helped most in the discussion

## Session Management — Codex remembers everything

The script maintains a **persistent Codex thread** within a Claude Code session. This has important implications:

**Within a debate (rounds 1-3):**
- Codex sees the full conversation history — every prior round in the current debate.
- In Round 2+, do NOT resend the full proposal. Only send what changed and why. Codex already has the original.
- Example Round 2 message: "Addressed your concerns: switched from SQLite to PostgreSQL for write concurrency. Kept Redis for presence. Added CRDT snapshotting strategy every 100 ops." — NOT the entire plan again.

**Across debates (multiple planning sessions):**
- The thread persists across all debates in a single Claude Code session.
- Codex accumulates context from all prior debates in the project.
- You can reference earlier debates: "Similar to what we discussed for the auth module, but applied to the payment flow."
- This means later debates are richer — Codex understands the project's evolving architecture.

**When to reset:**
- Only reset (`node "${CLAUDE_PLUGIN_ROOT}/scripts/counterpoint.mjs" reset`) when starting a completely unrelated project context or when the thread becomes too long/confused.
- Do NOT reset between debates within the same project — the accumulated context is valuable.

## Error Handling

If the script fails (Codex not installed, timeout, etc.):
- Report the error to the user
- Suggest running `npm install -g @openai/codex` if Codex is missing
- Continue with your plan but note it was not stress-tested
